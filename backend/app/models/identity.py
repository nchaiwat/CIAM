from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class MasterIdentity(Base):
    __tablename__ = "master_identities"

    id = Column(Integer, primary_key=True, index=True)
    ad_guid = Column(String(100), unique=True, index=True, nullable=True)
    employee_id = Column(String(50), index=True, nullable=True)
    username = Column(String(100), unique=True, index=True, nullable=False) # sAMAccountName
    full_name = Column(String(200), nullable=False)
    email = Column(String(150), nullable=True)
    department = Column(String(100), nullable=True)
    telephone = Column(String(50), nullable=True)
    telegram_id = Column(String(100), nullable=True) # Telegram username or user ID (e.g. @chaiwat_n)
    is_active_in_ad = Column(Boolean, default=True, nullable=False)
    last_login_ad_at = Column(DateTime(timezone=True), nullable=True)
    is_approved_exception = Column(Boolean, default=False, nullable=False)
    exception_type = Column(String(50), nullable=True)
    exception_reason = Column(String(255), nullable=True)
    exception_approved_by = Column(String(100), nullable=True)
    exception_approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    accounts = relationship("AppAccountMapping", back_populates="identity", cascade="all, delete-orphan")
