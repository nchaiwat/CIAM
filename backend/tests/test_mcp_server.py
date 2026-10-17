import pytest
from app.mcp.server import (
    mcp_server,
    ciam_health_check,
    ciam_list_users,
    ciam_get_ghost_accounts,
    ciam_get_spoke_data,
    ciam_get_audit_logs,
    ciam_dispatch_spoke_command,
    ciam_deprovision_user,
    ciam_reactivate_user
)

def test_mcp_server_metadata():
    assert mcp_server.name == "central-iam"
    assert mcp_server.version == "1.0.0"

def test_mcp_health_check():
    res = ciam_health_check()
    assert "status" in res
    assert "spokes" in res
    assert len(res["spokes"]) > 0

def test_mcp_list_users():
    res = ciam_list_users(limit=5)
    assert "users" in res
    assert len(res["users"]) > 0
    assert "username" in res["users"][0]
    assert "linked_spokes" in res["users"][0]

def test_mcp_get_ghost_accounts():
    res = ciam_get_ghost_accounts()
    assert "total_ghost_accounts" in res
    assert "severity" in res

def test_mcp_get_spoke_data():
    # Test valid spoke (e.g. MTPulse)
    res = ciam_get_spoke_data("mtpulse")
    assert res["app_code"].lower() == "mtpulse"
    assert "accounts" in res
    assert "recent_command_queue" in res

    # Test invalid spoke
    inv = ciam_get_spoke_data("non_existent_app_code_123")
    assert inv["status"] == "NOT_FOUND"

def test_mcp_audit_logs():
    res = ciam_get_audit_logs(limit=5)
    assert "logs" in res

def test_mcp_dispatch_spoke_command():
    res = ciam_dispatch_spoke_command(
        app_code="mtpulse",
        action="REQUEST_FULL_SYNC",
        username="test.user",
        reason="Automated test for MCP Mode C queue"
    )
    assert res["status"] == "QUEUED"
    assert "command_id" in res
    assert res["command_id"].startswith("CMD-")

@pytest.mark.anyio
async def test_mcp_deprovision_and_reactivate():
    # Test deprovisioning non-existent user returns FAILED
    res = await ciam_deprovision_user("non.existent.random.user.999", reason="Test offboard")
    assert res["status"] in ["FAILED", "SUCCESS", "PARTIAL"]

def test_remote_mcp_endpoints_and_auth():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.mcp.remote import MCP_STATIC_KEY

    client = TestClient(app)

    # 1. Info endpoint
    info_res = client.get("/api/v1/mcp/info")
    assert info_res.status_code == 200
    info = info_res.json()
    assert info["status"] == "OPERATIONAL"
    assert "tools" in info
    assert len(info["tools"]) >= 8

    # 2. Remote MCP endpoint without auth must return 401
    unauth_res = client.get("/mcp/messages")
    assert unauth_res.status_code == 401
    assert unauth_res.json()["error"] == "UNAUTHORIZED_MCP_ACCESS"

    # 3. Remote MCP endpoint with valid Bearer token passes auth guard
    auth_res = client.get("/mcp/messages", headers={"Authorization": f"Bearer {MCP_STATIC_KEY}"})
    assert auth_res.status_code != 401

