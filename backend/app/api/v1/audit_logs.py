import csv
import io
from datetime import timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.audit import IamAuditLog
from app.schemas.audit import AuditLogListResponse, AuditLogOut

BANGKOK_TZ = timezone(timedelta(hours=7))

router = APIRouter(prefix="/audit-logs", tags=["Audit Trail & Compliance"])

@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    search: Optional[str] = Query(None, description="Search actor, target user, reason"),
    action_type: Optional[str] = Query(None, description="Filter action: OFFBOARD_USER, ENABLE_USER, etc."),
    status: Optional[str] = Query(None, description="Filter status: SUCCESS, FAILED"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve paginated audit logs with search and filtering capabilities."""
    query = db.query(IamAuditLog)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                IamAuditLog.actor_username.ilike(term),
                IamAuditLog.target_username.ilike(term),
                IamAuditLog.reason.ilike(term),
                IamAuditLog.affected_app_code.ilike(term)
            )
        )

    if action_type:
        query = query.filter(IamAuditLog.action_type == action_type)

    if status:
        query = query.filter(IamAuditLog.status == status)

    total = query.count()
    items = (
        query.order_by(desc(IamAuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size
    )

@router.get("/export-csv")
def export_audit_logs_csv(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Export complete audit history to CSV file for ISO 27001 / PDPA compliance audit in Asia/Bangkok."""
    logs = db.query(IamAuditLog).order_by(desc(IamAuditLog.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID", "Timestamp (dd/mm/yyyy Asia/Bangkok)", "Actor", "Action", "Target User",
        "Affected App", "Previous Status", "New Status", "Execution Mode",
        "Reason", "Status", "IP Address"
    ])

    for log in logs:
        ts_str = ""
        if log.created_at:
            dt = log.created_at
            bkk_dt = dt.astimezone(BANGKOK_TZ) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(BANGKOK_TZ)
            ts_str = bkk_dt.strftime("%d/%m/%Y %H:%M:%S")

        writer.writerow([
            log.id,
            ts_str,
            log.actor_username,
            log.action_type,
            log.target_username,
            log.affected_app_code or "ALL",
            log.previous_status or "",
            log.new_status or "",
            log.execution_mode,
            log.reason or "",
            log.status,
            log.ip_address or ""
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ciam_audit_logs.csv"}
    )
