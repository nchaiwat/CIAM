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

    # Relationships
    accounts = relationship("AppAccountMapping", back_populates="application", cascade="all, delete-orphan")
