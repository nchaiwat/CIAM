import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def admin_token():
    # Login as seeded default admin
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]

def test_get_ai_settings_unauthorized():
    res = client.get("/api/v1/ai/settings", headers={"Authorization": "Bearer invalid_bad_token_xyz"})
    assert res.status_code == 401

def test_get_ai_settings_authorized(admin_token):
    res = client.get(
        "/api/v1/ai/settings",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert "provider" in data
    assert "model" in data

def test_update_ai_settings_admin(admin_token):
    # Enable and set API Key
    res = client.put(
        "/api/v1/ai/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "enabled": True,
            "provider": "google",
            "model": "gemini-1.5-flash",
            "api_key": "AIzaSyTestApiKeyForWindowAsia12345",
            "allow_mcp_tools": True,
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["has_api_key"] is True
    assert data["api_key_masked"] == "AIzaSy...2345"

def test_ai_chat_disabled(admin_token):
    # Temporarily disable
    client.put(
        "/api/v1/ai/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"enabled": False}
    )
    res = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "messages": [{"role": "user", "content": "สวัสดีครับ"}]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "ปิดใช้งาน" in data["message"]["content"]

def test_ai_chat_with_ghost_account_tool(admin_token):
    # Enable AI with fallback
    client.put(
        "/api/v1/ai/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"enabled": True, "allow_mcp_tools": True}
    )
    res = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "messages": [{"role": "user", "content": "ช่วยตรวจดู ghost account ในระบบหน่อยครับ"}]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "ciam_get_ghost_accounts" in data["tools_used"]
    assert len(data["message"]["content"]) > 0

def test_ai_chat_health_check_tool(admin_token):
    res = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "messages": [{"role": "user", "content": "สถานะระบบ health check ตอนนี้เป็นอย่างไร"}]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "ciam_health_check" in data["tools_used"]

def test_ai_chat_specific_username_lookup():
    from app.services.ai_service import detect_tool_intent
    intent = detect_tool_intent("Chaiwat.N ตรวจดูดีๆ")
    assert intent is not None
    tool_name, tool_args = intent
    assert tool_name == "ciam_list_users"
    assert tool_args.get("search") == "Chaiwat.N"


def test_ai_copilot_dashboard_summary_and_calculations(admin_token):
    from app.services.ai_service import execute_internal_mcp_tool, detect_tool_intent

    intent = detect_tool_intent("สรุปภาพรวม Dashboard KPI และสถิติแยกตามแผนก")
    assert intent is not None
    assert intent[0] == "ciam_get_dashboard_summary"

    summary_res = execute_internal_mcp_tool("ciam_get_dashboard_summary", {})
    assert summary_res.get("mode") == "READ_ONLY_ANALYTICS"
    assert "kpi" in summary_res
    assert "department_breakdown" in summary_res
    assert "spoke_breakdown" in summary_res


def test_ai_copilot_strict_read_only_blocks_mutations():
    from app.services.ai_service import execute_internal_mcp_tool, is_mutation_command_intent

    # Direct attempt to execute write tools must be blocked by governance guard
    for forbidden_tool in ("ciam_deprovision_user", "ciam_reactivate_user", "ciam_dispatch_spoke_command"):
        res = execute_internal_mcp_tool(forbidden_tool, {"username": "someone"})
        assert res.get("status") == "READ_ONLY_POLICY_BLOCKED"
        assert res.get("governance_policy") == "STRICT_READ_ONLY_NO_MUTATION"

    # Natural language mutation commands must be flagged as mutation intent
    assert is_mutation_command_intent("ช่วยระงับสิทธิ์พนักงาน Chaiwat.N ให้หน่อย") is True
    assert is_mutation_command_intent("ช่วยลบบัญชีผู้ใช้คนนี้ออกจากระบบ") is True
    assert is_mutation_command_intent("ถ้าจะระงับสิทธิ์ Chaiwat.N จะมีผลกระทบอะไรบ้าง") is False


def test_ai_copilot_rbac_portal_user_restriction():
    from types import SimpleNamespace
    from app.services.ai_service import execute_internal_mcp_tool

    portal_user = SimpleNamespace(username="portal.tester", full_name="Portal Tester", role="PORTAL_USER")

    # Portal user trying to access company-wide ghost accounts or audit logs must be blocked by RBAC
    ghost_attempt = execute_internal_mcp_tool("ciam_get_ghost_accounts", {}, current_user=portal_user)
    assert ghost_attempt.get("status") == "RBAC_FORBIDDEN"
    assert ghost_attempt.get("user_role") == "PORTAL_USER"

    # Portal user querying own access is allowed in self-service mode
    self_access = execute_internal_mcp_tool("ciam_get_portal_my_access", {}, current_user=portal_user)
    assert self_access.get("mode") == "READ_ONLY_SELF_SERVICE"
    assert self_access.get("username") == "portal.tester"


def test_ai_copilot_zero_training_and_dlp_privacy_controls():
    from app.services.ai_service import (
        ZERO_TRAINING_PRIVACY_HEADERS,
        sanitize_context_for_privacy,
        DEFAULT_SYSTEM_PROMPT,
    )

    # 1. Verify mandatory Zero-Training & Zero-Retention HTTP headers exist
    assert ZERO_TRAINING_PRIVACY_HEADERS.get("X-No-Model-Training") == "true"
    assert ZERO_TRAINING_PRIVACY_HEADERS.get("X-Data-Retention") == "none"
    assert ZERO_TRAINING_PRIVACY_HEADERS.get("X-OpenAI-Data-Usage-Opt-Out") == "true"
    assert "no-store" in ZERO_TRAINING_PRIVACY_HEADERS.get("Cache-Control", "")

    # 2. Verify DLP Scrubber strips secrets, keys, and password hashes
    raw_leak = '{"username": "admin", "hashed_password": "$2b$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO", "api_key": "sec_irm_mgmt_9a4f21e8d3b76c501e4a"}'
    cleaned = sanitize_context_for_privacy(raw_leak)
    assert "sec_irm_mgmt_9a4f21e8d3b76c501e4a" not in cleaned
    assert "$2b$12$" not in cleaned
    assert "[REDACTED" in cleaned

    # 3. Verify System Prompt explicitly mandates Zero Model Training & No External Use
    assert "Zero Model Training" in DEFAULT_SYSTEM_PROMPT
    assert "ห้ามนำไปใช้นอกองค์กรโดยเด็ดขาด" in DEFAULT_SYSTEM_PROMPT


