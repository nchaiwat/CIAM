import json
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator

class LoginRequest(BaseModel):
    username: str
    password: str
    # Honeypot decoy fields (invisible in real browser, traps automated bot scripts)
    corporate_fax: Optional[str] = None
    security_honey: Optional[str] = None
    # Velocity & Timing analysis (epoch ms when form rendered on client)
    form_render_ts: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "AdminUserOut"

class AdminUserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str
    is_active: bool
    department: Optional[str] = None
    employee_id: Optional[str] = None
    telegram_id: Optional[str] = None
    is_ad_user: bool = True
    must_change_password: bool = False
    password_changed_at: Optional[datetime] = None
    password_expires_at: Optional[datetime] = None
    days_until_password_expiry: Optional[int] = None
    is_password_expired: bool = False
    portal_preferences: Optional[Dict[str, Any]] = None

    @field_validator("portal_preferences", mode="before")
    @classmethod
    def _parse_portal_preferences(cls, value: Any) -> Optional[Dict[str, Any]]:
        if value is None or isinstance(value, dict):
            return value
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None
            try:
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
        return None

    model_config = {"from_attributes": True}

class AdminRoleUpdateRequest(BaseModel):
    role: str # SUPER_ADMIN, ADMIN, IT_HELPDESK, AUDITOR, PORTAL_USER

class AdminProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    telegram_id: Optional[str] = None
    new_password: Optional[str] = None

class PortalPreferencesUpdateRequest(BaseModel):
    app_order: Optional[List[str]] = None
    theme: Optional[Literal["light", "dark"]] = None

TokenResponse.model_rebuild()
