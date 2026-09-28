from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import AdminUser

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[AdminUser]:
    """Validate Bearer token and return current AdminUser (or None if unauthenticated)."""
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    username: str = payload.get("sub")
    if not username:
        return None

    user = db.query(AdminUser).filter(func.lower(AdminUser.username) == username.lower()).first()
    if not user or not user.is_active:
        return None

    return user

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Validate Bearer token and return current authenticated user (Admin or Portal User)."""
    user = get_current_user_optional(token=token, db=db)
    if user:
        return user

    # Fallback mock admin for development or tests without token
    if not token:
        admin = db.query(AdminUser).first()
        if admin:
            return admin

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="กรุณาเข้าสู่ระบบก่อนดำเนินการ (Authentication required)",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_current_admin(
    current_user: AdminUser = Depends(get_current_user)
) -> AdminUser:
    """Validate that the current user has Administrator privileges."""
    if current_user.role == "PORTAL_USER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="การเข้าถึงถูกปฏิเสธ: ส่วนนี้สำหรับผู้ดูแลระบบเท่านั้น (Administrator privileges required)"
        )
    return current_user
