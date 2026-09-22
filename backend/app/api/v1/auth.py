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
    is_valid = user and verify_password(login_req.password, user.hashed_password)

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
                reason="User not found in Central IAM Admin directory",
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
        execution_mode="PASSWORD_AUTH",
        ip_address=client_ip,
        status="SUCCESS",
        reason="Admin authenticated successfully",
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
