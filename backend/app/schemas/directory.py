from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class AppAccountSummary(BaseModel):
    application_id: int
    app_code: str
    app_name: str
    connector_type: str
    app_username: str
    app_group_name: Optional[str] = None
    is_active_in_app: bool
    last_sync_status: str
    last_app_login_at: Optional[datetime] = None

class UserListItem(BaseModel):
    id: int
    employee_id: Optional[str] = None
    username: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    telephone: Optional[str] = None
    is_active_in_ad: bool
    last_login_ad_at: Optional[datetime] = None
    connected_apps: List[AppAccountSummary] = []
    has_discrepancy: bool = False

    model_config = {"from_attributes": True}

class UserDetailResponse(BaseModel):
    user: UserListItem
    accounts: List[AppAccountSummary]
