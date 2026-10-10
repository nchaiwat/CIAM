from datetime import datetime, timezone
import secrets
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.application import ConnectedApplication, SpokePendingCommand
from app.models.mapping import AppAccountMapping
from app.models.identity import MasterIdentity
from app.models.audit import IamAuditLog

logger = logging.getLogger("ciam.agent")
router = APIRouter(prefix="/agent", tags=["On-Premise Spoke Agent"])

class CommandResultItem(BaseModel):
    command_id: str
    action: str
    username: str
    status: str  # 'COMPLETED', 'FAILED'
    message: Optional[str] = None

class HeartbeatAccountItem(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    use_ad_auth: Optional[bool] = True
    is_active: Optional[bool] = True

class AgentHeartbeatRequest(BaseModel):
    app_code: str
    status: Optional[str] = "HEALTHY"
    app_version: Optional[str] = None
    sync_type: Optional[str] = "HEARTBEAT"  # 'HEARTBEAT', 'FULL_SYNC'
    command_results: Optional[List[CommandResultItem]] = None
    accounts: Optional[List[HeartbeatAccountItem]] = None

class AssignedAccountItem(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = "Viewer"
    is_active: bool = True

class PendingCommandItem(BaseModel):
    command_id: str
    action: str  # 'DISABLE_USER', 'ENABLE_USER', 'PROVISION_USER', 'REQUEST_FULL_SYNC'
    username: str
    reason: Optional[str] = None
    issued_at: str

class AgentHeartbeatResponse(BaseModel):
    status: str
    app_code: str
    server_time: str
    next_heartbeat_seconds: int = 120
    pending_commands: List[PendingCommandItem] = []
    assigned_accounts: Optional[List[AssignedAccountItem]] = None
    message: Optional[str] = None

@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
def handle_agent_heartbeat(
    payload: AgentHeartbeatRequest,
    x_spoke_client_id: Optional[str] = Header(None, alias="X-Spoke-Client-ID"),
    x_spoke_api_key: Optional[str] = Header(None, alias="X-Spoke-API-Key"),
    db: Session = Depends(get_db)
):
    """
    Mode C: Outbound Agent Heartbeat & Command Queue Endpoint.
    
    Target on-premise applications periodically send an outbound HTTPS POST here to:
    1. Check in (heartbeat) to maintain 'ONLINE' status without requiring inbound ports.
    2. Synchronize their account directory (when sync_type == 'FULL_SYNC').
    3. Return execution results of previously received commands.
    4. Fetch any pending management commands (e.g., DISABLE_USER from 1-Click Offboarding).
    """
    candidate_code = payload.app_code.strip().lower()
    
    # 1. Authenticate spoke application
    app = None
    if x_spoke_client_id:
        app = db.query(ConnectedApplication).filter(
            (ConnectedApplication.client_id == x_spoke_client_id) |
            (ConnectedApplication.app_code == candidate_code)
        ).first()
    else:
        app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == candidate_code).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spoke application with code '{payload.app_code}' is not registered in Central IAM."
        )

    # Verify M2M credentials if provided on registered app
    expected_api_key = app.api_key or app.client_secret
    if expected_api_key and x_spoke_api_key:
        if x_spoke_api_key.strip() != expected_api_key.strip():
            logger.warning("Spoke agent %s auth failed: invalid API key", candidate_code)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid X-Spoke-API-Key for this application."
            )

    now = datetime.now(timezone.utc)

    # 2. Update Heartbeat & Health Status
    app.health_status = "ONLINE"
    app.latency_ms = 1
    app.last_health_check_at = now
    app.spoke_sso_status = "ACTIVE"

    # 3. Process execution results of previous commands
    if payload.command_results:
        for res in payload.command_results:
            cmd = db.query(SpokePendingCommand).filter(
                SpokePendingCommand.command_id == res.command_id
            ).first()
            if cmd:
                cmd.status = res.status.upper()
                cmd.executed_at = now
                cmd.result_message = res.message
                db.add(IamAuditLog(
                    actor_username=f"AGENT:{app.app_code.upper()}",
                    action_type=f"AGENT_CMD_{cmd.action}",
                    target_username=cmd.username,
                    affected_app_code=app.app_code,
                    execution_mode="OUTBOUND_AGENT",
                    reason=f"Executed command {cmd.command_id}: {res.message or res.status}",
                    status="SUCCESS" if res.status.upper() == "COMPLETED" else "FAILED"
                ))
        db.flush()

    # 4. Process Directory Push (Full Sync)
    if payload.accounts is not None and len(payload.accounts) > 0:
        synced_count = 0
        for acc in payload.accounts:
            username_clean = acc.username.strip()
            # Match master identity or create local spoke identity
            ident = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(username_clean)).first()
            is_corp_email = bool(acc.email and "@windowasia.com" in acc.email.lower())
            is_ad_format = len(username_clean.split(".")) == 2 and len(username_clean.split(".")[1]) <= 2
            dept_val = (acc.department or "").strip().lower()
            corporate_depts = ("sale", "sales", "purchasing", "pu", "it", "accounting", "hr", "qa", "warehouse", "m365", "office", "admin", "management", "general")
            is_corp_dept = any(cd in dept_val for cd in corporate_depts) if dept_val else False
            is_corp = is_corp_email or is_ad_format or is_corp_dept

            if not ident:
                ident = MasterIdentity(
                    username=username_clean,
                    full_name=acc.full_name or username_clean,
                    email=acc.email or (f"{username_clean.lower()}@windowasia.com" if is_corp else None),
                    department=acc.department or ("Corporate" if is_corp else "ทั่วไป"),
                    is_active_in_ad=True if is_corp else False,
                    created_at=now
                )
                db.add(ident)
                db.flush()
            elif is_corp and not ident.is_active_in_ad and username_clean.lower() != "pinyada.s":
                # Ensure legitimate corporate employee pushed from agent is active in AD
                ident.is_active_in_ad = True

            # Find existing mapping by (application_id, identity_id) OR case-insensitive username
            mapping = db.query(AppAccountMapping).filter(
                AppAccountMapping.application_id == app.id,
                (AppAccountMapping.identity_id == ident.id) |
                (func.lower(AppAccountMapping.app_username) == username_clean.lower())
            ).first()

            if not mapping:
                mapping = AppAccountMapping(
                    identity_id=ident.id,
                    application_id=app.id,
                    app_username=username_clean,
                    app_group_name=acc.role or "User",
                    is_active_in_app=acc.is_active if acc.is_active is not None else True,
                    last_sync_status="IN_SYNC"
                )
                db.add(mapping)
                db.flush()
            else:
                mapping.identity_id = ident.id
                mapping.app_username = username_clean
                mapping.app_group_name = acc.role or mapping.app_group_name
                mapping.is_active_in_app = acc.is_active if acc.is_active is not None else mapping.is_active_in_app
                mapping.last_sync_status = "IN_SYNC"

            # Prune any redundant duplicate mappings for this identity and application
            redundant_mappings = db.query(AppAccountMapping).filter(
                AppAccountMapping.application_id == app.id,
                AppAccountMapping.identity_id == ident.id,
                AppAccountMapping.id != mapping.id
            ).all()
            for r in redundant_mappings:
                db.delete(r)

            synced_count += 1

        app.total_linked_accounts = db.query(AppAccountMapping).filter(
            AppAccountMapping.application_id == app.id
        ).count()
        app.last_sync_at = now
        logger.info("Spoke agent %s pushed directory sync: %d accounts", app.app_code, synced_count)

    # 5. Two-Way Directory Reconciliation (Mode C Two-Way Sync)
    assigned_accounts_list: Optional[List[AssignedAccountItem]] = None
    outgoing_cmds: List[PendingCommandItem] = []
    dispatched_cmd_keys = set()

    if payload.accounts is not None:
        assigned_accounts_list = []
        # Query all active mapped accounts on CIAM for this app
        ciam_mappings = (
            db.query(AppAccountMapping, MasterIdentity)
            .join(MasterIdentity, AppAccountMapping.identity_id == MasterIdentity.id)
            .filter(
                AppAccountMapping.application_id == app.id,
                AppAccountMapping.is_active_in_app == True,
                MasterIdentity.is_active_in_ad == True
            )
            .all()
        )

        spoke_map = {acc.username.strip().lower(): acc for acc in payload.accounts}

        for mapping, ident in ciam_mappings:
            assigned_accounts_list.append(AssignedAccountItem(
                username=ident.username,
                full_name=ident.full_name or ident.username,
                email=ident.email,
                department=ident.department,
                role=mapping.app_group_name or "Viewer",
                is_active=True
            ))

            # If CIAM has assigned an account that Spoke does not have, issue PROVISION_USER
            if ident.username.lower() not in spoke_map:
                cmd_id = f"cmd_prov_{secrets.token_hex(4)}"
                outgoing_cmds.append(PendingCommandItem(
                    command_id=cmd_id,
                    action="PROVISION_USER",
                    username=ident.username,
                    reason=f"Auto-Reconciliation: Account assigned on Central IAM for {app.app_name}",
                    issued_at=now.isoformat()
                ))
                dispatched_cmd_keys.add(("PROVISION_USER", ident.username.lower()))
                db.add(SpokePendingCommand(
                    command_id=cmd_id,
                    app_code=app.app_code,
                    action="PROVISION_USER",
                    username=ident.username,
                    reason="Auto-Reconciliation: Account assigned on Central IAM",
                    status="SENT",
                    created_at=now
                ))

    # 6. Retrieve Pending Commands from DB queue
    pending_db_cmds = db.query(SpokePendingCommand).filter(
        SpokePendingCommand.app_code == app.app_code,
        SpokePendingCommand.status == "PENDING"
    ).order_by(SpokePendingCommand.created_at.asc()).limit(10).all()

    for cmd in pending_db_cmds:
        if (cmd.action, cmd.username.lower()) not in dispatched_cmd_keys:
            outgoing_cmds.append(PendingCommandItem(
                command_id=cmd.command_id,
                action=cmd.action,
                username=cmd.username,
                reason=cmd.reason,
                issued_at=cmd.created_at.isoformat()
            ))
            cmd.status = "SENT"

    db.commit()

    return AgentHeartbeatResponse(
        status="ACKNOWLEDGED",
        app_code=app.app_code,
        server_time=now.isoformat(),
        next_heartbeat_seconds=120,
        pending_commands=outgoing_cmds,
        assigned_accounts=assigned_accounts_list,
        message=f"Heartbeat received for {app.app_name}. {len(outgoing_cmds)} pending command(s) dispatched."
    )
