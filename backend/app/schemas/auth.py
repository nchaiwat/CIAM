from typing import Optional
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    username: str
    password: str

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

    model_config = {"from_attributes": True}

TokenResponse.model_rebuild()
