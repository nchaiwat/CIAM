import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.setting import SystemSetting
from app.models.audit import IamAuditLog
from app.services.daily_digest_service import (
    get_daily_digest_config,
    save_daily_digest_config,
    collect_daily_digest_metrics,
    render_daily_digest_html,
    send_daily_digest_email,
)

client = TestClient(app)


def test_daily_digest_config_management():
    db = SessionLocal()
    try:
        # 1. Clean existing setting
        db.query(SystemSetting).filter_by(setting_key="daily_email_digest_schedule").delete()
        db.commit()

        # 2. Get default config
        cfg = get_daily_digest_config(db, mask_password=True)
        assert cfg["enabled"] is False
        assert cfg["send_time"] == "07:00"
        assert cfg["smtp_host"] == "smtp.office365.com"
        assert cfg["has_password"] is False
        assert cfg["smtp_password_masked"] == ""

        # 3. Save new config with password
        saved = save_daily_digest_config(db, {
            "enabled": True,
            "send_time": "07:30",
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_user": "it-security@windowasia.com",
            "smtp_password": "super_secret_smtp_password",
            "from_email": "Window Asia Security <it-security@windowasia.com>",
            "recipients": ["admin1@windowasia.com", "admin2@windowasia.com"],
            "notify_admins_enabled": True
        })
        assert saved["enabled"] is True
        assert saved["send_time"] == "07:30"
        assert saved["smtp_host"] == "smtp.gmail.com"
        assert saved["has_password"] is True
        assert saved["smtp_password_masked"] == "******"
        assert len(saved["recipients"]) == 2

        # 4. Save without changing password (masked string)
        updated = save_daily_digest_config(db, {
            "send_time": "07:00",
            "smtp_password": "******"
        })
        assert updated["send_time"] == "07:00"
        # Verify in DB that raw password is still preserved
        raw_setting = db.query(SystemSetting).filter_by(setting_key="daily_email_digest_schedule").first()
        assert raw_setting.setting_value["smtp_password"] == "super_secret_smtp_password"
    finally:
        db.close()


def test_collect_metrics_and_render_html():
    db = SessionLocal()
    try:
        metrics = asyncio.run(collect_daily_digest_metrics(db))
        assert "kpi" in metrics
        assert "total_identities" in metrics["kpi"]
        assert "active_ad" in metrics["kpi"]
        assert "risk_level" in metrics
        assert metrics["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
        assert "connected_apps" in metrics
        assert "ghost_accounts" in metrics

        html = render_daily_digest_html(metrics)
        assert "WINDOW ASIA PUBLIC COMPANY LIMITED" in html
        assert "Central IAM • Daily Security & Identity Digest" in html
        assert "ตัวตนทั้งหมด" in html
        assert "https://ciam.windowasia.com" in html
    finally:
        db.close()


def test_send_daily_digest_email_success():
    db = SessionLocal()
    try:
        # Mock smtplib to simulate successful delivery
        with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
            mock_smtp.return_value = (True, "Delivered")

            res = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="TEST_ADMIN",
                custom_recipients=["security@windowasia.com"]
            ))
            assert res["success"] is True
            assert res["recipients_count"] >= 1
            assert "security@windowasia.com" in res["recipients"]

            # Verify IamAuditLog was written
            audit = (
                db.query(IamAuditLog)
                .filter(IamAuditLog.action_type == "DAILY_EMAIL_DIGEST")
                .order_by(IamAuditLog.created_at.desc())
                .first()
            )
            assert audit is not None
            assert audit.actor_username == "TEST_ADMIN"
            assert audit.status == "SUCCESS"
            assert "DAILY_EMAIL_DIGEST" in audit.action_type
    finally:
        db.close()


def test_api_daily_digest_endpoints():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/v1/dashboard/daily-digest
    get_res = client.get("/api/v1/dashboard/daily-digest", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert "config" in data
    assert "preview_metrics" in data

    # 2. PUT /api/v1/dashboard/daily-digest
    put_res = client.put(
        "/api/v1/dashboard/daily-digest",
        json={
            "enabled": True,
            "send_time": "07:00",
            "smtp_host": "smtp.office365.com",
            "smtp_port": 587,
            "smtp_user": "alert@windowasia.com",
            "recipients": ["lead-admin@windowasia.com"]
        },
        headers=headers
    )
    assert put_res.status_code == 200
    put_data = put_res.json()
    assert put_data["status"] == "success"
    assert put_data["config"]["send_time"] == "07:00"

    # 3. GET /api/v1/dashboard/daily-digest/preview-html
    preview_res = client.get("/api/v1/dashboard/daily-digest/preview-html", headers=headers)
    assert preview_res.status_code == 200
    assert "text/html" in preview_res.headers["content-type"]
    assert "Central IAM • Daily Security & Identity Digest" in preview_res.text

    # 4. POST /api/v1/dashboard/daily-digest/test-send with mock
    with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
        mock_smtp.return_value = (True, "Delivered")
        send_res = client.post(
            "/api/v1/dashboard/daily-digest/test-send",
            json={"custom_recipients": ["test-lead@windowasia.com"]},
            headers=headers
        )
        assert send_res.status_code == 200
        send_data = send_res.json()
        assert send_data["success"] is True
        assert "test-lead@windowasia.com" in send_data["recipients"]


def test_send_daily_digest_many_recipients_target_length():
    """Verify that multiple recipients do not overflow the 100-character target_username limit in audit logs."""
    db = SessionLocal()
    try:
        many_recipients = [
            f"user{i}_very_long_department_staff_member@windowasia.com"
            for i in range(10)
        ]
        with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
            mock_smtp.return_value = (True, "Delivered to all")

            res = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="TEST_ADMIN_STRESS",
                custom_recipients=many_recipients
            ))
            assert res["success"] is True

            audit = (
                db.query(IamAuditLog)
                .filter(IamAuditLog.actor_username == "TEST_ADMIN_STRESS")
                .order_by(IamAuditLog.created_at.desc())
                .first()
            )
            assert audit is not None
            # Target username must strictly be <= 95 characters
            assert len(audit.target_username) <= 95
            assert "recipients" in audit.target_username
            assert audit.status == "SUCCESS"
    finally:
        db.close()


def test_send_daily_digest_smtp_failure_creates_failed_audit_log():
    """Verify that SMTP failure returns clean error response and logs FAILED audit log without 500 error."""
    db = SessionLocal()
    try:
        with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
            mock_smtp.return_value = (False, "Authentication failed: 535 5.7.8 Username and Password not accepted")

            res = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="TEST_FAIL_ADMIN",
                custom_recipients=["test-fail@windowasia.com"]
            ))
            assert res["success"] is False
            assert "Authentication failed" in res["error"]

            audit = (
                db.query(IamAuditLog)
                .filter(IamAuditLog.actor_username == "TEST_FAIL_ADMIN")
                .order_by(IamAuditLog.created_at.desc())
                .first()
            )
            assert audit is not None
            assert audit.status == "FAILED"
            assert "ล้มเหลว" in audit.reason
    finally:
        db.close()


def test_send_smtp_sync_envelope_and_ssl_handling():
    """Verify that _send_smtp_sync extracts envelope address and handles port 465 SSL."""
    from app.services.daily_digest_service import _send_smtp_sync

    with patch("smtplib.SMTP_SSL") as mock_ssl:
        instance = MagicMock()
        mock_ssl.return_value = instance

        success, msg = _send_smtp_sync(
            smtp_host="smtp.gmail.com",
            smtp_port=465,
            smtp_user="itwindowasia@gmail.com",
            smtp_password="abcd efgh ijkl mnop",
            use_tls=True,
            from_email="Window Asia Central IAM <ciam-alert@windowasia.com>",
            recipients=["chaiwat.n@windowasia.com", "itwa@windowasia.com"],
            subject="Test Subject",
            html_content="<p>Hello</p>",
            text_content="Hello"
        )

        assert success is True
        mock_ssl.assert_called_once_with("smtp.gmail.com", 465, timeout=20)
        instance.sendmail.assert_called_once()
        args, _ = instance.sendmail.call_args
        assert args[0] == "ciam-alert@windowasia.com"
        assert args[1] == ["chaiwat.n@windowasia.com", "itwa@windowasia.com"]


def test_send_daily_digest_strips_stray_thai_karant_and_non_ascii():
    """Verify that stray Thai characters like \u0e4c before email are safely sanitized."""
    from app.services.daily_digest_service import sanitize_email_address, _clean_recipient_list

    # Test individual sanitization
    assert sanitize_email_address("์nittaya.s@windowasia.com") == "nittaya.s@windowasia.com"
    assert sanitize_email_address(" chaiwat.n@windowasia.com ") == "chaiwat.n@windowasia.com"
    assert sanitize_email_address("Window Asia <itwa@windowasia.com>") == "itwa@windowasia.com"

    # Test list sanitization
    dirty_list = [
        "chaiwat.n@windowasia.com",
        "์nittaya.s@windowasia.com",
        "Nakprat.P@windowasia.com",
        "invalid-without-at",
        "์admin.ciam@windowasia.com"
    ]
    cleaned = _clean_recipient_list(dirty_list)
    assert "nittaya.s@windowasia.com" in cleaned
    assert "admin.ciam@windowasia.com" in cleaned
    assert "invalid-without-at" not in cleaned
    for em in cleaned:
        # All sanitized emails must strictly be valid ASCII
        em.encode("ascii")


def test_test_send_does_not_append_admins():
    """Verify that test send with custom recipients strictly sends only to specified recipients."""
    db = SessionLocal()
    try:
        with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
            mock_smtp.return_value = (True, "Delivered")
            res = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="TEST_ADMIN",
                custom_recipients=["chaiwat.n@windowasia.com", "itwa@windowasia.com"],
                include_admins=False
            ))
            assert res["success"] is True
            assert res["recipients"] == ["chaiwat.n@windowasia.com", "itwa@windowasia.com"]
            assert res["recipients_count"] == 2
    finally:
        db.close()


def test_manual_test_send_does_not_pollute_scheduled_date():
    """Verify that manual test send does NOT set last_scheduled_date, but auto scheduled run does."""
    db = SessionLocal()
    try:
        with patch("app.services.daily_digest_service._send_smtp_sync") as mock_smtp:
            mock_smtp.return_value = (True, "Delivered")

            # 1. Manual test send
            res_manual = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="MANUAL_TEST_admin",
                custom_recipients=["admin@windowasia.com"]
            ))
            assert res_manual["success"] is True

            cfg = get_daily_digest_config(db, mask_password=False)
            assert cfg.get("last_scheduled_date") is None

            # 2. Automated scheduled run
            res_auto = asyncio.run(send_daily_digest_email(
                db=db,
                triggered_by="AUTO_SCHEDULED_07:00",
                custom_recipients=["admin@windowasia.com"]
            ))
            assert res_auto["success"] is True

            cfg_after = get_daily_digest_config(db, mask_password=False)
            assert cfg_after.get("last_scheduled_date") is not None
    finally:
        db.close()




