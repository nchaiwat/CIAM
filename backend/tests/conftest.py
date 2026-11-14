import pytest
from app.connectors.base import ConnectorHealth, ConnectorResult
from app.connectors.rest_api import RestApiConnector
from app.initial_data import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure database schema and initial seed data are populated before tests run."""
    init_db()


@pytest.fixture(autouse=True)
def _block_external_spoke_network_calls(monkeypatch):
    """Prevent local pytest runs from sending real HTTP requests to production Spoke apps."""
    orig_set_account_status = RestApiConnector.set_account_status
    orig_provision_account = RestApiConnector.provision_account
    orig_sync_inventory = RestApiConnector.sync_inventory
    orig_health_check = RestApiConnector.health_check

    def _is_external_http(connector: RestApiConnector) -> bool:
        base_url = (getattr(connector, "base_url", "") or "").strip().lower()
        return base_url.startswith("http://") or base_url.startswith("https://")

    async def _mock_set_account_status(
        self: RestApiConnector,
        username: str,
        is_active: bool,
        reason: str,
        updated_by: str = "Central-IAM-Service",
    ) -> ConnectorResult:
        if not _is_external_http(self):
            return await orig_set_account_status(self, username, is_active, reason, updated_by)
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="TEST_MOCK",
            message=f"Simulated HTTP status update for {username} in {self.app_code}",
            execution_time_ms=1,
            details={"mocked": True, "username": username, "is_active": is_active, "reason": reason},
        )

    async def _mock_provision_account(self: RestApiConnector, account_data: dict) -> ConnectorResult:
        if not _is_external_http(self):
            return await orig_provision_account(self, account_data)
        return ConnectorResult(
            success=True,
            status_code=200,
            execution_mode="TEST_MOCK",
            message=f"Simulated HTTP provision for {account_data.get('username')} in {self.app_code}",
            execution_time_ms=1,
            details={"mocked": True, "username": account_data.get("username")},
        )

    async def _mock_sync_inventory(
        self: RestApiConnector,
        status: str = "all",
        department: str | None = None,
        search: str | None = None,
    ) -> dict:
        if not _is_external_http(self):
            return await orig_sync_inventory(self, status=status, department=department, search=search)
        return {"app_code": self.app_code, "total": 0, "accounts": [], "mocked": True}

    async def _mock_health_check(self: RestApiConnector) -> ConnectorHealth:
        if not _is_external_http(self):
            return await orig_health_check(self)
        return ConnectorHealth(
            is_online=True,
            latency_ms=1,
            message=f"Simulated online ({self.app_code})",
            spoke_sso_active=True,
        )

    monkeypatch.setattr(RestApiConnector, "set_account_status", _mock_set_account_status)
    monkeypatch.setattr(RestApiConnector, "provision_account", _mock_provision_account)
    monkeypatch.setattr(RestApiConnector, "sync_inventory", _mock_sync_inventory)
    monkeypatch.setattr(RestApiConnector, "health_check", _mock_health_check)
