import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models.setting import SystemSetting
from app.connectors.base import ConnectorHealth
from app.services.telegram_service import (
    BANGKOK_TZ,
    get_sap_monitor_status,
    save_sap_monitor_config,
    check_and_notify_sap_status,
    send_sap_status_alert,
    trigger_test_sap_alert
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_sap_monitor_default_config_and_update():
    db = SessionLocal()
    try:
        # Reset setting
        setting = db.query(SystemSetting).filter_by(setting_key="sap_status_monitor").first()
        if setting:
            db.delete(setting)
            db.commit()

        # 1. Default should have check_interval_seconds = 300 (5 minutes)
        cfg = get_sap_monitor_status(db)
        assert cfg["current_status"] == "ONLINE"
        assert cfg["is_online"] is True
        assert cfg["check_interval_seconds"] == 300
        assert cfg["enabled"] is True

        # 2. Update interval to 600s (10 minutes)
        updated = save_sap_monitor_config(db, {"check_interval_seconds": 600})
        assert updated["check_interval_seconds"] == 600

        # Verify in DB
        db_cfg = get_sap_monitor_status(db)
        assert db_cfg["check_interval_seconds"] == 600
    finally:
        db.close()


@pytest.mark.anyio
async def test_sap_monitor_lifecycle_and_alerts():
    db = SessionLocal()
    try:
        # Reset setting
        setting = db.query(SystemSetting).filter_by(setting_key="sap_status_monitor").first()
        if setting:
            db.delete(setting)
            db.commit()

        # 1. Simulate SAP B1 going OFFLINE (Immediate Notification)
        with patch("app.connectors.sap_b1.SapB1Connector.health_check", new_callable=AsyncMock) as mock_health, \
             patch("app.services.telegram_service.send_telegram_message", new_callable=AsyncMock) as mock_send:
            mock_health.return_value = ConnectorHealth(is_online=False, latency_ms=2500, message="SAP B1 HTTP 502 Bad Gateway")
            mock_send.return_value = (True, "Success")

            res1 = await check_and_notify_sap_status(db, force_check=True)
            assert res1["status"] == "OFFLINE"
            assert res1["is_online"] is False
            assert res1["alert_sent"] is True
            assert res1["alert_type"] == "OFFLINE_IMMEDIATE"
            assert res1["state"]["total_offline_alerts_sent"] == 1
            assert res1["state"]["offline_since"] is not None

            # 2. Simulate SAP B1 STILL OFFLINE within 1 hour (No spam, alert_sent = False)
            res2 = await check_and_notify_sap_status(db, force_check=True)
            assert res2["status"] == "OFFLINE"
            assert res2["alert_sent"] is False
            assert res2["alert_type"] is None
            assert res2["state"]["total_offline_alerts_sent"] == 1

            # 3. Simulate 1 hour elapsed while still OFFLINE (Hourly Reminder)
            past_time = (datetime.now(timezone.utc).astimezone(BANGKOK_TZ) - timedelta(seconds=3700)).isoformat()
            setting_db = db.query(SystemSetting).filter_by(setting_key="sap_status_monitor").first()
            val = dict(setting_db.setting_value)
            val["last_notified_at"] = past_time
            val["offline_since"] = past_time
            setting_db.setting_value = val
            db.commit()

            res3 = await check_and_notify_sap_status(db, force_check=True)
            assert res3["status"] == "OFFLINE"
            assert res3["alert_sent"] is True
            assert res3["alert_type"] == "OFFLINE_REMINDER"
            assert res3["state"]["total_offline_alerts_sent"] == 2

            # 4. Simulate SAP B1 RECOVERED to ONLINE
            mock_health.return_value = ConnectorHealth(is_online=True, latency_ms=45, message="SAP B1 Service Layer v2 Online")
            res4 = await check_and_notify_sap_status(db, force_check=True)
            assert res4["status"] == "ONLINE"
            assert res4["is_online"] is True
            assert res4["alert_sent"] is True
            assert res4["alert_type"] == "ONLINE_RECOVERED"
            assert res4["state"]["total_offline_alerts_sent"] == 0
            assert res4["state"]["offline_since"] is None
    finally:
        db.close()


def test_sap_monitor_api_endpoints():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    if login_res.status_code == 423:
        # Unlock admin if locked by rate limiter
        from app.models.user import AdminUser
        db = SessionLocal()
        admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        if admin:
            admin.locked_until = None
            admin.failed_login_attempts = 0
            db.commit()
        db.close()
        login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})

    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /health-monitor includes sap_monitor
    res_get = client.get("/api/v1/dashboard/health-monitor", headers=headers)
    assert res_get.status_code == 200
    data = res_get.json()
    assert "sap_monitor" in data
    assert data["sap_monitor"]["check_interval_seconds"] >= 15

    # 2. PUT /health-monitor/sap-interval updates interval
    res_put = client.put(
        "/api/v1/dashboard/health-monitor/sap-interval",
        json={"check_interval_seconds": 300, "enabled": True},
        headers=headers
    )
    assert res_put.status_code == 200
    put_data = res_put.json()
    assert put_data["status"] == "success"
    assert put_data["sap_monitor"]["check_interval_seconds"] == 300

    # 3. POST /health-monitor/test-sap-alert
    with patch("app.services.telegram_service.send_telegram_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = (True, "Success")
        res_test = client.post(
            "/api/v1/dashboard/health-monitor/test-sap-alert",
            json={"alert_type": "OFFLINE_IMMEDIATE"},
            headers=headers
        )
        assert res_test.status_code == 200
        test_data = res_test.json()
        assert test_data["alert_type"] == "OFFLINE_IMMEDIATE"
