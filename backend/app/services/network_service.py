import ipaddress
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.setting import SystemSetting
from app.models.application import ConnectedApplication

logger = logging.getLogger("ciam.network")

DEFAULT_CORPORATE_NETWORKS = [
    "127.0.0.1/32",
    "::1/128",
    "10.8.0.0/24",        # Standard OpenVPN tunnel subnet
    "192.168.0.0/16",     # On-prem LAN
    "172.18.0.0/16",      # Internal Docker / Gateway subnet
    "49.231.185.245/32",  # Window Asia HQ Gateway IP
    "58.8.190.63/32",     # Secondary Office IP
    "147.50.223.20/32",   # Window Asia VPN / Office Egress Public IP
]

def get_client_ip(request) -> str:
    """Extract real client IP considering reverse proxy headers."""
    headers = getattr(request, "headers", {})
    forwarded = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[0]
    real_ip = headers.get("x-real-ip") or headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        return str(client.host).strip()
    return "127.0.0.1"

def get_allowed_cidrs_for_app(app: ConnectedApplication, db: Session) -> List[str]:
    """Get list of allowed CIDRs for an app, combining per-app override or global settings."""
    if app.allowed_network_cidrs:
        cidrs = [c.strip() for c in app.allowed_network_cidrs.split(",") if c.strip()]
        if cidrs:
            return cidrs

    # Global setting fallback from system_settings
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "corporate_vpn_networks").first()
        if setting and setting.setting_value:
            val = setting.setting_value
            if isinstance(val, dict) and "cidrs" in val:
                return val["cidrs"]
            elif isinstance(val, list):
                return val
            elif isinstance(val, str):
                return [c.strip() for c in val.split(",") if c.strip()]
    except Exception as e:
        logger.debug("Failed to query corporate_vpn_networks setting: %s", e)

    return DEFAULT_CORPORATE_NETWORKS

def is_ip_in_network(client_ip_str: str, cidr_str: str) -> bool:
    """Tests if client IP matches a CIDR or specific IP address."""
    try:
        clean_cidr = cidr_str.strip()
        if not clean_cidr:
            return False

        client_ip = ipaddress.ip_address(client_ip_str.strip())

        if "/" not in clean_cidr:
            clean_cidr = f"{clean_cidr}/32" if client_ip.version == 4 else f"{clean_cidr}/128"

        net_obj = ipaddress.ip_network(clean_cidr, strict=False)
        return client_ip in net_obj
    except Exception as e:
        logger.debug("IP matching check failed for ip=%s net=%s: %s", client_ip_str, cidr_str, e)
        return False

def is_client_authorized_for_app_network(client_ip: str, app: ConnectedApplication, db: Session) -> bool:
    """Checks if client IP is permitted according to app's network policy."""
    policy = (getattr(app, "network_policy", "ANYWHERE") or "ANYWHERE").upper()
    if policy == "ANYWHERE":
        return True

    allowed_cidrs = get_allowed_cidrs_for_app(app, db)
    for cidr in allowed_cidrs:
        if is_ip_in_network(client_ip, cidr):
            return True

    return False
