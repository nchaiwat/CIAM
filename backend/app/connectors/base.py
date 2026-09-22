from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel

class ConnectorResult(BaseModel):
    success: bool
    status_code: Optional[int] = None
    execution_mode: str # 'SYNC_REST' or 'ASYNC_RPA' or 'AD_LDAP'
    message: str
    execution_time_ms: int
    details: Optional[dict] = None

class ConnectorHealth(BaseModel):
    is_online: bool
    latency_ms: int
    message: str

class BaseConnector(ABC):
    @abstractmethod
    async def deprovision(self, username: str, reason: str) -> ConnectorResult:
        """Deactivate or disable user account in target spoke application."""
        pass

    async def activate(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        """Re-activate or enable user account in target spoke application."""
        return await self.set_account_status(username=username, is_active=True, reason=reason, updated_by=updated_by)

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        """Update account status (enable/disable) in target spoke application."""
        if not is_active:
            return await self.deprovision(username, reason)
        raise NotImplementedError("Activation not implemented for this connector.")

    async def provision_account(self, account_data: dict) -> ConnectorResult:
        """Create/provision a new user account in target application according to Spec Section 3.3."""
        raise NotImplementedError("Provisioning not implemented for this connector.")

    @abstractmethod
    async def health_check(self) -> ConnectorHealth:
        """Check availability and response time of target system."""
        pass

    @abstractmethod
    async def sync_inventory(self) -> dict:
        """Fetch list of all accounts from target application."""
        pass


