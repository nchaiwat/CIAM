import pytest
from app.connectors.pfsense import PfSenseConnector
from app.connectors.factory import get_connector_for_app
from app.models.application import ConnectedApplication

@pytest.mark.anyio
async def test_pfsense_ho_connector_instantiation_and_defaults():
    app = ConnectedApplication(
        app_code="pfsense_ho",
        app_name="pfSense Firewall & VPN (Head Office)",
        connector_type="PFSENSE",
        base_url="https://192.168.10.1",
        api_key="mgmt_ciam_key_9a88b1c0d2e3f4a5"
    )
    connector = get_connector_for_app(app)
    assert isinstance(connector, PfSenseConnector)
    assert connector.base_url == "https://192.168.10.1"
    assert connector.app_code == "pfsense_ho"

@pytest.mark.anyio
async def test_pfsense_ho_connector_simulation_fallback():
    connector = PfSenseConnector(
        app_code="pfsense_ho",
        base_url="https://192.168.10.1",
        api_key="mgmt_ciam_key_9a88b1c0d2e3f4a5"
    )
    # Offboard / deprovision in simulated mode
    res = await connector.deprovision(username="test.user", reason="Offboard test")
    assert res.success is True
    assert "pfsense_ho" in res.message.lower() or "PFSENSE_HO" in res.message

    # Re-enable in simulated mode
    res_enable = await connector.set_account_status(username="test.user", is_active=True, reason="Re-enable test")
    assert res_enable.success is True

@pytest.mark.anyio
async def test_pfsense_inventory_normalization():
    connector = PfSenseConnector(
        app_code="pfsense_ho",
        base_url="https://192.168.10.1",
        api_key="mgmt_ciam_key_9a88b1c0d2e3f4a5"
    )
    # When server unreachable, returns empty list without crashing
    inv = await connector.sync_inventory()
    assert "total_accounts" in inv
    assert "accounts" in inv
    assert isinstance(inv["accounts"], list)
