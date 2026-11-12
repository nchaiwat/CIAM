import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import validate_password_complexity, check_password_expiry, LOCAL_PASSWORD_EXPIRY_DAYS
from app.core.database import SessionLocal
from app.models.user import AdminUser

client = TestClient(app)


def test_password_complexity_unit():
    # Valid passwords (8 - 16 chars, uppercase, lowercase, number, special char, no username)
    assert validate_password_complexity("Admin@2026", username="somchai") is None
    assert validate_password_complexity("Strong#Pass123", username="john_doe") is None
    assert validate_password_complexity("P@ssw0rdEnterprise", username="user") is not None  # 18 chars > 16

    # Test length boundaries
    assert validate_password_complexity("Aa1!567", username="user") is not None  # 7 chars < 8
    assert validate_password_complexity("Aa1!5678", username="user") is None  # 8 chars (min)
    assert validate_password_complexity("Aa1!567890123456", username="user") is None  # 16 chars (max)
    assert validate_password_complexity("Aa1!5678901234567", username="user") is not None  # 17 chars > 16

    # Test missing character classes
    assert validate_password_complexity("abcdefgh1!", username="user") is not None  # No uppercase
    assert validate_password_complexity("ABCDEFGH1!", username="user") is not None  # No lowercase
    assert validate_password_complexity("Abcdefghij!", username="user") is not None  # No digit
    assert validate_password_complexity("Abcdefgh12", username="user") is not None  # No special char

    # Test username embedded in password (case-insensitive)
    assert validate_password_complexity("Somchai#2026", username="somchai") is not None
    assert validate_password_complexity("SOMCHAI#2026", username="somchai") is not None
    assert validate_password_complexity("PrefixSomchai!1", username="Somchai") is not None
    assert validate_password_complexity("GoodPass#2026", username="somchai") is None


def test_password_expiry_unit():
    now = datetime.now(timezone.utc)

    # 1. Password changed recently (e.g., today)
    is_expired, days_until, expires_at = check_password_expiry(now)
    assert is_expired is False
    assert days_until == LOCAL_PASSWORD_EXPIRY_DAYS
    assert expires_at is not None

    # 2. Password changed 45 days ago
    past_45 = now - timedelta(days=45)
    is_expired, days_until, expires_at = check_password_expiry(past_45)
    assert is_expired is False
    assert 44 <= days_until <= 45

    # 3. Password changed 91 days ago (expired)
    past_91 = now - timedelta(days=91)
    is_expired, days_until, expires_at = check_password_expiry(past_91)
    assert is_expired is True
    assert days_until <= 0

    # 4. Fallback to created_at when password_changed_at is None
    is_expired, days_until, expires_at = check_password_expiry(None, created_at=past_45)
    assert is_expired is False
    assert 44 <= days_until <= 45

    is_expired, days_until, expires_at = check_password_expiry(None, created_at=past_91)
    assert is_expired is True
    assert days_until <= 0


def test_password_expiry_in_api():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify user fields in login response
    user_info = login_data["user"]
    assert "password_expires_at" in user_info
    assert "days_until_password_expiry" in user_info
    assert "is_password_expired" in user_info

    # Test /api/v1/auth/me returns same expiry data
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "days_until_password_expiry" in me_data
    assert "is_password_expired" in me_data

    # Test password update enforces complexity (8 - 16 chars)
    # Reject short password
    bad_res = client.put(
        "/api/v1/auth/profile",
        json={"new_password": "Sh1!"},
        headers=headers
    )
    assert bad_res.status_code == 400
    assert "8 - 16" in bad_res.json()["detail"] or "ความยาว" in bad_res.json()["detail"]

    # Reject password containing username "admin"
    admin_in_pwd_res = client.put(
        "/api/v1/auth/profile",
        json={"new_password": "Admin!2026"},
        headers=headers
    )
    assert admin_in_pwd_res.status_code == 400
    assert "ชื่อผู้ใช้" in admin_in_pwd_res.json()["detail"] or "username" in admin_in_pwd_res.json()["detail"].lower()
