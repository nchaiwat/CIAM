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

    total_apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).count()
    online_apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True, ConnectedApplication.health_status == "ONLINE").count()
    # If not yet checked, assume active ones are online
    if online_apps == 0 and total_apps > 0:
        online_apps = total_apps

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
    send_health_report,
    get_ad_monitor_status,
    save_ad_monitor_config,
    check_and_notify_ad_status,
    trigger_test_ad_alert
)

class HealthMonitorUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    start_time: Optional[str] = None
    interval_hours: Optional[int] = None
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    notify_admins_enabled: Optional[bool] = None
    ad_check_interval_seconds: Optional[int] = None

class AdIntervalUpdateRequest(BaseModel):
    check_interval_seconds: int = 60

class HealthMonitorTestRequest(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None

class AdAlertTestRequest(BaseModel):
    alert_type: str = "OFFLINE_IMMEDIATE"  # OFFLINE_IMMEDIATE, OFFLINE_REMINDER, ONLINE_RECOVERED
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None


@router.get("/health-monitor")
async def get_health_monitor_status(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve Telegram Health Monitor configuration, live system health, and real-time AD monitor state."""
    config = get_health_monitor_config(db)
    health = await check_full_system_health(db)
    ad_monitor = get_ad_monitor_status(db)
    return {
        "config": config,
        "live_health": health,
        "ad_monitor": ad_monitor
    }


@router.put("/health-monitor")
def update_health_monitor(
    payload: HealthMonitorUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Update Telegram Health Monitor schedule, credentials, and AD check interval."""
    updated = save_health_monitor_config(db, payload.model_dump(exclude_unset=True))
    if payload.ad_check_interval_seconds is not None:
        save_ad_monitor_config(db, {"check_interval_seconds": payload.ad_check_interval_seconds})
    ad_mon = get_ad_monitor_status(db)
    return {
        "status": "success",
        "message": "บันทึกการตั้งค่าการแจ้งเตือน Telegram สำเร็จ",
        "config": updated,
        "ad_monitor": ad_mon
    }


@router.put("/health-monitor/ad-interval")
def update_ad_check_interval(
    payload: AdIntervalUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Update AD status monitoring probe interval (seconds)."""
    updated = save_ad_monitor_config(db, {"check_interval_seconds": payload.check_interval_seconds})
    return {
        "status": "success",
        "message": f"บันทึกความถี่ในการตรวจสอบ AD สำเร็จ ({payload.check_interval_seconds} วินาที)",
        "ad_monitor": updated
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


@router.post("/health-monitor/test-ad-alert")
async def trigger_test_ad_status_alert(
    payload: Optional[AdAlertTestRequest] = None,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Trigger a simulated AD status alert to Telegram (OFFLINE_IMMEDIATE, OFFLINE_REMINDER, or ONLINE_RECOVERED)."""
    alert_t = payload.alert_type if payload and payload.alert_type else "OFFLINE_IMMEDIATE"
    b_token = payload.bot_token if payload and payload.bot_token else None
    c_id = payload.chat_id if payload and payload.chat_id else None
    return await trigger_test_ad_alert(
        db=db,
        alert_type=alert_t,
        custom_bot_token=b_token,
        custom_chat_id=c_id
    )


@router.post("/health-monitor/check-ad-now")
async def force_check_ad_status(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Run an immediate AD status probe and notify if status is OFF or RECOVERED."""
    return await check_and_notify_ad_status(db, force_check=True)

