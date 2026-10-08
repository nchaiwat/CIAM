import pytest
from unittest.mock import MagicMock
from app.services.network_service import (
    get_client_ip,
    is_ip_in_network,
    is_client_authorized_for_app_network,
    DEFAULT_CORPORATE_NETWORKS,
)
from app.models.application import ConnectedApplication


def test_is_ip_in_network():
    # Single IP /32
    assert is_ip_in_network("49.231.185.245", "49.231.185.245/32") is True
    assert is_ip_in_network("49.231.185.246", "49.231.185.245/32") is False

    # Subnet /24
    assert is_ip_in_network("10.8.0.5", "10.8.0.0/24") is True
    assert is_ip_in_network("10.8.1.5", "10.8.0.0/24") is False

    # Subnet /16
    assert is_ip_in_network("192.168.1.100", "192.168.0.0/16") is True
    assert is_ip_in_network("172.16.1.100", "192.168.0.0/16") is False

    # Loopback
    assert is_ip_in_network("127.0.0.1", "127.0.0.1/32") is True


def test_get_client_ip_headers():
    request = MagicMock()
    request.headers = {"X-Forwarded-For": "203.0.113.195, 10.0.0.1"}
    assert get_client_ip(request) == "203.0.113.195"

    request.headers = {"X-Real-IP": "198.51.100.22"}
    assert get_client_ip(request) == "198.51.100.22"

    request.headers = {}
    request.client.host = "192.0.2.1"
    assert get_client_ip(request) == "192.0.2.1"


def test_authorized_for_anywhere_policy():
    app = ConnectedApplication(
        app_code="cloud_app",
        app_name="Cloud App",
        network_policy="ANYWHERE",
    )
    db = MagicMock()
    # Any IP should be allowed
    assert is_client_authorized_for_app_network("1.2.3.4", app, db) is True
    assert is_client_authorized_for_app_network("200.200.200.200", app, db) is True


def test_authorized_for_vpn_only_default_networks():
    app = ConnectedApplication(
        app_code="onprem_erp",
        app_name="On-Prem ERP",
        network_policy="VPN_ONLY",
        allowed_network_cidrs=None,
    )
    db = MagicMock()
    # Mock SystemSetting query returning None so it falls back to defaults
    db.query().filter().first.return_value = None

    # Egress WAN of Window Asia (VPN full tunnel)
    assert is_client_authorized_for_app_network("49.231.185.245", app, db) is True
    assert is_client_authorized_for_app_network("58.8.190.63", app, db) is True

    # OpenVPN Client IP
    assert is_client_authorized_for_app_network("10.8.0.15", app, db) is True

    # Office LAN IP
    assert is_client_authorized_for_app_network("192.168.10.50", app, db) is True

    # Unknown external public IP (without VPN)
    assert is_client_authorized_for_app_network("171.100.50.25", app, db) is False


def test_authorized_for_vpn_only_custom_cidrs():
    app = ConnectedApplication(
        app_code="isolated_db",
        app_name="Isolated DB",
        network_policy="VPN_ONLY",
        allowed_network_cidrs="10.8.0.0/24, 172.20.0.0/16",
    )
    db = MagicMock()

    assert is_client_authorized_for_app_network("10.8.0.50", app, db) is True
    assert is_client_authorized_for_app_network("172.20.10.1", app, db) is True
    # Default corporate IP not in custom list
    assert is_client_authorized_for_app_network("49.231.185.245", app, db) is False
