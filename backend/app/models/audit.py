from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base

class IamAuditLog(Base):
    __tablename__ = "iam_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_username = Column(String(100), nullable=False)                         # Admin username who triggered action
    action_type = Column(String(50), nullable=False)                             # 'OFFBOARD_USER', 'ENABLE_USER', 'RPA_TASK_TRIGGERED', 'SYNC'
    target_username = Column(String(100), nullable=False)                        # Target employee sAMAccountName
    affected_app_code = Column(String(50), nullable=True)                        # 'ALL', 'irm', 'qms', 'ad', 'legacy_erp'
    previous_status = Column(String(50), nullable=True)                          # e.g. 'ACTIVE'
    new_status = Column(String(50), nullable=True)                               # e.g. 'DISABLED'
    execution_mode = Column(String(50), default="SYNC_REST", nullable=False)     # 'SYNC_REST', 'ASYNC_RPA', 'AD_LDAP'
    reason = Column(Text, nullable=True)                                         # e.g. 'Resigned', 'Terminated'
    ip_address = Column(String(50), nullable=True)                              # IP address of actor
    status = Column(String(20), nullable=False)                                  # 'SUCCESS', 'QUEUED', 'PARTIAL_FAILED', 'FAILED'
    details = Column(Text, nullable=True)                                        # Additional JSON / error details
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
