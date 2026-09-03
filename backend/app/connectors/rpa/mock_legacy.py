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

    async def health_check(self) -> ConnectorHealth:
        return ConnectorHealth(
            is_online=True,
            latency_ms=12,
            message="RPA Automation Worker Service Ready & Idle"
        )
