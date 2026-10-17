import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.models.audit import IamAuditLog
from app.schemas.directory import (
    UserListItem,
    AppAccountSummary,
    UserDetailResponse,
    UserCreateRequest,
    UserCreateResponse,
    UserActivateRequest,
    UserActivateResponse,
    AccountLinkRequest,
    AccountExceptionRequest,
    AccountStatusUpdateRequest,
    AccountActionResponse,
    LocalPortalAccountRequest,
    LocalPortalAccountResponse,
    AssignSpokeAppRequest
)
from app.services.provisioning import execute_user_creation
from app.services.deprovisioning import execute_user_activation
from app.connectors.factory import get_connector_for_app

logger = logging.getLogger("ciam.directory")

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

def _build_app_summaries(mappings: list, identity_is_active_in_ad: Optional[bool] = None, now=None):
    if now is None:
        now = datetime.now(timezone.utc)

    # Deduplicate mappings by app_code so each spoke application appears at most once
    # Preference: active mapping > exception approved > latest login/update
    best_mappings_by_code = {}
    for m, app in mappings:
        code_key = (app.app_code or "").strip().upper()
        if not code_key:
            continue
        if code_key not in best_mappings_by_code:
            best_mappings_by_code[code_key] = (m, app)
        else:
            prev_m, prev_app = best_mappings_by_code[code_key]
            # Preference ranking: active in app beats inactive
            if m.is_active_in_app and not prev_m.is_active_in_app:
                best_mappings_by_code[code_key] = (m, app)
            elif m.is_active_in_app == prev_m.is_active_in_app:
                m_t = m.last_app_login_at or getattr(m, "updated_at", None) or getattr(m, "created_at", None)
                prev_t = prev_m.last_app_login_at or getattr(prev_m, "updated_at", None) or getattr(prev_m, "created_at", None)
                if m_t and (not prev_t or m_t > prev_t):
                    best_mappings_by_code[code_key] = (m, app)

    summaries = []
    for code_key, (m, app) in best_mappings_by_code.items():
        days_login = None
        if m.last_app_login_at:
            t = m.last_app_login_at
            t_utc = t if t.tzinfo else t.replace(tzinfo=timezone.utc)
            days_login = max(0, (now - t_utc).days)

        m_created = getattr(m, "created_at", None) or getattr(m, "updated_at", None)

        is_act = m.is_active_in_app
        if app.app_code.lower() == "ad" and identity_is_active_in_ad is not None:
            # Active Directory spoke badge strictly mirrors Master Identity's AD status
            is_act = identity_is_active_in_ad
            if m.is_active_in_app != identity_is_active_in_ad:
                m.is_active_in_app = identity_is_active_in_ad

        summaries.append(
            AppAccountSummary(
                mapping_id=m.id,
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                app_username=m.app_username,
                app_group_name=m.app_group_name,
                is_active_in_app=is_act,
                last_sync_status=m.last_sync_status,
                last_app_login_at=m.last_app_login_at,
                created_at=m_created,
                days_since_last_login=days_login,
                sso_enabled=bool(getattr(app, "sso_enabled", False)),
                is_approved_exception=bool(getattr(m, "is_approved_exception", False)),
                exception_type=getattr(m, "exception_type", None),
                exception_reason=getattr(m, "exception_reason", None),
                exception_approved_by=getattr(m, "exception_approved_by", None),
                exception_approved_at=getattr(m, "exception_approved_at", None),
            )
        )
    # Sort alphabetically by app_code so everyone has consistent sequence
    summaries.sort(key=lambda x: x.app_code.upper())
    return summaries

def _clean_directory_attributes(identity: MasterIdentity, mappings: list, is_ad: bool) -> tuple[Optional[str], Optional[str]]:
    """
    Enforce strict organizational integrity:
    1. People who have email are ONLY those with an active account in Microsoft 365.
    2. People who have department must be in Active Directory with an extracted OU.
       If not in AD or not a real OU, do NOT display (return None).
    """
    has_m365 = any(
        app.app_code.lower() == "m365" and m.is_active_in_app
        for m, app in mappings
    )
    email = identity.email if has_m365 else None

    dept_str = (identity.department or "").strip()
    if not is_ad or not dept_str:
        return email, None

    dept_lower = dept_str.lower()
    junk_exact = {
        "openvpn", "captive portal", "m365 user", "radius", "firewall",
        "active directory", "wa shop", "general", "employee", "user", "ç",
        "ทั่วไป", "none", "n/a", "-", "null", "undefined",
        "administrator", "admin", "domain admins", "domain users"
    }
    junk_substrings = [
        "openvpn", "captive portal", "m365 user", "radius", "firewall",
        "wa shop", "active directory"
    ]
    is_invalid_dept = (
        dept_lower in junk_exact
        or any(j in dept_lower for j in junk_substrings)
    )
    department = None if is_invalid_dept else dept_str

    return email, department

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
        raw_s = search.strip()
        s_low = raw_s.lower()
        search_variants = {raw_s}
        if "thai" in s_low:
            search_variants.add(s_low.replace("thai", "tai"))
        if "tai" in s_low and "thai" not in s_low:
            search_variants.add(s_low.replace("tai", "thai"))
        if "wut" in s_low:
            search_variants.add(s_low.replace("wut", "woot"))
        if "woot" in s_low:
            search_variants.add(s_low.replace("woot", "wut"))

        or_clauses = []
        for sv in search_variants:
            st = f"%{sv}%"
            mapped_ids_subq = (
                db.query(AppAccountMapping.identity_id)
                .filter(AppAccountMapping.app_username.ilike(st))
            )
            or_clauses.extend([
                MasterIdentity.username.ilike(st),
                MasterIdentity.full_name.ilike(st),
                MasterIdentity.employee_id.ilike(st),
                MasterIdentity.department.ilike(st),
                MasterIdentity.email.ilike(st),
                MasterIdentity.id.in_(mapped_ids_subq),
            ])
        query = query.filter(or_(*or_clauses))

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
        .filter(
            AppAccountMapping.identity_id.in_(identity_ids),
            ConnectedApplication.is_active == True
        )
        .all()
    )

    mappings_by_identity = defaultdict(list)
    for m, app in all_mappings:
        mappings_by_identity[m.identity_id].append((m, app))

    now = datetime.now(timezone.utc)
    corporate_depts = ("IT", "PU", "Accounting", "HR", "Executive", "Management", "General", "QA", "Sales", "Warehouse", "Administration", "ธุรการ")
    results: List[UserListItem] = []

    for identity in identities:
        mappings = mappings_by_identity.get(identity.id, [])
        u_clean = (identity.username or "").strip().lower()
        is_shop_acc = (
            u_clean.startswith("wa-shop")
            or u_clean.startswith("ws-")
            or "wa_shop" in u_clean
            or "shop_" in u_clean
            or (len(u_clean) > 2 and u_clean[:2].isdigit() and "-ws" in u_clean)
        )

        # Shop accounts are exclusively local branch VPN accounts, never AD accounts
        if is_shop_acc:
            mappings = [m_pair for m_pair in mappings if m_pair[1].app_code.lower() != "ad"]

        # AD users have ad_guid, employee_id, AD login history, AD mapping, corporate email, or corporate AD department
        has_ad_mapping = (not is_shop_acc) and any(app.app_code.lower() == "ad" for _, app in mappings)
        dept_lower = (identity.department or "").strip().lower()
        corporate_keywords = ("it", "pu", "purchasing", "accounting", "hr", "executive", "management", "general", "qa", "warehouse", "m365", "administration", "ธุรการ")
        is_corp_dept = any(kw in dept_lower for kw in corporate_keywords) if dept_lower else False
        has_corp_email = bool(identity.email and "@windowasia.com" in identity.email.lower())
        is_ad_username_fmt = len(u_clean.split(".")) == 2 and len(u_clean.split(".")[1]) <= 2

        is_ad = bool(
            not is_shop_acc
            and (
                identity.ad_guid 
                or identity.employee_id 
                or identity.last_login_ad_at 
                or has_ad_mapping
                or is_corp_dept
                or (has_corp_email and not is_shop_acc)
            )
            and (u_clean not in ("pinyada.s", "winmonpan.p"))
        )

        # An identity is genuinely active in AD only if it is an AD identity, has AD presence, and identity.is_active_in_ad is True
        has_direct_ad = bool(has_ad_mapping or identity.ad_guid or identity.last_login_ad_at)
        effective_ad_active = bool(is_ad and identity.is_active_in_ad and has_direct_ad)
        if identity.is_active_in_ad and (not has_direct_ad or is_shop_acc) and not getattr(identity, "is_approved_exception", False):
            # Auto-heal: If an identity has no AD presence at all or is a shop account, it is not in AD
            identity.is_active_in_ad = False
            effective_ad_active = False

        app_summaries = _build_app_summaries(mappings, identity_is_active_in_ad=effective_ad_active, now=now)
        created_at, last_access, days_since_access = _get_identity_activity(identity, mappings, now=now)

        # Check overall active status across AD and spokes
        has_active_spoke = any(m.is_active_in_app for m, _ in mappings)
        is_overall_active = effective_ad_active or has_active_spoke

        # Filter by app_code and status
        if app_code:
            target_app = app_code.lower().strip()
            if target_app == "ad":
                # Only genuine Active Directory accounts belong to this filter
                if not is_ad:
                    continue
                if status:
                    stat = status.lower().strip()
                    if stat == "active" and not effective_ad_active:
                        continue
                    elif stat in ("terminated", "inactive", "all_inactive") and effective_ad_active:
                        continue
            else:
                spoke_ms = [m for m, app in mappings if app.app_code.lower() == target_app]
                if not spoke_ms:
                    continue
                if status:
                    stat = status.lower().strip()
                    spoke_active = any(m.is_active_in_app for m in spoke_ms)
                    if stat == "active" and not spoke_active:
                        continue
                    elif stat in ("terminated", "inactive", "all_inactive") and spoke_active:
                        continue
        elif status:
            stat = status.lower().strip()
            if stat == "active" and not is_overall_active:
                continue
            elif stat in ("terminated", "inactive", "all_inactive") and is_overall_active:
                continue

        # Check approved exception
        is_identity_exception = bool(getattr(identity, "is_approved_exception", False))
        has_approved_mapping_exception = any(getattr(m, "is_approved_exception", False) for m, _ in mappings)
        is_exception = is_identity_exception or has_approved_mapping_exception

        # Discrepancy ONLY applies to AD corporate accounts that are INACTIVE in AD but STILL ACTIVE in a spoke app
        has_disc = is_ad and (not effective_ad_active) and has_active_spoke and not is_exception

        # Apply has_ghost filter if requested
        if has_ghost is not None:
            if has_ghost != has_disc:
                continue

        exc_type = getattr(identity, "exception_type", None) or next((getattr(m, "exception_type", None) for m, _ in mappings if getattr(m, "is_approved_exception", False)), None)
        exc_reason = getattr(identity, "exception_reason", None) or next((getattr(m, "exception_reason", None) for m, _ in mappings if getattr(m, "is_approved_exception", False)), None)
        exc_approved_by = getattr(identity, "exception_approved_by", None) or next((getattr(m, "exception_approved_by", None) for m, _ in mappings if getattr(m, "is_approved_exception", False)), None)

        clean_email, clean_dept = _clean_directory_attributes(identity, mappings, is_ad)

        results.append(UserListItem(
            id=identity.id,
            employee_id=identity.employee_id,
            username=identity.username,
            full_name=identity.full_name,
            email=clean_email,
            department=clean_dept,
            telephone=identity.telephone,
            telegram_id=identity.telegram_id,
            is_active_in_ad=effective_ad_active if is_ad else False,
            last_login_ad_at=identity.last_login_ad_at if is_ad else None,
            created_at=created_at,
            last_access_at=last_access,
            days_since_last_access=days_since_access,
            connected_apps=app_summaries,
            has_discrepancy=has_disc,
            is_ad_account=is_ad,
            is_approved_exception=is_exception,
            exception_type=exc_type,
            exception_reason=exc_reason,
            exception_approved_by=exc_approved_by
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
        .filter(
            AppAccountMapping.identity_id == identity.id,
            ConnectedApplication.is_active == True
        )
        .all()
    )

    u_clean = (identity.username or "").strip().lower()
    is_shop_acc = (
        u_clean.startswith("wa-shop")
        or u_clean.startswith("ws-")
        or "wa_shop" in u_clean
        or "shop_" in u_clean
        or (len(u_clean) > 2 and u_clean[:2].isdigit() and "-ws" in u_clean)
    )
    if is_shop_acc:
        mappings = [m_pair for m_pair in mappings if m_pair[1].app_code.lower() != "ad"]

    has_ad_mapping = (not is_shop_acc) and any(app.app_code.lower() == "ad" for _, app in mappings)
    has_direct_ad = bool(has_ad_mapping or identity.ad_guid or identity.last_login_ad_at)
    is_ad = bool((not is_shop_acc) and (identity.ad_guid or has_ad_mapping))
    effective_ad_active = bool(is_ad and identity.is_active_in_ad and has_direct_ad)
    if identity.is_active_in_ad and (not has_direct_ad or is_shop_acc) and not getattr(identity, "is_approved_exception", False):
        identity.is_active_in_ad = False
        effective_ad_active = False

    app_summaries = _build_app_summaries(mappings, identity_is_active_in_ad=effective_ad_active)
    created_at, last_access, days_since_access = _get_identity_activity(identity, mappings)
    has_disc = (not effective_ad_active) and any(m.is_active_in_app for m, _ in mappings)
    is_ad = bool(effective_ad_active or identity.ad_guid or any(app.app_code.lower() == "ad" for _, app in mappings))
    clean_email, clean_dept = _clean_directory_attributes(identity, mappings, is_ad)

    user_item = UserListItem(
        id=identity.id,
        employee_id=identity.employee_id,
        username=identity.username,
        full_name=identity.full_name,
        email=clean_email,
        department=clean_dept,
        telephone=identity.telephone,
        telegram_id=identity.telegram_id,
        is_active_in_ad=effective_ad_active if is_ad else False,
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


# -------------------------------------------------------------
# Enterprise Identity Linking & Approved Exception Endpoints
# -------------------------------------------------------------

@router.post("/users/{identity_id}/assign-app", response_model=AccountActionResponse)
async def assign_spoke_app_to_user(
    identity_id: int,
    payload: AssignSpokeAppRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Assign an existing Master Identity to a Connected Application (Spoke).
    Creates or re-activates AppAccountMapping and dispatches provisioning if applicable.
    """
    identity = db.query(MasterIdentity).filter_by(id=identity_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนที่ระบุ (MasterIdentity not found)")

    app = db.query(ConnectedApplication).filter_by(id=payload.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="ไม่พบระบบลูกที่ระบุ (ConnectedApplication not found)")

    target_username = (payload.app_username or identity.username).strip()
    target_group = (payload.app_group_name or "Standard User").strip()

    now = datetime.now(timezone.utc)
    existing_mapping = db.query(AppAccountMapping).filter_by(
        identity_id=identity.id,
        application_id=app.id
    ).first()

    connector_msg = ""
    connector_success = True

    if existing_mapping:
        existing_mapping.is_active_in_app = True
        existing_mapping.app_username = target_username
        existing_mapping.app_group_name = target_group
        existing_mapping.last_sync_status = "IN_SYNC" if identity.is_active_in_ad else "DISCREPANCY"
        existing_mapping.updated_at = now
        mapping = existing_mapping
    else:
        mapping = AppAccountMapping(
            identity_id=identity.id,
            application_id=app.id,
            app_username=target_username,
            app_group_name=target_group,
            is_active_in_app=True,
            last_sync_status="IN_SYNC" if identity.is_active_in_ad else "DISCREPANCY",
            created_at=now,
            updated_at=now
        )
        db.add(mapping)

    # If Mode A (REST API), attempt provisioning to child system
    if app.connector_type == "REST_API":
        try:
            connector = get_connector_for_app(app)
            conn_res = await connector.provision(
                username=target_username,
                full_name=identity.full_name,
                email=identity.email,
                department=identity.department,
                group_name=target_group
            )
            connector_msg = conn_res.message
            connector_success = conn_res.success
        except Exception as exc:
            logger.warning("Spoke connector provision for %s (%s) threw: %s", app.app_code, target_username, exc)
            connector_msg = f"มอบสิทธิ์ในระบบกลางสำเร็จ แต่ส่งคำสั่งไปยัง {app.app_name} มีข้อความ: {str(exc)[:120]}"

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="ASSIGN_SPOKE_ACCESS",
        target_username=target_username,
        affected_app_code=app.app_code,
        execution_mode="PORTAL_ADMIN",
        reason=f"มอบสิทธิ์ระบบ '{app.app_name}' ให้กับ '{identity.username}' ({identity.full_name}): {payload.reason}",
        ip_address=req.client.host if req.client else "127.0.0.1",
        status="SUCCESS" if connector_success else "WARNING"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"มอบสิทธิ์ระบบ {app.app_name} ให้กับ {identity.full_name} ({target_username}) สำเร็จเรียบร้อย",
        details={
            "identity_id": identity.id,
            "application_id": app.id,
            "app_code": app.app_code,
            "app_name": app.app_name,
            "app_username": target_username,
            "connector_message": connector_msg
        }
    )


@router.post("/accounts/{mapping_id}/link-identity", response_model=AccountActionResponse)
def link_account_to_identity(
    mapping_id: int,
    payload: AccountLinkRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Link a spoke application account (e.g. Nattcha.S in SAP B1) to a master Active Directory identity (Natcha.S).
    Resolves ghost accounts caused by spelling discrepancies in legacy child applications.
    """
    mapping = db.query(AppAccountMapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีระบบลูกที่ระบุ (AppAccountMapping not found)")

    target_identity = db.query(MasterIdentity).filter_by(id=payload.target_identity_id).first()
    if not target_identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนหลักปลายทาง (Target MasterIdentity not found)")

    old_identity = db.query(MasterIdentity).filter_by(id=mapping.identity_id).first()
    old_identity_id = mapping.identity_id
    old_username = old_identity.username if old_identity else "Unknown"

    # Check if target already has an account mapping for this application
    existing_target_mapping = (
        db.query(AppAccountMapping)
        .filter(
            AppAccountMapping.identity_id == target_identity.id,
            AppAccountMapping.application_id == mapping.application_id,
            AppAccountMapping.id != mapping.id
        )
        .first()
    )
    if existing_target_mapping:
        # Merge or replace existing target mapping
        db.delete(existing_target_mapping)
        db.flush()

    # Re-link mapping to target identity
    mapping.identity_id = target_identity.id
    mapping.last_sync_status = "IN_SYNC" if target_identity.is_active_in_ad else "DISCREPANCY"
    db.flush()

    # If the previous identity was an orphaned spoke placeholder with no AD presence and no other accounts, remove it
    orphaned_cleaned = False
    if old_identity and old_identity.id != target_identity.id:
        remaining_mappings_count = db.query(AppAccountMapping).filter_by(identity_id=old_identity_id).count()
        if remaining_mappings_count == 0 and not old_identity.is_active_in_ad and not old_identity.ad_guid:
            db.delete(old_identity)
            orphaned_cleaned = True

    # Audit log
    audit_reason = f"ผูกบัญชี '{mapping.app_username}' ({mapping.application.app_name if mapping.application else 'App'}) เข้ากับตัวตน '{target_identity.username}' ({target_identity.full_name}): {payload.reason}"
    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="LINK_APP_ACCOUNT",
        target_username=target_identity.username,
        affected_app_code=mapping.application.app_code if mapping.application else "SPOKE",
        execution_mode="PORTAL_ADMIN",
        reason=audit_reason,
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"ผูกบัญชี {mapping.app_username} เข้ากับตัวตน {target_identity.full_name} ({target_identity.username}) สำเร็จเรียบร้อย",
        details={
            "app_username": mapping.app_username,
            "target_username": target_identity.username,
            "target_identity_id": target_identity.id,
            "cleaned_orphaned_identity": orphaned_cleaned
        }
    )


@router.post("/users/{source_identity_id}/link-to/{target_identity_id}", response_model=AccountActionResponse)
def merge_and_link_identity(
    source_identity_id: int,
    target_identity_id: int,
    payload: AccountLinkRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Merge an entire spoke-only placeholder identity into an existing Active Directory MasterIdentity.
    """
    source_identity = db.query(MasterIdentity).filter_by(id=source_identity_id).first()
    if not source_identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนต้นทาง (Source Identity not found)")

    target_identity = db.query(MasterIdentity).filter_by(id=target_identity_id).first()
    if not target_identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนปลายทาง (Target Identity not found)")

    if source_identity.id == target_identity.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถรวมตัวตนเข้ากับตัวเองได้")

    source_mappings = db.query(AppAccountMapping).filter_by(identity_id=source_identity.id).all()
    reassigned_count = 0

    for m in source_mappings:
        # Check if target already has an account mapping for this application
        existing_target_mapping = (
            db.query(AppAccountMapping)
            .filter(
                AppAccountMapping.identity_id == target_identity.id,
                AppAccountMapping.application_id == m.application_id,
                AppAccountMapping.id != m.id
            )
            .first()
        )
        if existing_target_mapping:
            db.delete(existing_target_mapping)
            db.flush()

        m.identity_id = target_identity.id
        m.last_sync_status = "IN_SYNC" if target_identity.is_active_in_ad else "DISCREPANCY"
        reassigned_count += 1

    db.flush()

    # Delete source identity if it is not in AD
    cleaned = False
    if not source_identity.is_active_in_ad and not source_identity.ad_guid:
        db.delete(source_identity)
        cleaned = True

    # Audit log
    audit_reason = f"รวมตัวตน '{source_identity.username}' ({reassigned_count} บัญชี) เข้ากับตัวตนหลัก '{target_identity.username}': {payload.reason}"
    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="MERGE_IDENTITY",
        target_username=target_identity.username,
        affected_app_code="ALL_SPOKES",
        execution_mode="PORTAL_ADMIN",
        reason=audit_reason,
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"รวมบัญชี {reassigned_count} รายการ เข้ากับตัวตน {target_identity.full_name} ({target_identity.username}) สำเร็จ",
        details={
            "reassigned_accounts_count": reassigned_count,
            "target_username": target_identity.username,
            "cleaned_source_identity": cleaned
        }
    )


@router.post("/accounts/{mapping_id}/exception", response_model=AccountActionResponse)
def approve_account_exception(
    mapping_id: int,
    payload: AccountExceptionRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Approve an exception for a spoke account (e.g. Service Account, Known Name Mismatch, Outsource).
    Suppresses Ghost Account warnings for ISO 27001 audit compliance.
    """
    mapping = db.query(AppAccountMapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีที่ระบุ")

    now = datetime.now(timezone.utc)
    mapping.is_approved_exception = True
    mapping.exception_type = payload.exception_type.upper().strip()
    mapping.exception_reason = payload.reason.strip()
    mapping.exception_approved_by = current_admin.username
    mapping.exception_approved_at = now
    mapping.exception_expires_at = payload.expires_at
    mapping.last_sync_status = "APPROVED_EXCEPTION"

    # Also set on parent identity if standalone
    if mapping.identity:
        mapping.identity.is_approved_exception = True
        mapping.identity.exception_type = payload.exception_type.upper().strip()
        mapping.identity.exception_reason = payload.reason.strip()
        mapping.identity.exception_approved_by = current_admin.username
        mapping.identity.exception_approved_at = now

    audit_msg = f"อนุมัติข้อยกเว้นบัญชี '{mapping.app_username}' ({payload.exception_type}): {payload.reason}"
    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="APPROVE_EXCEPTION",
        target_username=mapping.app_username,
        affected_app_code=mapping.application.app_code if mapping.application else "SPOKE",
        execution_mode="PORTAL_ADMIN",
        reason=audit_msg,
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"อนุมัติข้อยกเว้นสำหรับบัญชี {mapping.app_username} เรียบร้อยแล้ว (ไม่นับเป็นบัญชีผี)",
        details={
            "app_username": mapping.app_username,
            "exception_type": mapping.exception_type,
            "exception_reason": mapping.exception_reason
        }
    )


@router.patch("/accounts/{mapping_id}/status", response_model=AccountActionResponse)
async def update_account_status(
    mapping_id: int,
    payload: AccountStatusUpdateRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Enable or disable an individual spoke application account for a specific user.
    Allows granular access control without offboarding the entire employee identity.
    """
    mapping = db.query(AppAccountMapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีระบบลูกที่ระบุ (AppAccountMapping not found)")

    app = mapping.application
    identity = mapping.identity
    app_name = app.app_name if app else "ระบบลูก"
    app_code = app.app_code if app else "spoke"
    target_username = mapping.app_username

    prev_status = mapping.is_active_in_app
    mapping.is_active_in_app = payload.is_active

    # If this is the Active Directory account, keep MasterIdentity.is_active_in_ad in sync!
    if app and app.app_code.lower() == "ad" and identity:
        identity.is_active_in_ad = payload.is_active

    # Determine sync status
    if identity:
        mapping.last_sync_status = "IN_SYNC" if identity.is_active_in_ad == mapping.is_active_in_app else "DISCREPANCY"

    # Attempt to propagate status change to target application connector
    connector_msg = ""
    connector_success = True
    if app:
        try:
            connector = get_connector_for_app(app)
            if payload.is_active:
                conn_res = await connector.activate(
                    username=target_username,
                    reason=f"Central IAM Granular Access Enabled: {payload.reason}",
                    updated_by=current_admin.username
                )
            else:
                conn_res = await connector.deprovision(
                    username=target_username,
                    reason=f"Central IAM Granular Access Revoked: {payload.reason}"
                )
            connector_msg = conn_res.message
            connector_success = conn_res.success
        except Exception as exc:
            logger.warning("Spoke connector update for %s (%s) threw: %s", app_code, target_username, exc)
            connector_msg = f"ปรับสิทธิ์ในระบบกลางสำเร็จ แต่ส่งคำสั่งไปยัง {app_name} มีข้อความ: {str(exc)[:120]}"

    action_label = "เปิดใช้งาน" if payload.is_active else "ระงับสิทธิ์"
    audit_reason = f"{action_label}การเข้าถึงระบบ '{app_name}' ({app_code.upper()}) สำหรับบัญชี '{target_username}': {payload.reason}"

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="ENABLE_SPOKE_ACCESS" if payload.is_active else "DISABLE_SPOKE_ACCESS",
        target_username=target_username,
        affected_app_code=app_code,
        previous_status="ACTIVE" if prev_status else "DISABLED",
        new_status="ACTIVE" if payload.is_active else "DISABLED",
        execution_mode="PORTAL_ADMIN",
        reason=audit_reason,
        ip_address=req.client.host if req.client else "127.0.0.1",
        status="SUCCESS" if connector_success else "WARNING",
        details=json.dumps({"mapping_id": mapping_id, "identity_username": identity.username if identity else None, "connector_msg": connector_msg})
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"{action_label}การเข้าถึง {app_name} สำหรับ {target_username} เรียบร้อยแล้ว",
        details={
            "mapping_id": mapping_id,
            "app_code": app_code,
            "app_name": app_name,
            "app_username": target_username,
            "is_active_in_app": mapping.is_active_in_app,
            "connector_message": connector_msg
        }
    )


@router.delete("/accounts/{mapping_id}/exception", response_model=AccountActionResponse)
def revoke_account_exception(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Revoke an approved exception for an account mapping.
    """
    mapping = db.query(AppAccountMapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีที่ระบุ")

    mapping.is_approved_exception = False
    mapping.exception_type = None
    mapping.exception_reason = None
    mapping.exception_approved_by = None
    mapping.exception_approved_at = None
    mapping.exception_expires_at = None
    mapping.last_sync_status = "DISCREPANCY" if not (mapping.identity and mapping.identity.is_active_in_ad) else "IN_SYNC"

    if mapping.identity:
        mapping.identity.is_approved_exception = False
        mapping.identity.exception_type = None
        mapping.identity.exception_reason = None
        mapping.identity.exception_approved_by = None
        mapping.identity.exception_approved_at = None

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="REVOKE_EXCEPTION",
        target_username=mapping.app_username,
        affected_app_code=mapping.application.app_code if mapping.application else "SPOKE",
        execution_mode="PORTAL_ADMIN",
        reason=f"ยกเลิกข้อยกเว้นสำหรับบัญชี '{mapping.app_username}'",
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"ยกเลิกข้อยกเว้นสำหรับบัญชี {mapping.app_username} เรียบร้อยแล้ว"
    )


@router.post("/users/{identity_id}/exception", response_model=AccountActionResponse)
def approve_user_exception(
    identity_id: int,
    payload: AccountExceptionRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Approve an exception for an entire identity and all its connected child accounts.
    """
    identity = db.query(MasterIdentity).filter_by(id=identity_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนที่ระบุ")

    now = datetime.now(timezone.utc)
    identity.is_approved_exception = True
    identity.exception_type = payload.exception_type.upper().strip()
    identity.exception_reason = payload.reason.strip()
    identity.exception_approved_by = current_admin.username
    identity.exception_approved_at = now

    for m in identity.accounts:
        m.is_approved_exception = True
        m.exception_type = payload.exception_type.upper().strip()
        m.exception_reason = payload.reason.strip()
        m.exception_approved_by = current_admin.username
        m.exception_approved_at = now
        m.last_sync_status = "APPROVED_EXCEPTION"

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="APPROVE_EXCEPTION",
        target_username=identity.username,
        affected_app_code="ALL_SPOKES",
        execution_mode="PORTAL_ADMIN",
        reason=f"อนุมัติข้อยกเว้นตัวตน '{identity.username}' ({payload.exception_type}): {payload.reason}",
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"อนุมัติข้อยกเว้นสำหรับ {identity.full_name} ({identity.username}) เรียบร้อยแล้ว"
    )


@router.delete("/users/{identity_id}/exception", response_model=AccountActionResponse)
def revoke_user_exception(
    identity_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Revoke approved exception for an identity and all its accounts.
    """
    identity = db.query(MasterIdentity).filter_by(id=identity_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนที่ระบุ")

    identity.is_approved_exception = False
    identity.exception_type = None
    identity.exception_reason = None
    identity.exception_approved_by = None
    identity.exception_approved_at = None

    for m in identity.accounts:
        m.is_approved_exception = False
        m.exception_type = None
        m.exception_reason = None
        m.exception_approved_by = None
        m.exception_approved_at = None
        m.last_sync_status = "DISCREPANCY" if not identity.is_active_in_ad else "IN_SYNC"

    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="REVOKE_EXCEPTION",
        target_username=identity.username,
        affected_app_code="ALL_SPOKES",
        execution_mode="PORTAL_ADMIN",
        reason=f"ยกเลิกข้อยกเว้นสำหรับตัวตน '{identity.username}'",
        status="SUCCESS"
    ))

    db.commit()

    return AccountActionResponse(
        status="SUCCESS",
        message=f"ยกเลิกข้อยกเว้นสำหรับ {identity.username} เรียบร้อยแล้ว"
    )


@router.post("/users/{identity_id}/local-account", response_model=LocalPortalAccountResponse)
def create_or_update_local_portal_account(
    identity_id: int,
    payload: LocalPortalAccountRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Provision or update a Local Portal Account for a non-AD user (e.g. Outsource/Spoke-local user).
    - Sets or updates password in central_iam_admins with role 'PORTAL_USER'.
    - Approves identity & associated spoke mappings as LOCAL_ACCOUNT exception (suppresses ghost warnings).
    - Allows the user to log in to Central IAM App Portal directly.
    """
    import secrets
    from sqlalchemy import func
    from app.core.security import hash_password, validate_password_complexity, generate_compliant_password

    identity = db.query(MasterIdentity).filter_by(id=identity_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="ไม่พบตัวตนที่ระบุ")

    now = datetime.now(timezone.utc)
    raw_password = (payload.password or "").strip()
    if raw_password:
        pwd_err = validate_password_complexity(raw_password)
        if pwd_err:
            raise HTTPException(status_code=400, detail=pwd_err)
    else:
        # Generate 10-char password strictly conforming to Enterprise Complexity Policy
        raw_password = generate_compliant_password()

    hashed_pwd = hash_password(raw_password)

    # 1. Create or update AdminUser with PORTAL_USER role
    admin_user = db.query(AdminUser).filter(
        func.lower(AdminUser.username) == identity.username.lower().strip()
    ).first()

    email_val = identity.email or f"{identity.username.lower()}@ciam.local"
    full_name_val = identity.full_name or identity.username
    must_change = bool(payload.must_change_password)

    if not admin_user:
        admin_user = AdminUser(
            username=identity.username,
            full_name=full_name_val,
            email=email_val,
            hashed_password=hashed_pwd,
            role="PORTAL_USER",
            is_active=True,
            failed_login_attempts=0,
            must_change_password=must_change
        )
        db.add(admin_user)
    else:
        admin_user.hashed_password = hashed_pwd
        admin_user.is_active = True
        admin_user.failed_login_attempts = 0
        admin_user.locked_until = None
        admin_user.must_change_password = must_change
        if admin_user.role not in ["SUPER_ADMIN", "ADMIN"]:
            admin_user.role = "PORTAL_USER"

    # 2. Mark MasterIdentity as approved LOCAL_ACCOUNT exception
    exception_reason = (payload.notes or "").strip() or "บัญชีผู้ใช้เฉพาะระบบ (Non-AD Local Portal Account)"
    identity.is_approved_exception = True
    identity.exception_type = "LOCAL_ACCOUNT"
    identity.exception_reason = exception_reason
    identity.exception_approved_by = current_admin.username
    identity.exception_approved_at = now

    # 3. Mark all spoke account mappings as approved exceptions
    for m in identity.accounts:
        m.is_approved_exception = True
        m.exception_type = "LOCAL_ACCOUNT"
        m.exception_reason = exception_reason
        m.exception_approved_by = current_admin.username
        m.exception_approved_at = now
        m.last_sync_status = "APPROVED_EXCEPTION"

    # 4. Audit Log
    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="CREATE_LOCAL_PORTAL_ACCOUNT",
        target_username=identity.username,
        affected_app_code="PORTAL",
        execution_mode="PORTAL_ADMIN",
        reason=f"สร้าง/รีเซ็ตรหัสผ่าน Local Portal Account สำหรับ {identity.username} (Role: {admin_user.role})",
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(admin_user)
    db.refresh(identity)

    return LocalPortalAccountResponse(
        status="SUCCESS",
        message=f"เปิดใช้งานบัญชี Local Portal สำหรับ '{identity.username}' สำเร็จ พร้อมใช้งานใน App Portal ได้ทันที",
        username=identity.username,
        full_name=identity.full_name,
        temporary_password=raw_password,
        role=admin_user.role,
        is_approved_exception=True,
        must_change_password=bool(admin_user.must_change_password)
    )


@router.post("/users/{user_id}/test-telegram")
async def test_user_telegram_dm(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Send a test direct message (DM) to the user's Telegram ID via Central-IAM Bot."""
    from datetime import timedelta
    from app.core.config import settings
    from app.services.telegram_service import get_health_monitor_config, send_telegram_message

    identity = db.query(MasterIdentity).filter(MasterIdentity.id == user_id).first()
    if not identity:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้นี้ในระบบ")

    telegram_id = (identity.telegram_id or "").strip()
    if not telegram_id:
        raise HTTPException(
            status_code=400,
            detail=f"ผู้ใช้ '{identity.full_name}' ({identity.username}) ยังไม่มีหมายเลข Telegram ID ในระบบ (กรุณาระบุ Telegram ID บน Active Directory ที่ฟิลด์ Pager)"
        )

    health_cfg = get_health_monitor_config(db)
    bot_token = health_cfg.get("bot_token") or getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    if not bot_token:
        raise HTTPException(
            status_code=400,
            detail="ยังไม่ได้ตั้งค่า Telegram Bot Token ในระบบ (กรุณาไปที่เมนู 'ตั้งค่าระบบ' เพื่อใส่ Bot Token)"
        )

    bangkok_now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime("%Y-%m-%d %H:%M:%S")
    msg_text = (
        f"🔔 <b>[Central-IAM] ทดสอบการส่งข้อความส่วนตัว (DM)</b>\n\n"
        f"เรียนคุณ: <b>{identity.full_name}</b> (<code>{identity.username}</code>)\n"
        f"แผนก: <b>{identity.department or '-'}</b>\n"
        f"หมายเลข Telegram ID: <code>{telegram_id}</code>\n\n"
        f"✅ การเชื่อมต่อระบบแจ้งเตือน Central-IAM กับ Telegram ของคุณสำเร็จเรียบร้อยแล้ว\n"
        f"<i>วันเวลา: {bangkok_now} น.</i>"
    )

    success, err_msg = await send_telegram_message(
        bot_token=bot_token,
        chat_id=telegram_id,
        text=msg_text,
        parse_mode="HTML"
    )

    if not success:
        return {
            "success": False,
            "message": f"ไม่สามารถส่งข้อความได้: {err_msg} (หมายเหตุ: บอท Telegram จะส่ง DM หาผู้ใช้ได้เมื่อผู้ใช้กด /start กับบอทแล้วเท่านั้น)",
            "telegram_id": telegram_id
        }

    # Audit Trail
    db.add(IamAuditLog(
        actor_username=current_admin.username,
        action_type="TEST_TELEGRAM_DM",
        target_username=identity.username,
        execution_mode="TELEGRAM_API",
        reason=f"ทดสอบส่งข้อความ DM ไปยัง Telegram ID: {telegram_id}",
        status="SUCCESS",
        details=json.dumps({"telegram_id": telegram_id, "recipient": identity.full_name})
    ))
    db.commit()

    return {
        "success": True,
        "message": f"ส่งข้อความทดสอบไปยัง Telegram ID: {telegram_id} สำเร็จเรียบร้อยแล้ว",
        "telegram_id": telegram_id
    }


@router.post("/sync-ad")
async def sync_active_directory_users(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """
    Directly query Active Directory via AD Sync Agent to update each user's
    department (OU), active status, and attributes in real time.
    """
    from app.connectors.ad_proxy import AdProxyConnector
    from app.services.scheduler import persist_spoke_inventory
    
    ad_app = db.query(ConnectedApplication).filter(func.lower(ConnectedApplication.app_code) == "ad").first()
    if not ad_app:
        raise HTTPException(status_code=404, detail="ระบบ Active Directory (app_code: 'ad') ไม่ได้ลงทะเบียนในระบบ")

    connector = AdProxyConnector(
        base_url=ad_app.base_url,
        api_key=ad_app.api_key,
        secret_key=ad_app.client_secret
    )
    
    try:
        inv = await connector.sync_inventory()
        raw_accounts = inv.get("accounts", [])
        if not raw_accounts:
            return {
                "success": False,
                "message": inv.get("notice") or "ไม่พบข้อมูลบัญชีผู้ใช้จาก AD Agent",
                "accounts_updated": 0
            }

        synced_count = persist_spoke_inventory(ad_app, raw_accounts, db, actor_username=current_admin.username)

        # Auto-heal phonetic / transliteration duplicate pairs into canonical AD identity
        for canon_u, dup_u in [("wachirawoot.b", "wachirawut.b"), ("duanghathai.p", "duanghatai.p")]:
            canonical_ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == canon_u).first()
            dup_ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == dup_u).first()
            if canonical_ident and dup_ident and canonical_ident.id != dup_ident.id:
                dup_mappings = db.query(AppAccountMapping).filter(AppAccountMapping.identity_id == dup_ident.id).all()
                for dm in dup_mappings:
                    existing_cm = db.query(AppAccountMapping).filter(
                        AppAccountMapping.identity_id == canonical_ident.id,
                        AppAccountMapping.application_id == dm.application_id
                    ).first()
                    if not existing_cm:
                        dm.identity_id = canonical_ident.id
                        dm.last_sync_status = "IN_SYNC" if canonical_ident.is_active_in_ad else "DISCREPANCY"
                    else:
                        db.delete(dm)
                db.flush()
                db.delete(dup_ident)
                db.flush()

        db.add(IamAuditLog(
            actor_username=current_admin.username,
            action_type="SYNC_AD_DIRECT",
            target_username="ACTIVE_DIRECTORY_ALL",
            affected_app_code="AD",
            execution_mode="MANUAL_TRIGGER",
            reason=f"สั่งซิงก์ข้อมูลสดจาก Active Directory โดยตรง ({synced_count} บัญชี)",
            status="SUCCESS"
        ))
        db.commit()

        return {
            "success": True,
            "message": f"ซิงก์ข้อมูลจาก Active Directory สำเร็จและอัปเดตข้อมูลผู้ใช้ {synced_count} บัญชีเรียบร้อยแล้ว",
            "accounts_updated": synced_count,
            "notice": inv.get("notice")
        }
    except Exception as exc:
        logger.error("Direct AD Sync error: %s", exc)
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาดในการเชื่อมต่อกับ AD Agent: {str(exc)}",
            "accounts_updated": 0
        }




