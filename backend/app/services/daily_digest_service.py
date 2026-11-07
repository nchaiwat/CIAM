import asyncio
import json
import logging
import smtplib
import time
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.models.setting import SystemSetting
from app.models.application import ConnectedApplication
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.user import AdminUser
from app.models.audit import IamAuditLog
from app.services.reconciliation import find_account_discrepancies
from app.connectors.ad_proxy import AdProxyConnector

logger = logging.getLogger("ciam.daily_digest")

BANGKOK_TZ = timezone(timedelta(hours=7))

DEFAULT_DIGEST_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "send_time": "07:00",
    "smtp_host": "smtp.office365.com",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_password": "",
    "use_tls": True,
    "from_email": "Window Asia Central IAM <ciam-alert@windowasia.com>",
    "recipients": [],
    "notify_admins_enabled": True,
    "last_run_at": None,
    "last_status": "IDLE",
    "last_summary": None,
    "last_error": None,
}


def get_bangkok_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(BANGKOK_TZ)


def calculate_next_digest_run(send_time_str: str, now_bkk: datetime) -> Optional[str]:
    """Calculate next run time based on send_time (e.g. 07:00)."""
    try:
        parts = send_time_str.split(":")
        target_h = int(parts[0])
        target_m = int(parts[1]) if len(parts) > 1 else 0

        next_run = now_bkk.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
        if next_run <= now_bkk:
            next_run += timedelta(days=1)
        return next_run.isoformat()
    except Exception as e:
        logger.warning("Error calculating next digest run: %s", e)
        return None


def get_daily_digest_config(db: Session, mask_password: bool = True) -> Dict[str, Any]:
    """Retrieve Daily Email Digest configuration from SystemSetting."""
    setting = db.query(SystemSetting).filter_by(setting_key="daily_email_digest_schedule").first()
    if not setting:
        config = DEFAULT_DIGEST_CONFIG.copy()
    else:
        config = {**DEFAULT_DIGEST_CONFIG, **setting.setting_value}

    now_bkk = get_bangkok_now()
    config["next_run_at"] = calculate_next_digest_run(config.get("send_time", "07:00"), now_bkk)

    raw_password = config.get("smtp_password", "") or ""
    config["has_password"] = bool(raw_password)

    if mask_password:
        if raw_password:
            config["smtp_password_masked"] = "******"
        else:
            config["smtp_password_masked"] = ""
        # Do not expose plain password when masked
        config["smtp_password"] = config["smtp_password_masked"]

    return config


def save_daily_digest_config(db: Session, update_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update Daily Email Digest configuration in SystemSetting."""
    setting = db.query(SystemSetting).filter_by(setting_key="daily_email_digest_schedule").first()
    current_val = dict(setting.setting_value) if (setting and setting.setting_value) else DEFAULT_DIGEST_CONFIG.copy()

    if "enabled" in update_data and update_data["enabled"] is not None:
        current_val["enabled"] = bool(update_data["enabled"])

    if "send_time" in update_data and update_data["send_time"]:
        parts = str(update_data["send_time"]).strip().split(":")
        if len(parts) >= 2 and 0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59:
            current_val["send_time"] = f"{int(parts[0]):02d}:{int(parts[1]):02d}"

    if "smtp_host" in update_data and update_data["smtp_host"] is not None:
        current_val["smtp_host"] = str(update_data["smtp_host"]).strip()

    if "smtp_port" in update_data and update_data["smtp_port"] is not None:
        try:
            current_val["smtp_port"] = int(update_data["smtp_port"])
        except (ValueError, TypeError):
            pass

    if "smtp_user" in update_data and update_data["smtp_user"] is not None:
        current_val["smtp_user"] = str(update_data["smtp_user"]).strip()

    # Password preservation if masked or blank
    if "smtp_password" in update_data:
        pwd = str(update_data["smtp_password"]).strip()
        if pwd and not pwd.startswith("***"):
            current_val["smtp_password"] = pwd

    if "use_tls" in update_data and update_data["use_tls"] is not None:
        current_val["use_tls"] = bool(update_data["use_tls"])

    if "from_email" in update_data and update_data["from_email"] is not None:
        current_val["from_email"] = str(update_data["from_email"]).strip()

    if "recipients" in update_data and update_data["recipients"] is not None:
        raw_recipients = update_data["recipients"]
        if isinstance(raw_recipients, list):
            current_val["recipients"] = [r.strip() for r in raw_recipients if r and "@" in r]
        elif isinstance(raw_recipients, str):
            current_val["recipients"] = [
                r.strip() for r in raw_recipients.replace(";", ",").split(",") if r.strip() and "@" in r
            ]

    if "notify_admins_enabled" in update_data and update_data["notify_admins_enabled"] is not None:
        current_val["notify_admins_enabled"] = bool(update_data["notify_admins_enabled"])

    if not setting:
        setting = SystemSetting(
            setting_key="daily_email_digest_schedule",
            setting_value=dict(current_val),
            description="Daily Security and Identity Digest Email Notification schedule and SMTP configuration"
        )
        db.add(setting)
    else:
        setting.setting_value = dict(current_val)
        flag_modified(setting, "setting_value")

    db.commit()
    db.refresh(setting)
    return get_daily_digest_config(db, mask_password=True)


async def collect_daily_digest_metrics(db: Session) -> Dict[str, Any]:
    """
    Collect comprehensive security, identity, and spoke health metrics
    from the Central IAM database for the daily executive digest.
    """
    now_bkk = get_bangkok_now()
    now_utc = datetime.now(timezone.utc)
    since_24h = now_utc - timedelta(hours=24)

    # 1. Identity & Directory KPI
    total_identities = db.query(MasterIdentity).count()
    active_ad = db.query(MasterIdentity).filter(MasterIdentity.is_active_in_ad == True).count()
    inactive_ad = total_identities - active_ad

    # Local accounts count
    local_accounts_count = db.query(MasterIdentity).filter(
        MasterIdentity.exception_type == "LOCAL_ACCOUNT"
    ).count()

    # 2. Ghost Accounts / Discrepancies
    discrepancies = find_account_discrepancies(db)
    ghost_accounts_data = []
    for d in discrepancies[:25]:  # limit to top 25 for email
        u_name = getattr(d, "username", None) or (d.get("username") if isinstance(d, dict) else "-")
        f_name = getattr(d, "full_name", None) or (d.get("full_name") if isinstance(d, dict) else "-")
        dept = getattr(d, "department", None) or (d.get("department") if isinstance(d, dict) else "-")
        app_n = getattr(d, "app_name", None) or (d.get("app_name") if isinstance(d, dict) else "ยังค้างในระบบลูก")
        ghost_accounts_data.append({
            "username": u_name,
            "full_name": f_name,
            "department": dept or "-",
            "ad_status": "🔴 ปิดใช้งานใน AD",
            "active_spokes": [app_n],
            "spokes_text": app_n
        })

    # 3. Connected Spoke Applications
    apps = db.query(ConnectedApplication).filter(ConnectedApplication.is_active == True).all()
    apps_data = []
    online_count = 0
    offline_count = 0
    break_glass_count = 0

    for a in apps:
        is_online = (a.health_status == "ONLINE")
        if is_online:
            online_count += 1
        else:
            offline_count += 1

        is_break_glass = (a.spoke_sso_status in ("BREAK_GLASS", "DISABLED"))
        if is_break_glass:
            break_glass_count += 1

        apps_data.append({
            "app_code": a.app_code,
            "app_name": a.app_name,
            "connector_type": a.connector_type,
            "health_status": a.health_status or "UNKNOWN",
            "spoke_sso_status": a.spoke_sso_status or "ACTIVE",
            "latency_ms": getattr(a, "last_latency_ms", None) or 0,
            "is_online": is_online,
            "is_break_glass": is_break_glass
        })

    # 4. AD Sync Agent Health Check
    ad_connector = AdProxyConnector()
    ad_health = await ad_connector.health_check()

    # 5. Daily Sync Schedule Result (from 04:00 AM)
    sync_setting = db.query(SystemSetting).filter_by(setting_key="sync_schedule").first()
    sync_summary = "ไม่มีประวัติการซิงก์"
    sync_status = "IDLE"
    sync_last_run = None
    if sync_setting and sync_setting.setting_value:
        sv = sync_setting.setting_value
        sync_summary = sv.get("last_summary") or "การซิงก์รอบอัตโนมัติสำเร็จ"
        sync_status = sv.get("last_status", "IDLE")
        sync_last_run = sv.get("last_run_at")

    # 6. Past 24-Hour Security Audit Events
    recent_offboardings = (
        db.query(IamAuditLog)
        .filter(
            IamAuditLog.action_type.in_(["DEPROVISION_USER", "DISPATCH_DEPROVISION"]),
            IamAuditLog.created_at >= since_24h
        )
        .order_by(desc(IamAuditLog.created_at))
        .all()
    )

    offboardings_data = []
    for ob in recent_offboardings:
        offboardings_data.append({
            "target_username": ob.target_username or "-",
            "actor": ob.actor_username or "System",
            "reason": ob.reason or "-",
            "status": ob.status or "SUCCESS",
            "timestamp": ob.created_at.strftime("%H:%M") if ob.created_at else "-"
        })

    # Recent Admin Setting modifications
    admin_actions_count = (
        db.query(IamAuditLog)
        .filter(
            IamAuditLog.created_at >= since_24h,
            (IamAuditLog.action_type.like("%ADMIN%") | IamAuditLog.action_type.like("%SETTING%"))
        )
        .count()
    )

    # 7. Risk Level Determination
    if len(discrepancies) > 0 or break_glass_count > 0 or not ad_health.is_online:
        risk_level = "HIGH"
        risk_label = "🔴 ระดับความเสี่ยงสูง (HIGH RISK / ATTENTION REQUIRED)"
        risk_color = "#dc2626"
    elif offline_count > 0 or sync_status in ("PARTIAL_ERROR", "FAILED"):
        risk_level = "MEDIUM"
        risk_label = "🟡 ควรตรวจสอบ (MEDIUM RISK / ATTENTION NEEDED)"
        risk_color = "#d97706"
    else:
        risk_level = "LOW"
        risk_label = "🟢 ทุกระบบปลอดภัยและสมบูรณ์ (LOW RISK / ALL CLEAR)"
        risk_color = "#16a34a"

    return {
        "report_date_thai": now_bkk.strftime("%d/%m/%Y"),
        "report_time_thai": now_bkk.strftime("%H:%M น."),
        "timestamp_bkk": now_bkk.strftime("%Y-%m-%d %H:%M:%S"),
        "risk_level": risk_level,
        "risk_label": risk_label,
        "risk_color": risk_color,
        "kpi": {
            "total_identities": total_identities,
            "active_ad": active_ad,
            "inactive_ad": inactive_ad,
            "local_accounts": local_accounts_count,
            "ghost_accounts_count": len(discrepancies),
            "connected_apps_total": len(apps),
            "connected_apps_online": online_count,
            "connected_apps_offline": offline_count,
            "break_glass_count": break_glass_count,
        },
        "ad_gateway": {
            "is_online": ad_health.is_online,
            "latency_ms": ad_health.latency_ms,
            "message": ad_health.message,
        },
        "ghost_accounts": ghost_accounts_data,
        "connected_apps": apps_data,
        "daily_sync": {
            "status": sync_status,
            "summary": sync_summary,
            "last_run": sync_last_run,
        },
        "past_24h_activity": {
            "offboardings_count": len(offboardings_data),
            "offboardings": offboardings_data,
            "admin_actions_count": admin_actions_count,
        }
    }


def render_daily_digest_html(metrics: Dict[str, Any]) -> str:
    """
    Render clean, responsive HTML email in Window Asia Corporate Deep Navy theme
    with KPI tiles, risk alerts, and clear tables.
    """
    kpi = metrics["kpi"]
    ghosts = metrics["ghost_accounts"]
    apps = metrics["connected_apps"]
    daily_sync = metrics["daily_sync"]
    past_24h = metrics["past_24h_activity"]
    ad_gw = metrics["ad_gateway"]

    # Ghost accounts rows
    ghost_rows = ""
    if ghosts:
        for g in ghosts:
            ghost_rows += f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">{g['username']}</td>
              <td style="padding: 10px 12px; color: #475569;">{g['full_name']}</td>
              <td style="padding: 10px 12px; color: #475569;">{g['department']}</td>
              <td style="padding: 10px 12px;">
                <span style="display: inline-block; background-color: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px;">
                  {g['spokes_text']}
                </span>
              </td>
            </tr>
            """
    else:
        ghost_rows = """
        <tr>
          <td colspan="4" style="padding: 16px; text-align: center; color: #16a34a; font-weight: 600; background-color: #f0fdf4;">
            ✓ ยอดเยี่ยม: ไม่พบบัญชีผีตกค้างในระบบลูก (Zero Ghost Accounts)
          </td>
        </tr>
        """

    # Spoke apps rows
    spoke_rows = ""
    for a in apps:
        status_badge = (
            '<span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">🟢 ONLINE</span>'
            if a['is_online'] else
            '<span style="background-color: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">🔴 OFFLINE</span>'
        )
        sso_badge = (
            '<span style="color: #64748b; font-size: 11px;">ปกติ</span>'
            if not a['is_break_glass'] else
            '<span style="background-color: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">⚠️ BREAK-GLASS</span>'
        )
        spoke_rows += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">{a['app_name']} <span style="font-size: 11px; color: #64748b; font-weight: normal;">({a['app_code']})</span></td>
          <td style="padding: 8px 12px; color: #64748b; font-size: 12px;">{a['connector_type']}</td>
          <td style="padding: 8px 12px;">{status_badge}</td>
          <td style="padding: 8px 12px;">{sso_badge}</td>
        </tr>
        """

    # Offboarding summary
    offboard_text = ""
    if past_24h["offboardings_count"] > 0:
        offboard_text = f"<p style='margin: 0 0 8px 0; color: #1e293b; font-size: 13px;'>มีการตัดสิทธิ์พนักงานรวม <strong>{past_24h['offboardings_count']}</strong> ท่านในรอบ 24 ชั่วโมงที่ผ่านมา:</p><ul style='margin: 0; padding-left: 20px; font-size: 12px; color: #475569;'>"
        for ob in past_24h["offboardings"][:5]:
            offboard_text += f"<li><strong>{ob['target_username']}</strong> ({ob['reason']}) โดย {ob['actor']} เวลา {ob['timestamp']}</li>"
        offboard_text += "</ul>"
    else:
        offboard_text = "<p style='margin: 0; color: #64748b; font-size: 13px;'>ไม่มีรายการตัดสิทธิ์พนักงานในรอบ 24 ชั่วโมงที่ผ่านมา</p>"

    html = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Central IAM Daily Security Digest</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 0;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); max-width: 640px; border: 1px solid #e2e8f0;">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%); padding: 24px 28px; text-align: left;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">
                          WINDOW ASIA PUBLIC COMPANY LIMITED
                        </span>
                        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                          Central IAM • Daily Security & Identity Digest
                        </h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">
                          รายงานสรุปสถานะความมั่นคงปลอดภัยประจำวันที่ {metrics['report_date_thai']} เวลา {metrics['report_time_thai']}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- OVERALL STATUS BANNER -->
              <tr>
                <td style="padding: 20px 28px 12px 28px;">
                  <div style="background-color: {metrics['risk_color']}15; border-left: 4px solid {metrics['risk_color']}; padding: 14px 18px; border-radius: 6px;">
                    <span style="font-size: 14px; font-weight: 800; color: {metrics['risk_color']}; display: block;">
                      {metrics['risk_label']}
                    </span>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">
                      สรุปผลการทำงานของระบบพิสูจน์ตัวตนกลาง สิทธิ์ของพนักงาน และระบบลูกข่ายทั้งหมด
                    </span>
                  </div>
                </td>
              </tr>

              <!-- KPI TILES (4 CARDS) -->
              <tr>
                <td style="padding: 8px 28px 16px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="25%" style="padding-right: 6px;">
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                          <div style="font-size: 22px; font-weight: 800; color: #0284c7;">{kpi['total_identities']}</div>
                          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">ตัวตนทั้งหมด</div>
                        </div>
                      </td>
                      <td width="25%" style="padding: 0 3px;">
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                          <div style="font-size: 22px; font-weight: 800; color: #16a34a;">{kpi['active_ad']}</div>
                          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">Active ใน AD</div>
                        </div>
                      </td>
                      <td width="25%" style="padding: 0 3px;">
                        <div style="background-color: {'#fee2e2' if kpi['ghost_accounts_count'] > 0 else '#f8fafc'}; border: 1px solid {'#fca5a5' if kpi['ghost_accounts_count'] > 0 else '#e2e8f0'}; border-radius: 8px; padding: 12px; text-align: center;">
                          <div style="font-size: 22px; font-weight: 800; color: {'#dc2626' if kpi['ghost_accounts_count'] > 0 else '#64748b'};">{kpi['ghost_accounts_count']}</div>
                          <div style="font-size: 11px; color: {'#991b1b' if kpi['ghost_accounts_count'] > 0 else '#64748b'}; font-weight: 600; margin-top: 2px;">บัญชีผีตกค้าง</div>
                        </div>
                      </td>
                      <td width="25%" style="padding-left: 6px;">
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                          <div style="font-size: 22px; font-weight: 800; color: #475569;">{kpi['connected_apps_online']}/{kpi['connected_apps_total']}</div>
                          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">ระบบลูกออนไลน์</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- SECTION: GHOST ACCOUNTS ALERT -->
              <tr>
                <td style="padding: 12px 28px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⚠️ การตรวจสอบบัญชีผีตกค้าง (Ghost Accounts / Discrepancies)
                  </h3>
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; text-align: left; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #f1f5f9; color: #475569; border-bottom: 1px solid #e2e8f0;">
                          <th style="padding: 8px 12px; font-weight: 700;">Username</th>
                          <th style="padding: 8px 12px; font-weight: 700;">ชื่อ-นามสกุล</th>
                          <th style="padding: 8px 12px; font-weight: 700;">แผนก</th>
                          <th style="padding: 8px 12px; font-weight: 700;">ระบบที่ยังค้างสิทธิ์</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ghost_rows}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- SECTION: SPOKE APPS & SYNC SUMMARY -->
              <tr>
                <td style="padding: 12px 28px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    🏢 ความพร้อมระบบลูกข่าย & สรุปการซิงก์รอบ 04:00 น.
                  </h3>
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 12px;">
                    <div style="color: #1e293b; font-weight: 600;">ผลการซิงก์รอบ 04:00 น.: <span style="font-weight: normal; color: #475569;">{daily_sync['summary']}</span></div>
                    <div style="color: #64748b; margin-top: 4px;">Active Directory Gateway: <span style="font-weight: 600; color: {'#16a34a' if ad_gw['is_online'] else '#dc2626'};">{'🟢 ONLINE' if ad_gw['is_online'] else '🔴 OFFLINE'}</span> ({ad_gw['latency_ms']} ms)</div>
                  </div>
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; text-align: left; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #f1f5f9; color: #475569; border-bottom: 1px solid #e2e8f0;">
                          <th style="padding: 8px 12px; font-weight: 700;">ระบบงาน (Spoke)</th>
                          <th style="padding: 8px 12px; font-weight: 700;">รูปแบบ</th>
                          <th style="padding: 8px 12px; font-weight: 700;">สถานะ</th>
                          <th style="padding: 8px 12px; font-weight: 700;">SSO Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spoke_rows}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- SECTION: PAST 24 HOURS SECURITY AUDIT -->
              <tr>
                <td style="padding: 12px 28px 20px 28px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    📋 การตัดสิทธิ์พนักงาน & ความเคลื่อนไหว 24 ชม.
                  </h3>
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                    {offboard_text}
                  </div>
                </td>
              </tr>

              <!-- CALL TO ACTION BUTTON -->
              <tr>
                <td style="padding: 10px 28px 28px 28px; text-align: center;">
                  <a href="https://ciam.windowasia.com" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                    🛡️ เปิดเข้าสู่ Central IAM Console
                  </a>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                  ระบบรายงานนี้ถูกสร้างขึ้นโดยอัตโนมัติจากเซิร์ฟเวอร์ Window Asia Central IAM<br>
                  เพื่อให้สอดคล้องกับมาตรฐานความมั่นคงปลอดภัย ISO 27001 และนโยบายการควบคุมสิทธิ์พนักงาน<br>
                  © 2026 Window Asia Public Company Limited. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return html


def _send_smtp_sync(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    use_tls: bool,
    from_email: str,
    recipients: List[str],
    subject: str,
    html_content: str,
    text_content: str
) -> Tuple[bool, str]:
    """Synchronous SMTP worker function intended to be run in asyncio.to_thread."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = ", ".join(recipients)

        part_text = MIMEText(text_content, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)

        server = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
        server.ehlo()

        if use_tls:
            server.starttls()
            server.ehlo()

        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)

        server.sendmail(from_email, recipients, msg.as_string())
        server.quit()
        return True, "Email sent successfully"
    except Exception as exc:
        err_msg = str(exc)
        logger.error("SMTP transmission error: %s", err_msg)
        return False, err_msg


async def send_daily_digest_email(
    db: Session,
    triggered_by: str = "MANUAL_TEST",
    custom_recipients: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Collect metrics, compose HTML email, and transmit via configured SMTP.
    Records comprehensive audit logs in IamAuditLog and updates SystemSetting status.
    """
    config = get_daily_digest_config(db, mask_password=False)
    smtp_host = config.get("smtp_host", "smtp.office365.com").strip()
    smtp_port = int(config.get("smtp_port", 587))
    smtp_user = config.get("smtp_user", "").strip()
    smtp_password = config.get("smtp_password", "").strip()
    use_tls = bool(config.get("use_tls", True))
    from_email = config.get("from_email", "Window Asia Central IAM <ciam-alert@windowasia.com>").strip()

    # Build recipients list
    recipients: List[str] = []
    if custom_recipients:
        recipients = [r.strip() for r in custom_recipients if r and "@" in r]
    else:
        recipients = [r.strip() for r in config.get("recipients", []) if r and "@" in r]

    # Add AdminUsers with email if enabled
    if config.get("notify_admins_enabled", True):
        admins = db.query(AdminUser).filter(AdminUser.is_active == True, AdminUser.email != None).all()
        for a in admins:
            em = (a.email or "").strip()
            if em and "@" in em and em not in recipients:
                recipients.append(em)

    now_bkk = get_bangkok_now()
    now_iso = now_bkk.isoformat()

    # Pre-validation
    if not smtp_host:
        return {
            "success": False,
            "error": "SMTP Host ยังไม่ได้กำหนด โปรดระบุในหน้าตั้งค่า",
            "recipients_count": len(recipients),
            "timestamp": now_iso
        }

    if not recipients:
        return {
            "success": False,
            "error": "ไม่พบอีเมลผู้รับ โปรดระบุอีเมลผู้รับอย่างน้อย 1 รายการ",
            "recipients_count": 0,
            "timestamp": now_iso
        }

    # Collect metrics & render HTML
    metrics = await collect_daily_digest_metrics(db)
    html_content = render_daily_digest_html(metrics)

    risk_label = metrics["risk_level"]
    ghost_count = metrics["kpi"]["ghost_accounts_count"]
    subject = f"[{risk_label}] Central IAM Daily Security Digest • {metrics['report_date_thai']} (พบ {ghost_count} บัญชีผี)"

    text_fallback = (
        f"Central IAM Daily Security Digest - {metrics['report_date_thai']}\n"
        f"สถานะ: {metrics['risk_label']}\n"
        f"ตัวตนทั้งหมด: {metrics['kpi']['total_identities']} | Active AD: {metrics['kpi']['active_ad']} | บัญชีผี: {ghost_count}\n"
        f"ระบบลูกออนไลน์: {metrics['kpi']['connected_apps_online']}/{metrics['kpi']['connected_apps_total']}\n"
        f"เข้าใช้งานคอนโซล: https://ciam.windowasia.com\n"
    )

    # Transmit via thread pool
    success, message = await asyncio.to_thread(
        _send_smtp_sync,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        use_tls=use_tls,
        from_email=from_email,
        recipients=recipients,
        subject=subject,
        html_content=html_content,
        text_content=text_fallback
    )

    summary_text = (
        f"ส่ง Daily Digest ไปยัง {len(recipients)} ผู้รับสำเร็จ ({', '.join(recipients[:3])})"
        if success else
        f"ส่ง Daily Digest ล้มเหลว: {message}"
    )

    # 1. Immutable Audit Log for Admin visibility
    db.add(IamAuditLog(
        actor_username=triggered_by,
        action_type="DAILY_EMAIL_DIGEST",
        target_username=", ".join(recipients[:5]),
        affected_app_code="CIAM_MAILER",
        execution_mode="SCHEDULED_OR_MANUAL",
        reason=summary_text,
        details=json.dumps({
            "success": success,
            "recipients_count": len(recipients),
            "recipients": recipients,
            "smtp_host": smtp_host,
            "risk_level": metrics["risk_level"],
            "ghost_count": ghost_count,
            "message": message,
            "triggered_by": triggered_by
        }, ensure_ascii=False),
        status="SUCCESS" if success else "FAILED"
    ))

    # 2. Update SystemSetting status
    setting = db.query(SystemSetting).filter_by(setting_key="daily_email_digest_schedule").first()
    if setting:
        val = dict(setting.setting_value)
        val["last_run_at"] = now_iso
        val["last_status"] = "SUCCESS" if success else "FAILED"
        val["last_summary"] = summary_text
        val["last_error"] = None if success else message
        val["last_run_date"] = now_bkk.strftime("%Y-%m-%d")
        setting.setting_value = val
        flag_modified(setting, "setting_value")

    db.commit()

    return {
        "success": success,
        "message": summary_text,
        "recipients_count": len(recipients),
        "recipients": recipients,
        "risk_level": metrics["risk_level"],
        "ghost_accounts_count": ghost_count,
        "timestamp": now_iso,
        "error": None if success else message
    }
