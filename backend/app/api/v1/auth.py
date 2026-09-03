from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.user import AdminUser
from app.schemas.auth import LoginRequest, TokenResponse, AdminUserOut
from app.api.deps import get_current_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate Admin user and issue JWT Bearer token."""
    user = db.query(AdminUser).filter(AdminUser.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive"
        )

    user.last_login_at = datetime.now(timezone.utc)
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
