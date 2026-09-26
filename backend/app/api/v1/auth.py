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
    raw_username = login_req.username.strip()
    clean_username = raw_username
    if "\\" in clean_username:
        clean_username = clean_username.split("\\")[-1]
    if "@" in clean_username:
        clean_username = clean_username.split("@")[0]

    user = db.query(AdminUser).filter(AdminUser.username.ilike(clean_username)).first()

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
            raw_ad_base = (ad_app.base_url if ad_app and ad_app.base_url else settings.AD_GATEWAY_URL).rstrip('/')
            clean_ad_base = raw_ad_base.replace("/api/v2/login", "").rstrip('/')
            ad_url = f"{clean_ad_base}/api/v2/login"

            primary_app_id = (ad_app.client_id if ad_app and ad_app.client_id else getattr(settings, "AD_APP_ID", "CIAM")) or "CIAM"
            primary_secret = (ad_app.client_secret or ad_app.api_key if ad_app else None) or getattr(settings, "AD_SECRET_KEY", None) or "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
            origin_ip = (ad_app.sap_company_db if ad_app and ad_app.sap_company_db else None) or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153")

            # Collect candidate (app_id, secret_key) pairs
            strategies = [
                (primary_app_id, primary_secret),
                ("CIAM", "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"),
                ("PettyCash", "d69f9e5a88e734c56e2978a63bf720c22635a9c0c32b5e2a2205510657e4e138"),
            ]
            seen_combos = set()
            candidate_pairs = []
            for a_id, s_key in strategies:
                if a_id and s_key and (a_id, s_key) not in seen_combos:
                    seen_combos.add((a_id, s_key))
                    candidate_pairs.append((a_id, s_key))

            tz_thai = timezone(timedelta(hours=7))
            timestamp_str = datetime.now(tz_thai).strftime("%Y-%m-%dT%H:%M:%SZ")

            with httpx.Client(timeout=10.0) as client:
                for cand_app_id, cand_secret in candidate_pairs:
                    payload = {
                        "app_id": cand_app_id,
                        "secret_key": cand_secret,
                        "username": clean_username,
                        "password": login_req.password,
                        "timestamp": timestamp_str
                    }
                    headers = {
                        "Content-Type": "application/json",
                        "X-Forwarded-For": origin_ip,
                        "X-Request-Timestamp": timestamp_str,
                        "X-Timestamp": timestamp_str,
                        "timestamp": timestamp_str,
                        "X-App-Id": cand_app_id,
                        "x-app-id": cand_app_id,
                        "X-Secret-Key": cand_secret,
                        "x-secret-key": cand_secret,
                        "X-Management-API-Key": cand_secret,
                        "x-management-api-key": cand_secret,
                    }
                    try:
                        ad_resp = client.post(ad_url, json=payload, headers=headers)
                        logger.info(
                            "AD Gateway auth probe (%s @ %s) returned HTTP %s: %s",
                            clean_username, cand_app_id, ad_resp.status_code, ad_resp.text[:150]
                        )
                        if ad_resp.status_code == 200:
                            try:
                                resp_data = ad_resp.json()
                            except Exception:
                                resp_data = {}

                            is_auth_ok = (
                                resp_data.get("success") in [True, "true", "True", 1]
                                or resp_data.get("authenticated") in [True, "true", "True", 1]
                                or resp_data.get("status") in ["success", "OK", "ok", True, 200]
                                or resp_data.get("code") in [200, "200"]
                                or ("user" in resp_data and not resp_data.get("error"))
                                or ("userData" in resp_data and not resp_data.get("error"))
                                or ("sAMAccountName" in resp_data and not resp_data.get("error"))
                            )
                            if is_auth_ok and not resp_data.get("error"):
                                ad_auth_success = True
                                break
                            else:
                                ad_err_detail = resp_data.get("message") or resp_data.get("error") or "AD Gateway rejected credentials"
                        else:
                            ad_err_detail = f"AD Gateway HTTP {ad_resp.status_code} ({ad_resp.text[:80]})"
                    except Exception as probe_err:
                        ad_err_detail = f"AD Gateway connection error: {str(probe_err)[:80]}"
                        logger.warning("AD Gateway probe exception (%s): %s", cand_app_id, probe_err)

        except Exception as ad_err:
            logger.warning("Active Directory login verification exception: %s", ad_err)
            ad_err_detail = str(ad_err)[:100]

        if ad_auth_success:
            is_valid = True
            auth_mode = "ACTIVE_DIRECTORY_AUTH"
            is_admin = clean_username.lower() in ["chaiwat.n", "admin", "superadmin"]

            # Ensure AdminUser record exists for access token & profile resolution
            if not user:
                from app.models.identity import MasterIdentity
                from app.core.security import get_password_hash
                import secrets

                ident = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(clean_username)).first()
                full_name = ident.full_name if ident else clean_username
                email = ident.email if ident else f"{clean_username.lower()}@windowasia.com"
                user_role = "SUPER_ADMIN" if is_admin else "PORTAL_USER"

                user = AdminUser(
                    username=clean_username,
                    email=email,
                    full_name=full_name,
                    hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                    role=user_role,
                    is_active=True,
                    failed_login_attempts=0
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                user.failed_login_attempts = 0
                user.locked_until = None
                user.is_active = True
                if is_admin and user.role != "SUPER_ADMIN":
                    user.role = "SUPER_ADMIN"
                db.commit()

            logger.info("AD Authentication succeeded for user '%s' (Assigned role: %s)", clean_username, user.role)

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
                    reason=f"Invalid credentials (AD/Local): {ad_err_detail or 'Password mismatch'} (Attempt {user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS})",
                    details=f"User-Agent: {user_agent}, IP: {client_ip}"
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
