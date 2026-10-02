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
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="SSO_CLIENT",
            message=f"SSO Access revoked centrally for '{username}' in {self.app_name} (User cannot authenticate via CIAM SSO)",
            execution_time_ms=1,
            details={"mode": "SSO_CLIENT_ONLY", "note": "Managed centrally via CIAM session invalidation"}
        )

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        action = "permitted" if is_active else "revoked"
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="SSO_CLIENT",
            message=f"SSO Access {action} centrally for '{username}' in {self.app_name}",
            execution_time_ms=1,
            details={"mode": "SSO_CLIENT_ONLY", "is_active": is_active}
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
        return {
            "application_name": self.app_name,
            "total_accounts": 0,
            "accounts": [],
            "mode": "SSO_CLIENT_ONLY",
            "message": "ระบบนี้เชื่อมต่อแบบ SSO Client Mode (On-Premise) บัญชีผู้ใช้จะถูกสร้างและจับคู่แบบ Just-In-Time (JIT) เมื่อพนักงานเข้าใช้งานผ่าน SSO"
        }
