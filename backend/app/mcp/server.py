"""
Central IAM - Model Context Protocol (MCP) Server
Enterprise Identity Governance & Spoke Management for AI Agents
Compatible with Model Context Protocol (MCP) v2.x (MCPServer)
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from mcp.server.mcpserver import MCPServer
from sqlalchemy import or_, desc

from app.core.database import SessionLocal
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication, SpokePendingCommand
from app.models.audit import IamAuditLog
from app.services.reconciliation import find_account_discrepancies
from app.services.deprovisioning import execute_one_click_offboard, execute_user_activation
from app.schemas.offboarding import OffboardExecuteRequest

logger = logging.getLogger("ciam.mcp")

# Initialize MCP Server
mcp_server = MCPServer(
    name="central-iam",
    version="1.0.0",
    instructions="""
Window Asia Central IAM MCP Server provides tools to manage enterprise identities,
monitor system health across all connected child applications (spokes), audit security logs,
detect ghost accounts (discrepancies), and execute instant 1-Click Offboarding.
Connected systems include: Active Directory, pfSense Firewalls, SAP B1, M365, IRM, and MTPulse.
"""
)

# ---------------------------------------------------------------------------
# 1. System Health & Infrastructure Tools
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_health_check() -> Dict[str, Any]:
    """
    Check real-time health and connection status of Central IAM and all connected spoke applications.
    Returns status, latency, base URL, and connector type for each system (IRM, MTPulse, SAP B1, pfSense, M365, AD).
    """
    db = SessionLocal()
    try:
        apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
        results = []
        online_count = 0
        total_count = len(apps)

        for app in apps:
            is_online = app.health_status == "ONLINE"
            if is_online:
                online_count += 1

            results.append({
                "app_code": app.app_code,
                "app_name": app.app_name,
                "connector_type": app.connector_type,
                "health_status": app.health_status or "ONLINE",
                "spoke_sso_status": app.spoke_sso_status or "ACTIVE",
                "latency_ms": app.latency_ms,
                "base_url": app.base_url,
                "network_policy": getattr(app, "network_policy", "ANYWHERE"),
                "last_health_check": app.last_health_check_at.isoformat() if app.last_health_check_at else None
            })

        ad_status = "ONLINE" if os.environ.get("AD_GATEWAY_URL") else "CONFIGURED"

        return {
            "status": "HEALTHY" if online_count == total_count else "DEGRADED",
            "active_spokes_count": total_count,
            "online_spokes_count": online_count,
            "ad_gateway_status": ad_status,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "spokes": results
        }
    except Exception as e:
        logger.error("Error in ciam_health_check: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


@mcp_server.tool()
def ciam_get_dashboard_summary() -> Dict[str, Any]:
    """
    Retrieve complete Central IAM Dashboard KPIs, analytical calculations, department breakdown,
    spoke account statistics, approved exceptions count, and sync schedule configuration.
    Strictly Read-Only analytical tool covering all metrics displayed on the CIAM Dashboard (/),
    Directory (/directory), and Connected Apps (/applications).
    """
    from sqlalchemy import func
    from app.models.setting import SystemSetting

    db = SessionLocal()
    try:
        total_identities = db.query(MasterIdentity).count()
        active_ad_identities = db.query(MasterIdentity).filter(MasterIdentity.is_active_in_ad == True).count()
        inactive_ad_identities = total_identities - active_ad_identities

        active_spoke_accounts = (
            db.query(AppAccountMapping)
            .filter(AppAccountMapping.is_active_in_app == True)
            .count()
        )
        deprovisioned_spoke_accounts = (
            db.query(AppAccountMapping)
            .filter(AppAccountMapping.is_active_in_app == False)
            .count()
        )

        apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
        connected_systems_total = len(apps)
        connected_systems_online = sum(1 for a in apps if (a.health_status or "ONLINE") == "ONLINE")

        discrepancies = find_account_discrepancies(db)
        ghost_accounts_count = len(discrepancies)

        approved_exceptions_count = (
            db.query(AppAccountMapping)
            .filter(AppAccountMapping.is_approved_exception == True)
            .count()
        )

        # Department breakdown calculation
        dept_rows = (
            db.query(
                MasterIdentity.department,
                MasterIdentity.is_active_in_ad,
                func.count(MasterIdentity.id),
            )
            .group_by(MasterIdentity.department, MasterIdentity.is_active_in_ad)
            .all()
        )
        dept_stats: Dict[str, Dict[str, int]] = {}
        for dept_name, is_act, cnt in dept_rows:
            d_key = (dept_name or "ไม่ระบุแผนก (Unassigned)").strip()
            if d_key not in dept_stats:
                dept_stats[d_key] = {"total": 0, "active_in_ad": 0, "inactive_in_ad": 0}
            dept_stats[d_key]["total"] += cnt
            if is_act:
                dept_stats[d_key]["active_in_ad"] += cnt
            else:
                dept_stats[d_key]["inactive_in_ad"] += cnt

        department_breakdown = [
            {"department": k, **v}
            for k, v in sorted(dept_stats.items(), key=lambda x: (-x[1]["total"], x[0]))
        ]

        # Per-spoke account summary calculation
        spoke_breakdown = []
        for app in apps:
            total_mapped = db.query(AppAccountMapping).filter(AppAccountMapping.application_id == app.id).count()
            active_mapped = (
                db.query(AppAccountMapping)
                .filter(AppAccountMapping.application_id == app.id, AppAccountMapping.is_active_in_app == True)
                .count()
            )
            spoke_breakdown.append({
                "app_code": app.app_code,
                "app_name": app.app_name,
                "connector_type": app.connector_type,
                "health_status": app.health_status or "ONLINE",
                "spoke_sso_status": getattr(app, "spoke_sso_status", "ACTIVE") or "ACTIVE",
                "network_policy": getattr(app, "network_policy", "ANYWHERE") or "ANYWHERE",
                "total_accounts": total_mapped,
                "active_accounts": active_mapped,
                "inactive_accounts": total_mapped - active_mapped,
            })

        # Sync schedule setting
        sync_setting = db.query(SystemSetting).filter_by(setting_key="auto_sync_schedule").first()
        sync_schedule = sync_setting.setting_value if (sync_setting and sync_setting.setting_value) else {"enabled": True, "cron_time": "04:00"}

        summary_text = (
            f"สรุปภาพรวมระบบ Central IAM (Dashboard KPI): มีตัวตนทั้งหมด {total_identities} รายการ "
            f"(Active ใน AD {active_ad_identities} รายการ, Inactive/Local {inactive_ad_identities} รายการ), "
            f"บัญชีในระบบลูกที่เปิดใช้งาน (Active Accounts) {active_spoke_accounts} บัญชี, "
            f"บัญชีที่ระงับสิทธิ์แล้ว {deprovisioned_spoke_accounts} บัญชี, "
            f"ระบบที่เชื่อมต่อออนไลน์ {connected_systems_online}/{connected_systems_total} ระบบ, "
            f"พบความเสี่ยงบัญชีผี (Ghost Accounts) {ghost_accounts_count} รายการ "
            f"(มีข้อยกเว้นที่อนุมัติแล้ว {approved_exceptions_count} รายการ)"
        )

        return {
            "mode": "READ_ONLY_ANALYTICS",
            "summary": summary_text,
            "kpi": {
                "total_identities": total_identities,
                "active_ad_identities": active_ad_identities,
                "inactive_ad_identities": inactive_ad_identities,
                "active_accounts": active_spoke_accounts,
                "deprovisioned_accounts": deprovisioned_spoke_accounts,
                "connected_systems_online": connected_systems_online,
                "connected_systems_total": connected_systems_total,
                "ghost_accounts_count": ghost_accounts_count,
                "approved_exceptions_count": approved_exceptions_count,
            },
            "spoke_breakdown": spoke_breakdown,
            "department_breakdown": department_breakdown[:25],
            "total_departments": len(department_breakdown),
            "auto_sync_schedule": sync_schedule,
        }
    except Exception as e:
        logger.error("Error in ciam_get_dashboard_summary: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 2. User Directory & Identity Management Tools
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_list_users(
    search: str = "",
    department: str = "",
    is_active: Optional[bool] = None,
    app_code: str = "",
    limit: int = 50
) -> Dict[str, Any]:
    """
    Search and list enterprise users in Central IAM directory.
    Supports filtering by app_code ('mtpulse', 'irm', 'sap_b1', 'pfsense_fac', 'pfsense_ho', 'm365', 'ad').
    Returns identity details (username, full name, department, employee ID, email, AD status)
    along with their assigned spoke applications.
    """
    db = SessionLocal()
    try:
        query = db.query(MasterIdentity)

        if app_code:
            clean_app = app_code.strip().lower()
            query = (
                query.join(AppAccountMapping, AppAccountMapping.identity_id == MasterIdentity.id)
                .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
                .filter(ConnectedApplication.app_code.ilike(f"%{clean_app}%"))
                .distinct()
            )

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
                s_clean = f"%{sv}%"
                mapped_ids_subq = (
                    db.query(AppAccountMapping.identity_id)
                    .filter(AppAccountMapping.app_username.ilike(s_clean))
                )
                or_clauses.extend([
                    MasterIdentity.username.ilike(s_clean),
                    MasterIdentity.full_name.ilike(s_clean),
                    MasterIdentity.employee_id.ilike(s_clean),
                    MasterIdentity.email.ilike(s_clean),
                    MasterIdentity.id.in_(mapped_ids_subq),
                ])
            query = query.filter(or_(*or_clauses))

        if department:
            query = query.filter(MasterIdentity.department.ilike(f"%{department.strip()}%"))

        if is_active is not None:
            query = query.filter(MasterIdentity.is_active_in_ad == is_active)

        total = query.count()
        # If searching with Firstname.L and 0 results, fallback to Firstname prefix
        if search and total == 0 and "." in search.strip():
            prefix_only = search.strip().split(".")[0]
            if len(prefix_only) >= 3:
                p_clean = f"%{prefix_only}%"
                query = db.query(MasterIdentity).filter(
                    or_(
                        MasterIdentity.username.ilike(p_clean),
                        MasterIdentity.full_name.ilike(p_clean),
                        MasterIdentity.email.ilike(p_clean),
                    )
                )
                total = query.count()

        # Prioritize active AD corporate accounts first so shop/branch VPN accounts ('01-WS_...') never push real employees out of the limit window
        identities = (
            query.order_by(
                MasterIdentity.is_active_in_ad.desc(),
                MasterIdentity.username.asc()
            )
            .limit(limit)
            .all()
        )

        user_list = []
        for ident in identities:
            mappings = (
                db.query(AppAccountMapping, ConnectedApplication)
                .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
                .filter(AppAccountMapping.identity_id == ident.id)
                .all()
            )

            spokes = [
                {
                    "app_code": app.app_code,
                    "app_name": app.app_name,
                    "app_username": mapping.app_username,
                    "group_name": mapping.app_group_name,
                    "is_active": mapping.is_active_in_app
                }
                for mapping, app in mappings
            ]

            has_ad_spoke = any((s["app_code"] or "").lower() == "ad" for s in spokes)
            user_list.append({
                "id": ident.id,
                "username": ident.username,
                "full_name": ident.full_name,
                "employee_id": ident.employee_id,
                "department": ident.department,
                "email": ident.email,
                "is_active_in_ad": ident.is_active_in_ad,
                "is_ad_account": bool(ident.is_active_in_ad or has_ad_spoke or ident.ad_guid or ident.employee_id),
                "linked_spokes": spokes
            })

        filter_notes = []
        if app_code:
            filter_notes.append(f"ระบบ '{app_code.upper()}'")
        if department:
            filter_notes.append(f"แผนก '{department}'")
        if search:
            filter_notes.append(f"คำค้น '{search}'")
        if is_active is not None:
            filter_notes.append(f"สถานะ {'ACTIVE' if is_active else 'INACTIVE'}")
        filter_desc = " + ".join(filter_notes) if filter_notes else "ทั้งหมด"

        summary_text = (
            f"หน้าทะเบียนผู้ใช้ (User Directory) ของ Central IAM พบผู้ใช้งานจริงตามเงื่อนไข ({filter_desc}) "
            f"ทั้งสิ้น {total} บัญชี (ดึงแสดงผล {len(user_list)} บัญชี)"
        )

        return {
            "summary": summary_text,
            "total_users_in_directory": total,
            "total_matches": total,
            "returned_count": len(user_list),
            "users": user_list
        }
    except Exception as e:
        logger.error("Error in ciam_list_users: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Security, Ghost Account & Reconciliation Tools
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_get_ghost_accounts() -> Dict[str, Any]:
    """
    Detect discrepancies / Ghost Accounts across the enterprise.
    Identifies employees who have been disabled or offboarded in Active Directory,
    yet still retain active login accounts or VPN access in spoke applications (pfSense, SAP B1, IRM, MTPulse).
    """
    db = SessionLocal()
    try:
        discrepancies = find_account_discrepancies(db)
        ghost_list = [
            {
                "username": item.username,
                "full_name": item.full_name,
                "department": item.department,
                "app_code": item.app_code,
                "app_name": item.app_name,
                "ad_status": item.ad_status,
                "app_status": item.app_status,
                "reason": item.reason
            }
            for item in discrepancies
        ]
        return {
            "total_ghost_accounts": len(ghost_list),
            "severity": "HIGH" if len(ghost_list) > 0 else "CLEAN",
            "ghost_accounts": ghost_list
        }
    except Exception as e:
        logger.error("Error in ciam_get_ghost_accounts: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. Spoke-Specific Query & Contractor Tools (e.g. MTPulse, IRM)
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_get_spoke_data(app_code: str, search: str = "", **kwargs) -> Dict[str, Any]:
    """
    Query accounts, pending commands, and operational context for a specific spoke application.
    Supports 'mtpulse' (Modern Trade & Maintenance), 'irm' (Incoming Raw Materials),
    'sap_b1' (ERP), 'pfsense_fac', 'pfsense_ho', 'm365', and 'ad'.
    """
    db = SessionLocal()
    try:
        app_code_clean = (app_code or "").strip().lower()
        if "mtpulse" in app_code_clean:
            app_target = "mtpulse"
        elif "irm" in app_code_clean:
            app_target = "irm"
        else:
            app_target = app_code_clean

        app = db.query(ConnectedApplication).filter(
            or_(
                ConnectedApplication.app_code.ilike(app_target),
                ConnectedApplication.app_code.ilike(app_code_clean),
                ConnectedApplication.client_id.ilike(app_code_clean),
                ConnectedApplication.app_name.ilike(f"%{app_code_clean}%")
            )
        ).first()

        if not app:
            available_apps = [a.app_code for a in db.query(ConnectedApplication).all()]
            return {
                "status": "NOT_FOUND",
                "message": f"Application '{app_code}' not found.",
                "available_applications": available_apps
            }

        # Query mapped users
        mapping_query = (
            db.query(AppAccountMapping, MasterIdentity)
            .join(MasterIdentity, AppAccountMapping.identity_id == MasterIdentity.id)
            .filter(AppAccountMapping.application_id == app.id)
        )

        if search:
            s_clean = f"%{search.strip()}%"
            mapping_query = mapping_query.filter(
                or_(
                    AppAccountMapping.app_username.ilike(s_clean),
                    MasterIdentity.full_name.ilike(s_clean),
                    MasterIdentity.username.ilike(s_clean)
                )
            )

        mappings = mapping_query.order_by(AppAccountMapping.app_username.asc()).all()
        accounts = [
            {
                "app_username": m.app_username,
                "master_username": ident.username,
                "full_name": ident.full_name,
                "department": ident.department,
                "is_active_in_app": m.is_active_in_app,
                "last_sync_status": m.last_sync_status,
                "last_app_login_at": m.last_app_login_at.isoformat() if m.last_app_login_at else None,
                "updated_at": m.updated_at.isoformat() if m.updated_at else None
            }
            for m, ident in mappings
        ]

        active_in_app_count = sum(1 for a in accounts if a["is_active_in_app"])

        # Query pending command queue (Mode C agents like MTPulse)
        pending_commands = (
            db.query(SpokePendingCommand)
            .filter(SpokePendingCommand.app_code == app.app_code)
            .order_by(desc(SpokePendingCommand.created_at))
            .limit(10)
            .all()
        )

        commands_list = [
            {
                "command_id": cmd.command_id,
                "action": cmd.action,
                "username": cmd.username,
                "status": cmd.status,
                "issued_by": cmd.issued_by,
                "created_at": cmd.created_at.isoformat() if cmd.created_at else None
            }
            for cmd in pending_commands
        ]

        summary_text = (
            f"ระบบ {app.app_name} (รหัส '{app.app_code}') มีบัญชีที่ผูกและแสดงผลในหน้าทะเบียนผู้ใช้ (User Directory) "
            f"ของ Central IAM ทั้งสิ้น {len(accounts)} บัญชี (เป็นบัญชี Active ในระบบลูก {active_in_app_count} บัญชี)"
        )

        return {
            "summary": summary_text,
            "total_accounts_in_directory": len(accounts),
            "total_mapped_accounts": len(accounts),
            "active_in_app_count": active_in_app_count,
            "app_code": app.app_code,
            "app_name": app.app_name,
            "connector_type": app.connector_type,
            "health_status": app.health_status or "ONLINE",
            "base_url": app.base_url,
            "accounts": accounts,
            "recent_command_queue": commands_list
        }
    except Exception as e:
        logger.error("Error in ciam_get_spoke_data: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5. One-Click Offboarding & Deprovisioning Tool
# ---------------------------------------------------------------------------
@mcp_server.tool()
async def ciam_deprovision_user(
    username: str,
    reason: str = "Offboarding via AI Agent",
    operator: str = "AI_AGENT"
) -> Dict[str, Any]:
    """
    Execute instant 1-Click Offboarding for an employee.
    Deactivates identity in Active Directory and revokes accounts across all connected child systems
    (pfSense VPN, SAP B1, M365, IRM, MTPulse).
    Generates an official compliance certificate ID and immutable audit log records.
    """
    db = SessionLocal()
    try:
        req = OffboardExecuteRequest(
            username=username.strip(),
            effective_date=datetime.now().strftime("%Y-%m-%d"),
            reason=reason.strip(),
            notes=f"Automated deprovisioning triggered by operator: {operator}"
        )
        result = await execute_one_click_offboard(
            db=db,
            request=req,
            actor_username=operator,
            ip_address="127.0.0.1 (MCP)"
        )
        checklist_items = [
            {
                "app_code": item.app_code,
                "app_name": item.app_name,
                "connector_type": item.connector_type,
                "status": item.status,
                "message": item.message,
                "execution_mode": item.execution_mode
            }
            for item in result.checklist
        ]
        return {
            "status": result.overall_status,
            "certificate_id": result.certificate_id,
            "target_username": result.target_username,
            "target_full_name": result.target_full_name,
            "target_department": result.target_department,
            "executed_at": result.executed_at.isoformat(),
            "checklist": checklist_items
        }
    except Exception as e:
        logger.error("Error in ciam_deprovision_user: %s", e)
        return {"status": "FAILED", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 6. Re-activation & Provisioning Tool
# ---------------------------------------------------------------------------
@mcp_server.tool()
async def ciam_reactivate_user(
    username: str,
    reason: str = "Re-activation via AI Agent",
    operator: str = "AI_AGENT"
) -> Dict[str, Any]:
    """
    Reactivate a previously offboarded or disabled employee identity.
    Re-enables account in Active Directory and re-provisions access across mapped spoke applications.
    """
    db = SessionLocal()
    try:
        identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(username.strip())).first()
        if not identity:
            return {"status": "FAILED", "message": f"User '{username}' not found in Central IAM."}

        result = await execute_user_activation(
            db=db,
            identity_id=identity.id,
            reason=reason.strip(),
            actor_username=operator,
            ip_address="127.0.0.1 (MCP)"
        )
        return {
            "status": result.overall_status,
            "username": result.username,
            "full_name": result.full_name,
            "ad_status": result.ad_status,
            "checklist": [
                {
                    "app_code": c.app_code,
                    "app_name": c.app_name,
                    "status": c.status,
                    "message": c.message
                }
                for c in result.checklist
            ]
        }
    except Exception as e:
        logger.error("Error in ciam_reactivate_user: %s", e)
        return {"status": "FAILED", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7. Audit Log Inspection Tool (Read-Only)
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_get_audit_logs(limit: int = 15, action_type: str = "", search: str = "") -> Dict[str, Any]:
    """
    Retrieve security audit trail and governance event logs from Central IAM.
    Filterable by action type (e.g. 'DISABLE_USER', 'ENABLE_USER', 'SYSTEM_SETTING', 'LOGIN') and search keyword.
    """
    db = SessionLocal()
    try:
        total_logs = db.query(IamAuditLog).count()
        query = db.query(IamAuditLog)
        if action_type:
            query = query.filter(IamAuditLog.action_type.ilike(f"%{action_type.strip()}%"))
        if search:
            s_clean = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    IamAuditLog.actor_username.ilike(s_clean),
                    IamAuditLog.target_username.ilike(s_clean),
                    IamAuditLog.affected_app_code.ilike(s_clean),
                    IamAuditLog.reason.ilike(s_clean),
                )
            )

        matched_count = query.count()
        logs = query.order_by(desc(IamAuditLog.created_at)).limit(limit).all()
        records = [
            {
                "id": log.id,
                "actor": log.actor_username,
                "action": log.action_type,
                "target": log.target_username,
                "affected_app": log.affected_app_code,
                "status": log.status,
                "reason": log.reason,
                "timestamp": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ]
        return {
            "mode": "READ_ONLY",
            "total_audit_logs_in_system": total_logs,
            "matched_count": matched_count,
            "returned_count": len(records),
            "logs": records
        }
    except Exception as e:
        logger.error("Error in ciam_get_audit_logs: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7B. Offboarding Impact Preview Tool (100% Read-Only Simulation)
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_preview_offboarding_impact(username: str) -> Dict[str, Any]:
    """
    Read-Only Offboarding Center Impact Analysis (mirrors /offboarding preview).
    Calculates and displays which Active Directory and Spoke accounts would be affected
    if an employee were to be offboarded, WITHOUT modifying or deactivating any account.
    """
    db = SessionLocal()
    try:
        clean_u = (username or "").strip()
        if not clean_u:
            return {"status": "NOT_FOUND", "message": "กรุณาระบุชื่อผู้ใช้งาน (username) ที่ต้องการจำลองผลกระทบ"}

        identity = (
            db.query(MasterIdentity)
            .filter(
                or_(
                    MasterIdentity.username.ilike(clean_u),
                    MasterIdentity.full_name.ilike(f"%{clean_u}%"),
                    MasterIdentity.email.ilike(f"%{clean_u}%"),
                )
            )
            .first()
        )
        if not identity:
            return {"status": "NOT_FOUND", "message": f"ไม่พบบัญชีผู้ใช้ '{clean_u}' ในระบบ Central IAM"}

        mappings = (
            db.query(AppAccountMapping, ConnectedApplication)
            .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
            .filter(AppAccountMapping.identity_id == identity.id)
            .all()
        )

        affected_systems = []
        active_impact_count = 0
        for m, app in mappings:
            if m.is_active_in_app:
                active_impact_count += 1
            affected_systems.append({
                "app_code": app.app_code,
                "app_name": app.app_name,
                "connector_type": app.connector_type,
                "app_username": m.app_username,
                "group_name": m.app_group_name,
                "is_active_in_app": m.is_active_in_app,
                "is_approved_exception": m.is_approved_exception,
            })

        return {
            "mode": "READ_ONLY_SIMULATION_NO_CHANGES_MADE",
            "governance_notice": "ข้อมูลนี้เป็นการจำลองผลกระทบแบบ Read-Only เท่านั้น ระบบ AI Copilot ไม่ได้รับอนุญาตให้ทำการระงับสิทธิ์หรือแก้ไขข้อมูลจริง หากต้องการดำเนินการจริง กรุณาไปที่เมนู 'ศูนย์ระงับสิทธิ์ (/offboarding)' บนหน้าเว็บ",
            "username": identity.username,
            "full_name": identity.full_name,
            "department": identity.department,
            "email": identity.email,
            "is_active_in_ad": identity.is_active_in_ad,
            "total_linked_systems": len(affected_systems),
            "active_accounts_that_would_be_revoked": active_impact_count,
            "affected_systems": affected_systems,
        }
    except Exception as e:
        logger.error("Error in ciam_preview_offboarding_impact: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7C. Self-Service SSO Portal Access Inspection Tool (RBAC Scoped)
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_get_portal_my_access(username: str) -> Dict[str, Any]:
    """
    Read-Only Self-Service SSO Portal inspection for a specific user.
    Returns only that user's identity profile and the SSO applications they are authorized to access on /portal.
    """
    db = SessionLocal()
    try:
        clean_u = (username or "").strip()
        identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(clean_u)).first()
        if not identity:
            return {
                "mode": "READ_ONLY_SELF_SERVICE",
                "username": clean_u,
                "status": "NOT_FOUND",
                "message": f"ไม่พบข้อมูลตัวตนของ '{clean_u}'",
            }

        mappings = (
            db.query(AppAccountMapping, ConnectedApplication)
            .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
            .filter(
                AppAccountMapping.identity_id == identity.id,
                AppAccountMapping.is_active_in_app == True,
                ConnectedApplication.is_active == True,
            )
            .all()
        )

        authorized_apps = [
            {
                "app_code": app.app_code,
                "app_name": app.app_name,
                "app_username": m.app_username,
                "role_or_group": m.app_group_name,
                "health_status": app.health_status or "ONLINE",
                "sso_enabled": bool(app.sso_enabled),
                "network_policy": getattr(app, "network_policy", "ANYWHERE") or "ANYWHERE",
                "base_url": app.base_url,
            }
            for m, app in mappings
        ]

        return {
            "mode": "READ_ONLY_SELF_SERVICE",
            "username": identity.username,
            "full_name": identity.full_name,
            "department": identity.department,
            "email": identity.email,
            "is_active_in_ad": identity.is_active_in_ad,
            "authorized_apps_count": len(authorized_apps),
            "authorized_apps": authorized_apps,
        }
    except Exception as e:
        logger.error("Error in ciam_get_portal_my_access: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 8. Command Queue Dispatcher for Spoke Mode C (e.g. MTPulse)
# ---------------------------------------------------------------------------
@mcp_server.tool()
def ciam_dispatch_spoke_command(
    app_code: str,
    action: str,
    username: str,
    reason: str = "Command via MCP Agent",
    operator: str = "AI_AGENT"
) -> Dict[str, Any]:
    """
    Queue an asynchronous command for an on-premise spoke application (Mode C like MTPulse).
    Actions include: 'DISABLE_USER', 'ENABLE_USER', 'PROVISION_USER', 'REQUEST_FULL_SYNC'.
    The command will be dispatched to the spoke agent on its next reverse heartbeat.
    """
    import uuid
    db = SessionLocal()
    try:
        app_code_clean = app_code.strip().lower()
        app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code.ilike(app_code_clean)).first()
        if not app:
            return {"status": "FAILED", "message": f"Spoke application '{app_code}' not found."}

        cmd_id = f"CMD-{uuid.uuid4().hex[:12].upper()}"
        cmd = SpokePendingCommand(
            command_id=cmd_id,
            app_code=app.app_code,
            action=action.upper().strip(),
            username=username.strip(),
            reason=reason.strip(),
            status="PENDING",
            issued_by=operator,
            created_at=datetime.now(timezone.utc)
        )
        db.add(cmd)
        db.commit()

        return {
            "status": "QUEUED",
            "command_id": cmd_id,
            "app_code": app.app_code,
            "action": action.upper().strip(),
            "target_username": username.strip(),
            "message": f"Command {cmd_id} successfully queued for {app.app_code}. Will be dispatched on next heartbeat."
        }
    except Exception as e:
        logger.error("Error in ciam_dispatch_spoke_command: %s", e)
        return {"status": "ERROR", "message": str(e)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
@mcp_server.resource("ciam://system/health")
def resource_system_health() -> str:
    """Live JSON status report of Central IAM and all connected spokes."""
    return json.dumps(ciam_health_check(), indent=2, ensure_ascii=False)

@mcp_server.resource("ciam://ghost-accounts/list")
def resource_ghost_accounts() -> str:
    """Live list of detected ghost accounts needing administrative offboarding."""
    return json.dumps(ciam_get_ghost_accounts(), indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Direct CLI Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Runs standard stdio transport for IDE integrations (Antigravity, Cursor, Claude Desktop)
    print("Starting Central IAM MCP Server via stdio transport...", file=os.sys.stderr)
    mcp_server.run(transport="stdio")
