from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import MasterIdentity
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.models.audit import IamAuditLog
from app.services.scheduler import persist_spoke_inventory

client = TestClient(app)

def get_admin_token():
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_direct_infra_never_shows_pending_provision():
    """
    Direct / Infrastructure systems (pfSense, M365, SAP B1) are read-only inventory.
    If a user is missing from their live inventory, the mapping must be pruned/deleted,
    and NEVER retained with PENDING_PROVISION (WAIT).
    """
    db = SessionLocal()
    now = datetime.now(timezone.utc)

    # 1. Setup mock pfSense app (sso_enabled = False)
    pfsense = db.query(ConnectedApplication).filter_by(app_code="pfsense_ho").first()
    if not pfsense:
        pfsense = ConnectedApplication(
            app_code="pfsense_ho",
            app_name="pfSense (Head Office)",
            connector_type="PFSENSE",
            sso_enabled=False,
            is_active=True
        )
        db.add(pfsense)
        db.commit()

    # 2. Setup mock SSO app (IRM, sso_enabled = True)
    irm = db.query(ConnectedApplication).filter_by(app_code="irm").first()
    if not irm:
        irm = ConnectedApplication(
            app_code="irm",
            app_name="IRM",
            connector_type="REST_API",
            sso_enabled=True,
            is_active=True
        )
        db.add(irm)
        db.commit()

    # 3. Create test identity
    ident = db.query(MasterIdentity).filter_by(username="test_lock_user").first()
    if not ident:
        ident = MasterIdentity(
            username="test_lock_user",
            full_name="Test Lock User",
            email="test_lock_user@windowasia.com",
            is_active_in_ad=True
        )
        db.add(ident)
        db.commit()

    # 4. Create stale mapping for pfSense and IRM
    db.query(AppAccountMapping).filter_by(identity_id=ident.id).delete()
    db.commit()

    pfsense_map = AppAccountMapping(
        identity_id=ident.id,
        application_id=pfsense.id,
        app_username=ident.username,
        is_active_in_app=True,
        status_origin="CIAM_ADMIN",
        last_sync_status="IN_SYNC"
    )
    irm_map = AppAccountMapping(
        identity_id=ident.id,
        application_id=irm.id,
        app_username=ident.username,
        is_active_in_app=True,
        status_origin="CIAM_ADMIN",
        last_sync_status="IN_SYNC"
    )
    db.add_all([pfsense_map, irm_map])
    db.commit()

    # 5. Sync pfSense with live accounts that DO NOT include test_lock_user
    mock_pfsense_accounts = [{"username": "other_user", "status": "ACTIVE"}]
    persist_spoke_inventory(pfsense, mock_pfsense_accounts, db)
    db.commit()

    # Verify pfSense mapping was pruned and NOT marked PENDING_PROVISION
    pfsense_after = db.query(AppAccountMapping).filter_by(
        identity_id=ident.id,
        application_id=pfsense.id
    ).first()
    assert pfsense_after is None, "Direct infra mapping must be deleted when not in live inventory (No WAIT)"

    # 6. Sync IRM with live accounts that DO NOT include test_lock_user
    mock_irm_accounts = [{"username": "other_user", "status": "ACTIVE"}]
    persist_spoke_inventory(irm, mock_irm_accounts, db)
    db.commit()

    # Verify IRM mapping WAS retained with PENDING_PROVISION because it is an SSO Spoke
    irm_after = db.query(AppAccountMapping).filter_by(
        identity_id=ident.id,
        application_id=irm.id
    ).first()
    assert irm_after is not None
    assert irm_after.last_sync_status == "PENDING_PROVISION"

    # Cleanup
    db.query(AppAccountMapping).filter_by(identity_id=ident.id).delete()
    db.delete(ident)
    db.commit()
    db.close()


def test_ciam_authority_lock_and_timestamp_reconciliation():
    """
    Test CIAM Admin Authority Lock:
    1. If is_status_locked = True, Spoke cannot override the status.
    2. API toggle lock works and logs audit.
    3. Timestamp reconciliation compares spoke updated_at vs CIAM status_updated_at.
    """
    db = SessionLocal()
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    now = datetime.now(timezone.utc)

    irm = db.query(ConnectedApplication).filter_by(app_code="irm").first()
    ident = db.query(MasterIdentity).filter_by(username="test_authority_user").first()
    if not ident:
        ident = MasterIdentity(
            username="test_authority_user",
            full_name="Authority User",
            email="auth_user@windowasia.com",
            is_active_in_ad=True
        )
        db.add(ident)
        db.commit()

    mapping = AppAccountMapping(
        identity_id=ident.id,
        application_id=irm.id,
        app_username=ident.username,
        is_active_in_app=False,
        is_status_locked=False,
        status_origin="CIAM_ADMIN",
        status_updated_at=now - timedelta(minutes=10),
        last_sync_status="IN_SYNC"
    )
    db.add(mapping)
    db.commit()
    mapping_id = mapping.id

    try:
        # 1. Test Lock API
        lock_res = client.patch(
            f"/api/v1/directory/accounts/{mapping_id}/lock",
            json={"is_status_locked": True, "reason": "HR disciplinary lockout"},
            headers=headers
        )
        assert lock_res.status_code == 200
        assert lock_res.json()["status"] == "SUCCESS"

        db.refresh(mapping)
        assert mapping.is_status_locked is True

        # 2. Spoke attempts to send Active status during sync: must be REJECTED
        spoke_payload = [{
            "username": ident.username,
            "status": "ACTIVE",
            "updated_at": (now + timedelta(minutes=1)).isoformat()
        }]
        persist_spoke_inventory(irm, spoke_payload, db)
        db.commit()

        db.refresh(mapping)
        assert mapping.is_active_in_app is False, "Locked status must remain False even if Spoke sends ACTIVE"

        # Check Audit Log for SPOKE_OVERRIDE_REJECTED
        reject_log = db.query(IamAuditLog).filter_by(
            action_type="SPOKE_OVERRIDE_REJECTED",
            target_username=ident.username
        ).first()
        assert reject_log is not None

        # 3. Unlock via API
        unlock_res = client.patch(
            f"/api/v1/directory/accounts/{mapping_id}/lock",
            json={"is_status_locked": False, "reason": "Restored access"},
            headers=headers
        )
        assert unlock_res.status_code == 200
        db.refresh(mapping)
        assert mapping.is_status_locked is False

        # 4. Now sync again with Spoke sending ACTIVE: should be ACCEPTED
        persist_spoke_inventory(irm, spoke_payload, db)
        db.commit()
        db.refresh(mapping)
        assert mapping.is_active_in_app is True, "Unlocked mapping accepts Spoke status update"

    finally:
        db.query(AppAccountMapping).filter_by(identity_id=ident.id).delete()
        db.delete(ident)
        db.commit()
        db.close()
