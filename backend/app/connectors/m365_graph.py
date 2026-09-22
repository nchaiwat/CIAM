import time
import logging
from typing import Optional, Dict, Any, List
import httpx
from datetime import datetime, timezone
from app.connectors.base import BaseConnector, ConnectorResult, ConnectorHealth
from app.core.config import settings

logger = logging.getLogger("ciam.connectors.m365")

class M365GraphConnector(BaseConnector):
    """
    Microsoft 365 / Microsoft Graph API Connector.
    Configured in Safe Read-Only Audit Mode per enterprise governance specification.
    Fetches user inventory, verifies connectivity, and detects ghost mailboxes without modifying cloud accounts.
    """
    def __init__(
        self,
        tenant_id: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        app_code: str = "m365",
        base_url: str = "https://graph.microsoft.com"
    ):
        self.tenant_id = (tenant_id or getattr(settings, "M365_TENANT_ID", "")).strip()
        self.client_id = (client_id or getattr(settings, "M365_CLIENT_ID", "")).strip()
        self.client_secret = (client_secret or getattr(settings, "M365_CLIENT_SECRET", "")).strip()
        self.app_code = app_code
        self.base_url = (base_url or "https://graph.microsoft.com").rstrip("/")
        
        # Token cache: (token_str, expiry_timestamp)
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        """Acquire or return cached OAuth 2.0 access token from Microsoft Entra ID."""
        now = time.time()
        if self._cached_token and now < (self._token_expires_at - 60):
            return self._cached_token

        if not self.tenant_id or not self.client_id or not self.client_secret:
            raise ValueError("Missing Microsoft 365 credentials (tenant_id, client_id, or client_secret)")

        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        token_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(token_url, data=token_data)
            if resp.status_code != 200:
                raise Exception(f"Failed to acquire Microsoft Graph token: HTTP {resp.status_code} - {resp.text[:200]}")
            
            data = resp.json()
            self._cached_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            self._token_expires_at = now + expires_in
            logger.info("Acquired fresh Microsoft Graph access token (valid for %ds)", expires_in)
            return self._cached_token

    async def health_check(self) -> ConnectorHealth:
        """Verify Microsoft Graph connectivity and measure roundtrip latency."""
        start_time = time.time()
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
            endpoint = f"{self.base_url}/v1.0/users"
            params = {
                "$select": "id,displayName",
                "$top": "1"
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(endpoint, headers=headers, params=params)
                elapsed = int((time.time() - start_time) * 1000)

                if resp.status_code == 200:
                    return ConnectorHealth(
                        is_online=True,
                        latency_ms=elapsed,
                        message=f"Microsoft Graph API Connected (Tenant: {self.tenant_id[:8]}...)"
                    )
                return ConnectorHealth(
                    is_online=False,
                    latency_ms=elapsed,
                    message=f"HTTP {resp.status_code}: {resp.text[:100]}"
                )
        except Exception as exc:
            elapsed = int((time.time() - start_time) * 1000)
            return ConnectorHealth(
                is_online=False,
                latency_ms=elapsed,
                message=f"Unreachable: {str(exc)[:100]}"
            )

    async def sync_inventory(
        self,
        status: str = "all",
        department: Optional[str] = None,
        search: Optional[str] = None
    ) -> dict:
        """Fetch all user accounts from Microsoft 365 via Microsoft Graph API with pagination."""
        token = await self._get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        all_raw_users: List[Dict[str, Any]] = []
        url: Optional[str] = f"{self.base_url}/v1.0/users"
        params: Optional[Dict[str, str]] = {
            "$select": "id,displayName,userPrincipalName,mail,accountEnabled,jobTitle,department",
            "$top": "999"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            while url:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code != 200:
                    raise Exception(f"Failed to fetch users from Microsoft Graph: HTTP {resp.status_code} - {resp.text[:200]}")
                
                data = resp.json()
                users_chunk = data.get("value", [])
                all_raw_users.extend(users_chunk)
                
                # Subsequent pagination requests must NOT re-pass params as nextLink contains them
                url = data.get("@odata.nextLink")
                params = None

        accounts = []
        for u in all_raw_users:
            raw_email = (u.get("mail") or u.get("userPrincipalName") or "").strip()
            # Extract standard username (prefix before @)
            raw_upn = (u.get("userPrincipalName") or "").strip()
            username = (raw_email or raw_upn).split("@")[0].strip()
            if not username:
                continue

            is_active = bool(u.get("accountEnabled", True))
            display_name = (u.get("displayName") or username).strip()
            dept = u.get("department") or (u.get("jobTitle") or "M365 User")
            
            # Determine group designation
            group_name = "Mailbox" if u.get("mail") else "Entra ID"

            accounts.append({
                "username": username,
                "full_name": display_name,
                "email": raw_email or (f"{username}@windowasia.com" if not "@" in raw_upn else raw_upn),
                "department": dept,
                "employee_id": None,
                "group_name": group_name,
                "is_active": is_active,
                "id": u.get("id"),
                "user_principal_name": raw_upn
            })

        logger.info("Successfully fetched %d accounts from Microsoft 365", len(accounts))
        return {
            "application_name": "Microsoft 365",
            "total_accounts": len(accounts),
            "accounts": accounts
        }

    async def deprovision(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        """
        Safe Read-Only Guardrail:
        Does NOT modify or block Microsoft 365 cloud mailboxes.
        Returns a successful audit record acknowledging the read-only inspection status.
        """
        logger.info("M365 Safe Read-Only: skipped cloud deprovisioning for '%s' (Reason: %s)", username, reason)
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="READ_ONLY_AUDIT",
            message=f"M365 Read-Only Mode: Skipped cloud modification for '{username}' (Audit Only)",
            execution_time_ms=5,
            details={
                "read_only": True,
                "target_username": username,
                "reason": reason,
                "note": "Microsoft 365 integration is configured as Read-Only Inventory Monitor"
            }
        )

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        """Safe Read-Only Guardrail for status update."""
        return await self.deprovision(username=username, reason=reason, updated_by=updated_by)

    async def provision_account(self, account_data: dict) -> ConnectorResult:
        """Safe Read-Only Guardrail: Provisioning in M365 is handled via Microsoft Admin Center."""
        username = account_data.get("username", "user")
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="READ_ONLY_AUDIT",
            message=f"M365 Read-Only Mode: Account '{username}' must be provisioned via Microsoft 365 Admin Portal",
            execution_time_ms=5,
            details={"read_only": True, "target": username}
        )
