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
        default_base = "http://172.18.0.1:3100/api/v1/pfsense/ho" if "ho" in app_code.lower() else "http://172.18.0.1:3100/api/v1/pfsense/fac"
        self.base_url = (base_url or default_base).rstrip("/")
        self.api_key = api_key or "mgmt_ciam_key_9a88b1c0d2e3f4a5"
        self.origin_ip = origin_ip or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153") or "157.173.219.153"

    def _get_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "X-Management-API-Key": self.api_key,
            "x-management-api-key": self.api_key,
            "X-Spoke-API-Key": self.api_key,
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
        headers = self._get_headers()
        payload = {
            "is_active": is_active,
            "reason": reason,
            "updated_by": updated_by
        }

        # Try CIAM standard endpoint first, then native pfSense-pkg-RESTAPI endpoint
        endpoints_to_try = [
            (f"{self.base_url}/users/{username}/status", "PATCH", payload),
            (f"{self.base_url}/api/v1/user", "PATCH", {"username": username, "disabled": not is_active}),
            (f"{self.base_url}/user", "PATCH", {"username": username, "disabled": not is_active}),
        ]

        try:
            async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
                for endpoint, method, req_payload in endpoints_to_try:
                    try:
                        response = await client.request(method, endpoint, headers=headers, json=req_payload)
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
                        elif response.status_code == 404:
                            continue  # Try next candidate endpoint
                        else:
                            return ConnectorResult(
                                success=False,
                                status_code=response.status_code,
                                execution_mode="PFSENSE_REST",
                                message=f"pfSense error ({response.status_code}): {response.text[:200]}",
                                execution_time_ms=elapsed,
                                details={"response": response.text[:300]}
                            )
                    except httpx.HTTPStatusError:
                        continue
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
                message=f"ไม่สามารถเชื่อมต่อไปยัง pfSense ({self.base_url}): {str(exc)[:100]}",
                execution_time_ms=elapsed
            )

        elapsed = int((time.time() - start_time) * 1000)
        return ConnectorResult(
            success=False,
            status_code=404,
            execution_mode="PFSENSE_REST",
            message=f"ไม่พบบัญชีผู้ใช้ '{username}' บน {self.app_code.upper()}",
            execution_time_ms=elapsed
        )

    async def deprovision(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        return await self.set_account_status(username=username, is_active=False, reason=reason, updated_by=updated_by)

    async def sync_inventory(self, status: str = "all", department: Optional[str] = None, search: Optional[str] = None) -> dict:
        base = self.base_url.rstrip("/")
        candidates = [
            base if base.endswith("/users") else f"{base}/users",
            f"{base}/api/v1/user",
            f"{base}/api/v1/users",
            f"{base}/user",
            base,
        ]
        headers = self._get_headers({"Accept": "application/json"})
        try:
            async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
                for endpoint in candidates:
                    try:
                        response = await client.get(endpoint, headers=headers)
                        if response.status_code == 200:
                            data = response.json()
                            # Normalize different response shapes
                            if isinstance(data, dict):
                                if "accounts" in data and isinstance(data["accounts"], list):
                                    return data
                                elif "data" in data and isinstance(data["data"], list):
                                    raw_list = data["data"]
                                else:
                                    raw_list = []
                            elif isinstance(data, list):
                                raw_list = data
                            else:
                                raw_list = []

                            norm_accounts = []
                            for it in raw_list:
                                if not isinstance(it, dict):
                                    continue
                                u_name = it.get("username") or it.get("name") or it.get("sAMAccountName")
                                if not u_name:
                                    continue
                                is_act = it.get("is_active") if "is_active" in it else not it.get("disabled", False)
                                f_name = it.get("full_name") or it.get("descr") or it.get("name") or u_name
                                grp = it.get("group_name") or it.get("scope") or "VPN_USER"
                                norm_accounts.append({
                                    "username": u_name,
                                    "full_name": f_name,
                                    "is_active": is_act,
                                    "email": None,
                                    "department": None,
                                    "group_name": grp
                                })
                            return {
                                "total_accounts": len(norm_accounts),
                                "accounts": norm_accounts
                            }
                    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                        logger.info("pfSense host unreachable (%s): %s", endpoint, exc)
                        break
                    except Exception:
                        continue
        except Exception as exc:
            logger.warning("sync_inventory error for %s: %s", self.app_code, exc)
        return {"total_accounts": 0, "accounts": []}

    async def health_check(self) -> ConnectorHealth:
        start_time = time.time()
        base = self.base_url.rstrip("/")
        candidates = [
            base if base.endswith("/users") else f"{base}/users",
            f"{base}/health",
            f"{base}/api/v1/system/status",
            f"{base}/api/v1/status",
            f"{base}/api/v1/user",
            f"{base}/user",
            "http://172.18.0.1:3100/api/v1/pfsense/health",
        ]
        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                for endpoint in candidates:
                    try:
                        response = await client.get(endpoint, headers=headers)
                        elapsed = int((time.time() - start_time) * 1000)
                        if response.status_code in [200, 204]:
                            return ConnectorHealth(
                                is_online=True,
                                latency_ms=elapsed,
                                message=f"pfSense Online ({elapsed}ms)",
                                spoke_sso_active=False
                            )
                        elif response.status_code == 401:
                            return ConnectorHealth(
                                is_online=True,
                                latency_ms=elapsed,
                                message=f"pfSense Online (HTTP 401 - ต้องตรวจสอบ API Key)",
                                spoke_sso_active=False
                            )
                    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                        elapsed = int((time.time() - start_time) * 1000)
                        return ConnectorHealth(
                            is_online=False,
                            latency_ms=elapsed,
                            message=f"Unreachable: {str(exc)[:60]}",
                            spoke_sso_active=False
                        )
                    except Exception:
                        continue
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            return ConnectorHealth(
                is_online=False,
                latency_ms=elapsed,
                message=f"Unreachable: {str(exc)[:60]}",
                spoke_sso_active=False
            )

        elapsed = int((time.time() - start_time) * 1000)
        return ConnectorHealth(
            is_online=False,
            latency_ms=elapsed,
            message=f"pfSense ไม่ตอบรับ ({self.base_url})",
            spoke_sso_active=False
        )
