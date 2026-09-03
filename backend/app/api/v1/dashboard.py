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
