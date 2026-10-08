import pytest
from datetime import datetime, timezone
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
