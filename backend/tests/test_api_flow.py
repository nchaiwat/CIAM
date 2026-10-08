import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"

def test_login_and_auth():
    # Correct login
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["user"]["username"] == "admin"

    # Profile check with token
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "admin"


def test_login_honeypot_trap():
    """ISO 27001 Security: Bot submitting decoy honeypot fields must be rejected immediately."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "admin123",
            "corporate_fax": "bot_automated_spammer_value"
        }
    )
    assert response.status_code == 401
    assert "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" in response.json()["detail"]


def test_login_brute_force_lockout():
    """ISO 27001 Security: Consecutive failed logins must trigger account lockout."""
    # Reset admin state first by successful login
    client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})

    # 4 failed attempts: return 401
    for _ in range(4):
        res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong_password"})
        assert res.status_code == 401

    # 5th failed attempt: triggers lockout
    res_5th = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong_password"})
    assert res_5th.status_code == 401

    # 6th attempt (even with correct password): account is locked (HTTP 423)
    res_locked = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res_locked.status_code == 423
    assert "ระงับชั่วคราว" in res_locked.json()["detail"]

    # Unlock admin for subsequent tests
    from app.core.database import SessionLocal
    from app.models.user import AdminUser
    db = SessionLocal()
    admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
    if admin:
        admin.locked_until = None
        admin.failed_login_attempts = 0
        db.commit()
    db.close()


def test_dashboard_and_reconciliation_alert():
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["kpi"]["total_identities"] >= 1
    assert "discrepancies" in data

def test_directory_cross_app_matrix():
    response = client.get("/api/v1/directory/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 1

    # Check that connected_apps matrix is populated for available users
    all_connected_apps = [a["app_code"] for u in users for a in u["connected_apps"]]
    assert "irm" in all_connected_apps

def test_applications_and_ping():
    # Login first
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List apps
    response = client.get("/api/v1/applications", headers=headers)
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) >= 2

    # Test ping on first app (mock connector health_check to avoid hitting external production IRM during tests)
    from unittest.mock import patch, AsyncMock
    from app.connectors.base import ConnectorHealth

    with patch("app.connectors.rest_api.RestApiConnector.health_check", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = ConnectorHealth(is_online=True, latency_ms=12, message="Mocked Online")
        first_app = apps[0]
        first_app_id = first_app["id"]
        ping_resp = client.post(f"/api/v1/applications/{first_app_id}/ping", headers=headers)
        assert ping_resp.status_code == 200
        assert ping_resp.json()["status"] in ["ONLINE", "OFFLINE"]

    # Test get credentials
    cred_resp = client.get(f"/api/v1/applications/{first_app_id}/credentials", headers=headers)
    assert cred_resp.status_code == 200
    cred_data = cred_resp.json()
    assert cred_data["header_name"] == "X-Management-API-Key"
    assert "api_key" in cred_data

    # Test patch update
    old_name = first_app["app_name"]
    patch_resp = client.patch(
        f"/api/v1/applications/{first_app_id}",
        json={"app_name": f"{old_name} (Updated)"},
        headers=headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["app_name"] == f"{old_name} (Updated)"

    # Revert back
    revert_resp = client.patch(
        f"/api/v1/applications/{first_app_id}",
        json={"app_name": old_name},
        headers=headers
    )
    assert revert_resp.status_code == 200
    assert revert_resp.json()["app_name"] == old_name

def test_create_provision_and_lifecycle():
    # Login first
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get available apps
    apps_res = client.get("/api/v1/applications", headers=headers)
    assert apps_res.status_code == 200
    apps = apps_res.json()
    assert len(apps) > 0

    import uuid
    uid = uuid.uuid4().hex[:6]
    test_username = f"test.user.{uid}"

    # Register an isolated mock spoke application for lifecycle test so it never hits external production
    mock_app_res = client.post(
        "/api/v1/applications",
        json={
            "app_code": f"test_mock_{uid}",
            "app_name": f"Test Mock Spoke {uid}",
            "connector_type": "REST_API",
            "base_url": "mock://internal-test-spoke",
            "api_key": "sec_test_mock_key"
        },
        headers=headers
    )
    assert mock_app_res.status_code == 200
    mock_app = mock_app_res.json()

    payload = {
        "employee_id": f"EMP-{uid.upper()}",
        "username": test_username,
        "full_name": f"Lifecycle Test {uid}",
        "email": f"test.{uid}@windowasia.com",
        "department": "Engineering",
        "create_in_ad": True,
        "target_spokes": [
            {
                "application_id": mock_app["id"],
                "group_name": "QA Tester"
            }
        ]
    }

    # 1. Create and Provision
    create_res = client.post("/api/v1/directory/users", json=payload, headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["username"] == test_username
    assert data["ad_status"] == "ACTIVE"
    assert len(data["spoke_results"]) == 1

    # 2. Preview Offboarding
    prev_resp = client.post("/api/v1/offboarding/preview", json={"username": test_username})
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["total_apps_affected"] >= 1

    # 3. Execute 1-Click Offboarding
    exec_resp = client.post(
        "/api/v1/offboarding/execute",
        json={
            "username": test_username,
            "effective_date": "2026-09-09",
            "reason": "Test clearance",
            "notes": "Automated integration test lifecycle"
        }
    )
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["overall_status"] in ["SUCCESS", "PARTIAL"]
    assert exec_data["certificate_id"].startswith("CERT-")

    # Verify user state is now inactive
    user_resp = client.get(f"/api/v1/directory/users?search={test_username}", headers=headers)
    assert user_resp.status_code == 200
    user_item = user_resp.json()[0]
    assert user_item["is_active_in_ad"] is False

    # 4. Reactivate user
    act_res = client.post(
        f"/api/v1/directory/users/{user_item['id']}/activate",
        json={"reason": "Re-hired by organization"},
        headers=headers
    )
    assert act_res.status_code == 200
    act_data = act_res.json()
    assert act_data["ad_status"] == "ACTIVE"

    # Clean up test user so test doesn't leave clutter
    from app.core.database import SessionLocal
    from app.models.identity import MasterIdentity
    from app.models.mapping import AppAccountMapping
    db = SessionLocal()
    ident = db.query(MasterIdentity).filter(MasterIdentity.username == test_username).first()
    if ident:
        db.query(AppAccountMapping).filter(AppAccountMapping.identity_id == ident.id).delete()
        db.delete(ident)
        db.commit()
    db.close()
    client.delete(f"/api/v1/applications/{mock_app['id']}", headers=headers)

def test_audit_logs_and_csv_export():
    # Check audit logs list
    response = client.get("/api/v1/audit-logs")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0

    # Export CSV
    csv_resp = client.get("/api/v1/audit-logs/export-csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]

def test_delete_application_lifecycle():
    # Login
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a dummy app to delete
    import uuid
    dummy_code = f"dummy_{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/applications",
        json={
            "app_code": dummy_code,
            "app_name": f"Dummy App {dummy_code}",
            "connector_type": "REST_API",
            "base_url": "https://example.com/api"
        },
        headers=headers
    )
    assert create_res.status_code == 200
    dummy_id = create_res.json()["id"]

    # 2. Delete the application
    del_res = client.delete(f"/api/v1/applications/{dummy_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 3. Confirm it's gone
    get_res = client.get(f"/api/v1/applications/{dummy_id}/credentials", headers=headers)
    assert get_res.status_code == 404

def test_admin_roles_and_power_user_assignment():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List admins
    admins_res = client.get("/api/v1/auth/admins", headers=headers)
    assert admins_res.status_code == 200
    admins = admins_res.json()
    assert isinstance(admins, list)
    assert any(a["username"] == "admin" for a in admins)

    # 2. Update a test employee role to Power User (ADMIN)
    update_res = client.patch(
        "/api/v1/auth/admins/Thanaphat.C/role",
        json={"role": "ADMIN"},
        headers=headers
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["username"] == "Thanaphat.C"
    assert data["role"] == "ADMIN"

    # 3. Verify role in admin list
    admins_check = client.get("/api/v1/auth/admins", headers=headers).json()
    thanaphat = next((a for a in admins_check if a["username"] == "Thanaphat.C"), None)
    assert thanaphat is not None
    assert thanaphat["role"] == "ADMIN"

def test_download_spoke_spec():
    # 1. Standard API endpoint
    res = client.get("/api/v1/applications/spec/download")
    assert res.status_code == 200
    assert "text/markdown" in res.headers["content-type"]
    assert "Central IAM" in res.text
    assert "v2.7.0" in res.headers.get("content-disposition", "")

    # 2. Resilient double-prefix fallback endpoint
    res2 = client.get("/api/v1/api/v1/applications/spec/download")
    assert res2.status_code == 200
    assert "text/markdown" in res2.headers["content-type"]
    assert "Central IAM" in res2.text
    assert "v2.7.0" in res2.headers.get("content-disposition", "")

def test_user_create_with_telegram_id():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    import uuid
    rand_user = f"user_{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/directory/users",
        json={
            "username": rand_user,
            "full_name": f"Test Employee {rand_user}",
            "email": f"{rand_user}@windowasia.com",
            "department": "IT",
            "telephone": "089-999-9999",
            "telegram_id": "@windowasia_dev",
            "create_in_ad": False,
            "target_spokes": []
        },
        headers=headers
    )
    assert create_res.status_code == 201

    # Check detail
    identity_id = create_res.json()["identity_id"]
    detail_res = client.get(f"/api/v1/directory/users/{identity_id}", headers=headers)
    assert detail_res.status_code == 200
    user_data = detail_res.json()["user"]
    assert user_data["telegram_id"] == "@windowasia_dev"

def test_admin_profile_telegram_id():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update profile with telegram_id
    update_res = client.put(
        "/api/v1/auth/profile",
        json={
            "full_name": "Somchai N. (IT Security Lead)",
            "telegram_id": "@chaiwat_admin",
            "email": "chaiwat.n@windowasia.com"
        },
        headers=headers
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["telegram_id"] == "@chaiwat_admin"
    assert "Somchai N." in data["full_name"]

    # Verify /me returns telegram_id
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["telegram_id"] == "@chaiwat_admin"

def test_health_monitor_schedule_and_alert():
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get health monitor config and live health
    get_res = client.get("/api/v1/dashboard/health-monitor", headers=headers)
    assert get_res.status_code == 200
    res_data = get_res.json()
    assert "config" in res_data
    assert "live_health" in res_data
    assert "ad_sync_agent" in res_data["live_health"]

    # 2. Update health monitor schedule (e.g. 08:00, every 4 hours)
    put_res = client.put(
        "/api/v1/dashboard/health-monitor",
        json={
            "enabled": True,
            "start_time": "08:00",
            "interval_hours": 4,
            "bot_token": "123456:FAKE_TELEGRAM_BOT_TOKEN_FOR_TEST",
            "chat_id": "-1001234567890",
            "notify_admins_enabled": True
        },
        headers=headers
    )
    assert put_res.status_code == 200
    saved_cfg = put_res.json()["config"]
    assert saved_cfg["enabled"] is True
    assert saved_cfg["start_time"] == "08:00"
    assert saved_cfg["interval_hours"] == 4
    assert saved_cfg["chat_id"] == "-1001234567890"

    # 3. Test triggering alert (will simulate attempt and report delivery details)
    alert_res = client.post(
        "/api/v1/dashboard/health-monitor/test-alert",
        json={},
        headers=headers
    )
    assert alert_res.status_code == 200
    alert_data = alert_res.json()
    assert "health" in alert_data
    assert "summary" in alert_data


def test_sso_only_connector_lifecycle():
    import uuid
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Register a new app with connector_type SSO_ONLY
    app_code = f"sso_app_{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/applications",
        json={
            "app_code": app_code,
            "app_name": f"On-Prem App {app_code}",
            "connector_type": "SSO_ONLY",
            "base_url": "https://internal-app.windowasia.local"
        },
        headers=headers
    )
    assert create_res.status_code == 200
    app_data = create_res.json()
    app_id = app_data["id"]
    assert app_data["connector_type"] == "SSO_ONLY"
    assert app_data["health_status"] == "ONLINE"
    assert app_data["spoke_sso_status"] == "ACTIVE"

    # 2. Ping the SSO_ONLY application
    ping_res = client.post(f"/api/v1/applications/{app_id}/ping", headers=headers)
    assert ping_res.status_code == 200
    ping_data = ping_res.json()
    assert ping_data["status"] == "ONLINE"
    assert ping_data["spoke_sso_status"] == "ACTIVE"

    # 3. Check inventory
    inv_res = client.get(f"/api/v1/applications/{app_id}/inventory", headers=headers)
    assert inv_res.status_code == 200
    inv_data = inv_res.json()
    assert inv_data["mode"] == "SSO_CLIENT_ONLY"

    # 4. Clean up
    del_res = client.delete(f"/api/v1/applications/{app_id}", headers=headers)
    assert del_res.status_code == 200


def test_agent_heartbeat_and_command_queue():
    import uuid
    from app.connectors.factory import get_connector_for_app
    from app.models.application import ConnectedApplication, SpokePendingCommand
    from app.core.database import SessionLocal

    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Register test spoke app
    test_code = f"agent_test_{uuid.uuid4().hex[:6]}"
    test_key = "sec_test_agent_m2m_key_12345"
    create_res = client.post(
        "/api/v1/applications",
        json={
            "app_code": test_code,
            "app_name": f"Agent Test {test_code}",
            "connector_type": "SSO_ONLY",
            "api_key": test_key
        },
        headers=headers
    )
    assert create_res.status_code == 200
    app_id = create_res.json()["id"]

    # 2. Queue a disable user command via SsoOnlyConnector
    db = SessionLocal()
    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    connector = get_connector_for_app(app)
    import asyncio
    asyncio.run(connector.set_account_status(username="test_emp_01", is_active=False, reason="Resigned employee"))
    db.close()

    # 3. Simulate Agent sending Heartbeat + Full Sync
    agent_headers = {
        "X-Spoke-Client-ID": f"{test_code}-spoke-client",
        "X-Spoke-API-Key": test_key
    }
    hb_payload = {
        "app_code": test_code,
        "sync_type": "FULL_SYNC",
        "accounts": [
            {
                "username": "test_emp_01",
                "full_name": "Test Employee 01",
                "email": "test01@windowasia.com",
                "role": "Staff",
                "is_active": True
            }
        ]
    }
    hb_res = client.post("/api/v1/agent/heartbeat", json=hb_payload, headers=agent_headers)
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["status"] == "ACKNOWLEDGED"
    assert len(hb_data["pending_commands"]) >= 1
    target_cmd = hb_data["pending_commands"][0]
    assert target_cmd["action"] == "DISABLE_USER"
    assert target_cmd["username"] == "test_emp_01"
    cmd_id = target_cmd["command_id"]

    # 4. Simulate Agent reporting command execution result
    res_payload = {
        "app_code": test_code,
        "sync_type": "HEARTBEAT",
        "command_results": [
            {
                "command_id": cmd_id,
                "action": "DISABLE_USER",
                "username": "test_emp_01",
                "status": "COMPLETED",
                "message": "User disabled in local SQLite/PostgreSQL"
            }
        ]
    }
    hb2_res = client.post("/api/v1/agent/heartbeat", json=res_payload, headers=agent_headers)
    assert hb2_res.status_code == 200
    hb2_data = hb2_res.json()
    assert hb2_data["status"] == "ACKNOWLEDGED"
    # The command should no longer be pending
    assert not any(c["command_id"] == cmd_id for c in hb2_data["pending_commands"])

    # 5. Clean up
    del_res = client.delete(f"/api/v1/applications/{app_id}", headers=headers)
    assert del_res.status_code == 200


def test_granular_spoke_status_toggle_and_alphabetical_sorting():
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch directory users
    res = client.get("/api/v1/directory/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert len(users) > 0

    # Verify alphabetical sorting of connected_apps for all users with multiple apps
    for u in users:
        apps = u.get("connected_apps", [])
        if len(apps) > 1:
            app_codes = [a["app_code"].upper() for a in apps]
            assert app_codes == sorted(app_codes), f"Apps not sorted alphabetically: {app_codes}"

    # 2. Find a user with a connected app to test granular status toggle
    target_user = next((u for u in users if len(u.get("connected_apps", [])) > 0), None)
    assert target_user is not None
    target_app = target_user["connected_apps"][0]
    mapping_id = target_app["mapping_id"]
    initial_status = target_app["is_active_in_app"]

    # 3. Toggle status to the opposite
    toggle_res = client.patch(
        f"/api/v1/directory/accounts/{mapping_id}/status",
        headers=headers,
        json={"is_active": not initial_status, "reason": "Test granular deprovisioning"}
    )
    assert toggle_res.status_code == 200
    toggle_data = toggle_res.json()
    assert toggle_data["status"] == "SUCCESS"
    assert toggle_data["details"]["is_active_in_app"] == (not initial_status)

    # 4. Re-fetch user and verify updated status
    refreshed_res = client.get(f"/api/v1/directory/users/{target_user['id']}", headers=headers)
    assert refreshed_res.status_code == 200
    refreshed_user = refreshed_res.json()["user"]
    refreshed_app = next(a for a in refreshed_user["connected_apps"] if a["mapping_id"] == mapping_id)
    assert refreshed_app["is_active_in_app"] == (not initial_status)

    # 5. Restore original status
    restore_res = client.patch(
        f"/api/v1/directory/accounts/{mapping_id}/status",
        headers=headers,
        json={"is_active": initial_status, "reason": "Restore original status"}
    )
    assert restore_res.status_code == 200

def test_ad_account_status_preservation_and_auto_heal():
    from app.core.database import SessionLocal
    from app.models.identity import MasterIdentity
    from app.initial_data import init_db

    # 1. Simulate a corporate identity having is_active_in_ad = False
    with SessionLocal() as db:
        test_user = db.query(MasterIdentity).filter(MasterIdentity.username == "Patcha.S").first()
        if test_user:
            test_user.is_active_in_ad = False
            db.commit()

    # 2. Run init_db auto-heal
    init_db()

    # 3. Verify that Patcha.S was auto-healed back to Active
    with SessionLocal() as db:
        healed_user = db.query(MasterIdentity).filter(MasterIdentity.username == "Patcha.S").first()
        assert healed_user is not None
        assert healed_user.is_active_in_ad is True




