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
import re
import random
import string

LOCAL_PASSWORD_EXPIRY_DAYS = 90

def validate_password_complexity(password: str, username: Optional[str] = None) -> Optional[str]:
    """
    Validate enterprise password complexity:
    - Length between 8 and 16 characters ('ยาว 8-16 ตัวอักษร')
    - Contains at least one uppercase letter (A-Z)
    - Contains at least one lowercase letter (a-z)
    - Contains at least one digit (0-9)
    - Contains at least one special character (!@#$%^&*...)
    - Does not contain the username (case-insensitive)
    Returns None if valid, or a descriptive error message in Thai if invalid.
    """
    if not password:
        return "กรุณาระบุรหัสผ่าน"
    pwd = password.strip()
    if len(pwd) < 8 or len(pwd) > 16:
        return f"รหัสผ่านต้องมีความยาวระหว่าง 8 ถึง 16 ตัวอักษร (ปัจจุบัน {len(pwd)} ตัวอักษร)"
    if not re.search(r"[A-Z]", pwd):
        return "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว"
    if not re.search(r"[a-z]", pwd):
        return "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว"
    if not re.search(r"[0-9]", pwd):
        return "รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว"
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]", pwd):
        return "รหัสผ่านต้องมีอักขระพิเศษ (!@#$%^&*...) อย่างน้อย 1 ตัว"
    if username:
        clean_user = username.strip().lower()
        if len(clean_user) >= 3 and clean_user in pwd.lower():
            return "รหัสผ่านต้องไม่มีชื่อผู้ใช้ (Username) ปะปนอยู่"
    return None

def check_password_expiry(
    password_changed_at: Optional[datetime],
    created_at: Optional[datetime] = None
) -> tuple[bool, int, datetime]:
    """
    Calculate 90-day password expiration status.
    Returns:
        (is_expired: bool, days_until_expiry: int, expires_at: datetime)
    """
    now = datetime.now(timezone.utc)
    base_dt = password_changed_at or created_at or now
    if base_dt.tzinfo is None:
        base_dt = base_dt.replace(tzinfo=timezone.utc)

    expires_at = base_dt + timedelta(days=LOCAL_PASSWORD_EXPIRY_DAYS)
    remaining_seconds = (expires_at - now).total_seconds()
    days_until_expiry = max(0, int(remaining_seconds // 86400))
    is_expired = remaining_seconds <= 0

    return is_expired, days_until_expiry, expires_at

def generate_compliant_password() -> str:
    """Generate a 10-12 character password strictly satisfying the complexity policy."""
    upper = random.choice(string.ascii_uppercase)
    lower = random.choice(string.ascii_lowercase)
    digit1 = random.choice(string.digits)
    digit2 = random.choice(string.digits)
    special = random.choice("!@#$%&*?_-")
    # remaining 5-6 characters from mixed alphabet and digits
    remaining = random.choices(string.ascii_letters + string.digits, k=5)
    chars = [upper, lower, digit1, digit2, special] + remaining
    random.shuffle(chars)
    return "".join(chars)

