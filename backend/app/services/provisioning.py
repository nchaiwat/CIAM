import json
import logging
from typing import List
from sqlalchemy.orm import Session

from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.models.audit import IamAuditLog
from app.connectors.factory import get_connector_for_app
from app.connectors.ad_proxy import AdProxyConnector
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
    Orchestrate enterprise user provisioning:
    1. Create Master Identity in Central IAM
    2. Provision in Active Directory via AD Proxy (if enabled)
    3. Provision in each selected Spoke Application (REST API, SAP B1, etc.)
    4. Create AppAccountMapping records and persist Audit Trail
    """
    clean_username = request.username.strip()
    existing_user = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(clean_username)).first()
    if existing_user:
        raise ValueError(f"Identity with username '{clean_username}' already exists in Central Directory.")

    # 1. Create Master Identity
    identity = MasterIdentity(
        employee_id=request.employee_id.strip() if request.employee_id else None,
        username=clean_username,
        full_name=request.full_name.strip(),
        email=request.email.strip() if request.email else None,
        department=request.department.strip() if request.department else None,
        telephone=request.telephone.strip() if request.telephone else None,
        is_active_in_ad=request.create_in_ad
    )
    db.add(identity)
    db.flush() # Populate identity.id

    spoke_results: List[SpokeProvisionResult] = []
    overall_success = True

    # 2. Provision in Active Directory via AD Proxy
    ad_status = "SKIPPED"
    if request.create_in_ad:
        ad_connector = AdProxyConnector()
        ad_res = await ad_connector.provision_account({
            "username": clean_username,
            "full_name": request.full_name,
            "email": request.email,
            "department": request.department,
            "employee_id": request.employee_id,
            "telephone": request.telephone,
            "created_by": actor_username
        })

        ad_status = "ACTIVE" if ad_res.success else "FAILED"
        if not ad_res.success:
            overall_success = False

        db.add(IamAuditLog(
            actor_username=actor_username,
            action_type="CREATE_USER",
            target_username=clean_username,
            affected_app_code="ad",
            previous_status="NONE",
            new_status=ad_status,
            execution_mode=ad_res.execution_mode,
            reason="New employee onboarding into Active Directory",
            ip_address=ip_address,
            status="SUCCESS" if ad_res.success else "FAILED",
            details=json.dumps({"ad_result": ad_res.model_dump()})
        ))

    # 3. Provision into Selected Spoke Applications
    for target in request.target_spokes:
        app = db.query(ConnectedApplication).filter(ConnectedApplication.id == target.application_id).first()
        if not app:
            continue

        connector = get_connector_for_app(app)
        app_username = (target.custom_username or clean_username).strip()
        group_name = (target.group_name or "Standard User").strip()

        account_payload = {
            "username": app_username,
            "full_name": request.full_name,
            "email": request.email,
            "department": request.department,
            "group_name": group_name,
            "use_ad_auth": request.create_in_ad,
            "created_by": actor_username
        }

        try:
            conn_res = await connector.provision_account(account_payload)
            if not conn_res.success:
                overall_success = False

            # Create or update mapping
            existing_mapping = (
                db.query(AppAccountMapping)
                .filter(
                    AppAccountMapping.application_id == app.id,
                    AppAccountMapping.app_username == app_username
                )
                .first()
            )

            if not existing_mapping:
                mapping = AppAccountMapping(
                    identity_id=identity.id,
                    application_id=app.id,
                    app_username=app_username,
                    app_group_name=group_name,
                    is_active_in_app=True,
                    last_sync_status="IN_SYNC"
                )
                db.add(mapping)
            else:
                existing_mapping.identity_id = identity.id
                existing_mapping.app_group_name = group_name
                existing_mapping.is_active_in_app = True
                existing_mapping.last_sync_status = "IN_SYNC"

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
                new_status="ACTIVE" if conn_res.success else "FAILED",
                execution_mode=conn_res.execution_mode,
                reason=f"Assigned role '{group_name}' in {app.app_name}",
                ip_address=ip_address,
                status="SUCCESS" if conn_res.success else "FAILED",
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
        spoke_results=spoke_results
    )
