import base64
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.oidc_keys import sign_rs256_token, verify_rs256_token
from app.core.security import secure_compare, verify_password
from app.models.application import ConnectedApplication
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.oauth import OAuthAuthorizationCode
from app.models.user import AdminUser

logger = logging.getLogger("ciam.oidc")


def validate_client_and_redirect_uri(
    db: Session, client_id: str, redirect_uri: str
) -> ConnectedApplication:
    """Validate client existence, active status, SSO flag, and redirect URI whitelist."""
    app = db.query(ConnectedApplication).filter(ConnectedApplication.client_id == client_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown client_id '{client_id}'"
        )
    if not app.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application '{app.app_name}' is currently inactive"
        )
    if not app.sso_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SSO login is disabled for application '{app.app_name}'"
        )

    # Validate redirect URI
    allowed_uris: List[str] = []
    if app.redirect_uris:
        allowed_uris = [u.strip() for u in app.redirect_uris.split(",") if u.strip()]

    # Also allow base_url if configured
    if app.base_url:
        allowed_uris.append(app.base_url.rstrip("/"))

    # Check match (exact or prefix match if configured)
    is_valid_uri = any(
        redirect_uri == allowed or redirect_uri.rstrip("/") == allowed.rstrip("/")
        for allowed in allowed_uris
    )

    if not is_valid_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Redirect URI '{redirect_uri}' is not authorized for client '{client_id}'"
        )

    return app


def verify_employee_credentials(
    db: Session, username: str, password: str
) -> Dict[str, Any]:
    """
    Authenticate employee against MasterIdentity and AD Gateway.
    Falls back to AdminUser or development simulation when AD sync is disabled.
    """
    # 1. Check if it's an AdminUser logging in
    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin and verify_password(password, admin.hashed_password):
        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        return {
            "username": admin.username,
            "full_name": admin.full_name,
            "email": admin.email,
            "department": "IT Security & Administration",
            "employee_id": "ADMIN-01",
            "is_admin": True,
            "roles": {"admin": admin.role}
        }

    # 2. Check MasterIdentity
    identity = db.query(MasterIdentity).filter(MasterIdentity.username == username).first()
    if not identity:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in Central IAM Directory"
        )

    if not identity.is_active_in_ad:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee account is disabled in Active Directory (Offboarded)"
        )

    # In development mode or test mode, default password 'admin123' or username matches
    # In production, this verifies via AD Gateway /api/v2/login
    if not settings.AD_SYNC_ENABLED:
        # Development mode simulation: accept password if provided
        if password not in ["admin123", "password", "windowasia2026", username]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Active Directory credentials"
            )
    else:
        # Live AD Gateway verification per ADAuthen.md & Spoke Specification
        import httpx
        from datetime import timedelta
        from app.models.application import ConnectedApplication

        # 1. Fetch AD App configuration from database or fallback to settings
        ad_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "ad").first()
        ad_base = (ad_app.base_url if ad_app and ad_app.base_url else settings.AD_GATEWAY_URL).rstrip('/')
        ad_app_id = (ad_app.client_id if ad_app and ad_app.client_id else settings.AD_APP_ID)
        ad_secret = (ad_app.client_secret or ad_app.api_key if ad_app else None) or settings.AD_SECRET_KEY
        origin_ip = (ad_app.sap_company_db if ad_app and ad_app.sap_company_db else None) or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153")

        # 2. Thai Local Time (+7) formatted with trailing 'Z' and NO fractional seconds (ADAuthen.md Section 3)
        tz_thai = timezone(timedelta(hours=7))
        timestamp_str = datetime.now(tz_thai).strftime("%Y-%m-%dT%H:%M:%SZ")

        ad_url = f"{ad_base}/api/v2/login"
        payload = {
            "app_id": ad_app_id,
            "secret_key": ad_secret,
            "username": username,
            "password": password,
            "timestamp": timestamp_str
        }
        headers = {
            "Content-Type": "application/json",
            "X-Forwarded-For": origin_ip
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(ad_url, json=payload, headers=headers)
                if resp.status_code != 200:
                    err_msg = "Invalid Active Directory credentials"
                    try:
                        err_data = resp.json()
                        if "message" in err_data:
                            err_msg = err_data["message"]
                    except Exception:
                        pass
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"AD Authentication failed: {err_msg}"
                    )
                resp_data = resp.json()
                if resp_data.get("status") not in ["success", "OK", True] and not resp_data.get("authenticated", False):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=resp_data.get("message") or "Active Directory rejected authentication or user not in App_CIAM group"
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to connect to AD Gateway at %s: %s", ad_url, e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot reach Active Directory Gateway at {ad_base}: {str(e)}"
            )

    # Collect application roles
    roles = {}
    for mapping in identity.accounts:
        if mapping.is_active_in_app and mapping.application:
            roles[mapping.application.app_code] = mapping.app_group_name or "User"

    return {
        "username": identity.username,
        "full_name": identity.full_name,
        "email": identity.email,
        "department": identity.department,
        "employee_id": identity.employee_id,
        "is_admin": False,
        "roles": roles
    }


def create_authorization_code(
    db: Session,
    client_id: str,
    username: str,
    redirect_uri: str,
    scope: str = "openid profile email",
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = "S256"
) -> str:
    """Generate a single-use authorization code with 60s TTL."""
    code = secrets.token_urlsafe(36)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)

    auth_code_record = OAuthAuthorizationCode(
        code=code,
        client_id=client_id,
        username=username,
        redirect_uri=redirect_uri,
        scope=scope,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method or "S256",
        expires_at=expires_at,
        is_used=False
    )
    db.add(auth_code_record)
    db.commit()
    return code


def exchange_authorization_code(
    db: Session,
    code_str: str,
    redirect_uri: str,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    code_verifier: Optional[str] = None,
    issuer_url: str = "http://localhost:8001"
) -> Dict[str, Any]:
    """Validate PKCE, burn authorization code, and issue RS256 ID Token and Access Token."""
    auth_code = db.query(OAuthAuthorizationCode).filter(OAuthAuthorizationCode.code == code_str).first()
    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authorization code"
        )

    # Anti-replay attack check
    if auth_code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code has already been redeemed"
        )

    # Expiration check
    expires_at = auth_code.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code has expired (TTL 60s)"
        )

    # Redirect URI exact match
    if auth_code.redirect_uri != redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Redirect URI mismatch"
        )

    # Client ID check if specified
    target_client_id = client_id or auth_code.client_id
    if auth_code.client_id != target_client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID mismatch"
        )

    # Confidential client secret check if registered
    app = db.query(ConnectedApplication).filter(ConnectedApplication.client_id == auth_code.client_id).first()
    if app and app.client_secret:
        if not client_secret or not secure_compare(client_secret, app.client_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid client_secret for confidential client"
            )

    # PKCE Verification
    if auth_code.code_challenge:
        if not code_verifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing PKCE code_verifier"
            )

        if auth_code.code_challenge_method == "S256":
            sha256_digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
            calculated_challenge = base64.urlsafe_b64encode(sha256_digest).decode("utf-8").rstrip("=")
            if not secure_compare(calculated_challenge, auth_code.code_challenge):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid PKCE code_verifier (S256 verification failed)"
                )
        elif auth_code.code_challenge_method == "plain":
            if not secure_compare(code_verifier, auth_code.code_challenge):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid PKCE code_verifier (plain verification failed)"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported code_challenge_method '{auth_code.code_challenge_method}'"
            )

    # Burn code immediately (Single-Use)
    auth_code.is_used = True
    db.commit()

    # Retrieve user claims
    identity = db.query(MasterIdentity).filter(MasterIdentity.username == auth_code.username).first()
    now_ts = int(datetime.now(timezone.utc).timestamp())
    token_ttl_seconds = int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    exp_ts = now_ts + token_ttl_seconds

    roles = {}
    now_dt = datetime.now(timezone.utc)
    if identity:
        identity.last_login_ad_at = now_dt
        app_client = db.query(ConnectedApplication).filter(ConnectedApplication.client_id == auth_code.client_id).first()
        if app_client:
            mapping = db.query(AppAccountMapping).filter(
                AppAccountMapping.identity_id == identity.id,
                AppAccountMapping.application_id == app_client.id
            ).first()
            if mapping:
                mapping.last_app_login_at = now_dt
        db.commit()

        name = identity.full_name
        email = identity.email
        department = identity.department
        employee_id = identity.employee_id
        for m in identity.accounts:
            if m.is_active_in_app and m.application:
                roles[m.application.app_code] = m.app_group_name or "User"

    else:
        # Check AdminUser
        admin = db.query(AdminUser).filter(AdminUser.username == auth_code.username).first()
        name = admin.full_name if admin else auth_code.username
        email = admin.email if admin else None
        department = "IT Security"
        employee_id = "ADMIN-01"
        roles = {"admin": "SUPER_ADMIN"}

    # Construct RS256 ID Token
    id_token_payload = {
        "iss": issuer_url.rstrip("/"),
        "sub": auth_code.username,
        "aud": auth_code.client_id,
        "exp": exp_ts,
        "iat": now_ts,
        "auth_time": now_ts,
        "name": name,
        "preferred_username": auth_code.username,
        "email": email,
        "department": department,
        "employee_id": employee_id,
        "roles": roles
    }

    id_token = sign_rs256_token(id_token_payload)

    # Construct Access Token (RS256 Bearer Token)
    access_token_payload = {
        "iss": issuer_url.rstrip("/"),
        "sub": auth_code.username,
        "client_id": auth_code.client_id,
        "scope": auth_code.scope,
        "exp": exp_ts,
        "iat": now_ts
    }
    access_token = sign_rs256_token(access_token_payload)

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": token_ttl_seconds,
        "id_token": id_token,
        "scope": auth_code.scope
    }


def get_user_info_from_token(db: Session, token: str) -> Dict[str, Any]:
    """Decode RS256 Bearer Access Token and return OIDC UserInfo claims."""
    try:
        payload = verify_rs256_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired access token: {str(exc)}"
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim"
        )

    identity = db.query(MasterIdentity).filter(MasterIdentity.username == username).first()
    if identity:
        roles = {}
        for m in identity.accounts:
            if m.is_active_in_app and m.application:
                roles[m.application.app_code] = m.app_group_name or "User"
        return {
            "sub": identity.username,
            "name": identity.full_name,
            "full_name": identity.full_name,
            "preferred_username": identity.username,
            "username": identity.username,
            "email": identity.email,
            "department": identity.department,
            "employee_id": identity.employee_id,
            "roles": roles,
            "groups": list(roles.values())
        }

    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin:
        return {
            "sub": admin.username,
            "name": admin.full_name,
            "full_name": admin.full_name,
            "preferred_username": admin.username,
            "username": admin.username,
            "email": admin.email,
            "department": "IT Security",
            "employee_id": "ADMIN-01",
            "roles": {"admin": admin.role},
            "groups": [admin.role]
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User identity not found"
    )
