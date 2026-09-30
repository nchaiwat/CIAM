import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import MasterIdentity
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.models.user import AdminUser
from app.services.reconciliation import find_account_discrepancies

client = TestClient(app)

def get_admin_auth_header():
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_non_ad_local_portal_account_lifecycle():
    admin_headers = get_admin_auth_header()
    db = SessionLocal()
    try:
        # 1. Setup IRM spoke app and QMS spoke app
        irm_app = db.query(ConnectedApplication).filter_by(app_code="irm").first()
        if not irm_app:
            irm_app = ConnectedApplication(
                app_code="irm",
                app_name="Incoming Raw Material",
                connector_type="REST_API",
                is_active=True,
                sso_enabled=True,
                client_id="irm-spoke-client"
            )
            db.add(irm_app)
            db.commit()
            db.refresh(irm_app)

        qms_app = db.query(ConnectedApplication).filter_by(app_code="qms").first()
        if not qms_app:
            qms_app = ConnectedApplication(
                app_code="qms",
                app_name="Quality Management System",
                connector_type="REST_API",
                is_active=True,
                sso_enabled=True,
                client_id="qms-spoke-client"
            )
            db.add(qms_app)
            db.commit()
            db.refresh(qms_app)

        # 2. Setup Non-AD User created specifically in IRM: somchai_irm
        user_uname = "somchai_irm"
        # Cleanup if exists from previous runs
        old_admin = db.query(AdminUser).filter_by(username=user_uname).first()
        if old_admin:
            db.delete(old_admin)
        old_ident = db.query(MasterIdentity).filter_by(username=user_uname).first()
        if old_ident:
            db.delete(old_ident)
        db.commit()

        non_ad_ident = MasterIdentity(
            username=user_uname,
            full_name="Somchai Outsource",
            email="somchai.contractor@external.com",
            department="Warehouse Operations",
            is_active_in_ad=False,
            ad_guid=None
        )
        db.add(non_ad_ident)
        db.commit()
        db.refresh(non_ad_ident)

        irm_mapping = AppAccountMapping(
            identity_id=non_ad_ident.id,
            application_id=irm_app.id,
            app_username=user_uname,
            is_active_in_app=True,
            last_sync_status="IN_SYNC"
        )
        db.add(irm_mapping)
        db.commit()
        db.refresh(irm_mapping)

        # 3. Before approval as Local Account: User has no AdminUser and cannot log into Portal
        login_fail = client.post("/api/v1/auth/login", json={"username": user_uname, "password": "anypassword"})
        assert login_fail.status_code == 401

        # 4. Admin provisions Local Portal Account via API
        setup_res = client.post(
            f"/api/v1/directory/users/{non_ad_ident.id}/local-account",
            json={"notes": "Outsource contractor for IRM Warehouse"},
            headers=admin_headers
        )
        assert setup_res.status_code == 200
        setup_data = setup_res.json()
        assert setup_data["status"] == "SUCCESS"
        assert setup_data["username"] == user_uname
        assert setup_data["role"] == "PORTAL_USER"
        assert setup_data["is_approved_exception"] is True
        temp_pwd = setup_data["temporary_password"]
        assert len(temp_pwd) >= 6

        # 5. Non-AD User logs in with temporary password
        login_ok = client.post("/api/v1/auth/login", json={"username": user_uname, "password": temp_pwd})
        assert login_ok.status_code == 200
        user_token = login_ok.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # 6. Verify App Portal filters to ONLY show IRM (not QMS or others)
        portal_apps_res = client.get("/api/v1/oauth/portal/apps", headers=user_headers)
        assert portal_apps_res.status_code == 200
        portal_apps = portal_apps_res.json()
        app_codes = [a["app_code"] for a in portal_apps]
        assert "irm" in app_codes
        assert "qms" not in app_codes

        # 7. Non-AD User changes their password via profile endpoint
        new_pwd = "NewSecurePass2026!"
        change_res = client.put(
            "/api/v1/auth/profile",
            json={"new_password": new_pwd},
            headers=user_headers
        )
        assert change_res.status_code == 200

        # 8. Old password now rejected, new password works
        old_login = client.post("/api/v1/auth/login", json={"username": user_uname, "password": temp_pwd})
        assert old_login.status_code == 401

        new_login = client.post("/api/v1/auth/login", json={"username": user_uname, "password": new_pwd})
        assert new_login.status_code == 200

        # 9. Verify Reconciliation treats this user as approved exception (no ghost alert)
        db.expire_all()
        discrepancies = find_account_discrepancies(db)
        ghost_usernames = [d.username for d in discrepancies]
        assert user_uname not in ghost_usernames

    finally:
        # Cleanup
        to_clean_admin = db.query(AdminUser).filter_by(username="somchai_irm").first()
        if to_clean_admin:
            db.delete(to_clean_admin)
        to_clean_ident = db.query(MasterIdentity).filter_by(username="somchai_irm").first()
        if to_clean_ident:
            db.delete(to_clean_ident)
        db.commit()
        db.close()
