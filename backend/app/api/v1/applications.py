import logging
import secrets
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger("ciam.applications")
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.schemas.application import (
    AppCreate,
    AppUpdate,
    AppOut,
    PingResult,
    AppCredentialOut,
    SyncScheduleOut,
    SyncScheduleUpdate,
    SyncAllResult
)
from app.connectors.factory import get_connector_for_app
from app.services.scheduler import get_sync_schedule, update_sync_schedule, execute_sync_all

router = APIRouter(prefix="/applications", tags=["Connected Applications"])


@router.get("", response_model=List[AppOut])
def list_applications(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """List all registered child applications (REST and RPA)."""
    apps = db.query(ConnectedApplication).all()
    from sqlalchemy import func
    counts = dict(
        db.query(AppAccountMapping.application_id, func.count(AppAccountMapping.id))
        .group_by(AppAccountMapping.application_id)
        .all()
    )
    results = []
    for app in apps:
        total_accounts = counts.get(app.id, 0)
        app_out = AppOut(
            id=app.id,
            app_code=app.app_code,
            app_name=app.app_name,
            connector_type=app.connector_type,
            base_url=app.base_url,
            rpa_adapter_name=app.rpa_adapter_name,
            is_active=app.is_active,
            health_status=app.health_status,
            latency_ms=app.latency_ms,
            last_health_check_at=app.last_health_check_at,
            last_sync_at=app.last_sync_at,
            client_id=app.client_id,
            redirect_uris=app.redirect_uris,
            sso_enabled=app.sso_enabled,
            sap_company_db=app.sap_company_db,
            sap_username=app.sap_username,
            ad_allow_status_patch=app.ad_allow_status_patch,
            total_linked_accounts=total_accounts,
            created_at=app.created_at
        )
        results.append(app_out)
    return results

@router.post("", response_model=AppOut)
def register_application(
    data: AppCreate,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Register a new child application (REST API or RPA Worker)."""
    existing = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == data.app_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Application code '{data.app_code}' already exists.")

    # Generate M2M API Key if not supplied
    api_key = data.api_key or f"sec_{data.app_code}_{secrets.token_hex(16)}"
    client_id = data.client_id or f"{data.app_code}-spoke-client"
    client_secret = data.client_secret or f"sec_{data.app_code}_oauth_{secrets.token_hex(12)}"

    new_app = ConnectedApplication(
        app_code=data.app_code.lower().strip(),
        app_name=data.app_name.strip(),
        connector_type=data.connector_type,
        base_url=data.base_url,
        api_key=api_key,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uris=data.redirect_uris,
        sso_enabled=data.sso_enabled,
        sap_company_db=data.sap_company_db.strip() if data.sap_company_db else None,
        sap_username=data.sap_username.strip() if data.sap_username else None,
        sap_password=data.sap_password.strip() if data.sap_password else None,
        rpa_adapter_name=data.rpa_adapter_name,
        ad_allow_status_patch=data.ad_allow_status_patch or False,
        health_status="ONLINE" if data.connector_type == "RPA_WORKER" else "UNKNOWN"
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return AppOut(
        id=new_app.id,
        app_code=new_app.app_code,
        app_name=new_app.app_name,
        connector_type=new_app.connector_type,
        base_url=new_app.base_url,
        rpa_adapter_name=new_app.rpa_adapter_name,
        is_active=new_app.is_active,
        health_status=new_app.health_status,
        latency_ms=new_app.latency_ms,
        last_health_check_at=new_app.last_health_check_at,
        last_sync_at=new_app.last_sync_at,
        client_id=new_app.client_id,
        redirect_uris=new_app.redirect_uris,
        sso_enabled=new_app.sso_enabled,
        sap_company_db=new_app.sap_company_db,
        sap_username=new_app.sap_username,
        ad_allow_status_patch=new_app.ad_allow_status_patch,
        total_linked_accounts=0,
        created_at=new_app.created_at
    )

@router.post("/sync-all", response_model=SyncAllResult)
async def sync_all_applications(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Trigger manual synchronization across all active connected applications simultaneously."""
    res = await execute_sync_all(db, actor_username=current_admin.username)
    return res

@router.get("/sync-schedule", response_model=SyncScheduleOut)
def get_automated_sync_schedule(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Get the current automated daily synchronization schedule and status."""
    return get_sync_schedule(db)

@router.put("/sync-schedule", response_model=SyncScheduleOut)
def update_automated_sync_schedule(
    data: SyncScheduleUpdate,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Update automated daily synchronization schedule (enabled flag and HH:MM time)."""
    return update_sync_schedule(db, data.model_dump(exclude_unset=True))

@router.get("/{app_id}/credentials", response_model=AppCredentialOut)

def get_application_credentials(
    app_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve M2M API credentials, OIDC client keys, and headers configuration for an application."""
    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    return AppCredentialOut(
        id=app.id,
        app_code=app.app_code,
        app_name=app.app_name,
        connector_type=app.connector_type,
        base_url=app.base_url,
        api_key=app.api_key,
        header_name="X-Management-API-Key",
        client_id=app.client_id,
        client_secret=app.client_secret,
        redirect_uris=app.redirect_uris,
        sso_enabled=app.sso_enabled,
        sap_company_db=app.sap_company_db,
        sap_username=app.sap_username,
        sap_password=app.sap_password
    )

@router.patch("/{app_id}", response_model=AppOut)
def update_application(
    app_id: int,
    data: AppUpdate,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Update application details, connection URL, OIDC configuration, or M2M API Secret Key."""
    from app.models.audit import IamAuditLog

    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if data.app_name is not None:
        app.app_name = data.app_name.strip()
    if data.connector_type is not None:
        app.connector_type = data.connector_type
    if data.base_url is not None:
        app.base_url = data.base_url.strip() or None
    if data.api_key is not None:
        app.api_key = data.api_key.strip() or None
    if data.client_id is not None:
        app.client_id = data.client_id.strip() or None
    if data.client_secret is not None:
        app.client_secret = data.client_secret.strip() or None
    if data.redirect_uris is not None:
        app.redirect_uris = data.redirect_uris.strip() or None
    if data.sso_enabled is not None:
        app.sso_enabled = data.sso_enabled
    if data.rpa_adapter_name is not None:
        app.rpa_adapter_name = data.rpa_adapter_name
    if data.is_active is not None:
        app.is_active = data.is_active
    if data.sap_company_db is not None:
        app.sap_company_db = data.sap_company_db.strip() or None
    if data.sap_username is not None:
        app.sap_username = data.sap_username.strip() or None
    if data.sap_password is not None:
        app.sap_password = data.sap_password.strip() or None
    if data.ad_allow_status_patch is not None:
        app.ad_allow_status_patch = data.ad_allow_status_patch

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="UPDATE_APP",
        target_username=f"APP_{app.app_code.upper()}",
        affected_app_code=app.app_code,
        execution_mode=app.connector_type,
        reason=f"Updated application configuration for {app.app_name}",
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(app)

    total_accounts = db.query(AppAccountMapping).filter(AppAccountMapping.application_id == app.id).count()
    return AppOut(
        id=app.id,
        app_code=app.app_code,
        app_name=app.app_name,
        connector_type=app.connector_type,
        base_url=app.base_url,
        rpa_adapter_name=app.rpa_adapter_name,
        is_active=app.is_active,
        health_status=app.health_status,
        latency_ms=app.latency_ms,
        last_health_check_at=app.last_health_check_at,
        last_sync_at=app.last_sync_at,
        client_id=app.client_id,
        redirect_uris=app.redirect_uris,
        sso_enabled=app.sso_enabled,
        sap_company_db=app.sap_company_db,
        sap_username=app.sap_username,
        ad_allow_status_patch=app.ad_allow_status_patch,
        total_linked_accounts=total_accounts,
        created_at=app.created_at
    )

@router.post("/{app_id}/ping", response_model=PingResult)
async def ping_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Perform diagnostic health check and measure latency of connected application."""
    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    connector = get_connector_for_app(app)
    health = await connector.health_check()

    # Update database record
    app.health_status = "ONLINE" if health.is_online else "OFFLINE"
    app.latency_ms = health.latency_ms
    app.last_health_check_at = datetime.now(timezone.utc)
    db.commit()

    return PingResult(
        app_code=app.app_code,
        status="ONLINE" if health.is_online else "OFFLINE",
        latency_ms=health.latency_ms,
        message=health.message
    )

@router.get("/{app_id}/inventory")
async def get_application_inventory(
    app_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Fetch live account inventory directly from target spoke application."""
    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    connector = get_connector_for_app(app)
    try:
        data = await connector.sync_inventory()
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch inventory from {app.app_code}: {str(exc)}")

@router.post("/{app_id}/sync")
async def sync_application_inventory(
    app_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Synchronize account inventory from spoke system into Central IAM database:
    Upserts master identities, app account mappings, and flags discrepancies.
    """
    from app.models.identity import MasterIdentity
    from app.models.mapping import AppAccountMapping
    from app.models.audit import IamAuditLog

    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    connector = get_connector_for_app(app)
    try:
        inventory = await connector.sync_inventory()
    except Exception as exc:
        err_msg = str(exc)
        if "403" in err_msg and "Origin IP" in err_msg:
            raise HTTPException(
                status_code=502,
                detail=f"Sync failed: เซิร์ฟเวอร์ {app.app_code.upper()} ปฏิเสธการเชื่อมต่อ (IP Whitelist): {err_msg}"
            )
        raise HTTPException(status_code=502, detail=f"Sync failed: {err_msg}")

    raw_accounts = inventory.get("accounts", [])
    synced_count = 0
    now = datetime.now(timezone.utc)

    try:
        for item in raw_accounts:
            uname = (item.get("username") or "").strip()
            if not uname:
                continue

            # Look for existing identity in AD (Master Identity)
            identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(uname)).first()
            if not identity and item.get("email"):
                identity = db.query(MasterIdentity).filter(MasterIdentity.email.ilike(item.get("email").strip())).first()
            if not identity and item.get("full_name") and item.get("full_name").strip() != uname:
                identity = db.query(MasterIdentity).filter(MasterIdentity.full_name.ilike(item.get("full_name").strip())).first()

            is_ad_item = app.app_code.lower() == "ad"
            is_active = bool(item.get("is_active", True))

            if not identity:
                # Create identity if user doesn't exist yet
                identity = MasterIdentity(
                    username=uname,
                    full_name=item.get("full_name") or uname,
                    email=item.get("email"),
                    department=item.get("department"),
                    employee_id=item.get("employee_id"),
                    is_active_in_ad=is_active if is_ad_item else True,
                    created_at=now
                )
                db.add(identity)
                db.flush()
            else:
                if is_ad_item:
                    identity.is_active_in_ad = is_active
                    if item.get("employee_id"):
                        identity.employee_id = item.get("employee_id")
                # Enrich existing identity if empty
                if not identity.email and item.get("email"):
                    identity.email = item.get("email")
                if not identity.department and item.get("department"):
                    identity.department = item.get("department")
                if (not identity.full_name or identity.full_name == identity.username) and item.get("full_name"):
                    identity.full_name = item.get("full_name")

            # Check existing mapping (case-insensitive to prevent duplicate rows)
            existing_mappings = (
                db.query(AppAccountMapping)
                .filter(
                    AppAccountMapping.application_id == app.id,
                    func.lower(AppAccountMapping.app_username) == uname.lower()
                )
                .all()
            )
            if existing_mappings:
                exact_match = next((m for m in existing_mappings if m.app_username == uname), None)
                mapping = exact_match or existing_mappings[0]
                if len(existing_mappings) > 1:
                    for dup in existing_mappings:
                        if dup.id != mapping.id:
                            db.delete(dup)
                    db.flush()
            else:
                mapping = None

            is_active = bool(item.get("is_active", True))
            # Flag discrepancy: disabled in AD but active in app
            sync_status = "DISCREPANCY" if (not identity.is_active_in_ad and is_active) else "IN_SYNC"

            # Parse last login if provided
            last_login_dt = None
            raw_last_login = item.get("last_login_at")
            if raw_last_login:
                try:
                    last_login_dt = datetime.fromisoformat(raw_last_login.replace("Z", "+00:00"))
                except Exception:
                    pass

            if not mapping:
                mapping = AppAccountMapping(
                    identity_id=identity.id,
                    application_id=app.id,
                    app_username=uname,
                    app_user_id=str(item.get("id")) if item.get("id") is not None else None,
                    app_group_name=item.get("group_name"),
                    is_active_in_app=is_active,
                    last_sync_status=sync_status,
                    last_app_login_at=last_login_dt,
                    created_at=now
                )
                db.add(mapping)
            else:
                mapping.identity_id = identity.id
                mapping.app_username = uname  # Normalize casing to current live username
                mapping.app_user_id = str(item.get("id")) if item.get("id") is not None else mapping.app_user_id
                mapping.app_group_name = item.get("group_name")
                mapping.is_active_in_app = is_active
                mapping.last_sync_status = sync_status
                if last_login_dt:
                    mapping.last_app_login_at = last_login_dt

            synced_count += 1

        # Prune stale/orphaned mappings that no longer exist in the target spoke application
        live_usernames = {
            (item.get("username") or "").strip().lower()
            for item in raw_accounts
            if (item.get("username") or "").strip()
        }

        if live_usernames:
            stale_mappings = (
                db.query(AppAccountMapping)
                .filter(
                    AppAccountMapping.application_id == app.id,
                    ~func.trim(func.lower(AppAccountMapping.app_username)).in_(live_usernames)
                )
                .all()
            )
            for stale in stale_mappings:
                db.delete(stale)

            db.flush()

            # Deduplicate any remaining mappings for this app that differ only by case
            all_app_mappings = (
                db.query(AppAccountMapping)
                .filter(AppAccountMapping.application_id == app.id)
                .order_by(AppAccountMapping.id.asc())
                .all()
            )
            seen_lower = set()
            for m in all_app_mappings:
                low = (m.app_username or "").strip().lower()
                if low in seen_lower:
                    db.delete(m)
                else:
                    seen_lower.add(low)
            db.flush()

            # If syncing AD, mark MasterIdentity as inactive in AD if they are no longer in AD inventory
            if app.app_code.lower() == "ad":
                stale_identities = (
                    db.query(MasterIdentity)
                    .filter(
                        MasterIdentity.is_active_in_ad == True,
                        ~func.lower(MasterIdentity.username).in_(live_usernames)
                    )
                    .all()
                )
                for st_id in stale_identities:
                    st_id.is_active_in_ad = False

        app.last_sync_at = now
        app.health_status = "ONLINE"

        # Audit log
        db.add(IamAuditLog(
            actor_username=current_admin.username,
            action_type="SYNC",
            target_username=f"INVENTORY_{app.app_code.upper()}",
            affected_app_code=app.app_code,
            execution_mode=app.connector_type,
            reason=f"Manual inventory sync triggered: synced {synced_count} accounts from {app.app_name}",
            status="SUCCESS"
        ))

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Sync database operation failed for %s (%s): %s", app.app_code, app.id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"ข้อผิดพลาดขณะบันทึกข้อมูลซิงก์ ({app.app_code}): {str(exc)}"
        )

    return {
        "success": True,
        "app_code": app.app_code,
        "total_accounts_fetched": len(raw_accounts),
        "synced_count": synced_count,
        "synced_at": now.isoformat()
    }

@router.delete("/{app_id}")
def delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Decommission and remove a connected application from Central IAM."""
    from app.models.audit import IamAuditLog

    app = db.query(ConnectedApplication).filter(ConnectedApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app_code = app.app_code
    app_name = app.app_name

    # Count linked accounts
    total_mappings = db.query(AppAccountMapping).filter(AppAccountMapping.application_id == app.id).count()

    # Remove linked accounts
    db.query(AppAccountMapping).filter(AppAccountMapping.application_id == app.id).delete(synchronize_session=False)

    # Delete application record
    db.delete(app)

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="DELETE_APP",
        target_username=f"APP_{app_code.upper()}",
        affected_app_code=app_code,
        execution_mode="REST_API",
        reason=f"Decommissioned application '{app_name}' ({app_code.upper()}) - Removed {total_mappings} linked accounts",
        status="SUCCESS"
    ))

    db.commit()

    return {
        "success": True,
        "message": f"ลบระบบ '{app_name}' ({app_code.upper()}) เรียบร้อยแล้ว (ยกเลิกการผูกบัญชี {total_mappings} รายการ)",
        "deleted_app_code": app_code,
        "removed_mappings": total_mappings
    }
