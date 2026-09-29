import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import MasterIdentity
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.services.reconciliation import find_account_discrepancies

client = TestClient(app)

def get_auth_header():
    # Login to get admin token
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_link_account_and_exception_lifecycle():
    headers = get_auth_header()
    db = SessionLocal()
    try:
        # 1. Setup AD Master Identity: Natcha.S
        ad_user = db.query(MasterIdentity).filter_by(username="natcha.s").first()
        if not ad_user:
            ad_user = MasterIdentity(
                username="natcha.s",
                full_name="Natcha Samrongsap",
                department="Accounting",
                email="natcha.s@enterprise.local",
                is_active_in_ad=True,
                ad_guid="guid-natcha-ad-test"
            )
            db.add(ad_user)
            db.commit()
            db.refresh(ad_user)

        # 2. Setup Spoke application (SAP B1)
        sap_app = db.query(ConnectedApplication).filter_by(app_code="sap_b1").first()
        if not sap_app:
            sap_app = ConnectedApplication(
                app_code="sap_b1",
                app_name="SAP Business One",
                connector_type="SAP_B1",
                is_active=True
            )
            db.add(sap_app)
            db.commit()
            db.refresh(sap_app)

        # 3. Setup Spoke Orphaned Identity: Nattcha.S (Spelling mismatch)
        spoke_placeholder = db.query(MasterIdentity).filter_by(username="nattcha.s").first()
        if not spoke_placeholder:
            spoke_placeholder = MasterIdentity(
                username="nattcha.s",
                full_name="Nattcha Samrongsap",
                department="Accounting",
                is_active_in_ad=False,
                ad_guid=None
            )
            db.add(spoke_placeholder)
            db.commit()
            db.refresh(spoke_placeholder)

        # Create mapping on spoke placeholder
        mapping = db.query(AppAccountMapping).filter_by(
            application_id=sap_app.id,
            app_username="Nattcha.S"
        ).first()
        if not mapping:
            mapping = AppAccountMapping(
                identity_id=spoke_placeholder.id,
                application_id=sap_app.id,
                app_username="Nattcha.S",
                is_active_in_app=True,
                last_sync_status="DISCREPANCY"
            )
            db.add(mapping)
            db.commit()
            db.refresh(mapping)
        else:
            mapping.identity_id = spoke_placeholder.id
            mapping.is_approved_exception = False
            db.commit()

        mapping_id = mapping.id
        placeholder_id = spoke_placeholder.id

        # 4. Before linking or exception: find_account_discrepancies should flag this account
        discrepancies_before = find_account_discrepancies(db)
        ghost_usernames = [d.username.lower() for d in discrepancies_before]
        assert "nattcha.s" in ghost_usernames

        # 5. Test Approve Exception
        exc_res = client.post(
            f"/api/v1/directory/accounts/{mapping_id}/exception",
            json={
                "exception_type": "NAME_MISMATCH",
                "reason": "ชื่อสะกดผิดใน SAP B1 (Nattcha.S) เป็นพนักงานคนเดียวกับ Natcha.S บน AD"
            },
            headers=headers
        )
        assert exc_res.status_code == 200
        assert exc_res.json()["status"] == "SUCCESS"

        # Reconciliation must ignore approved exception!
        db.expire_all()
        discrepancies_with_exc = find_account_discrepancies(db)
        ghost_usernames_exc = [d.username.lower() for d in discrepancies_with_exc]
        assert "nattcha.s" not in ghost_usernames_exc

        # 6. Test Revoke Exception
        rev_res = client.delete(
            f"/api/v1/directory/accounts/{mapping_id}/exception",
            headers=headers
        )
        assert rev_res.status_code == 200
        db.expire_all()
        discrepancies_revoked = find_account_discrepancies(db)
        ghost_usernames_rev = [d.username.lower() for d in discrepancies_revoked]
        assert "nattcha.s" in ghost_usernames_rev

        # 7. Test Link Spoke Account to Master AD Identity (Natcha.S)
        link_res = client.post(
            f"/api/v1/directory/accounts/{mapping_id}/link-identity",
            json={
                "target_identity_id": ad_user.id,
                "reason": "ผูกบัญชี SAP B1 Nattcha.S เข้ากับ Natcha.S บน Active Directory"
            },
            headers=headers
        )
        assert link_res.status_code == 200
        assert link_res.json()["status"] == "SUCCESS"

        # Verify mapping is now linked to ad_user
        db.expire_all()
        refreshed_mapping = db.query(AppAccountMapping).filter_by(id=mapping_id).first()
        assert refreshed_mapping.identity_id == ad_user.id
        assert refreshed_mapping.last_sync_status == "IN_SYNC"

        # Verify orphaned placeholder identity was cleaned up
        orphaned_check = db.query(MasterIdentity).filter_by(id=placeholder_id).first()
        assert orphaned_check is None

        # Verify reconciliation no longer flags Nattcha.S as ghost because AD user is active
        discrepancies_after_link = find_account_discrepancies(db)
        ghost_usernames_after = [d.username.lower() for d in discrepancies_after_link]
        assert "nattcha.s" not in ghost_usernames_after

    finally:
        db.close()
