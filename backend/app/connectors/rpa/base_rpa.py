from abc import ABC, abstractmethod
from app.connectors.base import BaseConnector, ConnectorResult, ConnectorHealth

class BaseRpaAdapter(BaseConnector, ABC):
    """
    Abstract adapter for Robotic Process Automation (RPA) Workers.
    Inherited by custom bot runners (Playwright, Selenium, PyAutoGUI, or REST Queue dispatchers).
    """
    adapter_name: str
    target_system: str

    @abstractmethod
    async def deprovision(self, username: str, reason: str) -> ConnectorResult:
        """Run automation script to deactivate the specified user in the legacy UI."""
        pass

    @abstractmethod
    async def health_check(self) -> ConnectorHealth:
        """Verify bot worker availability, credentials, and target system responsiveness."""
        pass
