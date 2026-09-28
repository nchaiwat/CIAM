from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.models.audit import IamAuditLog
from app.services.reconciliation import find_account_discrepancies
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    KpiMetrics,
    ActivityItem
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve high-level KPI metrics, ghost account warnings, and recent activity logs."""
    total_identities = db.query(MasterIdentity).count()
    active_ad = db.query(MasterIdentity).filter(MasterIdentity.is_active_in_ad == True).count()
    deprovisioned = db.query(MasterIdentity).filter(MasterIdentity.is_active_in_ad == False).count()

    total_apps = db.query(ConnectedApplication).count()
    online_apps = db.query(ConnectedApplication).filter(ConnectedApplication.health_status == "ONLINE").count()
    # If not yet checked, assume active ones are online
    if online_apps == 0 and total_apps > 0:
        online_apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).count()

    discrepancies = find_account_discrepancies(db)

    recent_logs = (
        db.query(IamAuditLog)
        .order_by(desc(IamAuditLog.created_at))
        .limit(10)
        .all()
    )

    activities = [
        ActivityItem(
            id=log.id,
            actor_username=log.actor_username,
            action_type=log.action_type,
            target_username=log.target_username,
            affected_app_code=log.affected_app_code,
            execution_mode=log.execution_mode,
            status=log.status,
            created_at=log.created_at
        )
        for log in recent_logs
    ]

    return DashboardSummaryResponse(
        kpi=KpiMetrics(
            total_identities=total_identities,
            active_accounts=active_ad,
            deprovisioned_accounts=deprovisioned,
            connected_systems_online=online_apps,
            connected_systems_total=total_apps,
            ghost_accounts_count=len(discrepancies)
        ),
        discrepancies=discrepancies,
        recent_activities=activities
    )


# ---------------------------------------------------------
# Telegram System & AD Sync Agent Health Monitor Endpoints
# ---------------------------------------------------------
from pydantic import BaseModel
from typing import Optional
from app.services.telegram_service import (
    get_health_monitor_config,
    save_health_monitor_config,
    check_full_system_health,
    send_health_report
)

class HealthMonitorUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    start_time: Optional[str] = None
    interval_hours: Optional[int] = None
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    notify_admins_enabled: Optional[bool] = None

class HealthMonitorTestRequest(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None


@router.get("/health-monitor")
async def get_health_monitor_status(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve Telegram Health Monitor configuration and live system health snapshot."""
    config = get_health_monitor_config(db)
    health = await check_full_system_health(db)
    return {
        "config": config,
        "live_health": health
    }


@router.put("/health-monitor")
def update_health_monitor(
    payload: HealthMonitorUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Update Telegram Health Monitor schedule and credentials."""
    updated = save_health_monitor_config(db, payload.model_dump(exclude_unset=True))
    return {
        "status": "success",
        "message": "บันทึกการตั้งค่าการแจ้งเตือน Telegram สำเร็จ",
        "config": updated
    }


@router.post("/health-monitor/test-alert")
async def trigger_test_health_alert(
    payload: Optional[HealthMonitorTestRequest] = None,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Trigger an immediate real-time health check and send report to Telegram."""
    bot_tok = payload.bot_token if payload and payload.bot_token else None
    c_id = payload.chat_id if payload and payload.chat_id else None
    result = await send_health_report(
        db=db,
        triggered_by=f"MANUAL_TEST_{current_admin.username}",
        custom_bot_token=bot_tok,
        custom_chat_id=c_id
    )
    return result

