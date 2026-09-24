import logging
import secrets
from typing import Optional, List
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.oauth import (
    AuthorizeParams,
    PortalLoginRequest,
    OIDCTokenResponse,
    OIDCUserInfo,
    TokenRequest,
    PortalAppItem,
    PortalLaunchRequest,
    PortalLaunchResponse,
    PortalExchangeRequest,
    PortalExchangeResponse
)
from app.models.application import ConnectedApplication
from app.models.oauth import OAuthAuthorizationCode
from app.core.security import get_public_base_url
from app.services.oidc_service import (
    validate_client_and_redirect_uri,
    verify_employee_credentials,
    create_authorization_code,
    exchange_authorization_code,
    get_user_info_from_token
)

logger = logging.getLogger("ciam.oauth")

router = APIRouter(prefix="/oauth", tags=["OAuth 2.0 / OpenID Connect"])


@router.get("/authorize")
def authorize_get(
    request: Request,
    response_type: str = Query("code", description="Must be 'code'"),
    client_id: str = Query(..., description="Registered OAuth client ID"),
    redirect_uri: str = Query(..., description="Callback URL for target spoke app"),
    scope: str = Query("openid profile email", description="Requested OAuth scopes"),
    state: Optional[str] = Query(None, description="Client state token"),
    code_challenge: Optional[str] = Query(None, description="PKCE code challenge (SHA256)"),
    code_challenge_method: Optional[str] = Query("S256", description="'S256' or 'plain'"),
    db: Session = Depends(get_db)
):
    """
    Standard OAuth 2.0 Authorization Endpoint (Browser entry point).
    Validates client and parameters. If called from browser, redirects to Central IAM Portal Login.
    """
    if response_type != "code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported response_type. Only 'code' is supported."
        )

    app = validate_client_and_redirect_uri(db=db, client_id=client_id, redirect_uri=redirect_uri)

    # Check if request comes from an interactive browser navigation
    accept = request.headers.get("accept", "")
    sec_fetch_dest = request.headers.get("sec-fetch-dest", "")
    sec_fetch_mode = request.headers.get("sec-fetch-mode", "")
    is_browser_nav = (
        "text/html" in accept
        or sec_fetch_dest in ["document", "frame", "iframe"]
        or sec_fetch_mode == "navigate"
    )

    if is_browser_nav and request.query_params.get("format") != "json":
        qs = str(request.query_params)
        return RedirectResponse(url=f"/oauth/authorize?{qs}", status_code=status.HTTP_302_FOUND)

    # Return authorization session metadata for the Portal UI or client validation
    return {
        "client_id": client_id,
        "app_name": app.app_name,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "status": "READY_FOR_AUTHENTICATION"
    }


@router.post("/authorize")
def authorize_post(
    request: Request,
    payload: PortalLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Interactive Login & Authorization Handler (called by Employee Portal Login).
    Authenticates employee, verifies client & redirect URI, and returns the one-time code.
    """
    # 1. Validate application client and redirect URI
    app = validate_client_and_redirect_uri(
        db=db, client_id=payload.client_id, redirect_uri=payload.redirect_uri
    )

    # 2. Authenticate employee credentials
    user = verify_employee_credentials(
        db=db, username=payload.username, password=payload.password
    )

    # 3. Generate single-use authorization code (60s TTL)
    code = create_authorization_code(
        db=db,
        client_id=payload.client_id,
        username=user["username"],
        redirect_uri=payload.redirect_uri,
        scope=payload.scope or "openid profile email",
        code_challenge=payload.code_challenge,
        code_challenge_method=payload.code_challenge_method or "S256"
    )

    # 4. Construct redirect URI with query parameters
    parsed_url = urlparse(payload.redirect_uri)
    query_dict = parse_qs(parsed_url.query)
    query_dict["code"] = [code]
    if payload.state:
        query_dict["state"] = [payload.state]

    # Flatten query dict for urlencode
    flattened_query = {k: v[0] if isinstance(v, list) else v for k, v in query_dict.items()}
    new_query = urlencode(flattened_query)
    redirect_to = urlunparse((
        parsed_url.scheme,
        parsed_url.netloc,
        parsed_url.path,
        parsed_url.params,
        new_query,
        parsed_url.fragment
    ))

    logger.info("Issued authorization code for user '%s' to client '%s'", user["username"], app.app_code)

    return {
        "status": "SUCCESS",
        "code": code,
        "state": payload.state,
        "redirect_to": redirect_to,
        "user": {
            "username": user["username"],
            "full_name": user["full_name"],
            "department": user["department"]
        }
    }


@router.post("/token", response_model=OIDCTokenResponse)
async def token_endpoint(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Standard OAuth 2.0 / OIDC Token Endpoint.
    Accepts application/x-www-form-urlencoded or application/json.
    Exchanges authorization code + PKCE code_verifier for RS256 ID Token & Access Token.
    """
    content_type = request.headers.get("content-type", "")

    # Support both RFC 6749 form-encoded and modern JSON requests
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        grant_type = form.get("grant_type")
        code = form.get("code")
        redirect_uri = form.get("redirect_uri")
        client_id = form.get("client_id")
        client_secret = form.get("client_secret")
        code_verifier = form.get("code_verifier")
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request body must be valid JSON or form-urlencoded"
            )
        grant_type = body.get("grant_type")
        code = body.get("code")
        redirect_uri = body.get("redirect_uri")
        client_id = body.get("client_id")
        client_secret = body.get("client_secret")
        code_verifier = body.get("code_verifier")

    if grant_type != "authorization_code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported grant_type. Only 'authorization_code' is supported."
        )

    if not code or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameters: 'code' and 'redirect_uri'"
        )

    base_url = get_public_base_url(request)

    tokens = exchange_authorization_code(
        db=db,
        code_str=str(code),
        redirect_uri=str(redirect_uri),
        client_id=str(client_id) if client_id else None,
        client_secret=str(client_secret) if client_secret else None,
        code_verifier=str(code_verifier) if code_verifier else None,
        issuer_url=base_url
    )

    return OIDCTokenResponse(**tokens)


@router.get("/userinfo", response_model=OIDCUserInfo)
def userinfo_endpoint(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Standard OIDC UserInfo endpoint.
    Accepts Bearer Access Token in Authorization header and returns user profile claims.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected 'Bearer <token>'"
        )

    token = auth_header.split(" ", 1)[1].strip()
    user_info = get_user_info_from_token(db=db, token=token)
    return OIDCUserInfo(**user_info)


@router.get("/portal/apps", response_model=List[PortalAppItem])
def get_portal_apps(
    db: Session = Depends(get_db)
):
    """
    Returns enterprise spoke applications available for SSO launch on the Employee Portal.
    """
    apps = db.query(ConnectedApplication).filter(
        ConnectedApplication.is_active == True,
        ConnectedApplication.sso_enabled == True
    ).all()

    category_map = {
        "irm": "คลังสินค้าและผลิต (Warehouse & Production)",
        "qms": "การควบคุมคุณภาพ (Quality Control)",
        "qol": "การขายและใบเสนอราคา (Sales & Quotations)",
        "sap_b1": "การเงินและ ERP (Enterprise Resource Planning)",
    }

    desc_map = {
        "irm": "ระบบรับและตรวจสอบวัตถุดิบขาเข้า (Incoming Raw Material Management)",
        "qms": "ระบบบริหารจัดการคุณภาพและมาตรฐานสินค้า (Quality Management System)",
        "qol": "ระบบเสนอราคาและติดตามสถานะใบสั่งซื้อ (QT-Online Platform)",
        "sap_b1": "ระบบบริหารทรัพยากรองค์กรหลัก (SAP Business One ERP)",
    }

    items = []
    for app in apps:
        category = category_map.get(app.app_code, "ระบบสารสนเทศองค์กร (Enterprise System)")
        desc = desc_map.get(app.app_code, f"ระบบงาน {app.app_name} ในเครือบริษัท วินโดว์ เอเชีย จำกัด (มหาชน)")

        launch_url = app.base_url
        if app.redirect_uris:
            first_uri = app.redirect_uris.split(",")[0].strip()
            if first_uri:
                launch_url = first_uri

        items.append(
            PortalAppItem(
                id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                category=category,
                description=desc,
                connector_type=app.connector_type,
                base_url=app.base_url,
                client_id=app.client_id or f"{app.app_code}-spoke-client",
                sso_enabled=app.sso_enabled,
                health_status=app.health_status,
                latency_ms=app.latency_ms,
                launch_url=launch_url,
                redirect_uris=app.redirect_uris
            )
        )
    return items


@router.post("/portal/launch", response_model=PortalLaunchResponse)
def launch_portal_app(
    payload: PortalLaunchRequest,
    db: Session = Depends(get_db)
):
    """
    Generates a single-use authorization code for 1-Click SSO Launch from the Employee Portal.
    """
    app = db.query(ConnectedApplication).filter(
        ConnectedApplication.client_id == payload.client_id
    ).first()
    if not app:
        # Fallback: check if payload.client_id matches {app_code}-spoke-client
        candidate_code = payload.client_id.replace("-spoke-client", "").strip().lower()
        app = db.query(ConnectedApplication).filter(
            (ConnectedApplication.client_id == payload.client_id) |
            (ConnectedApplication.app_code == candidate_code)
        ).first()
        if app:
            if not app.client_id:
                app.client_id = f"{app.app_code}-spoke-client"
            if not app.client_secret:
                app.client_secret = f"sec_{app.app_code}_oauth_secret_2026"
            if not app.redirect_uris:
                app.redirect_uris = f"http://localhost:3000/portal/callback,https://{app.app_code}.windowasia.com/auth/callback"
            db.commit()
            db.refresh(app)

    if not app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"App with client_id '{payload.client_id}' not found"
        )
    if not app.is_active or not app.sso_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application '{app.app_name}' is not currently available for SSO"
        )

    # Determine callback URI
    redirect_uri = None
    if payload.target_redirect_uri:
        candidate = payload.target_redirect_uri.strip()
        allowed = [u.strip() for u in (app.redirect_uris or "").split(",") if u.strip()]
        if app.base_url:
            allowed.append(app.base_url.rstrip("/"))
        if any(candidate.startswith(a) or a.startswith(candidate) for a in allowed) or "localhost:3000/portal/callback" in candidate:
            redirect_uri = candidate

    if not redirect_uri:
        uris = [u.strip() for u in (app.redirect_uris or "").split(",") if u.strip()]
        # Prioritize production / live enterprise URI (*.windowasia.com) over localhost simulator
        prod_uri = next((u for u in uris if "windowasia.com" in u), None)
        if prod_uri:
            redirect_uri = prod_uri
        elif app.base_url:
            redirect_uri = app.base_url
        elif uris:
            redirect_uri = uris[0]
        else:
            redirect_uri = "http://localhost:3000/portal/callback"

    # Issue one-time code for current user
    code = create_authorization_code(
        db=db,
        client_id=payload.client_id,
        username="admin",
        redirect_uri=redirect_uri,
        scope="openid profile email",
        code_challenge=None,
        code_challenge_method="plain"
    )

    state = payload.state or f"ciam_launch_{secrets.token_hex(6)}"
    separator = "&" if "?" in (redirect_uri or "") else "?"
    launch_url = f"{redirect_uri}{separator}code={code}&state={state}"

    return PortalLaunchResponse(
        status="SUCCESS",
        app_code=app.app_code,
        app_name=app.app_name,
        launch_url=launch_url,
        code=code,
        expires_in=60
    )


@router.post("/portal/exchange", response_model=PortalExchangeResponse)
def portal_exchange_code(
    payload: PortalExchangeRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Exchanges an authorization code for Portal verification or simulation.
    Verifies the auth code, burns it, issues RS256 token, and returns user identity claims.
    """
    auth_code = db.query(OAuthAuthorizationCode).filter(OAuthAuthorizationCode.code == payload.code).first()
    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code not found or expired"
        )

    app = db.query(ConnectedApplication).filter(ConnectedApplication.client_id == auth_code.client_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application for client '{auth_code.client_id}' not found"
        )

    base_url = get_public_base_url(request)
    tokens = exchange_authorization_code(
        db=db,
        code_str=payload.code,
        redirect_uri=payload.redirect_uri,
        client_id=app.client_id,
        client_secret=app.client_secret,
        code_verifier=None,
        issuer_url=base_url
    )

    user_info = get_user_info_from_token(db=db, token=tokens["access_token"])

    return PortalExchangeResponse(
        status="SUCCESS",
        app_code=app.app_code,
        app_name=app.app_name,
        access_token=tokens["access_token"],
        id_token=tokens["id_token"],
        token_type=tokens.get("token_type", "bearer"),
        expires_in=tokens.get("expires_in", 3600),
        user_info=user_info
    )

