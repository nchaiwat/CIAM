from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class KpiMetrics(BaseModel):
    total_identities: int
    active_accounts: int
    deprovisioned_accounts: int
    connected_systems_online: int
    connected_systems_total: int
    ghost_accounts_count: int

class DiscrepancyItem(BaseModel):
    identity_id: int
    username: str
    full_name: str
    department: Optional[str] = None
    app_code: str
    app_name: str
    ad_status: str # 'DISABLED' or 'NOT_IN_AD'
    app_status: str # 'ACTIVE'
    reason: str

class ActivityItem(BaseModel):
    id: int
    actor_username: str
    action_type: str
    target_username: str
    affected_app_code: Optional[str] = None
    execution_mode: str
    status: str
    created_at: datetime

class DashboardSummaryResponse(BaseModel):
    kpi: KpiMetrics
    discrepancies: List[DiscrepancyItem]
    recent_activities: List[ActivityItem]
