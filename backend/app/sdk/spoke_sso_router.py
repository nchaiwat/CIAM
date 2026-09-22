"""
Spoke Application Single Sign-On (SSO) Router Template
Standardized OIDC / PKCE Single Sign-On Endpoint Handlers with Break-Glass Fallback.
Compatible with FastAPI spoke applications (IRM, QMS, QOL, etc.).
"""

from datetime import datetime, timezone
import logging
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.group import Group
from app.services.ciam_sso_client import CiamSsoClient
from app.services.log_service import record_transaction_log
from app.utils.security import create_access_token, create_refresh_token
from app.config import get_settings

logger = logging.getLogger("spoke.sso")
router = APIRouter(prefix="/api/auth/sso", tags=["Single Sign-On (CIAM SSO)"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class SsoConfigResponse(BaseModel):
    sso_enabled: bool
    ciam_base_url: str
    client_id: str
    ad_gateway_url: str
    fallback_available: bool = True


class SsoAuthorizeUrlRequest(BaseModel):
    redirect_uri: str
    state: Optional[str] = None


class SsoAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    code_verifier: str
    state: str


class SsoCallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str
    state: Optional[str] = None


class SsoTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class SsoBreakGlassToggleRequest(BaseModel):
    sso_enabled: bool
    reason: Optional[str] = "Manual break-glass toggle by administrator"


# ──────────────────────────────────────────────────────────────────────────────
# Helper: Get Initialized CIAM SSO Client
# ──────────────────────────────────────────────────────────────────────────────

def get_sso_client() -> CiamSsoClient:
    settings = get_settings()
    return CiamSsoClient(
        ciam_base_url=getattr(settings, "CIAM_BASE_URL", "http://127.0.0.1:8001"),
        client_id=getattr(settings, "CIAM_CLIENT_ID", "irm-spoke-client"),
        client_secret=getattr(settings, "CIAM_CLIENT_SECRET", "sec_irm_oauth_secret_2026"),
        ad_gateway_url=getattr(settings, "CIAM_AD_GATEWAY_URL", "http://192.168.12.11:3100"),
    )


# In-memory Break-Glass override state (takes precedence over settings when changed at runtime)
_runtime_sso_enabled_override: Optional[bool] = None


def is_sso_active() -> bool:
    global _runtime_sso_enabled_override
    if _runtime_sso_enabled_override is not None:
        return _runtime_sso_enabled_override
    settings = get_settings()
    return getattr(settings, "CIAM_SSO_ENABLED", True)


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/config", response_model=SsoConfigResponse)
async def get_sso_config():
    """Returns SSO runtime configuration, CIAM portal URL, and Break-Glass status."""
    settings = get_settings()
    sso_client = get_sso_client()
    return SsoConfigResponse(
        sso_enabled=is_sso_active(),
        ciam_base_url=sso_client.ciam_base_url,
        client_id=sso_client.client_id,
        ad_gateway_url=sso_client.ad_gateway_url,
        fallback_available=True,
    )


@router.post("/authorize-url", response_model=SsoAuthorizeUrlResponse)
async def generate_authorize_url(req: SsoAuthorizeUrlRequest):
    """
    Generates cryptographically random PKCE code_verifier and code_challenge,
    and constructs the Central IAM authorization redirect URL.
    """
    if not is_sso_active():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Central IAM SSO is currently disabled (Break-Glass Mode Active). Please use local credentials.",
        )

    sso_client = get_sso_client()
    code_verifier, code_challenge = sso_client.generate_pkce()
    state = req.state or f"state_{int(datetime.now(timezone.utc).timestamp())}"

    authorize_url = sso_client.get_authorize_url(
        redirect_uri=req.redirect_uri,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256",
        scope="openid profile email",
    )

    return SsoAuthorizeUrlResponse(
        authorize_url=authorize_url,
        code_verifier=code_verifier,
        state=state,
    )


@router.post("/callback", response_model=SsoTokenResponse)
async def handle_sso_callback(
    req: SsoCallbackRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Exchanges One-Time Authorization Code for RS256 ID Token via Backend-to-Backend channel.
    Cryptographically verifies signature via Central IAM JWKS, matches or auto-links the user,
    and returns an application access token.
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    sso_client = get_sso_client()

    # Step 1: Exchange code for tokens
    try:
        tokens = sso_client.exchange_code_for_tokens(
            code=req.code,
            redirect_uri=req.redirect_uri,
            code_verifier=req.code_verifier,
        )
    except Exception as exc:
        logger.error("SSO Code exchange failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange SSO code: {str(exc)}",
        )

    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Central IAM did not return an ID Token",
        )

    # Step 2: Cryptographically verify ID Token signature using JWKS
    try:
        claims = sso_client.verify_id_token(id_token)
    except Exception as exc:
        logger.error("SSO ID Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Cryptographic signature verification failed: {str(exc)}",
        )

    username = claims.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing subject (sub) claim",
        )

    # Step 3: Match user in database
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Try matching by email
        email = claims.get("email")
        if email:
            stmt_email = select(User).where(User.email == email)
            res_email = await db.execute(stmt_email)
            user = res_email.scalar_one_or_none()

    if not user:
        # Auto-provision user in spoke application if permitted
        logger.info("Auto-provisioning user from Central IAM: %s", username)
        # Find default group (e.g. PU User or first group)
        grp_stmt = select(Group).limit(1)
        grp_res = await db.execute(grp_stmt)
        default_grp = grp_res.scalar_one_or_none()

        from app.utils.security import hash_password
        user = User(
            username=username,
            password_hash=hash_password("SSO_MANAGED_ACCOUNT"),
            full_name=claims.get("name") or username,
            email=claims.get("email") or f"{username.lower()}@windowasia.com",
            department=claims.get("department") or "Purchasing",
            group_id=default_grp.id if default_grp else None,
            use_ad_auth=True,
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Step 4: Verify active state
    if not user.is_active:
        logger.warning("SSO Login rejected: user '%s' is deactivated", username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated in this system by IT Governance.",
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    # Step 5: Generate Spoke Application JWT Access & Refresh Tokens
    access_token = create_access_token(subject=user.username)
    refresh_token = create_refresh_token(subject=user.username)

    # Record audit log
    try:
        await record_transaction_log(
            category="user_auth",
            action="login_sso",
            status="success",
            message=f"เข้าสู่ระบบผ่าน Central IAM Single Sign-On (OIDC/PKCE) สำเร็จ: ผู้ใช้ '{user.username}'",
            details={
                "username": user.username,
                "ip": client_ip,
                "ciam_issuer": claims.get("iss"),
                "auth_method": "OIDC_PKCE_S256",
            },
            triggered_by=f"user:{user.username}",
        )
    except Exception as log_err:
        logger.warning("Failed to record SSO transaction log: %s", log_err)

    return SsoTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "department": user.department,
            "group_id": user.group_id,
        },
    )


@router.post("/break-glass-toggle")
async def toggle_break_glass_mode(req: SsoBreakGlassToggleRequest, request: Request):
    """
    Emergency Break-Glass Control:
    Allows administrators to immediately toggle Central IAM SSO enforcement ON or OFF
    in the event of a CIAM server outage or network partition.
    """
    global _runtime_sso_enabled_override
    _runtime_sso_enabled_override = req.sso_enabled

    state_desc = "ENABLED (Normal SSO Mode)" if req.sso_enabled else "DISABLED (Break-Glass Fallback Active)"
    logger.critical("🚨 BREAK-GLASS TOGGLE TRIGGERED: SSO is now %s. Reason: %s", state_desc, req.reason)

    try:
        await record_transaction_log(
            category="security_admin",
            action="break_glass_toggle",
            status="success",
            message=f"สลับสถานะระบบ Break-Glass SSO: {state_desc}",
            details={"sso_enabled": req.sso_enabled, "reason": req.reason},
            triggered_by="system:emergency_admin",
        )
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "sso_enabled": is_sso_active(),
        "mode": "CENTRAL_IAM_SSO" if is_sso_active() else "BREAK_GLASS_AD_GATEWAY_FALLBACK",
        "message": f"SSO status successfully switched to: {state_desc}",
    }
