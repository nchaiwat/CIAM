from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConnectedApplication(Base):
    __tablename__ = "connected_applications"

    id = Column(Integer, primary_key=True, index=True)
    app_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. 'irm', 'qms', 'legacy_erp'
    app_name = Column(String(100), nullable=False)                         # e.g. 'Incoming Raw Material'
    connector_type = Column(String(50), default="REST_API", nullable=False) # 'REST_API' or 'RPA_WORKER'
    base_url = Column(String(255), nullable=True)                         # Base URL for REST API or Web Portal
    api_key = Column(String(255), nullable=True)                          # Machine-to-Machine Secret Key
    rpa_adapter_name = Column(String(100), nullable=True)                 # e.g. 'mock_legacy_erp'
    is_active = Column(Boolean, default=True, nullable=False)
    health_status = Column(String(50), default="UNKNOWN")                  # 'ONLINE', 'OFFLINE', 'UNKNOWN'
    latency_ms = Column(Integer, nullable=True)
    last_health_check_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # OIDC / SSO Client Configuration
    client_id = Column(String(100), unique=True, index=True, nullable=True)
    client_secret = Column(String(255), nullable=True)
    redirect_uris = Column(String(1000), nullable=True) # Comma-separated allowed callback URLs
    sso_enabled = Column(Boolean, default=True, nullable=False)
    spoke_sso_status = Column(String(50), default="UNKNOWN", nullable=True) # 'ACTIVE', 'DISABLED', 'UNKNOWN'

    # SAP Business One Service Layer Credentials (Zero-Trust Session Auth)
    sap_company_db = Column(String(100), nullable=True)
    sap_username = Column(String(100), nullable=True)
    sap_password = Column(String(255), nullable=True)

    # Active Directory Gateway Controls (Safety Guardrails)
    ad_allow_status_patch = Column(Boolean, default=False, nullable=True)

    # Network Access Policy & VPN Restriction (Zero Trust Context-Aware Access Control)
    network_policy = Column(String(50), default="ANYWHERE", nullable=False) # 'ANYWHERE', 'VPN_ONLY'
    vpn_restriction_mode = Column(String(50), default="HIDE", nullable=False) # 'HIDE', 'LOCK_WITH_BANNER'
    allowed_network_cidrs = Column(String(500), nullable=True) # Optional comma-separated CIDRs override

    # Relationships
    accounts = relationship("AppAccountMapping", back_populates="application", cascade="all, delete-orphan")


class SpokePendingCommand(Base):
    __tablename__ = "spoke_pending_commands"

    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(String(50), unique=True, index=True, nullable=False)
    app_code = Column(String(50), index=True, nullable=False)
    action = Column(String(50), nullable=False) # 'DISABLE_USER', 'ENABLE_USER'
    username = Column(String(100), nullable=False)
    reason = Column(String(255), nullable=True)
    status = Column(String(20), default="PENDING", nullable=False) # 'PENDING', 'SENT', 'COMPLETED', 'FAILED'
    issued_by = Column(String(100), default="Central-IAM", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    executed_at = Column(DateTime(timezone=True), nullable=True)
    result_message = Column(String(500), nullable=True)

