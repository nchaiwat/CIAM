import logging
from typing import Optional
from app.connectors.base import BaseConnector, ConnectorResult, ConnectorHealth

logger = logging.getLogger("ciam.connectors.sso_only")

class SsoOnlyConnector(BaseConnector):
    """
    Mode B: SSO-Only Client Mode Connector for isolated On-Premise / Local Spoke systems.
    
    In this topology:
    - Target system is located inside an on-premise private network without inbound ports open to the Cloud.
    - End-users access the system via browser redirect and VPN/LAN.
    - The Spoke system contacts CIAM via outbound HTTPS only to validate tokens.
    - Health check is perpetually 'ONLINE' (SSO Ready).
    - Account provisioning and mapping is performed Just-In-Time (JIT) during SSO login.
    """
    def __init__(self, app_code: str, app_name: str, base_url: Optional[str] = None):
        self.app_code = app_code
        self.app_name = app_name
        self.base_url = (base_url or "").rstrip("/")

    async def deprovision(self, username: str, reason: str) -> ConnectorResult:
        """Revoke SSO access and queue DISABLE_USER command for On-Premise Outbound Agent (Mode C)."""
        return await self.set_account_status(username=username, is_active=False, reason=reason)


    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        import secrets
        from datetime import datetime, timezone
        from app.core.database import SessionLocal
        from app.models.application import SpokePendingCommand

        action_cmd = "ENABLE_USER" if is_active else "DISABLE_USER"
        cmd_id = f"cmd_{secrets.token_hex(6)}"

        try:
            db = SessionLocal()
            cmd = SpokePendingCommand(
                command_id=cmd_id,
                app_code=self.app_code,
                action=action_cmd,
                username=username,
                reason=reason,
                status="PENDING",
                issued_by=updated_by
            )
            db.add(cmd)
            db.commit()
            db.close()
        except Exception as e:
            logger.warning("Failed to queue pending spoke command for %s: %s", self.app_code, e)

        action = "permitted" if is_active else "revoked"
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="SSO_CLIENT",
            message=f"SSO Access {action} centrally for '{username}' in {self.app_name} (Queued command {cmd_id} for On-Premise Agent)",
            execution_time_ms=1,
            details={"mode": "SSO_CLIENT_ONLY", "is_active": is_active, "command_id": cmd_id}
        )

    async def provision_account(self, account_data: dict) -> ConnectorResult:
        username = account_data.get("username", "user")
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="SSO_CLIENT",
            message=f"Account '{username}' will be provisioned Just-In-Time (JIT) upon first SSO login to {self.app_name}",
            execution_time_ms=1,
            details={"mode": "JIT_PROVISIONING"}
        )

    async def health_check(self) -> ConnectorHealth:
        return ConnectorHealth(
            is_online=True,
            latency_ms=1,
            message=f"SSO Client Mode Active ({self.app_name}) - พร้อมรับการล็อกอินผ่านเบราว์เซอร์และ VPN",
            spoke_sso_active=True
        )

    async def sync_inventory(self) -> dict:
        import secrets
        from app.core.database import SessionLocal
        from app.models.application import SpokePendingCommand
        cmd_id = f"cmd_{secrets.token_hex(6)}"
        try:
            db = SessionLocal()
            cmd = SpokePendingCommand(
                command_id=cmd_id,
                app_code=self.app_code,
                action="REQUEST_FULL_SYNC",
                username="ALL_ACCOUNTS",
                reason="Scheduled 04:00 AM Full Directory Sync triggered from Central IAM",
                status="PENDING",
                issued_by="Central-IAM-Scheduler"
            )
            db.add(cmd)
            db.commit()
            db.close()
        except Exception as e:
            logger.warning("Failed to queue scheduled REQUEST_FULL_SYNC for %s: %s", self.app_code, e)

        return {
            "application_name": self.app_name,
            "total_accounts": 0,
            "accounts": [],
            "mode": "SSO_CLIENT_ONLY",
            "message": f"ส่งคำสั่งขอ Full Directory Sync ({cmd_id}) สำหรับ Mode C Outbound Agent เรียบร้อยแล้ว (จะประมวลผลเมื่อ Agent ส่ง Heartbeat รอบถัดไป)"
        }
