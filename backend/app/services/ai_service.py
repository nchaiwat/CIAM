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

DEFAULT_SYSTEM_PROMPT = (
    "คุณคือ Central IAM Enterprise Copilot ผู้ช่วยอัจฉริยะด้านการบริหารจัดการตัวตนและความปลอดภัย (IAM) "
    "ประจำบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (Window Asia Public Company Limited)\n\n"
    "### กฎเหล็กในการตอบ (Strict Directives):\n"
    "1. ตอบกลับเป็น 'ภาษาไทย' ที่สุภาพ เป็นมืออาชีพ ชัดเจน และกระชับเสมอ เว้นแต่ผู้ใช้จะระบุภาษาอื่น\n"
    "2. ห้ามแสดงความคิดในใจ (Chain-of-thought) ห้ามแปลคำถามซ้ำเป็นภาษาอังกฤษ ให้ตอบคำตอบสุดท้ายแก่ผู้ใช้โดยตรงทันที\n"
    "3. ช่วยตรวจสอบบัญชีผี (Ghost Accounts), ข้อมูลตัวตนใน Active Directory, สถานะระบบลูก (MTPulse, IRM, QMS, SAP B1), สุขภาพระบบ และ Audit Logs\n"
    "4. ใช้ Markdown (หัวข้อ, ข้อย่อย, ตาราง, ตัวหนา) ให้อ่านง่าย สบายตา\n"
    "5. [ความถูกต้องแม่นยำสูงสุดและห้ามแต่งข้อมูล (Zero-Hallucination & Anti-Sycophancy Policy)]:\n"
    "   - ให้ยึดถือข้อมูลตัวเลขและสถานะจาก [Real-Time System Context via Central IAM Tools] เป็นความจริงสูงสุด (Ground Truth) เท่านั้น\n"
    "   - ห้ามเออออตามตัวเลขหรือสมมุติฐานที่ผู้ใช้ถามนำเด็ดขาด หากผู้ใช้ถามว่า 'มี 120 บัญชีใช่ไหม' หรือ 'แสดง 120 บัญชีในหน้าทะเบียนใช่ไหม' แต่ข้อมูลจากระบบ Tool Output ระบุว่ามี 6 บัญชี คุณต้องปฏิเสธและแก้ไขทันทีว่า 'ไม่ถูกต้องครับ ในระบบจริงมีเพียง 6 บัญชี' พร้อมแจกแจงรายชื่อจริงจากระบบ\n"
    "   - ห้ามตอบรับว่า 'ยืนยันตามนี้ครับ' กับตัวเลขที่ผิดพลาดหรือไม่ตรงกับ Context จาก Tool เด็ดขาด\n"
    "   - หากข้อมูลจาก Tool ไม่พบ หรือเกิดข้อผิดพลาด ให้ตอบตามตรงว่าไม่พบข้อมูลหรือระบบขัดข้อง ห้ามแต่งเรื่องหรือคาดเดาขึ้นมาเอง"
)

DEFAULT_SETTINGS: Dict[str, Any] = {
    "enabled": False,
    "provider": "google",
    "model": "gemini-2.5-flash",
    "api_key": None,
    "base_url": None,
    "system_prompt": DEFAULT_SYSTEM_PROMPT,
    "allow_mcp_tools": True,
}

def ensure_thai_directive(prompt: Optional[str]) -> str:
    if not prompt or "You are Central IAM Enterprise Copilot" in prompt:
        return DEFAULT_SYSTEM_PROMPT
    if "ภาษาไทย" not in prompt:
        return f"{prompt}\n\n[ข้อกำหนดสำคัญ]: ต้องตอบเป็นภาษาไทยอย่างสุภาพ กระชับ และตรงประเด็นเสมอ ห้ามแสดงความคิดในใจหรือแปลคำถามซ้ำ และยึดความจริงจากระบบ ห้ามเดาตัวเลข"
    return prompt

def prioritize_models(models: List[str]) -> List[str]:
    """Sort models so recommended fast flash models come first, slow models last"""
    priority_order = [
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-pro",
    ]
    result: List[str] = []
    for p in priority_order:
        if p in models and p not in result:
            result.append(p)
    for m in models:
        if m not in result and "gemini" in m.lower() and "tts" not in m.lower():
            result.append(m)
    for m in models:
        if m not in result:
            result.append(m)
    return result

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
    # Ensure system_prompt enforces Thai
    data["system_prompt"] = ensure_thai_directive(data.get("system_prompt"))
    return data

def get_ai_settings(db: Session) -> AICopilotSettings:
    raw = get_raw_settings(db)
    api_key = raw.get("api_key")
    return AICopilotSettings(
        enabled=bool(raw.get("enabled", False)),
        provider=str(raw.get("provider", "google")),
        model=str(raw.get("model", "gemini-2.5-flash")),
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
    model = req.model or raw.get("model", "gemini-2.5-flash")
    api_key = req.api_key if req.api_key and "..." not in req.api_key else raw.get("api_key")
    base_url = req.base_url or raw.get("base_url")

    t0 = time.time()
    latency = lambda: int((time.time() - t0) * 1000)

    if provider == "google":
        if not api_key:
            return AITestResponse(success=False, message="กรุณากรอก Google Gemini API Key ก่อนทดสอบ", latency_ms=0)
        
        headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
        # Fast lightweight ping payload with 5 tokens limit to minimize latency
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 5}
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Query available models dynamically via ListModels API
            available_models: List[str] = []
            try:
                list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                res_list = await client.get(list_url, headers=headers)
                if res_list.status_code == 200:
                    data = res_list.json()
                    models_raw = data.get("models", [])
                    for item in models_raw:
                        methods = item.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            clean_name = item.get("name", "").replace("models/", "")
                            if clean_name:
                                available_models.append(clean_name)
                elif res_list.status_code in (400, 403):
                    try:
                        err_data = res_list.json().get("error", {})
                        list_error = err_data.get("message", res_list.text[:250])
                    except Exception:
                        list_error = res_list.text[:250]
                    return AITestResponse(
                        success=False,
                        message=f"Google API Error ({res_list.status_code}): {list_error}",
                        latency_ms=latency(),
                    )
            except Exception as e:
                logger.warning(f"Failed to query ListModels: {e}")

            # 2. Sort available models by speed/priority (flash first)
            ordered_available = prioritize_models(available_models)

            # Determine candidates: try user requested model first, then prioritized list
            models_to_try: List[str] = []
            if model:
                models_to_try.append(model)
            for cand in ordered_available:
                if cand not in models_to_try:
                    models_to_try.append(cand)
            if not models_to_try:
                models_to_try = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"]

            last_error = ""
            for m in models_to_try[:4]:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
                try:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        matched_msg = f"เชื่อมต่อ Google Gemini ({m}) สำเร็จ!"
                        suggested = m if m != model else None
                        if suggested:
                            matched_msg += f" (แนะนำให้ใช้โมเดลความเร็วสูง '{m}')"
                        return AITestResponse(
                            success=True,
                            message=matched_msg,
                            latency_ms=latency(),
                            suggested_model=suggested,
                            available_models=ordered_available[:8] if ordered_available else None
                        )
                    else:
                        try:
                            err_data = res.json().get("error", {})
                            google_msg = err_data.get("message", res.text[:200])
                        except Exception:
                            google_msg = res.text[:200]
                        last_error = f"Google API {res.status_code} ({m}): {google_msg}"
                except Exception as e:
                    last_error = f"Connection Error: {str(e)}"
            
            return AITestResponse(
                success=False,
                message=last_error or "ไม่สามารถเชื่อมต่อโมเดลใดๆ ได้",
                latency_ms=latency(),
                available_models=ordered_available[:8] if ordered_available else None
            )



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
    """Execute Central IAM Core MCP Tools directly with robust parameter translation"""
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
            is_act = arguments.get("is_active")
            if is_act is None and "status" in arguments:
                st = str(arguments["status"]).lower().strip()
                if st in ("active", "true", "1", "ad_active"):
                    is_act = True
                elif st in ("inactive", "false", "0", "ad_inactive", "terminated"):
                    is_act = False
            return ciam_list_users(
                search=str(arguments.get("search") or ""),
                department=str(arguments.get("department") or ""),
                is_active=is_act,
                app_code=str(arguments.get("app_code") or ""),
                limit=int(arguments.get("limit", 50))
            )
        elif tool_name == "ciam_get_ghost_accounts":
            return ciam_get_ghost_accounts()
        elif tool_name == "ciam_get_spoke_data":
            app_target = str(arguments.get("app_code") or arguments.get("app_client_id") or "")
            return ciam_get_spoke_data(
                app_code=app_target,
                search=str(arguments.get("search") or "")
            )
        elif tool_name == "ciam_get_audit_logs":
            action_target = str(arguments.get("action_type") or arguments.get("action") or arguments.get("category") or "")
            return ciam_get_audit_logs(
                limit=int(arguments.get("limit", 15)),
                action_type=action_target
            )
        else:
            return {"error": f"Unknown tool '{tool_name}'"}
    except Exception as e:
        logger.error(f"execute_internal_mcp_tool error on {tool_name}: {e}", exc_info=True)
        return {"error": f"Tool execution failed: {str(e)}"}

_SYSTEM_STOPWORDS = {
    "user", "users", "account", "accounts", "admin", "active", "inactive",
    "directory", "spoke", "spokes", "app", "apps", "mtpulse", "pulse",
    "irm", "qms", "qol", "sap", "b1", "sap_b1", "erp", "pfsense", "pfsense_fac",
    "pfsense_ho", "fac", "ho", "vpn", "firewall", "m365", "ad", "sso", "oidc",
    "oauth", "pkce", "mcp", "ghost", "audit", "log", "logs", "health", "check",
    "status", "list", "all", "total", "online", "offline", "ciam", "central",
    "iam", "window", "asia", "windowasia", "com", "net", "org", "local",
    "true", "false", "null", "none", "api", "key", "token", "jwt", "rs256",
    "system", "server", "connect", "test", "ping", "sync", "error", "role",
    "roles", "group", "groups", "department", "dept", "office", "branch",
    "shop", "code", "mode", "client", "agent", "bot", "telegram", "line",
    "portal", "login", "password", "pass", "cert", "certificate", "offboard",
    "offboarding", "provision", "provisioning", "deprovision", "reactivate",
    "enable", "disable", "filter", "search", "help", "info", "data",
    "discrepancy", "uptime", "inventory",
}


def extract_user_search_term(user_query: str, history_messages: Optional[List[ChatMessage]] = None) -> Optional[str]:
    """
    Extract a specific username (e.g. 'Chaiwat.N', 'Duanghathai.P') or person name
    from the user's message, or from recent user messages on follow-up prompts.
    """
    import re

    def _extract_from_text(text: str) -> Optional[str]:
        # 1. Explicit email address -> username part
        email_m = re.search(r"\b([A-Za-z0-9._%+-]+)@(?:windowasia\.com|wa\.net)\b", text, re.IGNORECASE)
        if email_m:
            return email_m.group(1)

        # 2. Standard corporate username format: Firstname.I or Firstname.II (e.g. Chaiwat.N, Duanghathai.P)
        dot_matches = re.findall(r"\b([A-Za-z][A-Za-z0-9_-]{1,25}\.[A-Za-z]{1,4})\b", text)
        for dm in dot_matches:
            low_dm = dm.lower()
            if not any(low_dm.endswith(ext) for ext in (".com", ".net", ".org", ".md", ".py", ".js", ".ts", ".json")):
                return dm

        # 3. English name/username token (3+ chars) that is not a reserved system keyword
        eng_tokens = re.findall(r"\b([A-Za-z][A-Za-z0-9_-]{2,25})\b", text)
        for tok in eng_tokens:
            if tok.lower() not in _SYSTEM_STOPWORDS:
                return tok

        # 4. Thai name following common person prefixes (คุณ..., ชื่อ...)
        thai_m = re.search(r"(?:คุณ|ชื่อบัญชี|ชื่อผู้ใช้|พนักงานชื่อ|ค้นหาชื่อ)\s*([ก-๙A-Za-z0-9._-]{2,30})", text)
        if thai_m:
            cand = thai_m.group(1).strip()
            if cand not in ("อะไร", "ใคร", "ไหน", "บ้าง", "ครับ", "ค่ะ"):
                return cand

        return None

    # Check current user query first
    found = _extract_from_text(user_query)
    if found:
        return found

    # If current query is a follow-up (e.g. "ตรวจดูดีๆ", "เช็คอีกที", "มีสิทธิ์อะไรบ้าง"), check recent user messages
    if history_messages and any(k in user_query.lower() for k in ["ตรวจ", "เช็ค", "ดูดีๆ", "อีกที", "อีกครั้ง", "สิทธิ์", "ไหม", "หรือเปล่า", "คนนี้"]):
        for m in reversed(history_messages[:-1]):
            if m.role == "user":
                prev_found = _extract_from_text(m.content)
                if prev_found:
                    return prev_found
    return None


def detect_tool_intent(user_query: str, history_messages: Optional[List[ChatMessage]] = None) -> Optional[tuple[str, Dict[str, Any]]]:
    """Pattern matching for natural language questions to relevant MCP tools with conversation context awareness"""
    q = user_query.lower()

    # Check context from recent messages if query lacks explicit app mention
    context_text = ""
    if history_messages:
        recent = history_messages[-4:]
        context_text = " ".join(m.content for m in recent).lower()

    # 1. Ghost Accounts
    if any(k in q for k in ["ghost", "บัญชีผี", "ghost account", "ผี", "ค้าง", "discrepancy"]):
        return ("ciam_get_ghost_accounts", {})

    # 2. Health check
    if any(k in q for k in ["health", "สถานะระบบ", "health check", "เซิร์ฟเวอร์", "พอร์ต", "uptime"]):
        return ("ciam_health_check", {})

    # 3. Audit logs
    if any(k in q for k in ["audit", "log", "ประวัติ", "ใครทำอะไร", "บันทึกการเข้า"]):
        return ("ciam_get_audit_logs", {"limit": 10})

    # 4. Specific User / Person Lookup (e.g. 'Chaiwat.N', 'Chaiwat.N ตรวจดูดีๆ', 'ค้นหา Duanghathai.P')
    user_search = extract_user_search_term(user_query, history_messages)
    if user_search:
        return ("ciam_list_users", {"search": user_search, "limit": 50})

    # 4. Spoke Apps: MTPulse, IRM, SAP B1, pfSense
    spoke_detected = None
    if any(k in q for k in ["mtpulse", "mt pulse", "mt_pulse"]) or ("mtpulse" in context_text and any(k in q for k in ["บัญชี", "ผู้ใช้", "แสดง", "กี่", "ทะเบียน", "คน", "ยืนยัน"])):
        spoke_detected = "mtpulse"
    elif any(k in q for k in ["irm", "จัดซื้อ", "inventory"]) or ("irm" in context_text and any(k in q for k in ["บัญชี", "ผู้ใช้", "แสดง", "กี่", "ทะเบียน", "คน", "ยืนยัน"])):
        spoke_detected = "irm"
    elif any(k in q for k in ["sap", "sap b1", "sap_b1", "erp"]) or ("sap" in context_text and any(k in q for k in ["บัญชี", "ผู้ใช้", "แสดง", "กี่", "ทะเบียน", "คน", "ยืนยัน"])):
        spoke_detected = "sap_b1"
    elif any(k in q for k in ["pfsense", "vpn", "firewall"]) or ("pfsense" in context_text and any(k in q for k in ["บัญชี", "ผู้ใช้", "แสดง", "กี่", "ทะเบียน", "คน", "ยืนยัน"])):
        spoke_detected = "pfsense_fac"

    # If spoke is detected AND user is asking about directory / users / count / listing / confirmation
    if spoke_detected:
        if any(k in q for k in ["ทะเบียน", "directory", "filter", "กรอง", "แสดงในหน้า", "หน้าทะเบียน", "กี่คน", "กี่บัญชี", "จำนวน", "ยืนยัน"]):
            return ("ciam_list_users", {"app_code": spoke_detected, "limit": 100})
        return ("ciam_get_spoke_data", {"app_code": spoke_detected})

    # 5. General User Directory Listing
    if any(k in q for k in ["พนักงาน", "ผู้ใช้", "user", "บัญชี", "list user", "ทะเบียน", "directory", "ตรวจ", "ค้นหา", "เช็ค", "สิทธิ์"]):
        return ("ciam_list_users", {"limit": 100})

    return None

async def call_external_llm(
    provider: str,
    model: str,
    api_key: str,
    base_url: Optional[str],
    system_prompt: str,
    messages: List[ChatMessage],
    tool_context: Optional[str] = None
) -> tuple[str, str]:
    """Invoke External LLM API (Google Gemini / OpenAI) and return (response_text, model_used)"""
    sys_instruction = ensure_thai_directive(system_prompt)
    if tool_context:
        sys_instruction += (
            f"\n\n[Real-Time System Context via Central IAM Tools - GROUND TRUTH]:\n{tool_context}\n\n"
            f"[ข้อกำหนดสำคัญด้านความถูกต้องของข้อมูล (Zero-Hallucination & Anti-Sycophancy)]:\n"
            f"1. ให้ยึดถือข้อมูลตัวเลขและรายชื่อจาก Tool Output ด้านบนเป็นความจริง 100% เท่านั้น\n"
            f"2. หากผู้ใช้ถามนำด้วยตัวเลขที่ผิดพลาด หรือขอให้ยืนยันตัวเลขที่ไม่ตรงกับ Tool Output "
            f"(เช่น ผู้ใช้ถามว่ามี 120 บัญชี แต่ข้อมูลจริงใน Tool Output ระบุว่ามี 6 บัญชี) "
            f"คุณต้องปฏิเสธอย่างชัดเจนทันทีและแก้ไขตัวเลขให้ถูกต้องตาม Tool Output พร้อมแจกแจงรายชื่อจริง ห้ามตอบรับว่า 'ยืนยันตามนี้ครับ' หรือเออออตามตัวเลขผิดเด็ดขาด!\n"
            f"3. สรุปและตอบคำถามเป็นภาษาไทยอย่างสุภาพ กระชับ เป็นมืออาชีพ และตรงประเด็น"
        )

    if provider == "google":
        # Prioritize requested model, then fast flash fallbacks
        models_to_try = [model]
        for fallback_m in ("gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-1.5-flash"):
            if fallback_m not in models_to_try:
                models_to_try.append(fallback_m)

        contents = []
        for m in messages:
            role = "user" if m.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m.content}]})

        # Prepend system instruction and generationConfig for speed & strict Thai adherence
        payload = {
            "system_instruction": {"parts": [{"text": sys_instruction}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            }
        }
        headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=25.0) as client:
            last_err = ""
            for m_candidate in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_candidate}:generateContent?key={api_key}"
                try:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        return text, m_candidate
                    try:
                        err_data = res.json().get("error", {})
                        google_msg = err_data.get("message", res.text[:200])
                    except Exception:
                        google_msg = res.text[:200]
                    last_err = f"Gemini API Error {res.status_code} ({m_candidate}): {google_msg}"
                except Exception as e:
                    last_err = str(e)
            raise Exception(last_err)

    elif provider in ("openai", "custom"):
        url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        api_messages = [{"role": "system", "content": sys_instruction}]
        for m in messages:
            api_messages.append({"role": m.role, "content": m.content})
        payload = {"model": model, "messages": api_messages, "temperature": 0.2}
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"], model
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
            model_used=None,
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
        intent = detect_tool_intent(last_user_msg, req.messages)
        if intent:
            tool_name, tool_args = intent
            tool_result = execute_internal_mcp_tool(tool_name, tool_args)
            tools_used.append(tool_name)
            tool_context = f"Tool '{tool_name}' Output:\n{json.dumps(tool_result, ensure_ascii=False, indent=2)}"

    # Step 2: Call LLM if API Key is configured
    api_key = raw.get("api_key")
    provider = raw.get("provider", "google")
    model = raw.get("model", "gemini-2.5-flash")
    base_url = raw.get("base_url")
    system_prompt = raw.get("system_prompt", DEFAULT_SETTINGS["system_prompt"])

    if api_key:
        try:
            llm_text, model_used = await call_external_llm(
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
                model_used=model_used,
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
        model_used="Central IAM Rules",
    )
