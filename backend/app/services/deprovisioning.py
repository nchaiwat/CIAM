import uuid
import json
import logging
from datetime import datetime, timezone
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.models.audit import IamAuditLog
from app.connectors.factory import get_connector_for_app
from app.connectors.ad_proxy import AdProxyConnector
from app.schemas.offboarding import (
    OffboardExecuteRequest,
    OffboardExecuteResponse,
    AppExecutionResult
)
from app.schemas.directory import AppActivationResult, UserActivateResponse

logger = logging.getLogger("ciam.deprovisioning")

async def execute_one_click_offboard(
    db: Session,
    request: OffboardExecuteRequest,
    actor_username: str,
    ip_address: str = "127.0.0.1"
) -> OffboardExecuteResponse:
    """
    Executes Instant One-Click Offboarding across:
    1. Active Directory (Master Identity via AD Proxy)
    2. All linked Child Systems (REST API & RPA Worker Connectors)
    3. Persists audit records and returns compliance certificate checklist
    """
    query_str = (request.username or "").strip()
    identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(query_str)).first()
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
        raise ValueError(f"Master Identity with username '{request.username}' not found.")

    cert_id = f"CERT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    execution_time = datetime.now(timezone.utc)
    checklist: List[AppExecutionResult] = []
    overall_success = True

    # Step 1: Disable in Active Directory via AD Proxy
    ad_prev_status = "ACTIVE" if identity.is_active_in_ad else "DISABLED"
    identity.is_active_in_ad = False
    db.commit()

    ad_connector = AdProxyConnector()
    ad_conn_res = await ad_connector.deprovision(identity.username, request.reason)

    ad_result = AppExecutionResult(
        app_code="ad",
        app_name="Active Directory (via AD Proxy)",
        connector_type="AD_PROXY",
        execution_mode=ad_conn_res.execution_mode,
        status="SUCCESS" if ad_conn_res.success else "FAILED",
        message=ad_conn_res.message,
        http_code=ad_conn_res.status_code or 200,
        execution_time_ms=ad_conn_res.execution_time_ms
    )
    checklist.append(ad_result)
    if not ad_conn_res.success:
        overall_success = False

    # Log AD offboard in Audit Log
    db.add(IamAuditLog(
        actor_username=actor_username,
        action_type="OFFBOARD_USER",
        target_username=identity.username,
        affected_app_code="ad",
        previous_status=ad_prev_status,
        new_status="DISABLED",
        execution_mode=ad_conn_res.execution_mode,
        reason=request.reason,
        ip_address=ip_address,
        status="SUCCESS" if ad_conn_res.success else "FAILED",
        details=json.dumps({"certificate_id": cert_id, "notes": request.notes, "ad_details": ad_conn_res.details})
    ))


    # Step 2: Query all linked child accounts
    mappings = (
        db.query(AppAccountMapping, ConnectedApplication)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.identity_id == identity.id)
        .all()
    )

    for mapping, app in mappings:
        connector = get_connector_for_app(app)
        prev_app_status = "ACTIVE" if mapping.is_active_in_app else "DISABLED"

        try:
            conn_res = await connector.deprovision(
                username=mapping.app_username,
                reason=f"Central IAM Offboarding ({request.reason})"
            )

            if conn_res.success:
                mapping.is_active_in_app = False
                mapping.last_sync_status = "IN_SYNC"
                status_str = "SUCCESS"
            else:
                overall_success = False
                status_str = "FAILED"

            checklist.append(AppExecutionResult(
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=conn_res.execution_mode,
                status=status_str,
                message=conn_res.message,
                http_code=conn_res.status_code,
                execution_time_ms=conn_res.execution_time_ms
            ))

            # Audit log per child app
            db.add(IamAuditLog(
                actor_username=actor_username,
                action_type="OFFBOARD_USER",
                target_username=identity.username,
                affected_app_code=app.app_code,
                previous_status=prev_app_status,
                new_status="DISABLED" if conn_res.success else prev_app_status,
                execution_mode=conn_res.execution_mode,
                reason=request.reason,
                ip_address=ip_address,
                status=status_str,
                details=json.dumps({
                    "certificate_id": cert_id,
                    "connector_result": conn_res.model_dump(),
                    "app_username": mapping.app_username
                })
            ))

        except Exception as exc:
            overall_success = False
            logger.error("Error deprovisioning in app %s: %s", app.app_code, exc)
            checklist.append(AppExecutionResult(
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=app.connector_type,
                status="FAILED",
                message=f"Connector failure: {str(exc)}",
                execution_time_ms=100
            ))

    db.commit()

    return OffboardExecuteResponse(
        certificate_id=cert_id,
        executed_at=execution_time,
        actor_username=actor_username,
        target_username=identity.username,
        target_full_name=identity.full_name,
        target_employee_id=identity.employee_id,
        target_department=identity.department,
        reason=request.reason,
        effective_date=request.effective_date,
        overall_status="SUCCESS" if overall_success else "PARTIAL",
        checklist=checklist
    )


async def execute_user_activation(
    db: Session,
    identity_id: int,
    reason: str,
    actor_username: str,
    ip_address: str = "127.0.0.1"
) -> UserActivateResponse:
    """
    Re-activate an employee across Active Directory and all linked child systems.
    1. Enables user in AD via AD Proxy
    2. Enables account across all linked Spoke applications
    3. Resets reconciliation status to IN_SYNC
    4. Records immutable audit trail
    """
    identity = db.query(MasterIdentity).filter(MasterIdentity.id == identity_id).first()
    if not identity:
        raise ValueError(f"Master Identity with ID {identity_id} not found.")

    checklist: List[AppActivationResult] = []
    overall_success = True

    # 1. Activate in Active Directory via AD Proxy
    ad_prev_status = "ACTIVE" if identity.is_active_in_ad else "DISABLED"
    identity.is_active_in_ad = True
    db.commit()

    ad_connector = AdProxyConnector()
    ad_conn_res = await ad_connector.activate(identity.username, reason)

    checklist.append(AppActivationResult(
        app_code="ad",
        app_name="Active Directory (via AD Proxy)",
        connector_type="AD_PROXY",
        execution_mode=ad_conn_res.execution_mode,
        status="SUCCESS" if ad_conn_res.success else "FAILED",
        message=ad_conn_res.message,
        http_code=ad_conn_res.status_code or 200,
        execution_time_ms=ad_conn_res.execution_time_ms
    ))

    db.add(IamAuditLog(
        actor_username=actor_username,
        action_type="ENABLE_USER",
        target_username=identity.username,
        affected_app_code="ad",
        previous_status=ad_prev_status,
        new_status="ACTIVE",
        execution_mode=ad_conn_res.execution_mode,
        reason=reason,
        ip_address=ip_address,
        status="SUCCESS" if ad_conn_res.success else "FAILED",
        details=json.dumps({"ad_details": ad_conn_res.details})
    ))

    # 2. Activate across all linked child applications
    mappings = (
        db.query(AppAccountMapping, ConnectedApplication)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.identity_id == identity.id)
        .all()
    )

    for mapping, app in mappings:
        connector = get_connector_for_app(app)
        prev_app_status = "ACTIVE" if mapping.is_active_in_app else "DISABLED"

        try:
            conn_res = await connector.activate(
                username=mapping.app_username,
                reason=f"Central IAM Re-activation ({reason})"
            )

            if conn_res.success:
                mapping.is_active_in_app = True
                mapping.last_sync_status = "IN_SYNC"
                status_str = "SUCCESS"
            else:
                overall_success = False
                status_str = "FAILED"

            checklist.append(AppActivationResult(
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=conn_res.execution_mode,
                status=status_str,
                message=conn_res.message,
                http_code=conn_res.status_code,
                execution_time_ms=conn_res.execution_time_ms
            ))

            db.add(IamAuditLog(
                actor_username=actor_username,
                action_type="ENABLE_USER",
                target_username=identity.username,
                affected_app_code=app.app_code,
                previous_status=prev_app_status,
                new_status="ACTIVE" if conn_res.success else prev_app_status,
                execution_mode=conn_res.execution_mode,
                reason=reason,
                ip_address=ip_address,
                status=status_str,
                details=json.dumps({
                    "app_username": mapping.app_username,
                    "connector_result": conn_res.model_dump()
                })
            ))

        except Exception as exc:
            overall_success = False
            logger.error("Error activating in app %s: %s", app.app_code, exc)
            checklist.append(AppActivationResult(
                app_code=app.app_code,
                app_name=app.app_name,
                connector_type=app.connector_type,
                execution_mode=app.connector_type,
                status="FAILED",
                message=f"Connector failure: {str(exc)}",
                execution_time_ms=100
            ))

    db.commit()

    return UserActivateResponse(
        identity_id=identity.id,
        username=identity.username,
        full_name=identity.full_name,
        ad_status="ACTIVE",
        overall_status="SUCCESS" if overall_success else "PARTIAL",
        checklist=checklist
    )

