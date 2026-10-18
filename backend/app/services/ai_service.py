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
    "### ขอบเขตอำนาจหน้าที่และกฎเหล็กในการทำงาน (Core Governance Directives):\n"
    "1. **ภาษาและรูปแบบ:** ตอบกลับเป็น 'ภาษาไทย' ที่สุภาพ เป็นมืออาชีพ ชัดเจน และกระชับเสมอ ใช้ Markdown (หัวข้อ, ข้อย่อย, ตาราง, ตัวหนา) ให้อ่านง่าย ห้ามแสดงความคิดในใจ (Chain-of-thought)\n"
    "2. **ครอบคลุมการแสดงผลและคำนวณทุกฟังก์ชันของระบบ (100% Read & Analytical Parity):**\n"
    "   - คุณสามารถดึงข้อมูล คำนวณสถิติ และสรุปผลได้ครบทุกหน้าจอที่มีในระบบ ได้แก่: ภาพรวม Dashboard KPI, สถิติจำนวนพนักงานแยกตามแผนก, ทะเบียนผู้ใช้ (User Directory), บัญชีผี (Ghost Accounts) และข้อยกเว้นที่อนุมัติแล้ว, ข้อมูลระบบลูก (MTPulse, IRM, QMS, SAP B1, pfSense, M365, AD), การจำลองผลกระทบก่อนระงับสิทธิ์ (Offboarding Impact Preview), ประวัติการใช้งาน (Audit Trail) และสิทธิ์เข้าใช้งาน SSO Portal\n"
    "3. **ทำงานตามสิทธิ์ของผู้ใช้งานจริงอย่างเคร่งครัด (Strict Role-Based Access Control - RBAC):**\n"
    "   - ผู้ดูแลระบบ (`SUPER_ADMIN`, `ADMIN`, `AUDITOR`) สามารถสอบถามและวิเคราะห์ข้อมูลภาพรวมทั้งองค์กรได้\n"
    "   - พนักงานทั่วไป (`PORTAL_USER`) สามารถตรวจสอบได้เฉพาะข้อมูลบัญชีและรายการแอป SSO ของตนเองเท่านั้น ห้ามเปิดเผยข้อมูลของพนักงานคนอื่นหรือข้อมูลระดับผู้ดูแลระบบเด็ดขาด\n"
    "4. **นโยบายห้ามแก้ไขข้อมูลโดยเด็ดขาด (Strict Read-Only / Zero-Mutation Policy):**\n"
    "   - คุณทำงานในโหมด **Read-Only (อ่าน ค้นหา คำนวณ และจำลองผลกระทบเท่านั้น)**\n"
    "   - **ห้ามทำการ Update, Create, Modify, Delete, ระงับสิทธิ์ (Offboard), เปิดสิทธิ์คืน, หรือเปลี่ยนการตั้งค่าระบบใดๆ ทั้งสิ้น**\n"
    "   - หากผู้ใช้สั่งให้แก้ไขข้อมูล ลบบัญชี หรือระงับสิทธิ์พนักงาน ให้ปฏิเสธการแก้ไขข้อมูลอย่างสุภาพ โดยแจ้งว่าเป็นนโยบายความปลอดภัย Read-Only ของ AI Copilot จากนั้นให้แสดงข้อมูลปัจจุบันหรือจำลองผลกระทบ (Read-Only Preview) พร้อมแนะนำเมนูและปุ่มบนหน้าเว็บให้ผู้ใช้ไปกดดำเนินการด้วยตนเอง\n"
    "5. **ความถูกต้องแม่นยำสูงสุดและห้ามแต่งข้อมูล (Zero-Hallucination & Anti-Sycophancy Policy):**\n"
    "   - ให้ยึดถือข้อมูลตัวเลขและสถานะจาก [Real-Time System Context via Central IAM Tools] เป็นความจริงสูงสุด (Ground Truth) เท่านั้น\n"
    "   - ห้ามเออออตามตัวเลขหรือสมมุติฐานที่ผู้ใช้ถามนำเด็ดขาด หากตัวเลขที่ผู้ใช้ถามไม่ตรงกับ Tool Output ต้องปฏิเสธและแก้ไขให้ถูกต้องทันที ห้ามตอบรับว่า 'ยืนยันตามนี้ครับ' กับตัวเลขที่ผิดเด็ดขาด"
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
    if "Read-Only" not in prompt or "ภาษาไทย" not in prompt:
        return (
            f"{prompt}\n\n"
            "[ข้อกำหนดธรรมาภิบาลสำคัญ]: ต้องตอบเป็นภาษาไทยอย่างสุภาพ กระชับ ยึดความจริงจากระบบ 100% ห้ามเดาตัวเลข "
            "ทำงานตามสิทธิ์ผู้ใช้งาน (RBAC) และทำงานในโหมด Read-Only เท่านั้น (แสดงผลและคำนวณได้ทุกฟังก์ชัน แต่ห้าม Update/แก้ไข/ลบข้อมูลใดๆ ในระบบ)"
        )
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

# --- MCP Tool Executor & Fallback Engine (Strictly Read-Only & RBAC Enforced) ---

READ_ONLY_ALLOWED_TOOLS = {
    "ciam_get_dashboard_summary",
    "ciam_health_check",
    "ciam_list_users",
    "ciam_get_ghost_accounts",
    "ciam_get_spoke_data",
    "ciam_get_audit_logs",
    "ciam_preview_offboarding_impact",
    "ciam_get_portal_my_access",
}

FORBIDDEN_MUTATION_TOOLS = {
    "ciam_deprovision_user",
    "ciam_reactivate_user",
    "ciam_dispatch_spoke_command",
}


def execute_internal_mcp_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    current_user: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Execute Central IAM Core MCP Tools in STRICT READ-ONLY MODE with Role-Based Access Control (RBAC).
    Any attempt to invoke a state-mutating tool is blocked at the governance layer.
    """
    from app.mcp.server import (
        ciam_get_dashboard_summary,
        ciam_health_check,
        ciam_list_users,
        ciam_get_ghost_accounts,
        ciam_get_spoke_data,
        ciam_get_audit_logs,
        ciam_preview_offboarding_impact,
        ciam_get_portal_my_access,
    )

    # 1. Strict Zero-Mutation Guard: Never allow AI Copilot to execute write/update/delete tools
    if tool_name in FORBIDDEN_MUTATION_TOOLS or tool_name not in READ_ONLY_ALLOWED_TOOLS:
        return {
            "status": "READ_ONLY_POLICY_BLOCKED",
            "governance_policy": "STRICT_READ_ONLY_NO_MUTATION",
            "message": (
                f"ปฏิเสธการทำงานของ '{tool_name}': AI Copilot มีขอบเขตการทำงานแบบ Read-Only "
                "(อ่าน คำนวณ และแสดงผลเท่านั้น) ห้ามทำการแก้ไข อัปเดต หรือระงับสิทธิ์ในระบบโดยเด็ดขาด"
            ),
        }

    # 2. Strict Role-Based Access Control (RBAC) Guard
    user_role = getattr(current_user, "role", "SUPER_ADMIN") if current_user is not None else "SUPER_ADMIN"
    current_username = getattr(current_user, "username", "") if current_user is not None else ""

    if user_role == "PORTAL_USER":
        # Regular portal users may ONLY inspect their own identity and their own authorized SSO apps
        if tool_name in ("ciam_get_portal_my_access", "ciam_list_users"):
            return ciam_get_portal_my_access(username=current_username)
        return {
            "status": "RBAC_FORBIDDEN",
            "user_role": user_role,
            "username": current_username,
            "message": (
                f"บัญชีของคุณ ({current_username} - สิทธิ์ผู้ใช้งานทั่วไป PORTAL_USER) "
                "สามารถตรวจสอบได้เฉพาะข้อมูลบัญชีและรายการแอป SSO ของตนเองเท่านั้น "
                "ไม่มีสิทธิ์เข้าถึงข้อมูลทะเบียนผู้ใช้ของผู้อื่นหรือข้อมูลผู้ดูแลระบบครับ"
            ),
            "my_portal_access": ciam_get_portal_my_access(username=current_username),
        }

    try:
        if tool_name == "ciam_get_dashboard_summary":
            return ciam_get_dashboard_summary()
        elif tool_name == "ciam_health_check":
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
                limit=int(arguments.get("limit", 50)),
            )
        elif tool_name == "ciam_get_ghost_accounts":
            return ciam_get_ghost_accounts()
        elif tool_name == "ciam_get_spoke_data":
            app_target = str(arguments.get("app_code") or arguments.get("app_client_id") or "")
            return ciam_get_spoke_data(
                app_code=app_target,
                search=str(arguments.get("search") or ""),
            )
        elif tool_name == "ciam_get_audit_logs":
            action_target = str(arguments.get("action_type") or arguments.get("action") or arguments.get("category") or "")
            return ciam_get_audit_logs(
                limit=int(arguments.get("limit", 15)),
                action_type=action_target,
                search=str(arguments.get("search") or ""),
            )
        elif tool_name == "ciam_preview_offboarding_impact":
            return ciam_preview_offboarding_impact(
                username=str(arguments.get("username") or arguments.get("search") or "")
            )
        elif tool_name == "ciam_get_portal_my_access":
            target_u = str(arguments.get("username") or current_username)
            return ciam_get_portal_my_access(username=target_u)
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
    "discrepancy", "uptime", "inventory", "dashboard", "kpi", "summary",
    "update", "edit", "delete", "remove", "create", "add", "reset",
}


def is_mutation_command_intent(user_query: str) -> bool:
    """
    Detect if the user is asking AI Copilot to perform an Update, Create, Modify, Delete,
    Offboard, Deprovision, Reactivate, or Settings change action.
    """
    q = user_query.lower().strip()
    # Read-only questions about offboarding/updates (e.g. "ใครถูกระงับสิทธิ์บ้าง", "ประวัติการแก้ไข", "ถ้าจะระงับสิทธิ์จะกระทบอะไร") are allowed
    if any(ro in q for ro in ["ใครถูก", "มีใคร", "ประวัติ", "audit", "log", "ถ้าจะ", "ผลกระทบ", "preview", "จำลอง", "มีกี่", "กี่คน", "กี่บัญชี"]):
        return False

    mutation_phrases = [
        "ช่วยระงับสิทธิ์", "สั่งระงับสิทธิ์", "ทำการระงับสิทธิ์", "ตัดสิทธิ์ให้หน่อย", "ปิดบัญชีให้หน่อย",
        "deprovision", "offboard ให้หน่อย", "สั่ง offboard",
        "ช่วยเปิดสิทธิ์", "เปิดบัญชีให้หน่อย", "reactivate",
        "ช่วยลบ", "สั่งลบ", "ลบบัญชี", "ลบผู้ใช้", "delete user", "remove user",
        "ช่วยแก้ไข", "แก้ไขข้อมูล", "อัปเดตข้อมูล", "เปลี่ยนชื่อ", "เปลี่ยนแผนก", "เปลี่ยนรหัสผ่าน", "reset password",
        "ช่วยเพิ่มผู้ใช้", "สร้างบัญชี", "เพิ่มสิทธิ์", "ผูกสิทธิ์", "สั่งซิงก์", "กดซิงก์ให้หน่อย",
    ]
    return any(mp in q for mp in mutation_phrases)


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
    """Pattern matching for natural language questions to relevant Read-Only MCP tools with conversation context awareness"""
    q = user_query.lower()

    # Check context from recent messages if query lacks explicit app mention
    context_text = ""
    if history_messages:
        recent = history_messages[-4:]
        context_text = " ".join(m.content for m in recent).lower()

    # 0. Offboarding Impact Preview or Mutation Refusal Preview
    user_search = extract_user_search_term(user_query, history_messages)
    if any(k in q for k in ["offboard", "ระงับสิทธิ์", "ลาออก", "ตัดสิทธิ์", "ผลกระทบ"]):
        if user_search:
            return ("ciam_preview_offboarding_impact", {"username": user_search})

    # 1. Ghost Accounts
    if any(k in q for k in ["ghost", "บัญชีผี", "ghost account", "ผี", "ค้าง", "discrepancy"]):
        return ("ciam_get_ghost_accounts", {})

    # 2. Dashboard KPI / Overall Summary / Department Breakdown / Total Calculations
    if any(k in q for k in [
        "dashboard", "kpi", "ภาพรวม", "สรุปภาพรวม", "สถิติ", "แยกตามแผนก", "แต่ละแผนก",
        "ทั้งหมดกี่", "มีกี่แผนก", "ข้อยกเว้น", "exception", "ตารางเวลาซิงก์", "auto sync",
    ]):
        return ("ciam_get_dashboard_summary", {})

    # 3. Health check
    if any(k in q for k in ["health", "สถานะระบบ", "health check", "เซิร์ฟเวอร์", "พอร์ต", "uptime", "ออนไลน์"]):
        return ("ciam_health_check", {})

    # 4. Audit logs
    if any(k in q for k in ["audit", "log", "ประวัติ", "ใครทำอะไร", "บันทึกการเข้า"]):
        return ("ciam_get_audit_logs", {"limit": 15, "search": user_search or ""})

    # 5. Specific User / Person Lookup (e.g. 'Chaiwat.N', 'Chaiwat.N ตรวจดูดีๆ', 'ค้นหา Duanghathai.P')
    if user_search:
        return ("ciam_list_users", {"search": user_search, "limit": 50})

    # 6. Spoke Apps: MTPulse, IRM, SAP B1, pfSense
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

    # 7. General User Directory Listing or Summary
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
            f"[ข้อกำหนดสำคัญด้านความถูกต้องของข้อมูลและธรรมาภิบาล (Zero-Hallucination & Strict Read-Only Policy)]:\n"
            f"1. ให้ยึดถือข้อมูลตัวเลขและรายชื่อจาก Tool Output ด้านบนเป็นความจริง 100% เท่านั้น\n"
            f"2. ห้ามทำการแก้ไข อัปเดต ลบ หรือระงับสิทธิ์ใดๆ ในระบบ หากผู้ใช้ร้องขอให้แก้ไขข้อมูล ให้แจ้งอย่างสุภาพว่า AI Copilot ทำงานในโหมด Read-Only เท่านั้น พร้อมแสดงข้อมูลจริงจาก Tool Output และแนะนำเมนูบนหน้าเว็บให้ผู้ใช้ไปกดดำเนินการด้วยตนเอง\n"
            f"3. หากผู้ใช้ถามนำด้วยตัวเลขที่ผิดพลาด หรือขอให้ยืนยันตัวเลขที่ไม่ตรงกับ Tool Output "
            f"(เช่น ผู้ใช้ถามว่ามี 120 บัญชี แต่ข้อมูลจริงใน Tool Output ระบุว่ามี 6 บัญชี) "
            f"คุณต้องปฏิเสธอย่างชัดเจนทันทีและแก้ไขตัวเลขให้ถูกต้องตาม Tool Output พร้อมแจกแจงรายชื่อจริง ห้ามตอบรับว่า 'ยืนยันตามนี้ครับ' หรือเออออตามตัวเลขผิดเด็ดขาด!\n"
            f"4. สรุปและตอบคำถามเป็นภาษาไทยอย่างสุภาพ กระชับ เป็นมืออาชีพ และตรงประเด็น"
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
    """Core AI Chat processing with RBAC enforcement, Strict Read-Only tool execution, and LLM fallback"""
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

    user_role = getattr(current_user, "role", "SUPER_ADMIN") if current_user is not None else "SUPER_ADMIN"
    current_username = getattr(current_user, "username", "admin") if current_user is not None else "admin"

    tools_used: List[str] = []
    tool_context: Optional[str] = None
    mutation_requested = is_mutation_command_intent(last_user_msg) if last_user_msg else False

    # Step 1: Detect intent and execute Read-Only MCP tool (scoped by user's RBAC role)
    if raw.get("allow_mcp_tools", True) and last_user_msg:
        if user_role == "PORTAL_USER":
            # Portal users always get their own RBAC-scoped context
            intent = detect_tool_intent(last_user_msg, req.messages)
            tool_name = intent[0] if intent else "ciam_get_portal_my_access"
            tool_args = intent[1] if intent else {"username": current_username}
            tool_result = execute_internal_mcp_tool(tool_name, tool_args, current_user=current_user)
            tools_used.append("ciam_get_portal_my_access")
            tool_context = (
                f"[Caller RBAC Context: username='{current_username}', role='{user_role}' (Self-Service Only)]\n"
                f"Tool Output:\n{json.dumps(tool_result, ensure_ascii=False, indent=2)}"
            )
        else:
            intent = detect_tool_intent(last_user_msg, req.messages)
            if intent:
                tool_name, tool_args = intent
                tool_result = execute_internal_mcp_tool(tool_name, tool_args, current_user=current_user)
                tools_used.append(tool_name)
                tool_context = (
                    f"[Caller RBAC Context: username='{current_username}', role='{user_role}']\n"
                    f"Tool '{tool_name}' Output:\n{json.dumps(tool_result, ensure_ascii=False, indent=2)}"
                )

    if mutation_requested:
        readonly_guard_note = (
            "\n\n[STRICT READ-ONLY GOVERNANCE ALERT]: ผู้ใช้กำลังสั่งให้แก้ไข/อัปเดต/ลบ หรือระงับสิทธิ์ในระบบ "
            "คุณต้องแจ้งผู้ใช้อย่างชัดเจนว่า 'AI Copilot ทำงานในโหมด Read-Only (อ่าน คำนวณ และแสดงผลเท่านั้น) "
            "ไม่ได้รับอนุญาตให้ทำการแก้ไข อัปเดต หรือระงับสิทธิ์ในระบบโดยตรง' "
            "จากนั้นแสดงข้อมูลปัจจุบันหรือผลกระทบจากการจำลอง (Preview) ให้ดู และแนะนำเมนูบนหน้าเว็บให้ผู้ใช้กดทำรายการด้วยตนเอง"
        )
        tool_context = (tool_context or "") + readonly_guard_note

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
    if mutation_requested:
        preview_snippet = f"\n\n```json\n{tool_context[:1800]}\n```" if tool_context else ""
        content = (
            "🛡️ **นโยบายความปลอดภัย AI Copilot (Strict Read-Only Mode)**\n\n"
            "ขออภัยครับ **Central IAM Copilot** มีขอบเขตการทำงานสำหรับการ **อ่าน ค้นหา คำนวณสถิติ และจำลองผลกระทบ (Read-Only) เท่านั้น** "
            "ไม่อนุญาตให้ทำการแก้ไข อัปเดต ลบ หรือสั่งระงับสิทธิ์ลงในฐานข้อมูลโดยตรง เพื่อความมั่นคงปลอดภัยตามมาตรฐาน ISO/IEC 27001 ครับ\n\n"
            "- หากต้องการ **ระงับสิทธิ์พนักงาน (1-Click Offboard):** กรุณาไปที่เมนู **`ศูนย์ระงับสิทธิ์ (/offboarding)`**\n"
            "- หากต้องการ **แก้ไข/ผูกบัญชีผู้ใช้:** กรุณาไปที่เมนู **`ทะเบียนผู้ใช้ (/directory)`**\n"
            "- หากต้องการ **ตั้งค่าระบบลูกหรือสั่งซิงก์:** กรุณาไปที่เมนู **`ระบบที่เชื่อมต่อ (/applications)`**"
            f"{preview_snippet}"
        )
    elif tool_context and tools_used:
        content = (
            f"🤖 **Central IAM Copilot (ระบบวิเคราะห์ข้อมูลอัตโนมัติ - Read-Only)**\n\n"
            f"ผมได้ดึงและคำนวณข้อมูลสดตามสิทธิ์ของคุณ (`{user_role}`) ผ่านเครื่องมือ `{tools_used[0]}` เรียบร้อยแล้วครับ:\n\n"
            f"```json\n{tool_context[:2000]}\n```\n\n"
            f"💡 *หมายเหตุ: ข้อมูลทั้งหมดแสดงผลแบบ Read-Only โดยไม่มีการแก้ไขข้อมูลในระบบ*"
        )
    else:
        content = (
            f"สวัสดีครับคุณ {getattr(current_user, 'full_name', 'Admin')} (`{user_role}`)! 🛡️\n\n"
            "ผมคือ **Central IAM Copilot** ผู้ช่วยวิเคราะห์ข้อมูลประจำระบบ Central IAM (โหมด **Read-Only 100%** ตามสิทธิ์ผู้ใช้งาน):\n\n"
            "- 📊 **สรุปภาพรวม & คำนวณสถิติ (Dashboard KPI & แยกตามแผนก)**\n"
            "- 👥 **ค้นหาและตรวจสอบทะเบียนผู้ใช้ (User Directory & สิทธิ์ระบบลูก)**\n"
            "- 👻 **ตรวจสอบความเสี่ยงบัญชีผี (Ghost Accounts) & ข้อยกเว้น**\n"
            "- 🔍 **จำลองผลกระทบก่อนระงับสิทธิ์ (Offboarding Impact Preview)**\n"
            "- 🔌 **ตรวจสอบสถานะระบบลูก (MTPulse, IRM, SAP B1, pfSense) & Audit Logs**\n\n"
            "*(หมายเหตุ: AI Copilot ทำหน้าที่แสดงผลและคำนวณข้อมูลตามสิทธิ์เท่านั้น ไม่มีการแก้ไขหรืออัปเดตข้อมูลใดๆ ในระบบ)*"
        )

    return AIChatResponse(
        message=ChatMessage(role="assistant", content=content),
        tools_used=tools_used,
        session_id=req.session_id,
        model_used="Central IAM Rules",
    )
