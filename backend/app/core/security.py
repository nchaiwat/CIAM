import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from jose import jwt
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

get_password_hash = hash_password

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None

def secure_compare(a: str, b: str) -> bool:
    """Constant-time string comparison to mitigate timing attacks."""
    return secrets.compare_digest(a, b)


def get_public_base_url(request: Any) -> str:
    """
    Extract public base URL honoring reverse proxy headers (X-Forwarded-Proto, X-Forwarded-Host).
    Falls back to settings.FRONTEND_URL or request.base_url.
    """
    if hasattr(request, "headers"):
        proto = request.headers.get("x-forwarded-proto")
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if proto and host:
            return f"{proto}://{host}".rstrip("/")

    if getattr(settings, "FRONTEND_URL", None) and "localhost" not in settings.FRONTEND_URL and "127.0.0.1" not in settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")

    return str(getattr(request, "base_url", "http://localhost:8001")).rstrip("/")

