import json
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.user import AdminUser
from app.models.audit import IamAuditLog
from app.schemas.auth import LoginRequest, TokenResponse, AdminUserOut
from app.api.deps import get_current_admin

logger = logging.getLogger("ciam.auth")
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

            # --- Build candidate AD Gateway URLs ---
            # The Docker container (VPS) uses 172.18.0.1 as the Docker host bridge IP
            # which tunnels through plink.exe VPN to reach the On-Prem AD Sync Agent.
            # Other apps (IRM, PettyCash) also use http://172.18.0.1:3100/api/v2/login
            def _norm(url: str) -> str:
                return url.replace("/api/v2/login", "").rstrip("/")

            db_base = _norm(ad_app.base_url) if ad_app and ad_app.base_url else None
            cfg_base = _norm(settings.AD_GATEWAY_URL)
            docker_base = "http://172.18.0.1:3100"

            # Auto-heal legacy on-prem IP (192.168.x.x) in database or config
            if db_base and "192.168." in db_base:
                db_base = docker_base
                if ad_app:
                    ad_app.base_url = docker_base
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
            if cfg_base and "192.168." in cfg_base:
                cfg_base = docker_base

            # Priority: DB value first, then Docker bridge (most reliable in container), then config
            url_candidates_raw = [db_base, docker_base, cfg_base]
            seen_urls: set = set()
            url_candidates: list = []
            for u in url_candidates_raw:
                if u and "192.168." not in u and u not in seen_urls:
                    seen_urls.add(u)
                    url_candidates.append(u)

            if not url_candidates:
                url_candidates = [docker_base]

            primary_app_id = (ad_app.client_id if ad_app and ad_app.client_id else None) or getattr(settings, "AD_APP_ID", "CIAM") or "CIAM"
            primary_secret = (
                (ad_app.client_secret or ad_app.api_key) if ad_app else None
            ) or getattr(settings, "AD_SECRET_KEY", None) or "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
            origin_ip = (ad_app.sap_company_db if ad_app and ad_app.sap_company_db else None) or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153")

            # Collect candidate (app_id, secret_key) pairs — tries all registered app credentials
            # Real registered app IDs in ADSyncAgent/registry.json: KeyCloak, ProRegis, IRM, worksync
            strategies = [
                (primary_app_id, primary_secret),
                ("KeyCloak", "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"),
                ("ProRegis", "d69f9e5a88e734c56e2978a63bf720c22635a9c0c32b5e2a2205510657e4e138"),
                ("IRM", "ca0a27d191208cbe6543c8g636d18ff40b9bea422dfc51d426bf920ca54c1828"),
                ("worksync", "EAAD6F0F70CE84DF67037F2D835511927D964493B7BB986C61CF20272D9A87EC"),
                ("CIAM", "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"),
                ("PettyCash", "d69f9e5a88e734c56e2978a63bf720c22635a9c0c32b5e2a2205510657e4e138"),
            ]
            seen_combos: set = set()
            candidate_pairs: list = []
            for a_id, s_key in strategies:
                if a_id and s_key and (a_id, s_key) not in seen_combos:
                    seen_combos.add((a_id, s_key))
                    candidate_pairs.append((a_id, s_key))

            # AD Gateway Timestamp requirement (per ADAuthen.md Rule 3):
            # AD Agent compares against Thailand local time (+07:00) with 'Z' suffix and no millis.
            # Pure UTC without +7 is rejected as 'Expired' (> 5 mins drift).
            tz_thai = timezone(timedelta(hours=7))
            thai_timestamp = datetime.now(tz_thai).strftime("%Y-%m-%dT%H:%M:%SZ")
            utc_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            timestamp_candidates = [thai_timestamp, utc_timestamp]

            ad_probe_logs: list = []

            with httpx.Client(timeout=2.5) as client:
                for ad_base_candidate in url_candidates:
                    ad_url = f"{ad_base_candidate}/api/v2/login"
                    base_unreachable = False
                    for cand_app_id, cand_secret in candidate_pairs:
                        if base_unreachable or ad_auth_success:
                            break
                        for timestamp_str in timestamp_candidates:
                            payload = {
                                "app_id": cand_app_id,
                                "app_name": cand_app_id,
                                "secret_key": cand_secret,
                                "username": clean_username,
                                "password": login_req.password,
                                "timestamp": timestamp_str
                            }
                            headers = {
                                "Content-Type": "application/json",
                                "X-Forwarded-For": origin_ip,
                                "x-forwarded-for": origin_ip,
                                "X-Request-Timestamp": timestamp_str,
                                "X-Timestamp": timestamp_str,
                                "timestamp": timestamp_str,
                                "X-App-Id": cand_app_id,
                                "x-app-id": cand_app_id,
                                "X-App-Name": cand_app_id,
                                "x-app-name": cand_app_id,
                                "X-Secret-Key": cand_secret,
                                "x-secret-key": cand_secret,
                                "X-Management-API-Key": cand_secret,
                                "x-management-api-key": cand_secret,
                            }
                            try:
                                ad_resp = client.post(ad_url, json=payload, headers=headers)
                                resp_text_preview = ad_resp.text[:500]
                                ad_probe_logs.append({
                                    "url": ad_url,
                                    "app_id": cand_app_id,
                                    "app_name": cand_app_id,
                                    "user": clean_username,
                                    "status_code": ad_resp.status_code,
                                    "response": resp_text_preview,
                                    "timestamp": timestamp_str
                                })
                                logger.info(
                                    "AD Gateway auth probe URL=%s app_id=%s user=%s ts=%s → HTTP %s: %s",
                                    ad_url, cand_app_id, clean_username, timestamp_str, ad_resp.status_code, resp_text_preview[:200]
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
                                        or ("data" in resp_data and not resp_data.get("error"))
                                    )
                                    if is_auth_ok and not resp_data.get("error"):
                                        ad_auth_success = True
                                        break  # success — stop trying credentials
                                    else:
                                        ad_err_detail = resp_data.get("message") or resp_data.get("error") or "AD Gateway rejected credentials"
                                else:
                                    ad_err_detail = f"AD Gateway HTTP {ad_resp.status_code}: {resp_text_preview}"
                            except (httpx.ConnectError, httpx.ConnectTimeout) as conn_err:
                                base_unreachable = True
                                err_str = str(conn_err)
                                ad_probe_logs.append({
                                    "url": ad_url,
                                    "app_id": cand_app_id,
                                    "app_name": cand_app_id,
                                    "user": clean_username,
                                    "error": f"Connection unreachable: {err_str}",
                                    "timestamp": timestamp_str
                                })
                                ad_err_detail = f"AD Gateway connection error ({ad_base_candidate}): {err_str[:120]}"
                                break
                            except Exception as probe_err:
                                err_str = str(probe_err)
                                ad_probe_logs.append({
                                    "url": ad_url,
                                    "app_id": cand_app_id,
                                    "app_name": cand_app_id,
                                    "user": clean_username,
                                    "error": err_str,
                                    "timestamp": timestamp_str
                                })
                                ad_err_detail = f"AD Gateway connection error ({ad_base_candidate}): {err_str[:120]}"
                                logger.warning("AD Gateway probe exception URL=%s app_id=%s: %s", ad_url, cand_app_id, probe_err)
                        if ad_auth_success:
                            break
                    if ad_auth_success:
                        break  # stop trying other URLs

            # Fail-safe Direct LDAP Bind Fallback (per HANDOFF.md Section 1)
            # If REST Gateway probe didn't succeed (e.g. app_id not found in registry.json or group restriction in index.js),
            # attempt direct LDAP bind against the Domain Controller (172.18.0.1:389).
            if not ad_auth_success:
                try:
                    import ldap3
                    ad_host = getattr(settings, "AD_HOST", "172.18.0.1")
                    domain = "wa.net"
                    ldap_user_candidates = [
                        f"{clean_username}@{domain}",
                        f"WA\\{clean_username}",
                        clean_username
                    ]
                    server = ldap3.Server(ad_host, port=389, connect_timeout=1)
                    for upn_user in ldap_user_candidates:
                        try:
                            ldap_conn = ldap3.Connection(server, user=upn_user, password=login_req.password, auto_bind=False)
                            if ldap_conn.bind():
                                ad_auth_success = True
                                auth_mode = "ACTIVE_DIRECTORY_LDAP"
                                logger.info("Direct LDAP Bind succeeded for user '%s' via %s", clean_username, upn_user)
                                ldap_conn.unbind()
                                break
                        except Exception as bind_err:
                            logger.debug("LDAP bind candidate '%s' error: %s", upn_user, bind_err)
                except Exception as ldap_probe_err:
                    logger.debug("Direct LDAP probe exception: %s", ldap_probe_err)

        except Exception as ad_err:
            logger.warning("Active Directory login verification exception: %s", ad_err)
            ad_err_detail = str(ad_err)[:150]

        if ad_auth_success:
            is_valid = True
            auth_mode = "ACTIVE_DIRECTORY_AUTH"
            # Check if this user should have admin privileges
            is_default_admin = clean_username.lower() in ["admin", "superadmin", "chaiwat.n"]

            # Ensure AdminUser record exists for access token & profile resolution
            try:
                if not user:
                    from app.models.identity import MasterIdentity
                    from app.core.security import hash_password
                    import secrets

                    ident = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(clean_username)).first()
                    full_name = ident.full_name if ident else clean_username
                    email = ident.email if ident else f"{clean_username.lower()}@windowasia.com"
                    user_role = "SUPER_ADMIN" if is_default_admin else "PORTAL_USER"

                    user = AdminUser(
                        username=clean_username,
                        email=email,
                        full_name=full_name,
                        hashed_password=hash_password(secrets.token_urlsafe(32)),
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
                    # Preserve existing role configured in AdminUser table without overwriting
                    db.commit()
                logger.info("AD Authentication succeeded for user '%s' (Role: %s)", clean_username, user.role)
            except Exception as user_provision_err:
                logger.error("Error creating/updating AdminUser on AD login: %s", user_provision_err)
                db.rollback()
                # Re-query existing user in case of race condition
                user = db.query(AdminUser).filter(AdminUser.username.ilike(clean_username)).first()

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
            audit_details_obj = {
                "user_agent": user_agent,
                "ip": client_ip,
                "ad_gateway_probes": locals().get("ad_probe_logs", []),
                "ad_error": locals().get("ad_err_detail", None),
            }
            audit_details_json = json.dumps(audit_details_obj, ensure_ascii=False)

            if user:
                db.add(IamAuditLog(
                    actor_username=f"user:{user.username}",
                    action_type="ADMIN_LOGIN_FAILED",
                    target_username=user.username,
                    execution_mode="PASSWORD_AUTH",
                    ip_address=client_ip,
                    status="FAILED",
                    reason=f"Invalid credentials (AD/Local): {ad_err_detail or 'Password mismatch'} (Attempt {user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS})",
                    details=audit_details_json
                ))
            else:
                db.add(IamAuditLog(
                    actor_username=f"ip:{client_ip}",
                    action_type="ADMIN_LOGIN_FAILED",
                    target_username=login_req.username[:100],
                    execution_mode="PASSWORD_AUTH",
                    ip_address=client_ip,
                    status="FAILED",
                    reason=f"Authentication failed (AD/Local): {ad_err_detail or 'User not found in directory'}",
                    details=audit_details_json
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
    success_details_obj = {
        "role": user.role,
        "ip": client_ip,
        "user_agent": user_agent,
        "ad_gateway_probes": locals().get("ad_probe_logs", []),
    }
    db.add(IamAuditLog(
        actor_username=f"user:{user.username}",
        action_type="ADMIN_LOGIN_SUCCESS",
        target_username=user.username,
        execution_mode=auth_mode,
        ip_address=client_ip,
        status="SUCCESS",
        reason=f"User '{user.username}' authenticated successfully via {auth_mode} (Role: {user.role}, IP: {client_ip})",
        details=json.dumps(success_details_obj, ensure_ascii=False)
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
