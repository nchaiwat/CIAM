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
    created_at: Optional[datetime] = None
    days_since_last_login: Optional[int] = None

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
    created_at: Optional[datetime] = None
    last_access_at: Optional[datetime] = None
    days_since_last_access: Optional[int] = None
    connected_apps: List[AppAccountSummary] = []
    has_discrepancy: bool = False
    is_ad_account: bool = True

    model_config = {"from_attributes": True}


class UserDetailResponse(BaseModel):
    user: UserListItem
    accounts: List[AppAccountSummary]

class SpokeProvisionTarget(BaseModel):
    application_id: int
    group_name: Optional[str] = None
    custom_username: Optional[str] = None

class UserCreateRequest(BaseModel):
    employee_id: Optional[str] = None
    username: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    telephone: Optional[str] = None
    create_in_ad: bool = True
    target_spokes: List[SpokeProvisionTarget] = []

class SpokeProvisionResult(BaseModel):
    application_id: int
    app_code: str
    app_name: str
    connector_type: str
    execution_mode: str
    success: bool
    status_code: Optional[int] = None
    message: str
    execution_time_ms: int

class UserCreateResponse(BaseModel):
    identity_id: int
    employee_id: Optional[str] = None
    username: str
    full_name: str
    department: Optional[str] = None
    ad_status: str
    overall_status: str
    spoke_results: List[SpokeProvisionResult] = []

class UserActivateRequest(BaseModel):
    reason: str = "Employee reinstated / reactivated by HR"

class AppActivationResult(BaseModel):
    app_code: str
    app_name: str
    connector_type: str
    execution_mode: str
    status: str
    message: str
    http_code: Optional[int] = None
    execution_time_ms: int

class UserActivateResponse(BaseModel):
    identity_id: int
    username: str
    full_name: str
    ad_status: str
    overall_status: str
    checklist: List[AppActivationResult] = []

