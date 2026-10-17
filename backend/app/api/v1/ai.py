from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import AdminUser
from app.schemas.ai import (
    AICopilotSettings,
    AICopilotSettingsUpdate,
    AIChatRequest,
    AIChatResponse,
    AITestRequest,
    AITestResponse,
)
from app.services.ai_service import (
    get_ai_settings,
    update_ai_settings,
    test_ai_connection,
    process_ai_chat,
)

router = APIRouter(prefix="/ai", tags=["AI Copilot & Intelligence Engine"])

@router.get("/settings", response_model=AICopilotSettings)
def get_copilot_settings(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Retrieve AI Copilot Configuration (API keys are masked)"""
    return get_ai_settings(db)

@router.put("/settings", response_model=AICopilotSettings)
def update_copilot_settings(
    update_data: AICopilotSettingsUpdate,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Update AI Copilot Configuration (Admin only)"""
    if current_admin.role not in ("SUPER_ADMIN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="เฉพาะ Admin หรือ Super Admin เท่านั้นที่สามารถแก้ไขการตั้งค่า AI ได้",
        )
    return update_ai_settings(db, update_data)

@router.post("/test", response_model=AITestResponse)
async def test_copilot_connection(
    req: AITestRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Test AI Provider API connection with provided or saved API key"""
    return await test_ai_connection(db, req)

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_copilot(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Engage in interactive conversation with Central IAM Copilot agent"""
    return await process_ai_chat(db, req, current_admin)
