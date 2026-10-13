import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models.setting import SystemSetting
from app.connectors.base import ConnectorHealth
from app.services.telegram_service import (
    BANGKOK_TZ,
    format_duration,
    get_ad_monitor_status,
    check_and_notify_ad_status,
    send_ad_status_alert
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_format_duration():
    assert format_duration(30) == "0 นาที"
    assert format_duration(90) == "1 นาที"
    assert format_duration(3600) == "1 ชั่วโมง"
    assert format_duration(3660) == "1 ชั่วโมง 1 นาที"
    assert format_duration(7500) == "2 ชั่วโมง 5 นาที"
    assert format_duration(90000) == "1 วัน 1 ชั่วโมง"

@pytest.mark.anyio
async def test_ad_monitor_lifecycle():
    db = SessionLocal()
    try:
        # Reset any prior setting
        setting = db.query(SystemSetting).filter_by(setting_key="ad_status_monitor").first()
        if setting:
            db.delete(setting)
            db.commit()

        initial_state = get_ad_monitor_status(db)
        assert initial_state["current_status"] == "ONLINE"
        assert initial_state["total_offline_alerts_sent"] == 0

        # 1. Simulate AD going OFFLINE (Immediate Notification)
        with patch("app.connectors.ad_proxy.AdProxyConnector.health_check", new_callable=AsyncMock) as mock_health, \
             patch("app.services.telegram_service.send_telegram_message", new_callable=AsyncMock) as mock_send:
            mock_health.return_value = ConnectorHealth(is_online=False, latency_ms=15, message="Connection refused")
            mock_send.return_value = (True, "Success")

            res1 = await check_and_notify_ad_status(db)
            assert res1["status"] == "OFFLINE"
            assert res1["is_online"] is False
            assert res1["alert_sent"] is True
            assert res1["alert_type"] == "OFFLINE_IMMEDIATE"
            assert res1["state"]["total_offline_alerts_sent"] == 1
            assert res1["state"]["offline_since"] is not None

            # 2. Simulate AD STILL OFFLINE but within 1 hour (No spam, no alert)
            res2 = await check_and_notify_ad_status(db)
            assert res2["status"] == "OFFLINE"
            assert res2["alert_sent"] is False
            assert res2["alert_type"] is None
            assert res2["state"]["total_offline_alerts_sent"] == 1

            # 3. Simulate AD STILL OFFLINE and 65 minutes passed (Hourly Reminder)
            # Adjust last_notified_at to 65 minutes ago
            st = db.query(SystemSetting).filter_by(setting_key="ad_status_monitor").first()
            val = dict(st.setting_value)
            t_65m_ago = (datetime.now(timezone.utc).astimezone(BANGKOK_TZ) - timedelta(minutes=65)).isoformat()
            val["last_notified_at"] = t_65m_ago
            st.setting_value = val
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(st, "setting_value")
            db.commit()

            res3 = await check_and_notify_ad_status(db)
            assert res3["status"] == "OFFLINE"
            assert res3["alert_sent"] is True
            assert res3["alert_type"] == "OFFLINE_REMINDER"
            assert res3["state"]["total_offline_alerts_sent"] == 2

            # 4. Simulate AD RECOVERED back to ONLINE (Immediate Recovery Notification)
            mock_health.return_value = ConnectorHealth(is_online=True, latency_ms=10, message="AD Gateway Online")
            res4 = await check_and_notify_ad_status(db)
            assert res4["status"] == "ONLINE"
            assert res4["is_online"] is True
            assert res4["alert_sent"] is True
            assert res4["alert_type"] == "ONLINE_RECOVERED"
            assert res4["state"]["total_offline_alerts_sent"] == 0
            assert res4["state"]["offline_since"] is None

            # 5. Subsequent run while ONLINE (Normal, no alert)
            res5 = await check_and_notify_ad_status(db)
            assert res5["status"] == "ONLINE"
            assert res5["alert_sent"] is False
            assert res5["alert_type"] is None
    finally:
        db.close()

def test_api_test_ad_alerts_and_check_now():
    # Login as admin
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test triggering test alert (OFFLINE_IMMEDIATE)
    res_test1 = client.post(
        "/api/v1/dashboard/health-monitor/test-ad-alert",
        json={"alert_type": "OFFLINE_IMMEDIATE"},
        headers=headers
    )
    assert res_test1.status_code == 200
    data1 = res_test1.json()
    assert data1["alert_type"] == "OFFLINE_IMMEDIATE"
    assert "success" in data1

    # 2. Test triggering test alert (ONLINE_RECOVERED)
    res_test2 = client.post(
        "/api/v1/dashboard/health-monitor/test-ad-alert",
        json={"alert_type": "ONLINE_RECOVERED"},
        headers=headers
    )
    assert res_test2.status_code == 200
    data2 = res_test2.json()
    assert data2["alert_type"] == "ONLINE_RECOVERED"

    # 3. Test check-ad-now endpoint
    res_check = client.post(
        "/api/v1/dashboard/health-monitor/check-ad-now",
        headers=headers
    )
    assert res_check.status_code == 200
    check_data = res_check.json()
    assert "status" in check_data
    assert "is_online" in check_data
    assert "state" in check_data

    # 4. Confirm health-monitor endpoint returns ad_monitor
    res_get = client.get(
        "/api/v1/dashboard/health-monitor",
        headers=headers
    )
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert "ad_monitor" in get_data
    assert "current_status" in get_data["ad_monitor"]
