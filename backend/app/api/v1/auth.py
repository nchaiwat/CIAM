from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.user import AdminUser
from app.models.audit import IamAuditLog
from app.schemas.auth import LoginRequest, TokenResponse, AdminUserOut
from app.api.deps import get_current_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/login", response_model=TokenResponse)
def login(login_req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate Admin user and issue JWT Bearer token.
    Compliant with ISO 27001 A.9.4.2 (Secure log-on) & A.12.4.1 (Event logging).
    Features Honeypot bot protection and Brute-force account lockout.
    """
    # Extract client IP
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "unknown")[:250]

    # 1. Honeypot Decoy Trap Evaluation
    # Legitimate users never see or populate corporate_fax or security_honey.
    if login_req.corporate_fax or login_req.security_honey:
        honeypot_val = login_req.corporate_fax or login_req.security_honey
        db.add(IamAuditLog(
            actor_username=f"bot:{client_ip}",
            action_type="BOT_HONEYPOT_DETECTED",
            target_username=login_req.username[:100],
            execution_mode="SECURITY_TRAP",
            ip_address=client_ip,
            status="FAILED",
            reason="Automated bot detected via honeypot decoy submission",
            details=f"Trap value: '{honeypot_val[:100]}', User-Agent: {user_agent}"
        ))
        db.commit()
        # Return generic error to prevent revealing trap trigger
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
        )

    now = datetime.now(timezone.utc)
    user = db.query(AdminUser).filter(AdminUser.username == login_req.username).first()

    # 2. Account Lockout Check (Brute-Force Prevention)
    if user and user.locked_until:
        locked_until_aware = user.locked_until
        if locked_until_aware.tzinfo is None:
            locked_until_aware = locked_until_aware.replace(tzinfo=timezone.utc)
        if locked_until_aware > now:
            remaining_mins = max(1, int((locked_until_aware - now).total_seconds() // 60) + 1)
            db.add(IamAuditLog(
                actor_username=f"user:{user.username}",
                action_type="ADMIN_LOGIN_LOCKED",
                target_username=user.username,
                execution_mode="PASSWORD_AUTH",
                ip_address=client_ip,
                status="FAILED",
                reason=f"Login rejected: Account locked until {locked_until_aware.isoformat()}",
                details=f"Remaining lockout: ~{remaining_mins} minutes, IP: {client_ip}"
            ))
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"บัญชีถูกระงับชั่วคราวเนื่องจากใส่รหัสผ่านผิดเกินกำหนด ({MAX_FAILED_ATTEMPTS} ครั้ง) กรุณาลองใหม่อีกครั้งใน {remaining_mins} นาที"
            )
        else:
            # Lockout expired, reset counter
            user.locked_until = None
            user.failed_login_attempts = 0
            db.commit()

    # 3. Credential Verification
    auth_mode = "PASSWORD_AUTH"
    is_valid = user and verify_password(login_req.password, user.hashed_password)

    # If local admin auth failed or user not in AdminUser, attempt Active Directory verification
    if not is_valid:
        ad_auth_success = False
        ad_err_detail = ""
        try:
            from app.models.application import ConnectedApplication
            from app.core.config import settings
            import httpx

            ad_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "ad").first()
            ad_base = (ad_app.base_url if ad_app and ad_app.base_url else settings.AD_GATEWAY_URL).rstrip('/')
            ad_app_id = (ad_app.client_id if ad_app and ad_app.client_id else settings.AD_APP_ID)
            ad_secret = (ad_app.client_secret or ad_app.api_key if ad_app else None) or settings.AD_SECRET_KEY
            origin_ip = (ad_app.sap_company_db if ad_app and ad_app.sap_company_db else None) or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153")

            tz_thai = timezone(timedelta(hours=7))
            timestamp_str = datetime.now(tz_thai).strftime("%Y-%m-%dT%H:%M:%SZ")

            ad_url = f"{ad_base}/api/v2/login"
            payload = {
                "app_id": ad_app_id,
                "secret_key": ad_secret,
                "username": login_req.username.strip(),
                "password": login_req.password,
                "timestamp": timestamp_str
            }
            headers = {
                "Content-Type": "application/json",
                "X-Forwarded-For": origin_ip
            }
            with httpx.Client(timeout=8.0) as client:
                ad_resp = client.post(ad_url, json=payload, headers=headers)
                if ad_resp.status_code == 200:
                    resp_data = ad_resp.json()
                    if resp_data.get("status") in ["success", "OK", True] or resp_data.get("authenticated", False):
                        ad_auth_success = True
                    else:
                        ad_err_detail = resp_data.get("message") or "AD Gateway rejected credentials"
                else:
                    ad_err_detail = f"AD Gateway HTTP {ad_resp.status_code}"
        except Exception as ad_err:
            logger.warning("Active Directory login verification exception: %s", ad_err)
            ad_err_detail = str(ad_err)[:100]

        if ad_auth_success:
            is_valid = True
            auth_mode = "ACTIVE_DIRECTORY_AUTH"
            # Ensure AdminUser record exists for access token & profile resolution
            if not user:
                from app.models.identity import MasterIdentity
                from app.core.security import get_password_hash
                import secrets

                ident = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(login_req.username.strip())).first()
                full_name = ident.full_name if ident else login_req.username.strip()
                email = ident.email if ident else f"{login_req.username.strip().lower()}@windowasia.com"
                is_admin = login_req.username.strip().lower() in ["chaiwat.n", "admin", "superadmin"]
                user_role = "SUPER_ADMIN" if is_admin else "PORTAL_USER"

                user = AdminUser(
                    username=login_req.username.strip(),
                    email=email,
                    full_name=full_name,
                    hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                    role=user_role,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                if login_req.username.strip().lower() in ["chaiwat.n"] and user.role != "SUPER_ADMIN":
                    user.role = "SUPER_ADMIN"
                    db.commit()

    if not is_valid:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
                db.add(IamAuditLog(
                    actor_username=f"user:{user.username}",
                    action_type="ADMIN_ACCOUNT_LOCKED",
                    target_username=user.username,
                    execution_mode="PASSWORD_AUTH",
                    ip_address=client_ip,
                    status="FAILED",
                    reason=f"Account locked for {LOCKOUT_MINUTES} minutes after {user.failed_login_attempts} failed attempts",
                    details=f"User-Agent: {user_agent}"
                ))
            else:
                db.add(IamAuditLog(
                    actor_username=f"user:{user.username}",
                    action_type="ADMIN_LOGIN_FAILED",
                    target_username=user.username,
                    execution_mode="PASSWORD_AUTH",
                    ip_address=client_ip,
                    status="FAILED",
                    reason=f"Invalid password (Attempt {user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS})",
                    details=f"User-Agent: {user_agent}"
                ))
            db.commit()
        else:
            # Non-existent user
            db.add(IamAuditLog(
                actor_username=f"ip:{client_ip}",
                action_type="ADMIN_LOGIN_FAILED",
                target_username=login_req.username[:100],
                execution_mode="PASSWORD_AUTH",
                ip_address=client_ip,
                status="FAILED",
                reason=f"Authentication failed (AD/Local): {ad_err_detail or 'User not found in directory'}",
                details=f"User-Agent: {user_agent}"
            ))
            db.commit()

        # ISO 27001 A.9.4.2: Generic error message to prevent username enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
        )

    # 4. Account Inactive Check
    if not user.is_active:
        db.add(IamAuditLog(
            actor_username=f"user:{user.username}",
            action_type="ADMIN_LOGIN_INACTIVE",
            target_username=user.username,
            execution_mode="PASSWORD_AUTH",
            ip_address=client_ip,
            status="FAILED",
            reason="Admin account is marked inactive / disabled",
            details=f"User-Agent: {user_agent}"
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="บัญชีผู้ดูแลระบบนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบสูงสุด"
        )

    # 5. Success: Reset failed attempts & Update last login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    db.add(IamAuditLog(
        actor_username=f"user:{user.username}",
        action_type="ADMIN_LOGIN_SUCCESS",
        target_username=user.username,
        execution_mode=auth_mode,
        ip_address=client_ip,
        status="SUCCESS",
        reason=f"User authenticated successfully ({auth_mode})",
        details=f"Role: {user.role}, IP: {client_ip}, User-Agent: {user_agent}"
    ))
    db.commit()

    token = create_access_token(subject=user.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=AdminUserOut.model_validate(user)
    )

@router.get("/me", response_model=AdminUserOut)
def get_current_user_profile(current_user: AdminUser = Depends(get_current_admin)):
    """Return currently logged in Admin profile."""
    return AdminUserOut.model_validate(current_user)
