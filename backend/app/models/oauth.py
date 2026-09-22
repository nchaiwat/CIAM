from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.core.database import Base

class OAuthAuthorizationCode(Base):
    __tablename__ = "oauth_authorization_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(128), unique=True, index=True, nullable=False)
    client_id = Column(String(100), index=True, nullable=False)
    username = Column(String(100), index=True, nullable=False)
    redirect_uri = Column(String(500), nullable=False)
    scope = Column(String(255), default="openid profile email", nullable=False)
    code_challenge = Column(String(255), nullable=True)
    code_challenge_method = Column(String(20), default="S256", nullable=False) # 'S256' or 'plain'
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
