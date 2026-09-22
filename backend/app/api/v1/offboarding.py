from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.schemas.offboarding import (
    OffboardPreviewRequest,
    OffboardPreviewResponse,
    AffectedAppInfo,
    OffboardExecuteRequest,
    OffboardExecuteResponse
)
from app.services.deprovisioning import execute_one_click_offboard

router = APIRouter(prefix="/offboarding", tags=["Offboarding Hub"])

@router.post("/preview", response_model=OffboardPreviewResponse)
def preview_offboarding_impact(
    request: OffboardPreviewRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Calculate the blast radius and preview which systems will be affected
    before executing the offboarding action.
    """
    query_str = (request.username or "").strip()
    # 1. Exact or case-insensitive match on username
    identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(query_str)).first()
    
    # 2. Match prefix or contains on username, full name, or employee ID
    if not identity:
        identity = (
            db.query(MasterIdentity)
            .filter(
                (MasterIdentity.username.ilike(f"{query_str}%")) |
                (MasterIdentity.username.ilike(f"%{query_str}%")) |
                (MasterIdentity.full_name.ilike(f"%{query_str}%")) |
                (MasterIdentity.employee_id.ilike(f"%{query_str}%"))
            )
            .first()
        )

    if not identity:
        raise HTTPException(status_code=404, detail=f"ไม่พบข้อมูลผู้ใช้ '{request.username}' ในระบบ")

    mappings = (
        db.query(AppAccountMapping, ConnectedApplication)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.identity_id == identity.id)
        .all()
    )

    affected_apps = []
    for mapping, app in mappings:
        action_text = (
            "Deactivate via REST API (M2M PATCH)"
            if app.connector_type == "REST_API"
            else f"Dispatch RPA Worker ({app.rpa_adapter_name or 'Bot Runner'})"
        )
        affected_apps.append(
            AffectedAppInfo(
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                app_username=mapping.app_username,
                current_status="ACTIVE" if mapping.is_active_in_app else "DISABLED",
                action_to_take=action_text
            )
        )

    return OffboardPreviewResponse(
        identity_id=identity.id,
        employee_id=identity.employee_id,
        username=identity.username,
        full_name=identity.full_name,
        department=identity.department,
        ad_current_status="ACTIVE" if identity.is_active_in_ad else "DISABLED",
        affected_applications=affected_apps,
        total_apps_affected=len(affected_apps)
    )

@router.post("/execute", response_model=OffboardExecuteResponse)
async def execute_offboarding(
    request: OffboardExecuteRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Execute Instant One-Click Offboarding across Active Directory and all child systems (REST & RPA).
    """
    client_ip = req.client.host if req.client else "127.0.0.1"
    try:
        response = await execute_one_click_offboard(
            db=db,
            request=request,
            actor_username=current_admin.username,
            ip_address=client_ip
        )
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(exc)}")
