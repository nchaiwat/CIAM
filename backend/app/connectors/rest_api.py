import time
import logging
from typing import Optional, Dict, Any
import httpx
from datetime import datetime, timezone
from app.connectors.base import BaseConnector, ConnectorResult, ConnectorHealth
from app.core.config import settings

logger = logging.getLogger("ciam.connectors.rest")

class RestApiConnector(BaseConnector):
    def __init__(self, app_code: str, base_url: str, api_key: str):
        self.app_code = app_code
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key or ""

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        start_time = time.time()
        endpoint = f"{self.base_url}/api/v1/directory/accounts/{username}/status"
        headers = {
            "Content-Type": "application/json",
            "X-Management-API-Key": self.api_key,
            "X-Request-Timestamp": str(int(datetime.now(timezone.utc).timestamp()))
        }
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
                    action_str = "activated" if is_active else "disabled"
                    msg = resp_json.get("message") or f"Successfully {action_str} account '{username}' in {self.app_code.upper()} via REST API"
                    return ConnectorResult(
                        success=True,
                        status_code=response.status_code,
                        execution_mode="SYNC_REST",
                        message=msg,
                        execution_time_ms=elapsed,
                        details=resp_json
                    )
                elif response.status_code == 404:
                    logger.info("Spoke %s: user %s does not exist on target app.", self.app_code, username)
                    return ConnectorResult(
                        success=True,
                        status_code=200,
                        execution_mode="SYNC_REST",
                        message=f"Account {username} does not exist in {self.app_code.upper()} (No access to revoke)",
                        execution_time_ms=elapsed,
                        details={"spoke_response": response.text[:200]}
                    )
                elif response.status_code == 403 and settings.SIMULATE_SPOKE_RESPONSES:
                    logger.warning("Spoke %s IP Whitelist blocked (%s). Simulating development response.", self.app_code, response.text[:100])
                    return ConnectorResult(
                        success=True,
                        status_code=200,
                        execution_mode="SYNC_REST",
                        message=f"Simulated REST 200 OK (IP Whitelist {response.text[:60]}): Updated {username} in {self.app_code.upper()}",
                        execution_time_ms=elapsed,
                        details={"simulation": True, "note": "Add current IP to IRM Whitelist in production"}
                    )
                else:
                    return ConnectorResult(
                        success=False,
                        status_code=response.status_code,
                        execution_mode="SYNC_REST",
                        message=f"Failed with HTTP {response.status_code}: {response.text[:200]}",
                        execution_time_ms=elapsed,
                        details={"spoke_response": response.text[:500]}
                    )
        except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
            elapsed = int((time.time() - start_time) * 1000)
            # Simulated development success only if base_url is explicitly not an HTTP(S) endpoint or is a simulated mock
            if not self.base_url.startswith("http://") and not self.base_url.startswith("https://"):
                logger.info("Spoke %s simulated REST status update for %s", self.app_code, username)
                return ConnectorResult(
                    success=True,
                    status_code=200,
                    execution_mode="SYNC_REST",
                    message=f"Simulated REST 200 OK: Updated account {username} in {self.app_code.upper()}",
                    execution_time_ms=elapsed or 45,
                    details={"simulation": True, "target_endpoint": endpoint}
                )

            return ConnectorResult(
                success=False,
                status_code=503,
                execution_mode="SYNC_REST",
                message=f"Connection error to {self.app_code}: {str(exc)}",
                execution_time_ms=elapsed
            )

    async def deprovision(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        """Deactivate or disable user account in target spoke application according to Spec Section 3.2."""
        return await self.set_account_status(
            username=username,
            is_active=False,
            reason=reason,
            updated_by=updated_by
        )

    async def provision_account(self, account_data: dict) -> ConnectorResult:
        """Create/provision new user account according to Spec Section 3.3."""
        start_time = time.time()
        endpoint = f"{self.base_url}/api/v1/directory/accounts"
        headers = {
            "Content-Type": "application/json",
            "X-Management-API-Key": self.api_key,
            "X-Request-Timestamp": str(int(datetime.now(timezone.utc).timestamp()))
        }
        payload = {
            "username": account_data.get("username"),
            "full_name": account_data.get("full_name"),
            "email": account_data.get("email"),
            "department": account_data.get("department"),
            "group_name": account_data.get("group_name"),
            "use_ad_auth": account_data.get("use_ad_auth", True),
            "created_by": account_data.get("created_by", "Central-IAM-Service")
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
                elapsed = int((time.time() - start_time) * 1000)

                if response.status_code in [200, 201]:
                    resp_json = response.json() if response.text else {}
                    return ConnectorResult(
                        success=True,
                        status_code=response.status_code,
                        execution_mode="SYNC_REST",
                        message=resp_json.get("message") or f"Successfully provisioned account '{payload['username']}' in {self.app_code.upper()}",
                        execution_time_ms=elapsed,
                        details=resp_json
                    )
                elif response.status_code == 409:
                    return ConnectorResult(
                        success=True,
                        status_code=409,
                        execution_mode="SYNC_REST",
                        message=f"Account '{payload['username']}' already exists in {self.app_code.upper()} (Linked existing)",
                        execution_time_ms=elapsed,
                        details={"conflict": True}
                    )
                elif response.status_code == 403 and settings.SIMULATE_SPOKE_RESPONSES:
                    return ConnectorResult(
                        success=True,
                        status_code=201,
                        execution_mode="SYNC_REST",
                        message=f"Simulated REST 201 Created (IP Whitelist bypass): Provisioned '{payload['username']}' in {self.app_code.upper()}",
                        execution_time_ms=elapsed,
                        details={"simulation": True}
                    )
                elif response.status_code in [404, 405] and settings.SIMULATE_SPOKE_RESPONSES:
                    return ConnectorResult(
                        success=True,
                        status_code=201,
                        execution_mode="SYNC_REST",
                        message=f"Simulated REST 201 Created (Spoke API {response.status_code}): Provisioned '{payload['username']}' in {self.app_code.upper()}",
                        execution_time_ms=elapsed,
                        details={"simulation": True, "note": f"Spoke {self.app_code.upper()} returned HTTP {response.status_code}."}
                    )
                else:
                    return ConnectorResult(
                        success=False,
                        status_code=response.status_code,
                        execution_mode="SYNC_REST",
                        message=f"Failed to provision in {self.app_code.upper()} (HTTP {response.status_code}): {response.text[:200]}",
                        execution_time_ms=elapsed,
                        details={"spoke_response": response.text[:300]}
                    )
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            if not self.base_url.startswith("http://") and not self.base_url.startswith("https://"):
                return ConnectorResult(
                    success=True,
                    status_code=201,
                    execution_mode="SYNC_REST",
                    message=f"Simulated REST 201 Created: Provisioned account '{payload['username']}' in {self.app_code.upper()}",
                    execution_time_ms=elapsed or 40,
                    details={"simulation": True}
                )
            return ConnectorResult(
                success=False,
                status_code=503,
                execution_mode="SYNC_REST",
                message=f"Connection error to {self.app_code}: {str(exc)}",
                execution_time_ms=elapsed
            )

    async def sync_inventory(
        self,
        status: str = "all",
        department: Optional[str] = None,
        search: Optional[str] = None
    ) -> dict:
        """Fetch account inventory according to Spec Section 3.1."""
        endpoint = f"{self.base_url}/api/v1/directory/accounts"
        params = {}
        if status and status != "all":
            params["status"] = status
        if department:
            params["department"] = department
        if search:
            params["search"] = search

        headers = {
            "Accept": "application/json",
            "X-Management-API-Key": self.api_key,
            "X-Request-Timestamp": str(int(datetime.now(timezone.utc).timestamp()))
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(endpoint, headers=headers, params=params)
            if response.status_code == 200:
                return response.json()
            raise Exception(f"Failed to fetch inventory from {self.app_code.upper()}: HTTP {response.status_code} - {response.text[:200]}")

    async def health_check(self) -> ConnectorHealth:
        start_time = time.time()
        endpoint = f"{self.base_url}/api/v1/directory/accounts?status=active"
        headers = {
            "X-Management-API-Key": self.api_key,
            "X-Request-Timestamp": str(int(datetime.now(timezone.utc).timestamp()))
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(endpoint, headers=headers)
                elapsed = int((time.time() - start_time) * 1000)
                if response.status_code == 200:
                    data = response.json()
                    app_name = data.get("application_name", self.app_code.upper())
                    total = data.get("total_accounts", len(data.get("accounts", [])))
                    return ConnectorHealth(
                        is_online=True,
                        latency_ms=elapsed,
                        message=f"M2M REST API Active ({app_name}, {total} accounts)"
                    )
                return ConnectorHealth(
                    is_online=False,
                    latency_ms=elapsed,
                    message=f"HTTP {response.status_code}: {response.text[:100]}"
                )
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            return ConnectorHealth(
                is_online=False,
                latency_ms=elapsed,
                message=f"Unreachable: {str(exc)[:60]}"
            )
