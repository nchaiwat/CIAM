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
