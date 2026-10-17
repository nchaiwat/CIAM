import asyncio
import json
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
    from sqlalchemy.orm.attributes import flag_modified
    setting = db.query(SystemSetting).filter_by(setting_key="sync_schedule").first()
    current_val = dict(setting.setting_value) if (setting and setting.setting_value) else DEFAULT_SCHEDULE.copy()

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
            setting_value=dict(current_val),
            description="Daily automated synchronization schedule for all connected spoke applications"
        )
        db.add(setting)
    else:
        setting.setting_value = dict(current_val)
        flag_modified(setting, "setting_value")

    db.commit()
    db.refresh(setting)
    return get_sync_schedule(db)

def persist_spoke_inventory(
    app: ConnectedApplication,
    raw_accounts: list,
    db: Session,
    actor_username: str = "System-Scheduler"
) -> int:
    """
    Persist account inventory from spoke system into Central IAM database:
    Upserts master identities, app account mappings, and flags discrepancies.
    """
    synced_count = 0
    now = datetime.now(timezone.utc)
    is_ad_item = (app.app_code or "").lower() == "ad"

    # Deduplicate incoming accounts by username to guard against duplicate entries
    # (e.g. pfSense accounts present in both FreeRADIUS and Local user database)
    seen_batch_usernames = set()
    deduped_accounts = []
    for item in raw_accounts:
        u_raw = (item.get("username") or "").strip()
        if not u_raw:
            continue
        u_lower = u_raw.lower()
        if u_lower in seen_batch_usernames:
            continue
        seen_batch_usernames.add(u_lower)
        deduped_accounts.append(item)

    for item in deduped_accounts:
        uname = (item.get("username") or "").strip()
        if not uname:
            continue

        u_clean = uname.lower()
        is_shop_acc = (
            u_clean.startswith("wa-shop")
            or u_clean.startswith("ws-")
            or "wa_shop" in u_clean
            or "shop_" in u_clean
            or (len(u_clean) > 2 and u_clean[:2].isdigit() and "-ws" in u_clean)
        )

        is_ad_item = app.app_code.lower() == "ad"
        if is_ad_item and is_shop_acc:
            # Branch shop VPN accounts must NEVER be ingested or mapped as Active Directory accounts in Central IAM
            continue

        is_active = bool(item.get("is_active", True))

        is_ad_format = len(uname.split(".")) == 2 and len(uname.split(".")[1]) <= 2
        dept_low = (item.get("department") or "").strip().lower()
        corporate_depts = ("sale", "sales", "purchasing", "pu", "it", "accounting", "hr", "executive", "management", "qa", "warehouse", "m365", "office", "general", "administration", "ธุรการ")
        is_corp_dept = any(cd in dept_low for cd in corporate_depts) if dept_low else False
        is_corp = (not is_shop_acc) and (is_ad_format or is_corp_dept or ("@windowasia.com" in (item.get("email") or "").lower()))

        # Look for existing identity in AD (Master Identity)
        identity = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == uname.lower()).first()
        if not identity and item.get("email"):
            identity = db.query(MasterIdentity).filter(MasterIdentity.email.ilike(item.get("email").strip())).first()
        if not identity and item.get("full_name") and item.get("full_name").strip() != uname:
            identity = db.query(MasterIdentity).filter(MasterIdentity.full_name.ilike(item.get("full_name").strip())).first()

        # Check phonetic / transliteration aliases for usernames (e.g. wachirawut.b <-> wachirawoot.b, duanghatai.p <-> duanghathai.p)
        if not identity and "." in uname:
            prefix, initial = uname.rsplit(".", 1)
            p_low = prefix.lower()
            alt_prefixes = []
            if "wut" in p_low:
                alt_prefixes.append(p_low.replace("wut", "woot"))
            if "woot" in p_low:
                alt_prefixes.append(p_low.replace("woot", "wut"))
            if "thai" in p_low:
                alt_prefixes.append(p_low.replace("thai", "tai"))
            if "tai" in p_low and "thai" not in p_low:
                alt_prefixes.append(p_low.replace("tai", "thai"))
            for ap in alt_prefixes:
                alt_uname = f"{ap}.{initial.lower()}"
                identity = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == alt_uname).first()
                if identity:
                    break

        telegram_val = str(item.get("telegram_id") or item.get("pager") or "").strip() or None

        raw_item_email = (item.get("email") or "").strip() or None

        is_m365_item = app.app_code.lower() == "m365"

        if not identity:
            identity = MasterIdentity(
                username=uname,
                full_name=item.get("full_name") or uname,
                email=raw_item_email if is_m365_item else None,
                department=item.get("department") if is_ad_item else None,
                employee_id=item.get("employee_id") if is_ad_item else None,
                telegram_id=telegram_val,
                is_active_in_ad=is_active if is_ad_item else False,
                created_at=now
            )
            db.add(identity)
            db.flush()
        else:
            if is_ad_item:
                identity.is_active_in_ad = is_active
                if item.get("employee_id"):
                    identity.employee_id = item.get("employee_id")
                # Department comes strictly from Active Directory OU
                if item.get("department"):
                    identity.department = item.get("department")
                if telegram_val:
                    identity.telegram_id = telegram_val
            elif is_shop_acc:
                identity.is_active_in_ad = False
                identity.ad_guid = None
                identity.employee_id = None
                ad_app = db.query(ConnectedApplication).filter(func.lower(ConnectedApplication.app_code) == "ad").first()
                if ad_app:
                    db.query(AppAccountMapping).filter(
                        AppAccountMapping.identity_id == identity.id,
                        AppAccountMapping.application_id == ad_app.id
                    ).delete()

            if telegram_val and not identity.telegram_id:
                identity.telegram_id = telegram_val

            # Email belongs EXCLUSIVELY to Microsoft 365 accounts
            if is_m365_item and raw_item_email:
                identity.email = raw_item_email

            if (not identity.full_name or identity.full_name == identity.username) and item.get("full_name"):
                identity.full_name = item.get("full_name")

        # Check existing mapping (by app_username or already linked identity_id)
        from sqlalchemy import or_
        existing_mappings = (
            db.query(AppAccountMapping)
            .filter(
                AppAccountMapping.application_id == app.id,
                or_(
                    func.lower(AppAccountMapping.app_username) == uname.lower(),
                    AppAccountMapping.identity_id == identity.id
                )
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

        is_exception = bool(
            getattr(mapping, "is_approved_exception", False) or getattr(identity, "is_approved_exception", False)
        )
        if is_exception:
            sync_status = "APPROVED_EXCEPTION"
        elif not is_shop_acc and not identity.is_active_in_ad and is_active and is_corp:
            sync_status = "DISCREPANCY"
        else:
            sync_status = "IN_SYNC"

        last_login_dt = None
        raw_last_login = item.get("last_login_at")
        if raw_last_login:
            try:
                last_login_dt = datetime.fromisoformat(raw_last_login.replace("Z", "+00:00"))
            except Exception:
                pass

        if not mapping:
            mapping = AppAccountMapping(
                identity_id=identity.id,
                application_id=app.id,
                app_username=uname,
                app_user_id=str(item.get("id")) if item.get("id") is not None else None,
                app_group_name=item.get("group_name") or ("Shop VPN" if is_shop_acc else None),
                is_active_in_app=is_active,
                last_sync_status=sync_status,
                last_app_login_at=last_login_dt,
                created_at=now
            )
            db.add(mapping)
        else:
            mapping.identity_id = identity.id
            mapping.app_username = uname
            mapping.app_user_id = str(item.get("id")) if item.get("id") is not None else mapping.app_user_id
            mapping.app_group_name = item.get("group_name") or mapping.app_group_name
            mapping.is_active_in_app = is_active
            mapping.last_sync_status = sync_status
            if last_login_dt:
                mapping.last_app_login_at = last_login_dt

        synced_count += 1

    # Prune stale/orphaned mappings
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
            if is_ad_item and stale.identity:
                logger.info("AD Sync: User '%s' removed from AD. Setting is_active_in_ad = False", stale.app_username)
                stale.identity.is_active_in_ad = False
            db.delete(stale)

        db.flush()

        # If syncing Active Directory, any identity that was marked is_active_in_ad=True but is NOT in live AD accounts must be False
        if is_ad_item and len(live_usernames) >= 5:
            missing_ad_identities = (
                db.query(MasterIdentity)
                .filter(
                    MasterIdentity.is_active_in_ad == True,
                    ~func.lower(MasterIdentity.username).in_(live_usernames)
                )
                .all()
            )
            for m_id in missing_ad_identities:
                logger.info("AD Sync: User '%s' is no longer in Active Directory. Setting is_active_in_ad = False", m_id.username)
                m_id.is_active_in_ad = False
            db.flush()

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

    app.last_sync_at = now
    app.health_status = "ONLINE"
    app.total_linked_accounts = synced_count

    db.add(IamAuditLog(
        actor_username=actor_username,
        action_type="SYNC",
        target_username=f"INVENTORY_{app.app_code.upper()}",
        affected_app_code=app.app_code,
        execution_mode=app.connector_type,
        reason=f"Account inventory synchronized: {synced_count} accounts from {app.app_name}",
        status="SUCCESS"
    ))

    db.commit()
    return synced_count


async def execute_sync_all(db: Session, actor_username: str = "System-Scheduler") -> Dict[str, Any]:
    """
    Execute inventory synchronization across all active connected applications.
    """
    now_utc = datetime.now(timezone.utc)
    apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
    results = []
    success_count = 0
    fail_count = 0

    logger.info("Starting sync-all for %d active applications (Actor: %s)", len(apps), actor_username)

    for app in apps:
        connector = get_connector_for_app(app)
        try:
            inv = await connector.sync_inventory()
            raw_accounts = inv.get("accounts", [])
            synced_for_app = persist_spoke_inventory(app, raw_accounts, db, actor_username=actor_username)

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

    failed_items = [r for r in results if not r["success"]]
    if failed_items:
        failed_desc = "; ".join([f"{f['app_name']} ({f['app_code']}): {f['error']}" for f in failed_items])
        summary_text = f"ซิงก์สำเร็จ {success_count} ระบบ, ล้มเหลว {fail_count} ระบบ [พบปัญหา: {failed_desc}]"
        affected_apps = ",".join([f["app_code"] for f in failed_items])
    else:
        summary_text = f"ซิงก์สำเร็จ {success_count} ระบบ, ล้มเหลว 0 ระบบ"
        affected_apps = "ALL"

    details_payload = json.dumps({
        "total_apps": len(apps),
        "success_count": success_count,
        "fail_count": fail_count,
        "failed_apps": failed_items,
        "results": results
    }, ensure_ascii=False)

    # Audit log
    db.add(IamAuditLog(
        actor_username=actor_username,
        action_type="SYNC_ALL_APPS",
        target_username="ALL_CONNECTED_SPOKES",
        affected_app_code=affected_apps,
        execution_mode="SCHEDULED_OR_MANUAL",
        reason=summary_text,
        details=details_payload,
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
            await asyncio.sleep(15)
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

                # Telegram System & AD Sync Agent Health Monitor Check
                try:
                    from app.services.telegram_service import get_health_monitor_config, send_health_report
                    health_cfg = get_health_monitor_config(db)
                    if health_cfg.get("enabled", False):
                        start_time = health_cfg.get("start_time", "08:00")
                        interval = max(1, min(24, int(health_cfg.get("interval_hours", 4))))
                        parts = start_time.split(":")
                        start_h = int(parts[0])
                        start_m = int(parts[1]) if len(parts) > 1 else 0

                        is_target_minute = (now_bkk.minute == start_m)
                        is_target_hour = ((now_bkk.hour - start_h) % interval == 0)

                        last_run_iso = health_cfg.get("last_run_at")
                        already_ran_in_this_window = False
                        if last_run_iso:
                            try:
                                last_dt = datetime.fromisoformat(last_run_iso)
                                if (now_bkk - last_dt.astimezone(BANGKOK_TZ)).total_seconds() < 300:
                                    already_ran_in_this_window = True
                            except Exception:
                                pass

                        if is_target_minute and is_target_hour and not already_ran_in_this_window:
                            logger.info("Executing scheduled Telegram health report at %s", current_hm)
                            await send_health_report(db, triggered_by=f"AUTO_SCHEDULED_{current_hm}")
                except Exception as health_err:
                    logger.warning("Error running scheduled health monitor: %s", health_err)

                # Real-Time AD Sync Agent Status Monitoring & Hourly Alert Loop
                try:
                    from app.services.telegram_service import check_and_notify_ad_status
                    await check_and_notify_ad_status(db)
                except Exception as ad_mon_err:
                    logger.warning("Error running real-time AD health monitor: %s", ad_mon_err)
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
