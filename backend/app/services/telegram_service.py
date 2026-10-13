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
    from sqlalchemy.orm.attributes import flag_modified
    setting = db.query(SystemSetting).filter_by(setting_key="health_monitor_schedule").first()
    current_val = dict(setting.setting_value) if (setting and setting.setting_value) else DEFAULT_HEALTH_MONITOR.copy()

    if "enabled" in update_data and update_data["enabled"] is not None:
        current_val["enabled"] = bool(update_data["enabled"])
    if "start_time" in update_data and update_data["start_time"]:
        parts = str(update_data["start_time"]).strip().split(":")
        if len(parts) >= 2 and 0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59:
            current_val["start_time"] = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    if "interval_hours" in update_data and update_data["interval_hours"] is not None:
        try:
            val = int(update_data["interval_hours"])
            if val in [1, 2, 4, 6, 8, 12, 24]:
                current_val["interval_hours"] = val
        except (ValueError, TypeError):
            pass
    if "bot_token" in update_data and update_data["bot_token"] is not None:
        current_val["bot_token"] = str(update_data["bot_token"]).strip()
    if "chat_id" in update_data and update_data["chat_id"] is not None:
        current_val["chat_id"] = str(update_data["chat_id"]).strip()
    if "notify_admins_enabled" in update_data and update_data["notify_admins_enabled"] is not None:
        current_val["notify_admins_enabled"] = bool(update_data["notify_admins_enabled"])

    if not setting:
        setting = SystemSetting(
            setting_key="health_monitor_schedule",
            setting_value=dict(current_val),
            description="Telegram Health Monitor and AD Sync Agent periodic alert configuration"
        )
        db.add(setting)
    else:
        setting.setting_value = dict(current_val)
        flag_modified(setting, "setting_value")

    db.commit()
    db.refresh(setting)
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
        val = dict(setting.setting_value) if setting.setting_value else {}
        val["last_run_at"] = get_bangkok_now().isoformat()
        val["last_status"] = "SUCCESS" if success_deliveries > 0 else "FAILED"
        val["last_summary"] = summary_msg
        val["last_error"] = "; ".join(delivery_errors) if delivery_errors else None
        setting.setting_value = val
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(setting, "setting_value")
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


# =========================================================
# Real-Time AD Sync Agent Status Monitoring & Hourly Alerts
# =========================================================

DEFAULT_AD_MONITOR: Dict[str, Any] = {
    "current_status": "ONLINE",
    "is_online": True,
    "offline_since": None,
    "last_notified_at": None,
    "total_offline_alerts_sent": 0,
    "last_check_at": None,
    "last_latency_ms": 0,
    "last_message": "พร้อมใช้งาน",
}

def format_duration(seconds: float) -> str:
    """Format elapsed seconds into readable Thai string (e.g., '1 ชั่วโมง 15 นาที')."""
    secs = int(max(0, seconds))
    days = secs // 86400
    hours = (secs % 86400) // 3600
    minutes = (secs % 3600) // 60
    parts = []
    if days > 0:
        parts.append(f"{days} วัน")
    if hours > 0:
        parts.append(f"{hours} ชั่วโมง")
    if minutes > 0 or not parts:
        parts.append(f"{minutes} นาที")
    return " ".join(parts)

def get_ad_monitor_status(db: Session) -> Dict[str, Any]:
    """Retrieve current AD Sync Agent monitor state."""
    setting = db.query(SystemSetting).filter_by(setting_key="ad_status_monitor").first()
    if not setting or not setting.setting_value:
        return DEFAULT_AD_MONITOR.copy()
    return {**DEFAULT_AD_MONITOR, **setting.setting_value}

async def send_ad_status_alert(
    db: Session,
    alert_type: str,  # "OFFLINE_IMMEDIATE", "OFFLINE_REMINDER", "ONLINE_RECOVERED"
    ad_health_message: str = "",
    ad_base_url: str = "http://172.18.0.1:3100",
    latency_ms: int = 0,
    downtime_str: str = "",
    total_alerts_sent: int = 1,
    custom_bot_token: Optional[str] = None,
    custom_chat_id: Optional[str] = None
) -> Tuple[bool, str, int]:
    """Send dedicated Telegram alert for AD Sync Agent status changes and hourly reminders."""
    config = get_health_monitor_config(db)
    bot_token = (custom_bot_token or config.get("bot_token") or getattr(settings, "TELEGRAM_BOT_TOKEN", "")).strip()
    primary_chat_id = (custom_chat_id or config.get("chat_id") or getattr(settings, "TELEGRAM_CHAT_ID", "")).strip()

    recipients = []
    if primary_chat_id:
        recipients.append(primary_chat_id)

    if config.get("notify_admins_enabled", True):
        admins = db.query(AdminUser).filter(AdminUser.is_active == True, AdminUser.telegram_id != None).all()
        for a in admins:
            tid = a.telegram_id.strip()
            if tid and tid not in recipients:
                recipients.append(tid)

    if not bot_token:
        return False, "Bot token missing", 0
    if not recipients:
        return False, "No recipient chat IDs configured", 0

    now_str = get_bangkok_now().strftime("%d/%m/%Y %H:%M:%S")

    if alert_type == "OFFLINE_IMMEDIATE":
        title = "🚨 <b>[CIAM ALERT] AD Sync Agent หลุดการเชื่อมต่อ (OFFLINE)</b>"
        body = (
            f"{title}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 <b>องค์กร:</b> Window Asia Public Company Limited\n"
            f"⏰ <b>เวลาตรวจพบ:</b> {now_str} (Asia/Bangkok)\n"
            f"🔌 <b>สถานะ:</b> 🔴 <b>OFFLINE (ตัดการเชื่อมต่อทันที)</b>\n"
            f"🌐 <b>Gateway Host:</b> <code>{ad_base_url}</code>\n"
            f"⚠️ <b>สาเหตุ/ข้อผิดพลาด:</b> <i>{ad_health_message or 'ไม่สามารถเชื่อมต่อ AD Proxy ได้'}</i>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📢 <b>หมายเหตุระบบ:</b> Central IAM จะส่งการแจ้งเตือนเตือนซ้ำทุกๆ 1 ชั่วโมง จนกว่า AD จะกลับมา ONLINE"
        )
    elif alert_type == "OFFLINE_REMINDER":
        title = f"⚠️ <b>[CIAM REMINDER] AD Sync Agent ยังคง OFFLINE (เตือนรอบที่ {total_alerts_sent})</b>"
        body = (
            f"{title}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 <b>องค์กร:</b> Window Asia Public Company Limited\n"
            f"⏰ <b>เวลาแจ้งเตือน:</b> {now_str} (Asia/Bangkok)\n"
            f"⏱️ <b>ขัดข้องต่อเนื่องแล้ว:</b> <b>{downtime_str}</b>\n"
            f"🔌 <b>สถานะ:</b> 🔴 <b>OFFLINE (ยังไม่สามารถติดต่อได้)</b>\n"
            f"🌐 <b>Gateway Host:</b> <code>{ad_base_url}</code>\n"
            f"⚠️ <b>ข้อความล่าสุด:</b> <i>{ad_health_message or 'Unreachable'}</i>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📢 <i>ระบบจะยังคงแจ้งเตือนทุก 1 ชั่วโมง จนกว่า AD จะกลับมาเชื่อมต่อได้ตามปกติ</i>"
        )
    elif alert_type == "ONLINE_RECOVERED":
        title = "✅ <b>[CIAM RECOVERY] AD Sync Agent กลับมา ONLINE ปกติแล้ว</b>"
        body = (
            f"{title}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 <b>องค์กร:</b> Window Asia Public Company Limited\n"
            f"⏰ <b>เวลากู้คืนสำเร็จ:</b> {now_str} (Asia/Bangkok)\n"
            f"⏱️ <b>รวมระยะเวลาที่ขัดข้อง:</b> <b>{downtime_str}</b>\n"
            f"🔌 <b>สถานะปัจจุบัน:</b> 🟢 <b>ONLINE (เชื่อมต่อสำเร็จ)</b>\n"
            f"⚡ <b>Latency:</b> <b>{latency_ms} ms</b>\n"
            f"🌐 <b>Gateway Host:</b> <code>{ad_base_url}</code>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👍 <i>ระบบกลับสู่สภาวะปกติ การยืนยันตัวตนและการซิงก์ข้อมูล AD พร้อมใช้งานแล้ว</i>"
        )
    else:
        title = f"ℹ️ <b>[CIAM] การทดสอบระบบแจ้งเตือน AD Sync Agent ({alert_type})</b>"
        body = f"{title}\n⏰ <b>เวลา:</b> {now_str}\n<i>ทดสอบการส่งสัญญาณแจ้งเตือนระบบ AD สำเร็จ</i>"

    success_deliveries = 0
    for r_id in recipients:
        ok, _ = await send_telegram_message(bot_token, r_id, body, parse_mode="HTML")
        if ok:
            success_deliveries += 1

    # Record Audit Log
    db.add(IamAuditLog(
        actor_username="System-AdMonitor",
        action_type=f"TELEGRAM_AD_{alert_type}",
        target_username="TELEGRAM_ADMINS",
        affected_app_code="AD",
        execution_mode="REALTIME_MONITOR",
        reason=f"ส่งแจ้งเตือนสถานะ AD ({alert_type}) สำเร็จ {success_deliveries}/{len(recipients)} ช่องทาง",
        status="SUCCESS" if success_deliveries > 0 else "FAILED"
    ))
    db.commit()

    return success_deliveries > 0, f"Delivered to {success_deliveries}/{len(recipients)}", success_deliveries

async def check_and_notify_ad_status(db: Session, force_check: bool = False) -> Dict[str, Any]:
    """
    Core Real-Time AD Monitor Engine:
    - Probes AD Sync Agent health
    - If status changes to OFF -> Immediately notify Telegram
    - If status remains OFF -> Remind every 1 hour (3600 seconds)
    - If status recovers to ON -> Immediately notify recovery with downtime summary
    - Persists state in SystemSetting: 'ad_status_monitor'
    """
    from sqlalchemy.orm.attributes import flag_modified
    now_bkk = get_bangkok_now()
    now_iso = now_bkk.isoformat()

    setting = db.query(SystemSetting).filter_by(setting_key="ad_status_monitor").first()
    if not setting:
        state = DEFAULT_AD_MONITOR.copy()
        setting = SystemSetting(
            setting_key="ad_status_monitor",
            setting_value=state,
            description="Real-time Active Directory status monitor and hourly alert tracker"
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    else:
        state = {**DEFAULT_AD_MONITOR, **(setting.setting_value or {})}

    ad_connector = AdProxyConnector()
    ad_health = await ad_connector.health_check()
    is_online = bool(ad_health.is_online)

    prev_status = state.get("current_status", "ONLINE")
    prev_offline_since = state.get("offline_since")
    prev_last_notified = state.get("last_notified_at")
    total_alerts = int(state.get("total_offline_alerts_sent", 0))

    alert_sent = False
    alert_type = None

    if not is_online:
        # Case 1: Just transitioned to OFFLINE
        if prev_status != "OFFLINE":
            state["current_status"] = "OFFLINE"
            state["is_online"] = False
            state["offline_since"] = now_iso
            state["last_notified_at"] = now_iso
            state["total_offline_alerts_sent"] = 1
            alert_type = "OFFLINE_IMMEDIATE"

            logger.warning("AD Sync Agent transitioned to OFFLINE! Sending immediate Telegram alert...")
            await send_ad_status_alert(
                db=db,
                alert_type="OFFLINE_IMMEDIATE",
                ad_health_message=ad_health.message,
                ad_base_url=ad_connector.base_url,
                latency_ms=ad_health.latency_ms,
                downtime_str="เพิ่งเริ่มขัดข้อง",
                total_alerts_sent=1
            )
            alert_sent = True
        else:
            # Case 2: Still OFFLINE - check 1-hour interval (3,600s)
            should_remind = False
            if prev_last_notified:
                try:
                    last_notified_dt = datetime.fromisoformat(prev_last_notified).astimezone(BANGKOK_TZ)
                    elapsed_secs = (now_bkk - last_notified_dt).total_seconds()
                    if elapsed_secs >= 3600:
                        should_remind = True
                except Exception:
                    should_remind = True
            else:
                should_remind = True

            if should_remind:
                total_alerts += 1
                state["last_notified_at"] = now_iso
                state["total_offline_alerts_sent"] = total_alerts
                alert_type = "OFFLINE_REMINDER"

                # Calculate cumulative downtime
                downtime_secs = 0
                if prev_offline_since:
                    try:
                        off_dt = datetime.fromisoformat(prev_offline_since).astimezone(BANGKOK_TZ)
                        downtime_secs = (now_bkk - off_dt).total_seconds()
                    except Exception:
                        pass
                downtime_str = format_duration(downtime_secs) if downtime_secs > 0 else "1 ชั่วโมง"

                logger.warning("AD Sync Agent remains OFFLINE (Round %d). Sending hourly reminder...", total_alerts)
                await send_ad_status_alert(
                    db=db,
                    alert_type="OFFLINE_REMINDER",
                    ad_health_message=ad_health.message,
                    ad_base_url=ad_connector.base_url,
                    latency_ms=ad_health.latency_ms,
                    downtime_str=downtime_str,
                    total_alerts_sent=total_alerts
                )
                alert_sent = True

    else:
        # Case 3: Transitioned back to ONLINE from OFFLINE
        if prev_status == "OFFLINE":
            downtime_secs = 0
            if prev_offline_since:
                try:
                    off_dt = datetime.fromisoformat(prev_offline_since).astimezone(BANGKOK_TZ)
                    downtime_secs = (now_bkk - off_dt).total_seconds()
                except Exception:
                    pass
            downtime_str = format_duration(downtime_secs) if downtime_secs > 0 else "ไม่เกิน 1 นาที"

            state["current_status"] = "ONLINE"
            state["is_online"] = True
            state["offline_since"] = None
            state["last_notified_at"] = now_iso
            state["total_offline_alerts_sent"] = 0
            alert_type = "ONLINE_RECOVERED"

            logger.info("AD Sync Agent RECOVERED to ONLINE! Downtime: %s. Sending recovery notification...", downtime_str)
            await send_ad_status_alert(
                db=db,
                alert_type="ONLINE_RECOVERED",
                ad_health_message=ad_health.message,
                ad_base_url=ad_connector.base_url,
                latency_ms=ad_health.latency_ms,
                downtime_str=downtime_str,
                total_alerts_sent=0
            )
            alert_sent = True
        else:
            state["current_status"] = "ONLINE"
            state["is_online"] = True

    state["last_check_at"] = now_iso
    state["last_latency_ms"] = ad_health.latency_ms
    state["last_message"] = ad_health.message

    setting.setting_value = dict(state)
    flag_modified(setting, "setting_value")
    db.commit()

    return {
        "status": state["current_status"],
        "is_online": is_online,
        "alert_sent": alert_sent,
        "alert_type": alert_type,
        "state": state
    }

async def trigger_test_ad_alert(
    db: Session,
    alert_type: str = "OFFLINE_IMMEDIATE",
    custom_bot_token: Optional[str] = None,
    custom_chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """Manually test AD status alert format and delivery to Telegram."""
    connector = AdProxyConnector()
    ok, msg, count = await send_ad_status_alert(
        db=db,
        alert_type=alert_type,
        ad_health_message="[ทดสอบ] การจำลองสถานะการขัดข้อง AD Sync Agent",
        ad_base_url=connector.base_url,
        latency_ms=12,
        downtime_str="1 ชั่วโมง 0 นาที",
        total_alerts_sent=1,
        custom_bot_token=custom_bot_token,
        custom_chat_id=custom_chat_id
    )
    return {
        "success": ok,
        "message": msg,
        "recipients_delivered": count,
        "alert_type": alert_type
    }
