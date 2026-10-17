import time
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.setting import SystemSetting
from app.schemas.ai import (
    AICopilotSettings,
    AICopilotSettingsUpdate,
    ChatMessage,
    AIChatRequest,
    AIChatResponse,
    AITestRequest,
    AITestResponse,
)

logger = logging.getLogger(__name__)

SETTING_KEY = "ai_copilot_settings"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "enabled": False,
    "provider": "google",
    "model": "gemini-1.5-flash",
    "api_key": None,
    "base_url": None,
    "system_prompt": (
        "You are Central IAM Enterprise Copilot for Window Asia Public Company Limited. "
        "You help IT Administrators query identity directory, check spoke system sync status, "
        "investigate ghost accounts, and explain SSO/M2M security policies."
    ),
    "allow_mcp_tools": True,
}

def mask_key(key: Optional[str]) -> Optional[str]:
    if not key or len(key) < 8:
        return None
    return f"{key[:6]}...{key[-4:]}"

def get_raw_settings(db: Session) -> Dict[str, Any]:
    row = db.query(SystemSetting).filter_by(setting_key=SETTING_KEY).first()
    if not row or not row.setting_value:
        return DEFAULT_SETTINGS.copy()
    data = DEFAULT_SETTINGS.copy()
    data.update(row.setting_value)
    return data

def get_ai_settings(db: Session) -> AICopilotSettings:
    raw = get_raw_settings(db)
    api_key = raw.get("api_key")
    return AICopilotSettings(
        enabled=bool(raw.get("enabled", False)),
        provider=str(raw.get("provider", "google")),
        model=str(raw.get("model", "gemini-1.5-flash")),
        api_key_masked=mask_key(api_key),
        has_api_key=bool(api_key),
        base_url=raw.get("base_url"),
        system_prompt=raw.get("system_prompt"),
        allow_mcp_tools=bool(raw.get("allow_mcp_tools", True)),
    )

def update_ai_settings(db: Session, update: AICopilotSettingsUpdate) -> AICopilotSettings:
    row = db.query(SystemSetting).filter_by(setting_key=SETTING_KEY).first()
    if not row:
        row = SystemSetting(setting_key=SETTING_KEY, setting_value=DEFAULT_SETTINGS.copy())
        db.add(row)

    current_val = DEFAULT_SETTINGS.copy()
    if row.setting_value:
        current_val.update(row.setting_value)

    if update.enabled is not None:
        current_val["enabled"] = update.enabled
    if update.provider is not None:
        current_val["provider"] = update.provider
    if update.model is not None:
        current_val["model"] = update.model
    if update.base_url is not None:
        current_val["base_url"] = update.base_url
    if update.system_prompt is not None:
        current_val["system_prompt"] = update.system_prompt
    if update.allow_mcp_tools is not None:
        current_val["allow_mcp_tools"] = update.allow_mcp_tools

    # Only update api_key if a non-empty string is passed and not already masked
    if update.api_key is not None:
        key_str = update.api_key.strip()
        if key_str and "..." not in key_str:
            current_val["api_key"] = key_str
        elif key_str == "":
            current_val["api_key"] = None

    row.setting_value = current_val
    db.commit()
    db.refresh(row)
    return get_ai_settings(db)

async def test_ai_connection(db: Session, req: AITestRequest) -> AITestResponse:
    raw = get_raw_settings(db)
    provider = req.provider or raw.get("provider", "google")
    model = req.model or raw.get("model", "gemini-1.5-flash")
    api_key = req.api_key if req.api_key and "..." not in req.api_key else raw.get("api_key")
    base_url = req.base_url or raw.get("base_url")

    t0 = time.time()
    latency = lambda: int((time.time() - t0) * 1000)

    if provider == "google":
        if not api_key:
            return AITestResponse(success=False, message="กรุณากรอก Google Gemini API Key ก่อนทดสอบ", latency_ms=0)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": "Hello, ping"}]}]}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return AITestResponse(success=True, message=f"เชื่อมต่อ Google Gemini ({model}) สำเร็จ!", latency_ms=latency())
                else:
                    return AITestResponse(success=False, message=f"Google API Error {res.status_code}: {res.text[:200]}", latency_ms=latency())
        except Exception as e:
            return AITestResponse(success=False, message=f"Connection Error: {str(e)}", latency_ms=latency())

    elif provider in ("openai", "custom"):
        if not api_key:
            return AITestResponse(success=False, message=f"กรุณากรอก {provider.upper()} API Key ก่อนทดสอบ", latency_ms=0)
        url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    return AITestResponse(success=True, message=f"เชื่อมต่อ {provider.upper()} ({model}) สำเร็จ!", latency_ms=latency())
                else:
                    return AITestResponse(success=False, message=f"API Error {res.status_code}: {res.text[:200]}", latency_ms=latency())
        except Exception as e:
            return AITestResponse(success=False, message=f"Connection Error: {str(e)}", latency_ms=latency())

    elif provider == "ollama":
        url = (base_url or "http://localhost:11434").rstrip("/") + "/api/generate"
        payload = {"model": model, "prompt": "hi", "stream": False}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return AITestResponse(success=True, message=f"เชื่อมต่อ Local Ollama ({model}) สำเร็จ!", latency_ms=latency())
                else:
                    return AITestResponse(success=False, message=f"Ollama Error {res.status_code}: {res.text[:200]}", latency_ms=latency())
        except Exception as e:
            return AITestResponse(success=False, message=f"Ollama Connection Error: {str(e)}", latency_ms=latency())

    return AITestResponse(success=False, message=f"ไม่รองรับ Provider '{provider}'", latency_ms=latency())

# --- MCP Tool Executor & Fallback Engine ---

def execute_internal_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Central IAM Core MCP Tools directly"""
    from app.mcp.server import (
        ciam_health_check,
        ciam_list_users,
        ciam_get_ghost_accounts,
        ciam_get_spoke_data,
        ciam_get_audit_logs,
    )
    try:
        if tool_name == "ciam_health_check":
            return ciam_health_check()
        elif tool_name == "ciam_list_users":
            return ciam_list_users(
                status=arguments.get("status"),
                search=arguments.get("search"),
                limit=int(arguments.get("limit", 20))
            )
        elif tool_name == "ciam_get_ghost_accounts":
            return ciam_get_ghost_accounts()
        elif tool_name == "ciam_get_spoke_data":
            return ciam_get_spoke_data(
                app_client_id=arguments.get("app_client_id", ""),
                query_type=arguments.get("query_type", "users"),
                filter_param=arguments.get("filter_param")
            )
        elif tool_name == "ciam_get_audit_logs":
            return ciam_get_audit_logs(
                limit=int(arguments.get("limit", 15)),
                category=arguments.get("category"),
                action=arguments.get("action")
            )
        else:
            return {"error": f"Unknown tool '{tool_name}'"}
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}

def detect_tool_intent(user_query: str) -> Optional[tuple[str, Dict[str, Any]]]:
    """Pattern matching for natural language questions to relevant MCP tools"""
    q = user_query.lower()
    if any(k in q for k in ["ghost", "บัญชีผี", "ghost account", "ผี"]):
        return ("ciam_get_ghost_accounts", {})
    if any(k in q for k in ["health", "สถานะระบบ", "health check", "เซิร์ฟเวอร์", "พอร์ต"]):
        return ("ciam_health_check", {})
    if any(k in q for k in ["audit", "log", "ประวัติ", "ใครทำอะไร", "บันทึกการเข้า"]):
        return ("ciam_get_audit_logs", {"limit": 10})
    if any(k in q for k in ["mtpulse", "mt pulse", "mt_pulse"]):
        return ("ciam_get_spoke_data", {"app_client_id": "mtpulse-agent", "query_type": "users"})
    if any(k in q for k in ["irm", "จัดซื้อ", "inventory"]):
        return ("ciam_get_spoke_data", {"app_client_id": "irm-spoke-client", "query_type": "users"})
    if any(k in q for k in ["พนักงาน", "ผู้ใช้", "user", "บัญชีทั้งหมด", "list user"]):
        return ("ciam_list_users", {"limit": 15})
    return None

async def call_external_llm(
    provider: str,
    model: str,
    api_key: str,
    base_url: Optional[str],
    system_prompt: str,
    messages: List[ChatMessage],
    tool_context: Optional[str] = None
) -> str:
    """Invoke External LLM API (Google Gemini / OpenAI)"""
    sys_instruction = system_prompt
    if tool_context:
        sys_instruction += f"\n\n[Real-Time System Context via Central IAM Tools]:\n{tool_context}\n\nPlease summarize and present the findings clearly in professional Thai."

    if provider == "google":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        contents = []
        for m in messages:
            role = "user" if m.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m.content}]})
        
        # Prepend system instruction
        payload = {
            "system_instruction": {"parts": [{"text": sys_instruction}]},
            "contents": contents
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            else:
                raise Exception(f"Gemini API Error {res.status_code}: {res.text[:200]}")

    elif provider in ("openai", "custom"):
        url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        api_messages = [{"role": "system", "content": sys_instruction}]
        for m in messages:
            api_messages.append({"role": m.role, "content": m.content})
        payload = {"model": model, "messages": api_messages, "temperature": 0.3}
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            else:
                raise Exception(f"OpenAI API Error {res.status_code}: {res.text[:200]}")

    raise ValueError(f"Unsupported provider: {provider}")

async def process_ai_chat(db: Session, req: AIChatRequest, current_user: Any) -> AIChatResponse:
    """Core AI Chat processing with tool execution and LLM fallback"""
    raw = get_raw_settings(db)
    if not raw.get("enabled", False):
        return AIChatResponse(
            message=ChatMessage(
                role="assistant",
                content=(
                    "⚠️ **ระบบ AI Copilot ถูกปิดใช้งานอยู่**\n\n"
                    "ผู้ดูแลระบบสามารถเข้าไปเปิดใช้งานและตั้งค่า API Key ได้ที่หน้า **[Settings > AI Copilot]**"
                )
            ),
            tools_used=[],
            session_id=req.session_id,
        )

    last_user_msg = ""
    for m in reversed(req.messages):
        if m.role == "user":
            last_user_msg = m.content
            break

    tools_used: List[str] = []
    tool_context: Optional[str] = None

    # Step 1: Detect intent and execute MCP tool if allowed
    if raw.get("allow_mcp_tools", True) and last_user_msg:
        intent = detect_tool_intent(last_user_msg)
        if intent:
            tool_name, tool_args = intent
            tool_result = execute_internal_mcp_tool(tool_name, tool_args)
            tools_used.append(tool_name)
            tool_context = f"Tool '{tool_name}' Output:\n{json.dumps(tool_result, ensure_ascii=False, indent=2)}"

    # Step 2: Call LLM if API Key is configured
    api_key = raw.get("api_key")
    provider = raw.get("provider", "google")
    model = raw.get("model", "gemini-1.5-flash")
    base_url = raw.get("base_url")
    system_prompt = raw.get("system_prompt", DEFAULT_SETTINGS["system_prompt"])

    if api_key:
        try:
            llm_text = await call_external_llm(
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url,
                system_prompt=system_prompt,
                messages=req.messages,
                tool_context=tool_context
            )
            return AIChatResponse(
                message=ChatMessage(role="assistant", content=llm_text),
                tools_used=tools_used,
                session_id=req.session_id,
            )
        except Exception as e:
            logger.error(f"External LLM call failed: {e}")
            # If external LLM fails, fall through to built-in intelligence response

    # Step 3: Built-in CIAM Rule-based Intelligence Response (Zero-External Dependency)
    if tool_context and tools_used:
        content = (
            f"🤖 **Central IAM Copilot (ระบบวิเคราะห์ข้อมูลอัตโนมัติ)**\n\n"
            f"ผมได้ดึงข้อมูลสดผ่านเครื่องมือ `{tools_used[0]}` ให้เรียบร้อยแล้วครับ:\n\n"
            f"```json\n{tool_context[:2000]}\n```\n\n"
            f"💡 *หมายเหตุ: หากต้องการให้ AI วิเคราะห์เชิงลึกด้วยภาษาธรรมชาติ กรุณาใส่ Google/OpenAI API Key ในหน้า Settings*"
        )
    else:
        content = (
            f"สวัสดีครับคุณ {getattr(current_user, 'full_name', 'Admin')}! 🛡️\n\n"
            "ผมคือ **Central IAM Copilot** ผู้ช่วยอัจฉริยะประจำระบบ Central IAM ยินดีช่วยเหลือครับ:\n\n"
            "- ตรวจสอบบัญชีผี (Ghost Accounts) ในระบบลูก\n"
            "- ตรวจสอบข้อมูลพนักงานและสถานะใน MTPulse / IRM\n"
            "- ตรวจสอบสุขภาพระบบ (Health Check) และ Audit Logs\n"
            "- อธิบายการตั้งค่า SSO, OAuth PKCE และ MCP Server\n\n"
            "ลองถามผมได้เลยครับ เช่น *'มีบัญชีผีในระบบหรือไม่'* หรือ *'ตรวจสอบระบบ MTPulse'* 😊"
        )

    return AIChatResponse(
        message=ChatMessage(role="assistant", content=content),
        tools_used=tools_used,
        session_id=req.session_id,
    )
