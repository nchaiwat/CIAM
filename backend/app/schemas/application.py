from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class AppCreate(BaseModel):
    app_code: str
    app_name: str
    connector_type: str = "REST_API" # 'REST_API', 'RPA_WORKER', 'SAP_B1'
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    rpa_adapter_name: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uris: Optional[str] = None
    sso_enabled: bool = True
    sap_company_db: Optional[str] = None
    sap_username: Optional[str] = None
    sap_password: Optional[str] = None
    ad_allow_status_patch: Optional[bool] = False

class AppUpdate(BaseModel):
    app_name: Optional[str] = None
    connector_type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    rpa_adapter_name: Optional[str] = None
    is_active: Optional[bool] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uris: Optional[str] = None
    sso_enabled: Optional[bool] = None
    sap_company_db: Optional[str] = None
    sap_username: Optional[str] = None
    sap_password: Optional[str] = None
    ad_allow_status_patch: Optional[bool] = None

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
    client_id: Optional[str] = None
    redirect_uris: Optional[str] = None
    sso_enabled: bool = True
    sap_company_db: Optional[str] = None
    sap_username: Optional[str] = None
    ad_allow_status_patch: Optional[bool] = False
    created_at: datetime

    model_config = {"from_attributes": True}

class PingResult(BaseModel):
    app_code: str
    status: str # 'ONLINE' or 'OFFLINE'
    latency_ms: int
    message: str

class AppCredentialOut(BaseModel):
    id: int
    app_code: str
    app_name: str
    connector_type: str = "REST_API"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    header_name: str = "X-Management-API-Key"
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uris: Optional[str] = None
    sso_enabled: bool = True
    sap_company_db: Optional[str] = None
    sap_username: Optional[str] = None
    sap_password: Optional[str] = None

class SyncScheduleOut(BaseModel):
    enabled: bool = True
    time: str = "04:00"
    timezone: str = "Asia/Bangkok"
    last_run_at: Optional[str] = None
    last_status: Optional[str] = None
    last_summary: Optional[str] = None
    next_run_at: Optional[str] = None

class SyncScheduleUpdate(BaseModel):
    enabled: Optional[bool] = None
    time: Optional[str] = None

class SyncAppResult(BaseModel):
    app_code: str
    app_name: str
    success: bool
    accounts_synced: int
    error: Optional[str] = None

class SyncAllResult(BaseModel):
    success: bool
    total_apps: int
    success_count: int
    fail_count: int
    summary: str
    results: list[SyncAppResult]
    timestamp: str



