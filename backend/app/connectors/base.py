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

    @abstractmethod
    async def health_check(self) -> ConnectorHealth:
        """Check availability and response time of target system."""
        pass
