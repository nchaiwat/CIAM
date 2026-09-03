from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class AuditLogOut(BaseModel):
    id: int
    actor_username: str
    action_type: str
    target_username: str
    affected_app_code: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    execution_mode: str
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    details: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class AuditLogListResponse(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    page_size: int
