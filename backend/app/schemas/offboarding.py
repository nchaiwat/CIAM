from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class OffboardPreviewRequest(BaseModel):
    username: str

class AffectedAppInfo(BaseModel):
    application_id: int
    app_code: str
    app_name: str
    connector_type: str # 'REST_API' or 'RPA_WORKER'
    app_username: str
    current_status: str # 'ACTIVE' or 'DISABLED'
    action_to_take: str # e.g. 'Disable via REST API PATCH' or 'Queue RPA Bot to Deactivate'

class OffboardPreviewResponse(BaseModel):
    identity_id: int
    employee_id: Optional[str] = None
    username: str
    full_name: str
    department: Optional[str] = None
    ad_current_status: str # 'ACTIVE' or 'DISABLED'
    affected_applications: List[AffectedAppInfo]
    total_apps_affected: int

class OffboardExecuteRequest(BaseModel):
    username: str
    effective_date: str # e.g. '2026-09-03'
    reason: str         # e.g. 'Resigned', 'Terminated', 'Contract Ended'
    notes: Optional[str] = None

class AppExecutionResult(BaseModel):
    app_code: str
    app_name: str
    connector_type: str
    execution_mode: str # 'SYNC_REST' or 'ASYNC_RPA' or 'AD_LDAP'
    status: str         # 'SUCCESS', 'QUEUED', 'FAILED'
    message: str
    http_code: Optional[int] = None
    execution_time_ms: int

class OffboardExecuteResponse(BaseModel):
    certificate_id: str
    executed_at: datetime
    actor_username: str
    target_username: str
    target_full_name: str
    target_employee_id: Optional[str] = None
    target_department: Optional[str] = None
    reason: str
    effective_date: str
    overall_status: str # 'SUCCESS', 'PARTIAL', 'FAILED'
    checklist: List[AppExecutionResult]
