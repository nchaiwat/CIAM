from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class AppCreate(BaseModel):
    app_code: str
    app_name: str
    connector_type: str = "REST_API" # 'REST_API' or 'RPA_WORKER'
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    rpa_adapter_name: Optional[str] = None

class AppUpdate(BaseModel):
    app_name: Optional[str] = None
    connector_type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    rpa_adapter_name: Optional[str] = None
    is_active: Optional[bool] = None

class AppOut(BaseModel):
    id: int
    app_code: str
    app_name: str
    connector_type: str
    base_url: Optional[str] = None
    rpa_adapter_name: Optional[str] = None
    is_active: bool
    health_status: str
    latency_ms: Optional[int] = None
    last_health_check_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    total_linked_accounts: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}

class PingResult(BaseModel):
    app_code: str
    status: str # 'ONLINE' or 'OFFLINE'
    latency_ms: int
    message: str
