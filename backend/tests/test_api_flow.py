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
    assert data["kpi"]["total_identities"] >= 5
    # Confirm ghost account detection works
    assert data["kpi"]["ghost_accounts_count"] >= 1
    ghost_usernames = [d["username"] for d in data["discrepancies"]]
    assert "kittisak.s" in ghost_usernames

def test_directory_cross_app_matrix():
    response = client.get("/api/v1/directory/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 5

    # Check that connected_apps matrix is populated
    somchai = next((u for u in users if u["username"] == "somchai.p"), None)
    assert somchai is not None
    app_codes = [a["app_code"] for a in somchai["connected_apps"]]
    assert "irm" in app_codes
    assert "legacy_erp" in app_codes

def test_applications_and_ping():
    # List apps
    response = client.get("/api/v1/applications")
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) >= 3

    # Test ping on first app
    first_app_id = apps[0]["id"]
    ping_resp = client.post(f"/api/v1/applications/{first_app_id}/ping")
    assert ping_resp.status_code == 200
    assert ping_resp.json()["status"] in ["ONLINE", "OFFLINE"]

def test_offboarding_workflow():
    # 1. Preview blast radius for anuson.t (linked to IRM, QMS, and Legacy ERP RPA)
    prev_resp = client.post("/api/v1/offboarding/preview", json={"username": "anuson.t"})
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["total_apps_affected"] >= 3

    # 2. Execute 1-Click Offboard
    exec_resp = client.post(
        "/api/v1/offboarding/execute",
        json={
            "username": "anuson.t",
            "effective_date": "2026-09-03",
            "reason": "Resigned",
            "notes": "Completed formal clearance"
        }
    )
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["overall_status"] == "SUCCESS"
    assert exec_data["certificate_id"].startswith("CERT-")
    assert len(exec_data["checklist"]) >= 4 # AD + 3 apps

    # 3. Verify user status is now inactive in AD and apps
    user_resp = client.get("/api/v1/directory/users?search=anuson.t")
    assert user_resp.status_code == 200
    user_item = user_resp.json()[0]
    assert user_item["is_active_in_ad"] is False
    for app_mapping in user_item["connected_apps"]:
        assert app_mapping["is_active_in_app"] is False

def test_audit_logs_and_csv_export():
    # Check audit logs list
    response = client.get("/api/v1/audit-logs")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    actions = [item["action_type"] for item in data["items"]]
    assert "OFFBOARD_USER" in actions

    # Export CSV
    csv_resp = client.get("/api/v1/audit-logs/export-csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "OFFBOARD_USER" in csv_resp.text
