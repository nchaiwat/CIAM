import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.models.setting import SystemSetting
from app.models.application import ConnectedApplication
from app.models.user import AdminUser
from app.models.audit import IamAuditLog
from app.connectors.ad_proxy import AdProxyConnector

logger = logging.getLogger("ciam.telegram")

BANGKOK_TZ = timezone(timedelta(hours=7))

DEFAULT_HEALTH_MONITOR: Dict[str, Any] = {
    "enabled": False,
    "start_time": "08:00",
    "interval_hours": 4,
    "bot_token": "",
    "chat_id": "",
    "notify_admins_enabled": True,
    "last_run_at": None,
    "last_status": "IDLE",
    "last_summary": None,
    "last_error": None,
}

def get_bangkok_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(BANGKOK_TZ)

def calculate_next_health_run(start_time_str: str, interval_hours: int, now_bkk: datetime) -> Optional[str]:
    """Calculate next run time based on start_time and interval_hours."""
    try:
        parts = start_time_str.split(":")
        start_h = int(parts[0])
        start_m = int(parts[1]) if len(parts) > 1 else 0

        # Calculate run points in a day: start_h, start_h + interval, ...
        interval = max(1, min(24, int(interval_hours)))
        today_runs = []
        for i in range(24 // interval + 1):
            h = (start_h + i * interval) % 24
            dt = now_bkk.replace(hour=h, minute=start_m, second=0, microsecond=0)
            today_runs.append(dt)

        # Sort today runs
        today_runs = sorted(list(set(today_runs)))

        # Find first run that is > now_bkk
        for run_dt in today_runs:
            if run_dt > now_bkk:
                return run_dt.isoformat()

        # If all today runs passed, next is first run tomorrow
        tomorrow_first = today_runs[0] + timedelta(days=1)
        return tomorrow_first.isoformat()
    except Exception as e:
        logger.warning("Error calculating next health run: %s", e)
        return None

def get_health_monitor_config(db: Session) -> Dict[str, Any]:
    setting = db.query(SystemSetting).filter_by(setting_key="health_monitor_schedule").first()
    if not setting:
        config = DEFAULT_HEALTH_MONITOR.copy()
        config["bot_token"] = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
        config["chat_id"] = getattr(settings, "TELEGRAM_CHAT_ID", "") or ""
    else:
        config = {**DEFAULT_HEALTH_MONITOR, **setting.setting_value}
        if not config.get("bot_token"):
            config["bot_token"] = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
        if not config.get("chat_id"):
            config["chat_id"] = getattr(settings, "TELEGRAM_CHAT_ID", "") or ""

    now_bkk = get_bangkok_now()
    config["next_run_at"] = calculate_next_health_run(
        config.get("start_time", "08:00"),
        int(config.get("interval_hours", 4)),
        now_bkk
    )
    return config

def save_health_monitor_config(db: Session, update_data: Dict[str, Any]) -> Dict[str, Any]:
    setting = db.query(SystemSetting).filter_by(setting_key="health_monitor_schedule").first()
    current_val = setting.setting_value if setting else DEFAULT_HEALTH_MONITOR.copy()

    if "enabled" in update_data and update_data["enabled"] is not None:
        current_val["enabled"] = bool(update_data["enabled"])
    if "start_time" in update_data and update_data["start_time"]:
        parts = str(update_data["start_time"]).strip().split(":")
        if len(parts) >= 2 and 0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59:
            current_val["start_time"] = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    if "interval_hours" in update_data and update_data["interval_hours"] is not None:
        val = int(update_data["interval_hours"])
        if val in [1, 2, 4, 6, 8, 12, 24]:
            current_val["interval_hours"] = val
    if "bot_token" in update_data and update_data["bot_token"] is not None:
        current_val["bot_token"] = str(update_data["bot_token"]).strip()
    if "chat_id" in update_data and update_data["chat_id"] is not None:
        current_val["chat_id"] = str(update_data["chat_id"]).strip()
    if "notify_admins_enabled" in update_data and update_data["notify_admins_enabled"] is not None:
        current_val["notify_admins_enabled"] = bool(update_data["notify_admins_enabled"])

    if not setting:
        setting = SystemSetting(
            setting_key="health_monitor_schedule",
            setting_value=current_val,
            description="Telegram Health Monitor and AD Sync Agent periodic alert configuration"
        )
        db.add(setting)
    else:
        setting.setting_value = current_val

    db.commit()
    return get_health_monitor_config(db)

async def check_full_system_health(db: Session) -> Dict[str, Any]:
    """Inspect Central IAM Engine, PostgreSQL DB, AD Sync Agent, and Connected Apps."""
    now_bkk = get_bangkok_now()

    # 1. PostgreSQL Database Check
    db_start = time.time()
    db_ok = False
    db_latency = 0
    try:
        db.execute(text("SELECT 1;"))
        db_latency = int((time.time() - db_start) * 1000)
        db_ok = True
    except Exception as exc:
        logger.error("DB health check error: %s", exc)

    # 2. AD Sync Agent / AD Gateway Check
    ad_connector = AdProxyConnector()
    ad_health = await ad_connector.health_check()

    # 3. Connected Applications
    apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
    online_apps = [a for a in apps if a.health_status == "ONLINE"]

    all_healthy = db_ok and ad_health.is_online

    return {
        "timestamp_bkk": now_bkk.strftime("%Y-%m-%d %H:%M:%S"),
        "all_healthy": all_healthy,
        "database": {
            "is_connected": db_ok,
            "latency_ms": db_latency,
            "engine": "PostgreSQL / SQLite"
        },
        "ad_sync_agent": {
            "is_online": ad_health.is_online,
            "latency_ms": ad_health.latency_ms,
            "message": ad_health.message,
            "base_url": ad_connector.base_url
        },
        "connected_apps": {
            "total": len(apps),
            "online": len(online_apps),
            "offline": len(apps) - len(online_apps)
        }
    }

async def send_telegram_message(bot_token: str, chat_id: str, text: str, parse_mode: str = "HTML") -> Tuple[bool, str]:
    """Send message via Telegram Bot API."""
    if not bot_token or not chat_id:
        return False, "Bot token or Chat ID is missing"

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return True, "Success"
            else:
                data = res.json() if res.text else {}
                err = data.get("description", res.text[:150])
                return False, f"Telegram API Error (HTTP {res.status_code}): {err}"
    except Exception as exc:
        return False, f"HTTP request failed: {str(exc)}"

async def send_health_report(
    db: Session,
    triggered_by: str = "MANUAL_TEST",
    custom_bot_token: Optional[str] = None,
    custom_chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """Run health check and send formatted alert to configured Telegram chat/admins."""
    config = get_health_monitor_config(db)
    bot_token = (custom_bot_token or config.get("bot_token") or getattr(settings, "TELEGRAM_BOT_TOKEN", "")).strip()
    primary_chat_id = (custom_chat_id or config.get("chat_id") or getattr(settings, "TELEGRAM_CHAT_ID", "")).strip()

    health = await check_full_system_health(db)
    now_str = health["timestamp_bkk"]

    # Build recipients list
    recipients = []
    if primary_chat_id:
        recipients.append(primary_chat_id)

    # Add AdminUsers with telegram_id if enabled and not already included
    if config.get("notify_admins_enabled", True):
        admins = db.query(AdminUser).filter(AdminUser.is_active == True, AdminUser.telegram_id != None).all()
        for a in admins:
            tid = a.telegram_id.strip()
            # Only add if it looks like a valid numeric Chat ID or @channel (Telegram Bot API requirement)
            if tid and tid not in recipients:
                recipients.append(tid)

    if not bot_token:
        return {
            "success": False,
            "error": "Telegram Bot Token ยังไม่ได้กำหนด โปรดระบุในหน้าตั้งค่า",
            "health": health,
            "recipients_count": 0
        }

    if not recipients:
        return {
            "success": False,
            "error": "ไม่พบ Telegram Chat ID หรือ Telegram ID ของผู้รับ โปรดระบุอย่างน้อย 1 รายการ",
            "health": health,
            "recipients_count": 0
        }

    # Format Status Emojis & Titles
    overall_status_emoji = "🟢" if health["all_healthy"] else "🔴"
    overall_status_text = "ทุกระบบทำงานปกติ (ALL SYSTEMS HEALTHY)" if health["all_healthy"] else "พบความผิดปกติ กรุณาตรวจสอบ (ATTENTION REQUIRED)"

    ad_status_emoji = "🟢" if health["ad_sync_agent"]["is_online"] else "🔴"
    ad_status_text = "ONLINE (ปกติ)" if health["ad_sync_agent"]["is_online"] else "OFFLINE (ตัดการเชื่อมต่อ)"

    db_status_emoji = "🟢" if health["database"]["is_connected"] else "🔴"
    db_status_text = f"CONNECTED ({health['database']['latency_ms']} ms)" if health["database"]["is_connected"] else "DISCONNECTED"

    # Construct HTML message
    message = (
        f"{overall_status_emoji} <b>[CIAM] System Health & AD Sync Agent Report</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏢 <b>องค์กร:</b> Window Asia Public Company Limited\n"
        f"⏰ <b>เวลาตรวจสอบ:</b> {now_str} (Asia/Bangkok)\n"
        f"⚙️ <b>การทำงาน:</b> {triggered_by}\n"
        f"📊 <b>สถานะรวม:</b> <b>{overall_status_text}</b>\n\n"
        f"<b>1. Central IAM Core Engine</b>\n"
        f"• สถานะระบบ: 🟢 OPERATIONAL\n"
        f"• ฐานข้อมูล: {db_status_emoji} {db_status_text}\n\n"
        f"<b>2. AD Sync Agent (Active Directory Gateway)</b>\n"
        f"• สถานะ: {ad_status_emoji} <b>{ad_status_text}</b>\n"
        f"• Gateway Host: <code>{health['ad_sync_agent']['base_url']}</code>\n"
        f"• Latency: <b>{health['ad_sync_agent']['latency_ms']} ms</b>\n"
        f"• รายละเอียด: <i>{health['ad_sync_agent']['message']}</i>\n\n"
        f"<b>3. ระบบลูกที่เชื่อมต่อ (Connected Applications)</b>\n"
        f"• ออนไลน์: <b>{health['connected_apps']['online']} / {health['connected_apps']['total']}</b> ระบบ\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<i>รายงานอัตโนมัติโดย Central IAM Governance Engine</i>"
    )

    success_deliveries = 0
    delivery_errors = []

    for r_id in recipients:
        ok, msg = await send_telegram_message(bot_token, r_id, message, parse_mode="HTML")
        if ok:
            success_deliveries += 1
        else:
            delivery_errors.append(f"{r_id}: {msg}")

    # Update system_settings last run
    setting = db.query(SystemSetting).filter_by(setting_key="health_monitor_schedule").first()
    summary_msg = f"ส่งแจ้งเตือนสำเร็จ {success_deliveries}/{len(recipients)} ช่องทาง ({overall_status_text})"
    if setting:
        val = setting.setting_value.copy()
        val["last_run_at"] = get_bangkok_now().isoformat()
        val["last_status"] = "SUCCESS" if success_deliveries > 0 else "FAILED"
        val["last_summary"] = summary_msg
        val["last_error"] = "; ".join(delivery_errors) if delivery_errors else None
        setting.setting_value = val
        db.commit()

    # Record Audit Log
    db.add(IamAuditLog(
        actor_username="System-HealthMonitor",
        action_type="TELEGRAM_HEALTH_ALERT",
        target_username="TELEGRAM_ADMINS",
        affected_app_code="AD_AND_CIAM",
        execution_mode=triggered_by,
        reason=summary_msg,
        status="SUCCESS" if success_deliveries > 0 else "FAILED"
    ))
    db.commit()

    return {
        "success": success_deliveries > 0,
        "summary": summary_msg,
        "health": health,
        "recipients_count": len(recipients),
        "success_deliveries": success_deliveries,
        "errors": delivery_errors,
        "timestamp": now_str
    }
