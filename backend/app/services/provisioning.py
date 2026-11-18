import json
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication, SpokePendingCommand
from app.models.audit import IamAuditLog
from app.models.user import AdminUser
from app.connectors.base import ConnectorResult
from app.connectors.factory import get_connector_for_app
from app.core.security import hash_password, validate_password_complexity, generate_compliant_password
from app.schemas.directory import (
    UserCreateRequest,
    UserCreateResponse,
    SpokeProvisionResult
)

logger = logging.getLogger("ciam.provisioning")

async def execute_user_creation(
    db: Session,
    request: UserCreateRequest,
    actor_username: str,
    ip_address: str = "127.0.0.1"
) -> UserCreateResponse:
    """
    Orchestrate enterprise user provisioning (Strict One-Way AD):
    1. CIAM never creates accounts in Active Directory; existing AD identities are reused
       for Spoke provisioning, while non-AD users are created as LOCAL_ACCOUNT identities.
    2. For new Local Accounts, validate or generate a compliant password and create a
       PORTAL_USER AdminUser so the user can authenticate immediately.
    3. Provision in each selected Spoke Application (REST API, Mode C Queue, etc.).
    4. Create/update AppAccountMapping records and persist Audit Trail.
    """
    now = datetime.now(timezone.utc)
    clean_username = request.username.strip()
    existing_user = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == clean_username.lower()).first()

    temporary_password: Optional[str] = None
    must_change_pwd: Optional[bool] = None

    if existing_user:
        if request.target_spokes and (existing_user.is_active_in_ad or request.create_in_ad):
            identity = existing_user
            ad_status = "ACTIVE" if identity.is_active_in_ad else "LOCAL_ACCOUNT"
        else:
            raise ValueError(f"มีบัญชีผู้ใช้ '{clean_username}' อยู่ในระบบแล้ว")
    else:
        if not request.create_in_ad:
            raw_password = (request.password or "").strip()
            if raw_password:
                pwd_err = validate_password_complexity(raw_password, username=clean_username)
                if pwd_err:
                    raise ValueError(pwd_err)
            else:
                raw_password = generate_compliant_password()

            temporary_password = raw_password
            must_change_pwd = bool(request.must_change_password)
            hashed_pwd = hash_password(raw_password)
            exc_reason = f"บัญชี Local Account สร้างผ่าน Central IAM โดย {actor_username}"

            admin_user = db.query(AdminUser).filter(func.lower(AdminUser.username) == clean_username.lower()).first()
            email_val = (request.email or "").strip() or f"{clean_username.lower()}@ciam.local"
            if not admin_user:
                admin_user = AdminUser(
                    username=clean_username,
                    full_name=request.full_name.strip(),
                    email=email_val,
                    hashed_password=hashed_pwd,
                    role="PORTAL_USER",
                    is_active=True,
                    failed_login_attempts=0,
                    must_change_password=must_change_pwd,
                    password_changed_at=now,
                )
                db.add(admin_user)
            else:
                admin_user.hashed_password = hashed_pwd
                admin_user.is_active = True
                admin_user.failed_login_attempts = 0
                admin_user.locked_until = None
                admin_user.must_change_password = must_change_pwd
                admin_user.password_changed_at = now
                if admin_user.role not in ["SUPER_ADMIN", "ADMIN"]:
                    admin_user.role = "PORTAL_USER"

            identity = MasterIdentity(
                employee_id=request.employee_id.strip() if request.employee_id else None,
                username=clean_username,
                full_name=request.full_name.strip(),
                email=request.email.strip() if request.email else None,
                department=request.department.strip() if request.department else None,
                telephone=request.telephone.strip() if request.telephone else None,
                telegram_id=request.telegram_id.strip() if request.telegram_id else None,
                is_active_in_ad=False,
                is_approved_exception=True,
                exception_type="LOCAL_ACCOUNT",
                exception_reason=exc_reason,
                exception_approved_by=actor_username,
                exception_approved_at=now,
                created_at=now,
            )
            db.add(identity)
            db.flush()
            ad_status = "LOCAL_ACCOUNT"

            db.add(IamAuditLog(
                actor_username=actor_username,
                action_type="CREATE_LOCAL_PORTAL_ACCOUNT",
                target_username=clean_username,
                affected_app_code="PORTAL",
                previous_status="NONE",
                new_status="LOCAL_ACCOUNT",
                execution_mode="PORTAL_ADMIN",
                reason=f"สร้างบัญชี Local Account '{clean_username}' พร้อมรหัสผ่านเริ่มต้นผ่าน Central IAM",
                ip_address=ip_address,
                status="SUCCESS",
            ))
        else:
            # Compatibility path when create_in_ad=True is supplied (no AD Proxy write)
            identity = MasterIdentity(
                employee_id=request.employee_id.strip() if request.employee_id else None,
                username=clean_username,
                full_name=request.full_name.strip(),
                email=request.email.strip() if request.email else None,
                department=request.department.strip() if request.department else None,
                telephone=request.telephone.strip() if request.telephone else None,
                telegram_id=request.telegram_id.strip() if request.telegram_id else None,
                is_active_in_ad=True,
                created_at=now,
            )
            db.add(identity)
            db.flush()
            ad_status = "ACTIVE"

    spoke_results: List[SpokeProvisionResult] = []
    overall_success = True

    # Provision into Selected Spoke Applications
    for target in request.target_spokes:
        app = db.query(ConnectedApplication).filter(ConnectedApplication.id == target.application_id).first()
        if not app:
            continue

        app_username = (target.custom_username or identity.username or clean_username).strip()
        group_name = (target.group_name or "Standard User").strip()
        use_ad_auth = bool(identity.is_active_in_ad)

        account_payload = {
            "username": app_username,
            "full_name": identity.full_name or request.full_name,
            "email": identity.email or request.email,
            "department": identity.department or request.department,
            "group_name": group_name,
            "use_ad_auth": use_ad_auth,
            "created_by": actor_username
        }
        if temporary_password:
            account_payload["password"] = temporary_password
            account_payload["must_change_password"] = bool(must_change_pwd)

        try:
            if app.connector_type == "SSO_ONLY":
                existing_cmd = (
                    db.query(SpokePendingCommand)
                    .filter(
                        SpokePendingCommand.app_code == app.app_code,
                        SpokePendingCommand.action == "PROVISION_USER",
                        func.lower(SpokePendingCommand.username) == app_username.lower(),
                        SpokePendingCommand.status.in_(["PENDING", "SENT"])
                    )
                    .first()
                )
                if not existing_cmd:
                    db.add(SpokePendingCommand(
                        command_id=f"cmd_prov_{secrets.token_hex(4)}",
                        app_code=app.app_code,
                        action="PROVISION_USER",
                        username=app_username,
                        reason=f"Provision assigned role '{group_name}' by {actor_username}",
                        status="PENDING",
                        issued_by=actor_username,
                        created_at=now,
                    ))
                conn_res = ConnectorResult(
                    success=True,
                    status_code=202,
                    execution_mode="OUTBOUND_AGENT",
                    message=f"ส่งคิวคำสั่ง PROVISION_USER สำหรับ '{app_username}' แล้ว (รอรอบ Heartbeat ของ {app.app_name})",
                    execution_time_ms=1,
                    details={"queued": True}
                )
                sync_status = "PENDING_PROVISION"
            else:
                connector = get_connector_for_app(app)
                conn_res = await connector.provision_account(account_payload)
                if not conn_res.success:
                    overall_success = False
                sync_status = "IN_SYNC" if conn_res.success else "PENDING_PROVISION"

            # Create or update mapping
            existing_mapping = (
                db.query(AppAccountMapping)
                .filter(
                    AppAccountMapping.application_id == app.id,
                    or_(
                        func.lower(AppAccountMapping.app_username) == app_username.lower(),
                        AppAccountMapping.identity_id == identity.id
                    )
                )
                .first()
            )

            is_local_exc = (identity.exception_type == "LOCAL_ACCOUNT")
            if not existing_mapping:
                mapping = AppAccountMapping(
                    identity_id=identity.id,
                    application_id=app.id,
                    app_username=app_username,
                    app_group_name=group_name,
                    is_active_in_app=True,
                    status_origin="CIAM_ADMIN",
                    status_updated_at=now,
                    status_reason=f"มอบสิทธิ์ระบบ {app.app_name} โดย {actor_username}",
                    last_sync_status=sync_status,
                    is_approved_exception=is_local_exc,
                    exception_type="LOCAL_ACCOUNT" if is_local_exc else None,
                    exception_reason=identity.exception_reason if is_local_exc else None,
                    exception_approved_by=actor_username if is_local_exc else None,
                    exception_approved_at=now if is_local_exc else None,
                    created_at=now,
                    updated_at=now,
                )
                db.add(mapping)
            else:
                existing_mapping.identity_id = identity.id
                existing_mapping.app_username = app_username
                existing_mapping.app_group_name = group_name
                existing_mapping.is_active_in_app = True
                existing_mapping.status_origin = "CIAM_ADMIN"
                existing_mapping.status_updated_at = now
                existing_mapping.status_reason = f"มอบสิทธิ์ระบบ {app.app_name} โดย {actor_username}"
                existing_mapping.last_sync_status = sync_status
                existing_mapping.updated_at = now
                if is_local_exc:
                    existing_mapping.is_approved_exception = True
                    existing_mapping.exception_type = "LOCAL_ACCOUNT"
                    existing_mapping.exception_reason = identity.exception_reason
                    existing_mapping.exception_approved_by = actor_username
                    existing_mapping.exception_approved_at = now

            spoke_results.append(SpokeProvisionResult(
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=conn_res.execution_mode,
                success=conn_res.success,
                status_code=conn_res.status_code,
                message=conn_res.message,
                execution_time_ms=conn_res.execution_time_ms
            ))

            db.add(IamAuditLog(
                actor_username=actor_username,
                action_type="PROVISION_USER",
                target_username=clean_username,
                affected_app_code=app.app_code,
                previous_status="NONE",
                new_status="ACTIVE" if conn_res.success else "PENDING_PROVISION",
                execution_mode=conn_res.execution_mode,
                reason=f"Assigned role '{group_name}' in {app.app_name}",
                ip_address=ip_address,
                status="SUCCESS" if conn_res.success else "WARNING",
                details=json.dumps({
                    "app_username": app_username,
                    "connector_result": conn_res.model_dump()
                })
            ))

        except Exception as exc:
            overall_success = False
            logger.error("Error provisioning in app %s: %s", app.app_code, exc)
            spoke_results.append(SpokeProvisionResult(
                application_id=app.id,
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=app.connector_type,
                success=False,
                status_code=500,
                message=f"Connector failure: {str(exc)}",
                execution_time_ms=100
            ))

    db.commit()
    db.refresh(identity)

    return UserCreateResponse(
        identity_id=identity.id,
        employee_id=identity.employee_id,
        username=identity.username,
        full_name=identity.full_name,
        department=identity.department,
        ad_status=ad_status,
        overall_status="SUCCESS" if overall_success else "PARTIAL",
        temporary_password=temporary_password,
        must_change_password=must_change_pwd,
        spoke_results=spoke_results
    )
