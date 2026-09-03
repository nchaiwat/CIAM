from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.schemas.directory import UserListItem, AppAccountSummary, UserDetailResponse

router = APIRouter(prefix="/directory", tags=["User Directory"])

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
        if status.lower() == "active":
            query = query.filter(MasterIdentity.is_active_in_ad == True)
        elif status.lower() == "inactive":
            query = query.filter(MasterIdentity.is_active_in_ad == False)

    identities = query.all()
    results: List[UserListItem] = []

    for identity in identities:
        mappings = (
            db.query(AppAccountMapping, ConnectedApplication)
            .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
            .filter(AppAccountMapping.identity_id == identity.id)
            .all()
        )

        app_summaries = [
            AppAccountSummary(
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                app_username=m.app_username,
                app_group_name=m.app_group_name,
                is_active_in_app=m.is_active_in_app,
                last_sync_status=m.last_sync_status,
                last_app_login_at=m.last_app_login_at
            )
            for m, app in mappings
        ]

        # Check discrepancy (Inactive in AD but active in child app)
        has_disc = (not identity.is_active_in_ad) and any(m.is_active_in_app for m, _ in mappings)

        # Apply app_code filter if requested
        if app_code:
            if not any(app.app_code.lower() == app_code.lower() for _, app in mappings):
                continue

        # Apply has_ghost filter if requested
        if has_ghost is not None:
            if has_ghost != has_disc:
                continue

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
            connected_apps=app_summaries,
            has_discrepancy=has_disc
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

    app_summaries = [
        AppAccountSummary(
            application_id=app.id,
            app_code=app.app_code,
            app_name=app.app_name,
            connector_type=app.connector_type,
            app_username=m.app_username,
            app_group_name=m.app_group_name,
            is_active_in_app=m.is_active_in_app,
            last_sync_status=m.last_sync_status,
            last_app_login_at=m.last_app_login_at
        )
        for m, app in mappings
    ]

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
        connected_apps=app_summaries,
        has_discrepancy=has_disc
    )

    return UserDetailResponse(user=user_item, accounts=app_summaries)
