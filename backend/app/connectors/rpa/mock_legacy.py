import asyncio
import time
import logging
from app.connectors.rpa.base_rpa import BaseRpaAdapter
from app.connectors.base import ConnectorResult, ConnectorHealth

logger = logging.getLogger("ciam.rpa.mock_legacy")

class MockLegacyErpRpaAdapter(BaseRpaAdapter):
    adapter_name = "mock_legacy_erp"
    target_system = "Legacy ERP / SAP B1"

    async def deprovision(self, username: str, reason: str) -> ConnectorResult:
        start_time = time.time()
        logger.info("[RPA Worker] Starting headless automation bot for target user: %s (Reason: %s)", username, reason)

        # Simulate bot execution steps with micro-delays
        steps = [
            "Initializing RPA Automation Agent environment...",
            "Authenticating bot operator into Legacy ERP Portal...",
            f"Navigating to User Administration > Search for '{username}'...",
            "Locating user account record and opening permission panel...",
            f"Modifying account state to 'DISABLED' with audit remark: '{reason}'...",
            "Committing transaction and verifying UI success confirmation modal..."
        ]

        for step in steps:
            logger.debug("[RPA Step] %s", step)
            await asyncio.sleep(0.1) # Realistic simulation delay

        elapsed = int((time.time() - start_time) * 1000)
        logger.info("[RPA Worker] Completed automation for %s in %d ms", username, elapsed)

        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="ASYNC_RPA",
            message=f"RPA Bot successfully deactivated {username} in {self.target_system}",
            execution_time_ms=elapsed,
            details={
                "bot_name": "CIAM-RPA-Worker-01",
                "steps_completed": len(steps),
                "target_system": self.target_system,
                "execution_log": steps
            }
        )

    async def activate(self, username: str, reason: str, updated_by: str = "Central-IAM-Service") -> ConnectorResult:
        start_time = time.time()
        logger.info("[RPA Worker] Starting headless automation bot to activate user: %s (Reason: %s)", username, reason)
        await asyncio.sleep(0.05)
        elapsed = int((time.time() - start_time) * 1000)
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="ASYNC_RPA",
            message=f"RPA Bot successfully activated {username} in {self.target_system}",
            execution_time_ms=elapsed,
            details={"bot_name": "CIAM-RPA-Worker-01", "target_system": self.target_system}
        )

    async def set_account_status(
        self,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service"
    ) -> ConnectorResult:
        if is_active:
            return await self.activate(username, reason, updated_by)
        return await self.deprovision(username, reason)

    async def provision_account(self, account_data: dict) -> ConnectorResult:
        username = account_data.get("username")
        logger.info("[RPA Worker] Provisioning account for: %s in %s", username, self.target_system)
        await asyncio.sleep(0.05)
        return ConnectorResult(
            success=True,
            status_code=201,
            execution_mode="ASYNC_RPA",
            message=f"RPA Bot successfully provisioned user '{username}' in {self.target_system}",
            execution_time_ms=45,
            details={"bot_name": "CIAM-RPA-Worker-01", "target_system": self.target_system}
        )

    async def health_check(self) -> ConnectorHealth:
        return ConnectorHealth(
            is_online=True,
            latency_ms=12,
            message="RPA Automation Worker Service Ready & Idle"
        )

