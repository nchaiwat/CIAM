from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class AICopilotSettings(BaseModel):
    enabled: bool = Field(default=False, description="Master toggle for CIAM AI Copilot")
    provider: str = Field(default="google", description="AI Provider: google, openai, anthropic, ollama, custom")
    model: str = Field(default="gemini-2.0-flash", description="Model identifier e.g. gemini-2.0-flash, gpt-4o-mini")
    api_key_masked: Optional[str] = Field(default=None, description="Masked API Key for secure UI display")
    has_api_key: bool = Field(default=False, description="Whether an API key is configured")
    base_url: Optional[str] = Field(default=None, description="Custom API endpoint (for Ollama or self-hosted LLM)")
    system_prompt: Optional[str] = Field(default=None, description="Custom agent persona and operational constraints")
    allow_mcp_tools: bool = Field(default=True, description="Allow AI Agent to invoke Central IAM / Spoke MCP Tools")

class AICopilotSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    allow_mcp_tools: Optional[bool] = None

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', 'system', 'tool'")
    content: str = Field(..., description="Message text content")
    tool_calls: Optional[List[Dict[str, Any]]] = Field(default=None, description="Executed tool calls and outputs")

class AIChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None

class AIChatResponse(BaseModel):
    message: ChatMessage
    tools_used: List[str] = Field(default_factory=list)
    session_id: Optional[str] = None

class AITestRequest(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class AITestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
