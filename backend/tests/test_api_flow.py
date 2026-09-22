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

    # Test ping on first app
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

    first_app = apps[0]
    payload = {
        "employee_id": f"EMP-{uid.upper()}",
        "username": test_username,
        "full_name": f"Lifecycle Test {uid}",
        "email": f"test.{uid}@windowasia.com",
        "department": "Engineering",
        "create_in_ad": True,
        "target_spokes": [
            {
                "application_id": first_app["id"],
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
