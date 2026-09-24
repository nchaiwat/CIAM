from typing import Optional
from app.models.application import ConnectedApplication
from app.connectors.base import BaseConnector
from app.connectors.rest_api import RestApiConnector
from app.connectors.sap_b1 import SapB1Connector
from app.connectors.ad_proxy import AdProxyConnector
from app.connectors.rpa.mock_legacy import MockLegacyErpRpaAdapter
from app.connectors.m365_graph import M365GraphConnector

def get_connector_for_app(app: ConnectedApplication) -> BaseConnector:
    """Instantiate appropriate connector based on application connector_type and code."""
    c_type = (app.connector_type or "").upper()
    
    if c_type in ["M365", "MICROSOFT_365", "GRAPH_API"] or app.app_code.lower() in ["m365", "o365", "microsoft_365"]:
        return M365GraphConnector(
            tenant_id=app.sap_company_db,
            client_id=app.client_id,
            client_secret=app.client_secret or app.api_key,
            app_code=app.app_code,
            base_url=app.base_url or "https://graph.microsoft.com"
        )
    elif c_type in ["SAP_B1", "SAP_SERVICE_LAYER"] or app.app_code.lower() in ["sap_b1", "sap"]:
        return SapB1Connector(
            base_url=app.base_url or "",
            api_key=app.api_key or "",
            company_db=app.sap_company_db or "",
            sap_username=app.sap_username or "",
            sap_password=app.sap_password or "",
            app_code=app.app_code
        )
    elif c_type in ["AD_PROXY", "AD_GATEWAY"] or app.app_code.lower() == "ad":
        effective_key = app.api_key
        if not effective_key or effective_key.strip() in ["mgmt_ciam_key_9a88b1c0d2e3f4a5", ""]:
            effective_key = app.client_secret or "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
        return AdProxyConnector(
            base_url=app.base_url,
            api_key=effective_key,
            allow_status_patch=bool(getattr(app, "ad_allow_status_patch", False)),
            origin_ip=app.sap_company_db or getattr(settings, "AD_ORIGIN_IP", "157.173.219.153")
        )
    elif c_type == "RPA_WORKER":
        if app.rpa_adapter_name == "mock_legacy_erp":
            return MockLegacyErpRpaAdapter()
        return MockLegacyErpRpaAdapter()
    else:
        # Default is standard Spec-compliant REST API
        return RestApiConnector(
            app_code=app.app_code,
            base_url=app.base_url or "",
            api_key=app.api_key or ""
        )

