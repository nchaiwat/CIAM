import time
import logging
from typing import Optional, Dict, Any
import httpx
from datetime import datetime, timezone
from app.connectors.base import BaseConnector, ConnectorResult, ConnectorHealth
from app.core.config import settings

logger = logging.getLogger("ciam.connectors.pfsense")

class PfSenseConnector(BaseConnector):
    """
    Connector for pfSense Firewall & VPN Gateway via AD Sync Agent Security Proxy.
    Communicates with pfSense REST API for FreeRADIUS VPN management and Captive Portal control.
    """
    def __init__(self, app_code: str, base_url: str, api_key: str, origin_ip: Optional[str] = None):
        self.app_code = app_code
        self.base_url = (base_url or "http://172.18.0.1:3100/api/v1/pfsense/fac").rstrip("/")
        self.api_key = api_key or "mgmt_ciam_key_9a88b1c0d2e3f4a5"
        self.origin_ip = origin_ip or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153") or "157.173.219.153"

    def _get_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "X-Management-API-Key": self.api_key,
            "x-management-api-key": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "X-Request-Timestamp": str(int(datetime.now(timezone.utc).timestamp())),
            "X-Forwarded-For": self.origin_ip,
        }
        if extra:
            headers.update(extra)
        return headers

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        start_time = time.time()
        endpoint = f"{self.base_url}/users/{username}/status"
        headers = self._get_headers()
        payload = {
            "is_active": is_active,
            "reason": reason,
            "updated_by": updated_by
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.patch(endpoint, headers=headers, json=payload)
                elapsed = int((time.time() - start_time) * 1000)
                if response.status_code in [200, 204]:
                    resp_json = response.json() if response.text else {}
                    action_str = "เปิดใช้งานสิทธิ์ VPN" if is_active else "ระงับสิทธิ์ VPN และตัดเซสชัน Captive Portal"
                    msg = resp_json.get("message") or f"{action_str} สำหรับ '{username}' บน {self.app_code.upper()} สำเร็จ"
                    return ConnectorResult(
                        success=True,
                        status_code=response.status_code,
                        execution_mode="PFSENSE_REST",
                        message=msg,
                        execution_time_ms=elapsed,
                        details=resp_json
                    )
                else:
                    return ConnectorResult(
                        success=False,
                        status_code=response.status_code,
                        execution_mode="PFSENSE_REST",
                        message=f"pfSense error ({response.status_code}): {response.text[:200]}",
                        execution_time_ms=elapsed,
                        details={"response": response.text[:300]}
                    )
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            logger.warning("pfSense connector error for %s: %s", username, exc)
            if settings.SIMULATE_SPOKE_RESPONSES:
                action_str = "เปิดใช้งาน" if is_active else "ระงับสิทธิ์ VPN"
                return ConnectorResult(
                    success=True,
                    status_code=200,
                    execution_mode="PFSENSE_REST",
                    message=f"Simulated {action_str} '{username}' บน {self.app_code.upper()} (Gateway offline)",
                    execution_time_ms=elapsed,
                    details={"simulation": True}
                )
            return ConnectorResult(
                success=False,
                status_code=503,
                execution_mode="PFSENSE_REST",
                message=f"ไม่สามารถเชื่อมต่อไปยัง pfSense Gateway ({self.base_url}): {str(exc)[:100]}",
                execution_time_ms=elapsed
            )

    async def deprovision(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        return await self.set_account_status(username=username, is_active=False, reason=reason, updated_by=updated_by)

    async def sync_inventory(self, status: str = "all", department: Optional[str] = None, search: Optional[str] = None) -> dict:
        endpoint = f"{self.base_url}/users"
        headers = self._get_headers({"Accept": "application/json"})
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(endpoint, headers=headers)
                if response.status_code == 200:
                    return response.json()
        except Exception as exc:
            logger.warning("sync_inventory error for %s: %s", self.app_code, exc)
        return {"total_accounts": 0, "accounts": []}

    async def health_check(self) -> ConnectorHealth:
        start_time = time.time()
        endpoint = f"{self.base_url}/health"
        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(endpoint, headers=headers)
                elapsed = int((time.time() - start_time) * 1000)
                if response.status_code == 200:
                    return ConnectorHealth(
                        is_online=True,
                        latency_ms=elapsed,
                        message=f"pfSense Gateway Online ({elapsed}ms)",
                        spoke_sso_active=False
                    )
                return ConnectorHealth(
                    is_online=False,
                    latency_ms=elapsed,
                    message=f"Gateway HTTP {response.status_code}",
                    spoke_sso_active=False
                )
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            return ConnectorHealth(
                is_online=False,
                latency_ms=elapsed,
                message=f"Unreachable: {str(exc)[:60]}",
                spoke_sso_active=False
            )
