import pytest
from datetime import datetime, timezone
from sqlalchemy import func
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db, Base
from app.models.identity import MasterIdentity
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.api.v1.directory import _build_app_summaries

client = TestClient(app)

def test_build_app_summaries_deduplication():
    """Verify that multiple mappings for the same application code are merged/deduplicated."""
    now = datetime.now(timezone.utc)
    app1 = ConnectedApplication(
        id=10,
        app_code="MTPULSE",
        app_name="MT Pulse",
        connector_type="SSO_ONLY"
    )
    
    # Simulate two mappings for the same identity and application (e.g. casing difference or duplicate push)
    mapping1 = AppAccountMapping(
        id=101,
        identity_id=1,
        application_id=10,
        app_username="ronnakorn.p",
        is_active_in_app=True,
        last_sync_status="IN_SYNC"
    )
    mapping2 = AppAccountMapping(
        id=102,
        identity_id=1,
        application_id=10,
        app_username="Ronnakorn.P",
        is_active_in_app=True,
        last_sync_status="IN_SYNC"
    )

    summaries = _build_app_summaries([(mapping1, app1), (mapping2, app1)], identity_is_active_in_ad=True, now=now)
    # Must only produce 1 summary badge for MTPULSE
    assert len(summaries) == 1
    assert summaries[0].app_code == "MTPULSE"

def test_spoke_agent_push_marks_identity_as_local_non_ad(client_with_auth=None):
    """Verify that new accounts pushed by a spoke agent have is_active_in_ad=False."""
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal

    db: Session = SessionLocal()
    try:
        # Create test spoke app
        spoke_app = db.query(ConnectedApplication).filter_by(app_code="test_spoke").first()
        if not spoke_app:
            spoke_app = ConnectedApplication(
                app_code="test_spoke",
                app_name="Test Spoke",
                connector_type="OUTBOUND_AGENT",
                api_key="sec_test_spoke_key_123"
            )
            db.add(spoke_app)
            db.commit()

        ident = None
        # Push account that does not exist in AD
        payload = {
            "app_code": "test_spoke",
            "app_version": "1.0.0",
            "status": "HEALTHY",
            "accounts": [
                {
                    "username": "LocalUser.Test",
                    "full_name": "Local Test User",
                    "email": "local.test@example.com",
                    "department": "ทั่วไป",
                    "role": "User",
                    "is_active": True
                }
            ]
        }

        resp = client.post(
            "/api/v1/agent/heartbeat",
            json=payload,
            headers={"X-Spoke-API-Key": "sec_test_spoke_key_123"}
        )
        assert resp.status_code == 200

        # Query MasterIdentity
        ident = db.query(MasterIdentity).filter(MasterIdentity.username.ilike("LocalUser.Test")).first()
        assert ident is not None
        assert ident.is_active_in_ad is False  # Must be False, NOT True!

        # Repeat push with different casing to verify deduplication
        payload["accounts"][0]["username"] = "localuser.test"
        resp2 = client.post(
            "/api/v1/agent/heartbeat",
            json=payload,
            headers={"X-Spoke-API-Key": "sec_test_spoke_key_123"}
        )
        assert resp2.status_code == 200

        mappings = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == ident.id,
            AppAccountMapping.application_id == spoke_app.id
        ).all()
        assert len(mappings) == 1  # Deduplicated!
    finally:
        # Cleanup
        if ident:
            db.query(AppAccountMapping).filter(AppAccountMapping.identity_id == ident.id).delete()
            db.delete(ident)
        if spoke_app:
            db.delete(spoke_app)
        db.commit()
        db.close()

def test_extract_ou_department_users_tc_and_administrator():
    """Verify Users TC root OU handling and filtering of administrator as department."""
    from app.connectors.ad_proxy import extract_ou_department

    # Direct in Users TC with Administrator fallback -> should be None
    assert extract_ou_department("CN=Chanpen Kidchapo,OU=Users TC,DC=wa,DC=net", fallback="Administrator") is None
    # Sub-OU Accounting under Users TC -> should be Accounting
    assert extract_ou_department("CN=Chanpen Kidchapo,OU=Accounting,OU=Users TC,DC=wa,DC=net") == "Accounting"
    # Sub-OU Administrator under Users TC -> should be filtered to None
    assert extract_ou_department("CN=Chanpen Kidchapo,OU=Administrator,OU=Users TC,DC=wa,DC=net") is None
    # Fallback to Admin or Administrator -> None
    assert extract_ou_department(None, fallback="admin") is None
    assert extract_ou_department("CN=Chanpen Kidchapo,OU=Users TC,DC=wa,DC=net", fallback="Purchasing") == "Purchasing"

def test_spoke_sync_preserves_ad_disabled_status():
    """Verify that spoke inventory sync (e.g. pfSense) NEVER flips is_active_in_ad to True for a disabled AD user."""
    from app.core.database import SessionLocal
    from app.services.scheduler import persist_spoke_inventory

    db = SessionLocal()
    try:
        # 1. Setup pfSense app
        pfsense_app = db.query(ConnectedApplication).filter_by(app_code="pfsense_ho").first()
        if not pfsense_app:
            pfsense_app = ConnectedApplication(
                app_code="pfsense_ho",
                app_name="pfSense Firewall (Head Office)",
                connector_type="INBOUND_POLL"
            )
            db.add(pfsense_app)
            db.flush()

        # 2. Setup user disabled in AD
        test_uname = "chanpen.k"
        ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == test_uname).first()
        if not ident:
            ident = MasterIdentity(
                username=test_uname,
                full_name="Chanpen Kidchapo",
                is_active_in_ad=False,
                department=None
            )
            db.add(ident)
        else:
            ident.is_active_in_ad = False
            ident.department = None
        db.commit()

        # 3. Simulate pfSense inventory sync reporting chanpen.k active
        inventory = {
            "application_name": "pfSense Firewall & VPN (Head Office)",
            "total_accounts": 1,
            "accounts": [
                {
                    "username": "chanpen.k",
                    "full_name": "Chanpen Kidchapo",
                    "department": "Administrator",
                    "is_active": True
                }
            ]
        }
        persist_spoke_inventory(pfsense_app, inventory["accounts"], db)
        db.commit()

        # 4. Assertions: is_active_in_ad MUST STILL BE FALSE!
        db.refresh(ident)
        assert ident.is_active_in_ad is False

        # Mapping must be flagged as DISCREPANCY (Ghost Account)
        mapping = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == ident.id,
            AppAccountMapping.application_id == pfsense_app.id
        ).first()
        assert mapping is not None
        assert mapping.is_active_in_app is True
        assert mapping.last_sync_status == "DISCREPANCY"
    finally:
        # Cleanup
        db.query(AppAccountMapping).filter(AppAccountMapping.app_username == "chanpen.k").delete()
        db.query(MasterIdentity).filter(MasterIdentity.username == "chanpen.k").delete()
        db.commit()
        db.close()


def test_ad_sync_marks_removed_ad_users_inactive():
    """Verify that when AD sync runs, any identity missing from live AD accounts is set to is_active_in_ad=False."""
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal
    from app.services.scheduler import persist_spoke_inventory

    db: Session = SessionLocal()
    try:
        ad_app = db.query(ConnectedApplication).filter(func.lower(ConnectedApplication.app_code) == "ad").first()
        if not ad_app:
            ad_app = ConnectedApplication(
                app_code="ad",
                app_name="Active Directory",
                connector_type="AD_PROXY",
                is_active=True
            )
            db.add(ad_app)
            db.flush()

        # Create user worawut.s with is_active_in_ad=True and an AD mapping
        test_uname = "worawut.s"
        ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == test_uname).first()
        if not ident:
            ident = MasterIdentity(
                username=test_uname,
                full_name="Worawut Seelanuan",
                email="worawut.s@windowasia.com",
                is_active_in_ad=True
            )
            db.add(ident)
            db.flush()
        else:
            ident.is_active_in_ad = True

        ad_map = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == ident.id,
            AppAccountMapping.application_id == ad_app.id
        ).first()
        if not ad_map:
            ad_map = AppAccountMapping(
                identity_id=ident.id,
                application_id=ad_app.id,
                app_username=test_uname,
                is_active_in_app=True,
                last_sync_status="IN_SYNC"
            )
            db.add(ad_map)
        db.commit()

        # Simulate AD sync with 5 active users, NOT including worawut.s
        live_ad_accounts = [
            {"username": "user1.a", "full_name": "User 1", "is_active": True},
            {"username": "user2.b", "full_name": "User 2", "is_active": True},
            {"username": "user3.c", "full_name": "User 3", "is_active": True},
            {"username": "user4.d", "full_name": "User 4", "is_active": True},
            {"username": "user5.e", "full_name": "User 5", "is_active": True},
        ]
        persist_spoke_inventory(ad_app, live_ad_accounts, db)
        db.commit()

        # worawut.s must now have is_active_in_ad = False
        db.refresh(ident)
        assert ident.is_active_in_ad is False

        # And his AD mapping must have been pruned
        remaining_ad_map = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == ident.id,
            AppAccountMapping.application_id == ad_app.id
        ).first()
        assert remaining_ad_map is None
    finally:
        db.query(AppAccountMapping).filter(AppAccountMapping.app_username.in_(["worawut.s", "user1.a", "user2.b", "user3.c", "user4.d", "user5.e"])).delete()
        db.query(MasterIdentity).filter(MasterIdentity.username.in_(["worawut.s", "user1.a", "user2.b", "user3.c", "user4.d", "user5.e"])).delete()
        db.commit()
        db.close()


