import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.setting import SystemSetting
from app.models.application import ConnectedApplication
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.audit import IamAuditLog
from app.connectors.factory import get_connector_for_app

logger = logging.getLogger("ciam.scheduler")

# Bangkok timezone offset (UTC+7)
BANGKOK_TZ = timezone(timedelta(hours=7))

DEFAULT_SCHEDULE = {
    "enabled": True,
    "time": "04:00",
    "timezone": "Asia/Bangkok",
    "last_run_at": None,
    "last_status": "IDLE",
    "last_summary": None,
    "last_run_date": None,
}

def get_current_bangkok_time() -> datetime:
    return datetime.now(timezone.utc).astimezone(BANGKOK_TZ)

def get_sync_schedule(db: Session) -> Dict[str, Any]:
    setting = db.query(SystemSetting).filter_by(setting_key="sync_schedule").first()
    if not setting:
        schedule = DEFAULT_SCHEDULE.copy()
    else:
        schedule = {**DEFAULT_SCHEDULE, **setting.setting_value}

    # Calculate next run timestamp
    try:
        now_bkk = get_current_bangkok_time()
        sched_time_parts = schedule.get("time", "04:00").split(":")
        target_h = int(sched_time_parts[0])
        target_m = int(sched_time_parts[1])
        next_run = now_bkk.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
        if next_run <= now_bkk:
            next_run += timedelta(days=1)
        schedule["next_run_at"] = next_run.isoformat()
    except Exception as exc:
        logger.warning("Error calculating next_run_at: %s", exc)
        schedule["next_run_at"] = None

    return schedule

def update_sync_schedule(db: Session, update_data: Dict[str, Any]) -> Dict[str, Any]:
    setting = db.query(SystemSetting).filter_by(setting_key="sync_schedule").first()
    current_val = setting.setting_value if setting else DEFAULT_SCHEDULE.copy()

    if "enabled" in update_data and update_data["enabled"] is not None:
        current_val["enabled"] = bool(update_data["enabled"])
    if "time" in update_data and update_data["time"]:
        # Validate HH:MM format
        parts = str(update_data["time"]).strip().split(":")
        if len(parts) == 2 and 0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59:
            current_val["time"] = f"{int(parts[0]):02d}:{int(parts[1]):02d}"

    if not setting:
        setting = SystemSetting(
            setting_key="sync_schedule",
            setting_value=current_val,
            description="Daily automated synchronization schedule for all connected spoke applications"
        )
        db.add(setting)
    else:
        setting.setting_value = current_val

    db.commit()
    return get_sync_schedule(db)

async def execute_sync_all(db: Session, actor_username: str = "System-Scheduler") -> Dict[str, Any]:
    """
    Execute inventory synchronization across all active connected applications.
    """
    apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
    results = []
    success_count = 0
    fail_count = 0
    now_utc = datetime.now(timezone.utc)

    logger.info("Starting sync-all for %d active applications (Actor: %s)", len(apps), actor_username)

    for app in apps:
        connector = get_connector_for_app(app)
        try:
            inv = await connector.sync_inventory()
            raw_accounts = inv.get("accounts", [])
            synced_for_app = 0

            for item in raw_accounts:
                uname = (item.get("username") or "").strip()
                if not uname:
                    continue

                # Match MasterIdentity by username, fallback to email, fallback to full_name
                identity = db.query(MasterIdentity).filter(MasterIdentity.username.ilike(uname)).first()
                if not identity and item.get("email"):
                    identity = db.query(MasterIdentity).filter(MasterIdentity.email.ilike(item.get("email").strip())).first()
                if not identity and item.get("full_name") and item.get("full_name").strip() != uname:
                    identity = db.query(MasterIdentity).filter(MasterIdentity.full_name.ilike(item.get("full_name").strip())).first()

                if not identity:
                    identity = MasterIdentity(
                        username=uname,
                        full_name=item.get("full_name") or uname,
                        email=item.get("email"),
                        department=item.get("department"),
                        is_active_in_ad=True,
                        created_at=now_utc
                    )
                    db.add(identity)
                    db.flush()
                else:
                    if not identity.email and item.get("email"):
                        identity.email = item.get("email")
                    if not identity.department and item.get("department"):
                        identity.department = item.get("department")
                    if (not identity.full_name or identity.full_name == identity.username) and item.get("full_name"):
                        identity.full_name = item.get("full_name")

                # Match AppAccountMapping (case-insensitive to prevent duplicate rows)
                existing_mappings = (
                    db.query(AppAccountMapping)
                    .filter(
                        AppAccountMapping.application_id == app.id,
                        func.lower(AppAccountMapping.app_username) == uname.lower()
                    )
                    .all()
                )
                if existing_mappings:
                    exact_match = next((m for m in existing_mappings if m.app_username == uname), None)
                    mapping = exact_match or existing_mappings[0]
                    if len(existing_mappings) > 1:
                        for dup in existing_mappings:
                            if dup.id != mapping.id:
                                db.delete(dup)
                        db.flush()
                else:
                    mapping = None

                is_active = bool(item.get("is_active", True))
                sync_status = "DISCREPANCY" if (not identity.is_active_in_ad and is_active) else "IN_SYNC"

                last_login_dt = None
                raw_login = item.get("last_login_at")
                if raw_login:
                    try:
                        last_login_dt = datetime.fromisoformat(raw_login.replace("Z", "+00:00"))
                    except Exception:
                        pass

                if not mapping:
                    mapping = AppAccountMapping(
                        identity_id=identity.id,
                        application_id=app.id,
                        app_username=uname,
                        app_user_id=str(item.get("id")) if item.get("id") is not None else None,
                        app_group_name=item.get("group_name"),
                        is_active_in_app=is_active,
                        last_sync_status=sync_status,
                        last_app_login_at=last_login_dt,
                        created_at=now_utc
                    )
                    db.add(mapping)
                else:
                    mapping.identity_id = identity.id
                    mapping.app_username = uname  # Normalize casing
                    mapping.app_user_id = str(item.get("id")) if item.get("id") is not None else mapping.app_user_id
                    mapping.app_group_name = item.get("group_name")
                    mapping.is_active_in_app = is_active
                    mapping.last_sync_status = sync_status
                    if last_login_dt:
                        mapping.last_app_login_at = last_login_dt

                synced_for_app += 1

            # Prune stale/orphaned mappings that no longer exist in the target spoke application
            live_usernames = {
                (item.get("username") or "").strip().lower()
                for item in raw_accounts
                if (item.get("username") or "").strip()
            }
            if live_usernames:
                stale_mappings = (
                    db.query(AppAccountMapping)
                    .filter(
                        AppAccountMapping.application_id == app.id,
                        ~func.trim(func.lower(AppAccountMapping.app_username)).in_(live_usernames)
                    )
                    .all()
                )
                for stale in stale_mappings:
                    db.delete(stale)

                db.flush()

                # Deduplicate any remaining mappings for this app that differ only by case
                all_app_mappings = (
                    db.query(AppAccountMapping)
                    .filter(AppAccountMapping.application_id == app.id)
                    .order_by(AppAccountMapping.id.asc())
                    .all()
                )
                seen_lower = set()
                for m in all_app_mappings:
                    low = (m.app_username or "").strip().lower()
                    if low in seen_lower:
                        db.delete(m)
                    else:
                        seen_lower.add(low)
                db.flush()

                if app.app_code.lower() == "ad":
                    stale_identities = (
                        db.query(MasterIdentity)
                        .filter(
                            MasterIdentity.is_active_in_ad == True,
                            ~func.lower(MasterIdentity.username).in_(live_usernames)
                        )
                        .all()
                    )
                    for st_id in stale_identities:
                        st_id.is_active_in_ad = False

            app.last_sync_at = now_utc
            app.health_status = "ONLINE"
            db.commit()

            results.append({
                "app_code": app.app_code,
                "app_name": app.app_name,
                "success": True,
                "accounts_synced": synced_for_app,
                "error": None
            })
            success_count += 1
        except Exception as exc:
            logger.warning("Sync failed for %s: %s", app.app_code, exc)
            results.append({
                "app_code": app.app_code,
                "app_name": app.app_name,
                "success": False,
                "accounts_synced": 0,
                "error": str(exc)[:150]
            })
            fail_count += 1

    summary_text = f"ซิงก์สำเร็จ {success_count} ระบบ, ล้มเหลว {fail_count} ระบบ"

    # Audit log
    db.add(IamAuditLog(
        actor_username=actor_username,
        action_type="SYNC_ALL_APPS",
        target_username="ALL_CONNECTED_SPOKES",
        affected_app_code="ALL",
        execution_mode="SCHEDULED_OR_MANUAL",
        reason=summary_text,
        status="SUCCESS" if fail_count == 0 else ("WARNING" if success_count > 0 else "FAILED")
    ))

    # Update system_settings last run
    setting = db.query(SystemSetting).filter_by(setting_key="sync_schedule").first()
    if setting:
        val = setting.setting_value.copy()
        val["last_run_at"] = now_utc.isoformat()
        val["last_status"] = "SUCCESS" if fail_count == 0 else "PARTIAL_ERROR"
        val["last_summary"] = summary_text
        val["last_run_date"] = get_current_bangkok_time().strftime("%Y-%m-%d")
        setting.setting_value = val
        db.commit()

    return {
        "success": fail_count == 0,
        "total_apps": len(apps),
        "success_count": success_count,
        "fail_count": fail_count,
        "summary": summary_text,
        "results": results,
        "timestamp": now_utc.isoformat()
    }

async def run_scheduler_worker():
    """
    Background worker loop checking every 30s whether it's time to run daily sync.
    Runs in Asia/Bangkok timezone.
    """
    logger.info("Central IAM Daily Scheduler worker initialized (Timezone: Asia/Bangkok)")
    while True:
        try:
            await asyncio.sleep(30)
            now_bkk = get_current_bangkok_time()
            today_str = now_bkk.strftime("%Y-%m-%d")
            current_hm = now_bkk.strftime("%H:%M")

            db = SessionLocal()
            try:
                schedule = get_sync_schedule(db)
                if not schedule.get("enabled", True):
                    continue

                target_time = schedule.get("time", "04:00")
                last_run_date = schedule.get("last_run_date")

                # If current time matches target HH:MM and hasn't run yet today
                if current_hm == target_time and last_run_date != today_str:
                    logger.info("Executing scheduled sync at %s (Asia/Bangkok)", current_hm)
                    await execute_sync_all(db, actor_username="Auto-Scheduler-04:00")
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Scheduler worker cancelled.")
            break
        except Exception as exc:
            logger.error("Error in scheduler worker loop: %s", exc)

_scheduler_task: Optional[asyncio.Task] = None

def start_background_scheduler():
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(run_scheduler_worker())
        logger.info("Central IAM Background Scheduler task started.")
