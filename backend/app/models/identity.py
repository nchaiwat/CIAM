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
    is_active_in_ad = Column(Boolean, default=True, nullable=False)
    last_login_ad_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    accounts = relationship("AppAccountMapping", back_populates="identity", cascade="all, delete-orphan")
