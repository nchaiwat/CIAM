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

        # 7. Non-AD User changes their password via profile endpoint (Enterprise 8-10 chars policy)
        new_pwd = "Wa@2026Ab"
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


def test_one_way_ad_and_local_account_creation_with_spoke_sync():
    """
    Verify:
    1. Creating a Local Account via POST /api/v1/directory/users (create_in_ad=False, dept='IT')
       sets LOCAL_ACCOUNT exception, returns temporary_password, never calls AD Proxy provision,
       never triggers false-positive Ghost Account (บัญชีผี), and allows immediate Portal login.
    2. Spoke Mode A provision payload includes password and use_ad_auth=False.
    3. Assigning an existing AD user or Local Account via /assign-app invokes provision_account
       without AttributeError, sets PENDING_PROVISION on failure, and recovers via Mode A sync push.
    4. Mode C /agent/heartbeat pushes PROVISION_USER for non-AD Local Accounts too.
    """
    import asyncio
    from unittest.mock import patch, AsyncMock
    from sqlalchemy import func
    from app.connectors.base import ConnectorResult
    from app.models.application import SpokePendingCommand
    from app.services.scheduler import push_pending_provisions_to_spoke

    admin_headers = get_admin_auth_header()
    db = SessionLocal()
    local_uname = "test.local.petty"
    ad_uname = "ad.existing.tester"

    try:
        # Pre-cleanup
        for u in (local_uname, ad_uname):
            db.query(SpokePendingCommand).filter(func.lower(SpokePendingCommand.username) == u).delete()
            old_adm = db.query(AdminUser).filter(func.lower(AdminUser.username) == u).first()
            if old_adm:
                db.delete(old_adm)
            old_id = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == u).first()
            if old_id:
                db.delete(old_id)
        for code in ("petty_mode_a", "petty_mode_c"):
            old_app = db.query(ConnectedApplication).filter_by(app_code=code).first()
            if old_app:
                db.delete(old_app)
        db.commit()

        # Setup Mode A & Mode C test spokes
        mode_a_app = ConnectedApplication(
            app_code="petty_mode_a",
            app_name="PettyCash Mode A",
            connector_type="REST_API",
            base_url="http://pettycash.internal",
            api_key="sec_petty_a",
            sso_enabled=True,
            is_active=True,
        )
        mode_c_app = ConnectedApplication(
            app_code="petty_mode_c",
            app_name="PettyCash Mode C",
            connector_type="SSO_ONLY",
            base_url="https://pettycash-c.internal",
            api_key="sec_petty_c",
            client_id="petty-c-client",
            sso_enabled=True,
            is_active=True,
        )
        db.add_all([mode_a_app, mode_c_app])
        db.commit()
        db.refresh(mode_a_app)
        db.refresh(mode_c_app)

        captured_payloads = []

        async def _capture_provision(self, account_data: dict) -> ConnectorResult:
            captured_payloads.append({"app_code": self.app_code, **account_data})
            return ConnectorResult(
                success=True,
                status_code=201,
                execution_mode="SYNC_REST",
                message=f"Created {account_data.get('username')}",
                execution_time_ms=5,
            )

        with patch("app.connectors.ad_proxy.AdProxyConnector.provision_account", new_callable=AsyncMock) as mock_ad_prov, \
             patch("app.connectors.rest_api.RestApiConnector.provision_account", new=_capture_provision):
            # 1. Create Local Account with department='IT' and initial password
            create_res = client.post(
                "/api/v1/directory/users",
                json={
                    "username": local_uname,
                    "full_name": "ทดสอบ ระบบPettycash",
                    "department": "IT",
                    "create_in_ad": False,
                    "password": "Wa@Local2026!",
                    "must_change_password": False,
                    "target_spokes": [
                        {"application_id": mode_a_app.id, "group_name": "Standard User"},
                        {"application_id": mode_c_app.id, "group_name": "Viewer"},
                    ],
                },
                headers=admin_headers,
            )
            assert create_res.status_code == 201, create_res.text
            cdata = create_res.json()
            assert cdata["ad_status"] == "LOCAL_ACCOUNT"
            assert cdata["temporary_password"] == "Wa@Local2026!"
            assert len(cdata["spoke_results"]) == 2
            mock_ad_prov.assert_not_called()

        # Verify password & use_ad_auth=False sent to Mode A Spoke
        assert len(captured_payloads) == 1
        assert captured_payloads[0]["username"] == local_uname
        assert captured_payloads[0]["use_ad_auth"] is False
        assert captured_payloads[0]["password"] == "Wa@Local2026!"

        # Verify Local Account can log into CIAM immediately with initial password
        login_res = client.post("/api/v1/auth/login", json={"username": local_uname, "password": "Wa@Local2026!"})
        assert login_res.status_code == 200

        # Verify NOT flagged as Ghost Account (บัญชีผี) in Directory API or reconciliation
        dir_res = client.get(f"/api/v1/directory/users?search={local_uname}&status=all", headers=admin_headers)
        assert dir_res.status_code == 200
        items = dir_res.json()
        assert len(items) == 1
        assert items[0]["is_ad_account"] is False
        assert items[0]["has_discrepancy"] is False
        assert items[0]["is_approved_exception"] is True
        assert items[0]["exception_type"] == "LOCAL_ACCOUNT"

        discrepancies = find_account_discrepancies(db)
        assert all(d.username.lower() != local_uname for d in discrepancies)

        # Verify Mode C Heartbeat includes non-AD Local Account in assigned_accounts & issues PROVISION_USER
        hb_res = client.post(
            "/api/v1/agent/heartbeat",
            json={"app_code": "petty_mode_c", "sync_type": "FULL_SYNC", "accounts": []},
            headers={"X-Spoke-API-Key": "sec_petty_c"},
        )
        assert hb_res.status_code == 200
        hb_data = hb_res.json()
        assigned_names = [a["username"].lower() for a in (hb_data.get("assigned_accounts") or [])]
        assert local_uname in assigned_names
        prov_cmds = [
            c for c in hb_data.get("pending_commands", [])
            if c["action"] == "PROVISION_USER" and c["username"].lower() == local_uname
        ]
        assert len(prov_cmds) == 1

        # 2. Test assign-app failure -> PENDING_PROVISION -> Mode A two-way sync push recovery
        ad_ident = MasterIdentity(
            username=ad_uname,
            full_name="Existing AD Tester",
            department="IT",
            email="ad.existing@windowasia.com",
            ad_guid="guid-existing-ad-1",
            is_active_in_ad=True,
        )
        db.add(ad_ident)
        db.commit()
        db.refresh(ad_ident)

        async def _fail_provision(self, account_data: dict) -> ConnectorResult:
            return ConnectorResult(
                success=False,
                status_code=503,
                execution_mode="SYNC_REST",
                message="Connection timeout",
                execution_time_ms=10,
            )

        with patch("app.connectors.rest_api.RestApiConnector.provision_account", new=_fail_provision):
            assign_res = client.post(
                f"/api/v1/directory/users/{ad_ident.id}/assign-app",
                json={"application_id": mode_a_app.id, "app_group_name": "Standard User"},
                headers=admin_headers,
            )
            assert assign_res.status_code == 200

        db.expire_all()
        pending_map = db.query(AppAccountMapping).filter_by(
            identity_id=ad_ident.id, application_id=mode_a_app.id
        ).first()
        assert pending_map is not None
        assert pending_map.last_sync_status == "PENDING_PROVISION"

        # Now Mode A Spoke comes back online and push_pending_provisions_to_spoke runs during sync
        pushed_list = []

        async def _recover_provision(self, account_data: dict) -> ConnectorResult:
            pushed_list.append(account_data["username"])
            return ConnectorResult(
                success=True,
                status_code=201,
                execution_mode="SYNC_REST",
                message="Created on retry",
                execution_time_ms=5,
            )

        raw_accounts = [{"username": local_uname, "is_active": True}]
        with patch("app.connectors.rest_api.RestApiConnector.provision_account", new=_recover_provision):
            pushed_count = asyncio.run(
                push_pending_provisions_to_spoke(mode_a_app, raw_accounts, db, actor_username="admin")
            )
            db.commit()

        assert pushed_count == 1
        assert pushed_list == [ad_uname]
        assert any(a["username"] == ad_uname for a in raw_accounts)
        db.refresh(pending_map)
        assert pending_map.last_sync_status == "IN_SYNC"

    finally:
        for u in (local_uname, ad_uname):
            db.query(SpokePendingCommand).filter(func.lower(SpokePendingCommand.username) == u).delete()
            adm = db.query(AdminUser).filter(func.lower(AdminUser.username) == u).first()
            if adm:
                db.delete(adm)
            ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == u).first()
            if ident:
                db.delete(ident)
        for code in ("petty_mode_a", "petty_mode_c"):
            app_row = db.query(ConnectedApplication).filter_by(app_code=code).first()
            if app_row:
                db.delete(app_row)
        db.commit()
        db.close()


def test_spoke_framework_version_handshake_across_sync_ping_and_heartbeat():
    """
    Verify that CIAM extracts, normalizes, persists, and returns Spoke Framework
    version (`spoke_framework_version`) during Mode A Sync, Ping, and Mode C Heartbeat.
    """
    from unittest.mock import patch, AsyncMock
    from app.connectors.base import ConnectorHealth
    from app.connectors.rest_api import RestApiConnector

    assert RestApiConnector._extract_framework_version({"spec_version": "v2.13.0"}, {}) == "2.13.0"
    assert RestApiConnector._extract_framework_version({}, {"x-ciam-framework-version": "v2.13.0"}) == "2.13.0"

    admin_headers = get_admin_auth_header()
    db = SessionLocal()
    try:
        for code in ("petty_fw_a", "petty_fw_c"):
            old_app = db.query(ConnectedApplication).filter_by(app_code=code).first()
            if old_app:
                db.delete(old_app)
        db.commit()

        mode_a_app = ConnectedApplication(
            app_code="petty_fw_a",
            app_name="PettyCash FW Mode A",
            connector_type="REST_API",
            base_url="http://pettycash-fw.internal",
            api_key="sec_fw_a",
            sso_enabled=True,
            is_active=True,
        )
        mode_c_app = ConnectedApplication(
            app_code="petty_fw_c",
            app_name="PettyCash FW Mode C",
            connector_type="SSO_ONLY",
            base_url="https://pettycash-fw-c.internal",
            api_key="sec_fw_c",
            client_id="petty-fw-c-client",
            sso_enabled=True,
            is_active=True,
        )
        db.add_all([mode_a_app, mode_c_app])
        db.commit()
        db.refresh(mode_a_app)
        db.refresh(mode_c_app)

        # 1. Mode A Sync extracts framework_version
        with patch("app.connectors.rest_api.RestApiConnector.sync_inventory", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = {"framework_version": "2.13.0", "accounts": []}
            sync_res = client.post(f"/api/v1/applications/{mode_a_app.id}/sync", headers=admin_headers)
            assert sync_res.status_code == 200, sync_res.text
            assert sync_res.json()["spoke_framework_version"] == "2.13.0"

        # 2. Mode A Ping extracts and normalizes 'v'-prefixed framework_version
        with patch("app.connectors.rest_api.RestApiConnector.health_check", new_callable=AsyncMock) as mock_health:
            mock_health.return_value = ConnectorHealth(
                is_online=True,
                latency_ms=15,
                message="OK",
                spoke_sso_active=True,
                spoke_framework_version="v2.12.0",
            )
            ping_res = client.post(f"/api/v1/applications/{mode_a_app.id}/ping", headers=admin_headers)
            assert ping_res.status_code == 200, ping_res.text
            assert ping_res.json()["spoke_framework_version"] == "2.12.0"
            assert ping_res.json()["latest_framework_version"] == "2.14.0"

        # 3. Mode C Heartbeat updates spoke_framework_version
        hb_res = client.post(
            "/api/v1/agent/heartbeat",
            json={"app_code": "petty_fw_c", "framework_version": "v2.13.0", "sync_type": "HEARTBEAT"},
            headers={"X-Spoke-API-Key": "sec_fw_c"},
        )
        assert hb_res.status_code == 200, hb_res.text
        hb_data = hb_res.json()
        assert hb_data["latest_framework_version"] == "2.14.0"
        assert hb_data["detected_framework_version"] == "2.13.0"

        # 4. GET /api/v1/applications exposes spoke_framework_version for UI badges
        apps_res = client.get("/api/v1/applications", headers=admin_headers)
        assert apps_res.status_code == 200
        apps_by_code = {a["app_code"]: a for a in apps_res.json()}
        assert apps_by_code["petty_fw_a"]["spoke_framework_version"] == "2.12.0"
        assert apps_by_code["petty_fw_c"]["spoke_framework_version"] == "2.13.0"
        assert apps_by_code["petty_fw_c"]["latest_framework_version"] == "2.14.0"
    finally:
        for code in ("petty_fw_a", "petty_fw_c"):
            app_row = db.query(ConnectedApplication).filter_by(app_code=code).first()
            if app_row:
                db.delete(app_row)
        db.commit()
        db.close()


def test_auto_heal_reverts_false_exceptions_for_former_ad_corporate_accounts():
    """Sprint 66: Auto-heal must NOT mask former AD corporate employees (e.g., siriporn.r) as local exceptions."""
    from app.initial_data import init_db
    admin_headers = get_admin_auth_header()
    db = SessionLocal()
    try:
        # Setup corporate M365 app
        m365_app = db.query(ConnectedApplication).filter_by(app_code="m365").first()
        if not m365_app:
            m365_app = ConnectedApplication(
                app_code="m365",
                app_name="Microsoft 365",
                connector_type="M365",
                is_active=True,
            )
            db.add(m365_app)
            db.commit()
            db.refresh(m365_app)

        # Setup former corporate employee who is inactive in AD and has M365 account
        test_uname = "siriporn.test_heal"
        ident = db.query(MasterIdentity).filter_by(username=test_uname).first()
        if not ident:
            ident = MasterIdentity(
                username=test_uname,
                full_name="Siriporn Test Healed",
                email="siriporn.test_heal@windowasia.com",
                department="Management",
                is_active_in_ad=False,
                is_approved_exception=True,
                exception_type="LOCAL_ACCOUNT",
                exception_reason="บัญชี Local Account ที่สร้างผ่าน Central IAM",
                exception_approved_by="System-AutoHeal",
            )
            db.add(ident)
            db.commit()
            db.refresh(ident)
        else:
            ident.is_active_in_ad = False
            ident.is_approved_exception = True
            ident.exception_type = "LOCAL_ACCOUNT"
            ident.exception_reason = "บัญชี Local Account ที่สร้างผ่าน Central IAM"
            ident.exception_approved_by = "System-AutoHeal"
            db.commit()

        # Add active mapping in M365
        mapping = db.query(AppAccountMapping).filter_by(identity_id=ident.id, application_id=m365_app.id).first()
        if not mapping:
            mapping = AppAccountMapping(
                identity_id=ident.id,
                application_id=m365_app.id,
                app_username=test_uname,
                is_active_in_app=True,
                status_origin="CIAM_ADMIN",
                is_approved_exception=True,
                exception_type="LOCAL_ACCOUNT",
                last_sync_status="APPROVED_EXCEPTION",
            )
            db.add(mapping)
            db.commit()
        else:
            mapping.is_active_in_app = True
            mapping.is_approved_exception = True
            mapping.last_sync_status = "APPROVED_EXCEPTION"
            db.commit()

        # Run init_db which should rollback the false exception
        init_db()

        # Verify identity exception was revoked
        db.refresh(ident)
        assert ident.is_approved_exception is False
        assert ident.exception_type is None
        assert ident.exception_approved_by is None

        # Verify mapping was restored to DISCREPANCY
        db.refresh(mapping)
        assert mapping.is_approved_exception is False
        assert mapping.last_sync_status == "DISCREPANCY"

        # Verify Directory API flags it as a Ghost Account
        dir_res = client.get(f"/api/v1/directory/users?search={test_uname}&status=all", headers=admin_headers)
        assert dir_res.status_code == 200
        items = dir_res.json()
        assert len(items) == 1
        assert items[0]["is_ad_account"] is True
        assert items[0]["has_discrepancy"] is True
        assert items[0]["is_approved_exception"] is False

        # Verify reconciliation flags it in ghost accounts list
        discrepancies = find_account_discrepancies(db)
        ghost_unames = [d.username.lower() for d in discrepancies]
        assert test_uname.lower() in ghost_unames
    finally:
        ident_row = db.query(MasterIdentity).filter_by(username="siriporn.test_heal").first()
        if ident_row:
            db.query(AppAccountMapping).filter_by(identity_id=ident_row.id).delete()
            db.delete(ident_row)
        db.commit()
        db.close()
