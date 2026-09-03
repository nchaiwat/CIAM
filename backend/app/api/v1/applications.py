import secrets
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.application import ConnectedApplication
from app.models.mapping import AppAccountMapping
from app.schemas.application import AppCreate, AppUpdate, AppOut, PingResult
from app.connectors.factory import get_connector_for_app

router = APIRouter(prefix="/applications", tags=["Connected Applications"])

@router.get("", response_model=List[AppOut])
def list_applications(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """List all registered child applications (REST and RPA)."""
    apps = db.query(ConnectedApplication).all()
    results = []
    for app in apps:
        total_accounts = db.query(AppAccountMapping).filter(AppAccountMapping.application_id == app.id).count()
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

    new_app = ConnectedApplication(
        app_code=data.app_code.lower().strip(),
        app_name=data.app_name.strip(),
        connector_type=data.connector_type,
        base_url=data.base_url,
        api_key=api_key,
        rpa_adapter_name=data.rpa_adapter_name,
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
        total_linked_accounts=0,
        created_at=new_app.created_at
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
