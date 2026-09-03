from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class AppAccountMapping(Base):
    __tablename__ = "app_account_mappings"

    id = Column(Integer, primary_key=True, index=True)
    identity_id = Column(Integer, ForeignKey("master_identities.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("connected_applications.id", ondelete="CASCADE"), nullable=False)
    app_username = Column(String(100), nullable=False)
    app_user_id = Column(String(50), nullable=True)
    app_group_name = Column(String(100), nullable=True) # e.g. 'PU User', 'QA Inspector'
    is_active_in_app = Column(Boolean, default=True, nullable=False)
    last_sync_status = Column(String(50), default="IN_SYNC", nullable=False) # 'IN_SYNC', 'DISCREPANCY'
    last_app_login_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    identity = relationship("MasterIdentity", back_populates="accounts")
    application = relationship("ConnectedApplication", back_populates="accounts")

    __table_args__ = (
        UniqueConstraint("application_id", "app_username", name="uq_app_username_per_app"),
    )
