from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.schemas.directory import (
    UserListItem,
    AppAccountSummary,
    UserDetailResponse,
    UserCreateRequest,
    UserCreateResponse,
    UserActivateRequest,
    UserActivateResponse
)
from app.services.provisioning import execute_user_creation
from app.services.deprovisioning import execute_user_activation

router = APIRouter(prefix="/directory", tags=["User Directory"])


def _get_identity_activity(identity: MasterIdentity, mappings: list, now=None):
    if now is None:
        now = datetime.now(timezone.utc)
    timestamps = []
    if identity.last_login_ad_at:
        t = identity.last_login_ad_at
        timestamps.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))

    for m, _ in mappings:
        if m.last_app_login_at:
            t = m.last_app_login_at
            timestamps.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))

    last_access = max(timestamps) if timestamps else None
    days_since_access = max(0, (now - last_access).days) if last_access else None
    created_at = getattr(identity, "created_at", None) or getattr(identity, "updated_at", None)

    return created_at, last_access, days_since_access

def _build_app_summaries(mappings: list, now=None):
    if now is None:
        now = datetime.now(timezone.utc)
    summaries = []
    for m, app in mappings:
        days_login = None
        if m.last_app_login_at:
            t = m.last_app_login_at
            t_utc = t if t.tzinfo else t.replace(tzinfo=timezone.utc)
            days_login = max(0, (now - t_utc).days)

        m_created = getattr(m, "created_at", None) or getattr(m, "updated_at", None)
        summaries.append(
            AppAccountSummary(
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                app_username=m.app_username,
                app_group_name=m.app_group_name,
                is_active_in_app=m.is_active_in_app,
                last_sync_status=m.last_sync_status,
                last_app_login_at=m.last_app_login_at,
                created_at=m_created,
                days_since_last_login=days_login
            )
        )
    return summaries

@router.get("/users", response_model=List[UserListItem])
def list_users(
    search: Optional[str] = Query(None, description="Search term for employee_id, username, full_name, department"),
    status: Optional[str] = Query(None, description="Filter by status: 'active', 'inactive'"),
    app_code: Optional[str] = Query(None, description="Filter by app code"),
    has_ghost: Optional[bool] = Query(None, description="Filter only ghost/discrepancy accounts"),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """List master enterprise identities with their cross-app status matrix."""
    from collections import defaultdict
    from datetime import datetime, timezone

    query = db.query(MasterIdentity)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                MasterIdentity.username.ilike(search_term),
                MasterIdentity.full_name.ilike(search_term),
                MasterIdentity.employee_id.ilike(search_term),
                MasterIdentity.department.ilike(search_term),
                MasterIdentity.email.ilike(search_term)
            )
        )

    if status:
        stat = status.lower().strip()
        if stat == "ad_active":
            query = query.filter(MasterIdentity.is_active_in_ad == True)
        elif stat == "ad_inactive":
            query = query.filter(MasterIdentity.is_active_in_ad == False)

    identities = query.all()
    if not identities:
        return []

    # Batch load all mappings in a single query instead of N queries
    identity_ids = [i.id for i in identities]
    all_mappings = (
        db.query(AppAccountMapping, ConnectedApplication)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.identity_id.in_(identity_ids))
        .all()
    )

    mappings_by_identity = defaultdict(list)
    for m, app in all_mappings:
        mappings_by_identity[m.identity_id].append((m, app))

    now = datetime.now(timezone.utc)
    corporate_depts = ("IT", "PU", "Administrator", "Accounting", "HR", "Executive", "Management", "General", "QA", "Sales", "Warehouse")
    results: List[UserListItem] = []

    for identity in identities:
        mappings = mappings_by_identity.get(identity.id, [])
        app_summaries = _build_app_summaries(mappings, now=now)
        created_at, last_access, days_since_access = _get_identity_activity(identity, mappings, now=now)

        # Check overall active status across AD and spokes
        has_active_spoke = any(m.is_active_in_app for m, _ in mappings)
        is_overall_active = identity.is_active_in_ad or has_active_spoke

        # Filter by overall active or terminated if requested
        if status:
            stat = status.lower().strip()
            if stat == "active" and not is_overall_active:
                continue
            elif stat in ("terminated", "all_inactive") and is_overall_active:
                continue

        # Check discrepancy (Inactive in AD but active in child app)
        has_disc = (not identity.is_active_in_ad) and has_active_spoke

        # Apply app_code filter if requested
        if app_code:
            if not any(app.app_code.lower() == app_code.lower() for _, app in mappings):
                continue

        # Apply has_ghost filter if requested
        if has_ghost is not None:
            if has_ghost != has_disc:
                continue

        # AD users have ad_guid, employee_id, AD login history, or corporate AD department
        is_ad = bool(
            identity.ad_guid 
            or identity.employee_id 
            or identity.last_login_ad_at 
            or (identity.department and identity.department in corporate_depts)
        )

        results.append(UserListItem(
            id=identity.id,
            employee_id=identity.employee_id,
            username=identity.username,
            full_name=identity.full_name,
            email=identity.email,
            department=identity.department,
            telephone=identity.telephone,
            is_active_in_ad=identity.is_active_in_ad,
            last_login_ad_at=identity.last_login_ad_at,
            created_at=created_at,
            last_access_at=last_access,
            days_since_last_access=days_since_access,
            connected_apps=app_summaries,
            has_discrepancy=has_disc,
            is_ad_account=is_ad
        ))

    return results

@router.get("/users/{user_id}", response_model=UserDetailResponse)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Retrieve detailed identity and cross-application permissions matrix for a single user."""
    identity = db.query(MasterIdentity).filter(MasterIdentity.id == user_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    mappings = (
        db.query(AppAccountMapping, ConnectedApplication)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.identity_id == identity.id)
        .all()
    )

    app_summaries = _build_app_summaries(mappings)
    created_at, last_access, days_since_access = _get_identity_activity(identity, mappings)
    has_disc = (not identity.is_active_in_ad) and any(m.is_active_in_app for m, _ in mappings)

    user_item = UserListItem(
        id=identity.id,
        employee_id=identity.employee_id,
        username=identity.username,
        full_name=identity.full_name,
        email=identity.email,
        department=identity.department,
        telephone=identity.telephone,
        is_active_in_ad=identity.is_active_in_ad,
        last_login_ad_at=identity.last_login_ad_at,
        created_at=created_at,
        last_access_at=last_access,
        days_since_last_access=days_since_access,
        connected_apps=app_summaries,
        has_discrepancy=has_disc
    )

    return UserDetailResponse(user=user_item, accounts=app_summaries)

@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_and_provision_user(
    request: UserCreateRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Onboard and provision a new employee:
    1. Register Master Identity in Central Directory
    2. Provision into Active Directory via AD Proxy (if requested)
    3. Provision account across selected Spoke applications (REST API, SAP B1, etc.)
    """
    client_ip = req.client.host if req.client else "127.0.0.1"
    try:
        response = await execute_user_creation(
            db=db,
            request=request,
            actor_username=current_admin.username,
            ip_address=client_ip
        )
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Provisioning error: {str(exc)}")

@router.post("/users/{user_id}/activate", response_model=UserActivateResponse)
async def activate_user(
    user_id: int,
    request: UserActivateRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Re-activate an employee across Active Directory and all linked child systems.
    """
    client_ip = req.client.host if req.client else "127.0.0.1"
    try:
        response = await execute_user_activation(
            db=db,
            identity_id=user_id,
            reason=request.reason,
            actor_username=current_admin.username,
            ip_address=client_ip
        )
        return response
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Activation error: {str(exc)}")

