from typing import Optional
from app.models.application import ConnectedApplication
from app.connectors.base import BaseConnector
from app.connectors.rest_api import RestApiConnector
from app.connectors.rpa.mock_legacy import MockLegacyErpRpaAdapter

def get_connector_for_app(app: ConnectedApplication) -> BaseConnector:
    """Instantiate appropriate connector based on application connector_type."""
    if app.connector_type == "RPA_WORKER":
        # Check adapter name
        if app.rpa_adapter_name == "mock_legacy_erp":
            return MockLegacyErpRpaAdapter()
        # Fallback to default RPA adapter
        return MockLegacyErpRpaAdapter()
    else:
        # Default is REST API
        return RestApiConnector(
            app_code=app.app_code,
            base_url=app.base_url or "",
            api_key=app.api_key or ""
        )
