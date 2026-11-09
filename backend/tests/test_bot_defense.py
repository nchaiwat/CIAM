import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.bot_defense import SlidingWindowRateLimiter, auth_rate_limiter, verify_submission_timing
from app.core.database import SessionLocal
from app.models.audit import IamAuditLog

client = TestClient(app)

def test_sliding_window_rate_limiter_logic():
    """Unit test for SlidingWindowRateLimiter algorithm, limits, and whitelist."""
    limiter = SlidingWindowRateLimiter(default_limit=3, default_window_seconds=2)
    test_ip = "192.0.2.100"

    # 1. First 3 requests allowed
    ok1, rem1, retry1 = limiter.is_allowed(test_ip)
    assert ok1 is True
    assert rem1 == 2
    assert retry1 == 0

    ok2, rem2, retry2 = limiter.is_allowed(test_ip)
    assert ok2 is True
    assert rem2 == 1

    ok3, rem3, retry3 = limiter.is_allowed(test_ip)
    assert ok3 is True
    assert rem3 == 0

    # 2. 4th request within window rejected
    ok4, rem4, retry4 = limiter.is_allowed(test_ip)
    assert ok4 is False
    assert rem4 == 0
    assert retry4 > 0

    # 3. Whitelisted IP is always permitted
    for _ in range(10):
        ok_wl, _, _ = limiter.is_allowed("127.0.0.1")
        assert ok_wl is True

    # 4. Reset functionality
    limiter.reset(test_ip)
    ok_after_reset, _, _ = limiter.is_allowed(test_ip)
    assert ok_after_reset is True


def test_timing_guard_velocity_verification():
    """Test timing guard human vs bot velocity threshold."""
    now_ms = int(time.time() * 1000)

    # Missing render_ts allows backward compatibility
    valid_none, _ = verify_submission_timing(None)
    assert valid_none is True

    # Sub-second bot script submission (< 400ms)
    bot_ts = now_ms - 100  # 100ms ago
    valid_bot, delta_bot = verify_submission_timing(bot_ts, min_elapsed_ms=400)
    assert valid_bot is False
    assert delta_bot is not None and delta_bot < 400

    # Legitimate human submission (> 400ms, e.g. 1.2s)
    human_ts = now_ms - 1200
    valid_human, delta_human = verify_submission_timing(human_ts, min_elapsed_ms=400)
    assert valid_human is True
    assert delta_human is not None and delta_human >= 400


def test_api_login_rate_limiting_exceeded():
    """Integration test: auth endpoint enforces 10 req/min rate limit per IP with HTTP 429 and Retry-After."""
    custom_ip = "198.51.100.88"
    headers = {"X-Forwarded-For": custom_ip}
    auth_rate_limiter.reset(custom_ip)

    # Ensure admin user is unlocked before and after test
    db = SessionLocal()
    from app.models.user import AdminUser
    admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
    if admin:
        admin.locked_until = None
        admin.failed_login_attempts = 0
        db.commit()
    db.close()

    try:
        # First 10 requests from this IP are processed by login (may return 401 or 423)
        for i in range(10):
            res = client.post(
                "/api/v1/auth/login",
                json={"username": f"random_spray_user_{i}", "password": "wrong_password_test"},
                headers=headers
            )
            assert res.status_code in [401, 423]

        # 11th request must be intercepted by rate limiter returning HTTP 429
        res_blocked = client.post(
            "/api/v1/auth/login",
            json={"username": "random_spray_user_11", "password": "wrong_password_test"},
            headers=headers
        )
        assert res_blocked.status_code == 429
        assert "Retry-After" in res_blocked.headers
        assert "ถี่เกินกำหนด" in res_blocked.json()["detail"]

        # Verify audit log entry
        db = SessionLocal()
        rate_log = db.query(IamAuditLog).filter(
            IamAuditLog.action_type == "IP_RATE_LIMITED",
            IamAuditLog.ip_address == custom_ip
        ).order_by(IamAuditLog.id.desc()).first()
        assert rate_log is not None
        assert rate_log.execution_mode == "BOT_DEFENSE"
        db.close()

    finally:
        auth_rate_limiter.reset(custom_ip)
        db = SessionLocal()
        admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        if admin:
            admin.locked_until = None
            admin.failed_login_attempts = 0
            db.commit()
        db.close()


def test_api_login_honeypot_trap():
    """Integration test: honeypot decoy fields reject bot and record audit log."""
    bot_ip = "198.51.100.99"
    headers = {"X-Forwarded-For": bot_ip}
    auth_rate_limiter.reset(bot_ip)

    res = client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "any_password",
            "corporate_fax": "automated_fax_spammer_bot"
        },
        headers=headers
    )
    assert res.status_code == 401
    assert "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" in res.json()["detail"]

    db = SessionLocal()
    honey_log = db.query(IamAuditLog).filter(
        IamAuditLog.action_type == "BOT_HONEYPOT_DETECTED",
        IamAuditLog.ip_address == bot_ip
    ).order_by(IamAuditLog.id.desc()).first()
    assert honey_log is not None
    assert "automated_fax_spammer_bot" in honey_log.details
    db.close()


def test_api_login_timing_velocity_guard():
    """Integration test: rapid automated form submission (< 400ms) is rejected with HTTP 400."""
    bot_ip = "198.51.100.77"
    headers = {"X-Forwarded-For": bot_ip}
    auth_rate_limiter.reset(bot_ip)

    now_ms = int(time.time() * 1000)
    # Submitted after only 50ms (impossible for human typing)
    fast_ts = now_ms - 50

    res = client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "any_password",
            "form_render_ts": fast_ts
        },
        headers=headers
    )
    assert res.status_code == 400
    assert "ตรวจพบความเร็วการส่งข้อมูลผิดปกติ" in res.json()["detail"]

    db = SessionLocal()
    timing_log = db.query(IamAuditLog).filter(
        IamAuditLog.action_type == "BOT_TIMING_VIOLATION",
        IamAuditLog.ip_address == bot_ip
    ).order_by(IamAuditLog.id.desc()).first()
    assert timing_log is not None
    assert timing_log.execution_mode == "BOT_DEFENSE"
    db.close()
