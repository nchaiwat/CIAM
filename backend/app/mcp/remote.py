"""
Central IAM - Remote Model Context Protocol (MCP) Service
Exposes Server-Sent Events (SSE) and HTTP Remote Transport for Cloud VPS execution.
Allows remote AI agents (Antigravity IDE, Cursor, Claude Desktop) to connect securely over HTTPS.
"""
import os
import logging
from typing import Dict, Any, Optional

from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.requests import Request
from fastapi import APIRouter, Depends

from mcp.server.transport_security import TransportSecuritySettings

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.database import SessionLocal
from app.models.user import AdminUser
from app.mcp.server import mcp_server

logger = logging.getLogger("ciam.mcp.remote")

# Dedicated API Key from environment or fallback to secret key prefix
MCP_STATIC_KEY = os.environ.get("MCP_API_KEY") or f"mcp_{settings.SECRET_KEY[:16]}"

def validate_mcp_auth_token(token: str) -> bool:
    """
    Validates MCP connection token against:
    1. Dedicated MCP_API_KEY or Master SECRET_KEY
    2. Valid Central IAM Admin JWT Access Token
    """
    token = (token or "").strip()
    if not token:
        return False

    # 1. Check static secret keys
    if token == settings.SECRET_KEY or token == MCP_STATIC_KEY:
        return True

    # 2. Check JWT Admin Access Token
    payload = decode_access_token(token)
    if payload and payload.get("sub"):
        username = payload.get("sub")
        db = SessionLocal()
        try:
            admin = db.query(AdminUser).filter(AdminUser.username.ilike(username)).first()
            if admin and admin.is_active and admin.role in ["SUPER_ADMIN", "ADMIN"]:
                return True
        finally:
            db.close()

    return False


class RemoteMcpAuthMiddleware(BaseHTTPMiddleware):
    """
    Security Guard for Remote MCP Endpoint:
    Enforces Bearer token verification from Authorization header, X-MCP-API-Key, or ?token= query parameter.
    """
    async def dispatch(self, request: Request, call_next):
        # Allow public discovery metadata on /info or root of /mcp so external clients can inspect capabilities cleanly
        path = request.url.path.rstrip("/")
        if path.endswith("/info") or path.endswith("/mcp"):
            return JSONResponse(get_mcp_server_info())

        # Extract token from various client headers/params
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
        api_key_header = request.headers.get("x-mcp-api-key") or request.headers.get("X-MCP-API-Key") or ""
        token_param = request.query_params.get("token") or ""

        token = ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
        elif api_key_header:
            token = api_key_header.strip()
        elif token_param:
            token = token_param.strip()

        if not validate_mcp_auth_token(token):
            return JSONResponse(
                {
                    "error": "UNAUTHORIZED_MCP_ACCESS",
                    "message": "Authentication required to access Window Asia Central IAM Remote MCP. Provide valid Authorization Bearer token, X-MCP-API-Key header, or ?token= parameter.",
                    "status_code": 401,
                    "sse_endpoints": [
                        "https://ciam.windowasia.com/api/v1/mcp/sse",
                        "https://ciam.windowasia.com/mcp/sse"
                    ]
                },
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"}
            )

        return await call_next(request)


def create_remote_mcp_app() -> Starlette:
    """
    Builds the Remote SSE Starlette Application mounted inside FastAPI.
    Routes:
      - GET  /sse        -> Establishes SSE Event Stream
      - POST /messages/  -> Receives JSON-RPC Messages from MCP Client
    """
    # Allow all origins and reverse proxy hosts for Cloud VPS deployment
    security_settings = TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    )

    app: Starlette = mcp_server.sse_app(
        sse_path="/sse",
        message_path="/messages/",
        transport_security=security_settings
    )

    # Attach authentication middleware
    app.add_middleware(RemoteMcpAuthMiddleware)
    return app


# ---------------------------------------------------------------------------
# Info & Configuration Helper Router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])

@router.get("/info")
def get_mcp_server_info() -> Dict[str, Any]:
    """
    Returns MCP server operational information and client connection templates
    for Cursor, Antigravity IDE, and Claude Desktop.
    """
    return {
        "status": "OPERATIONAL",
        "name": mcp_server.name,
        "version": mcp_server.version,
        "description": "Window Asia Central IAM Model Context Protocol (MCP) Server",
        "remote_transport": {
            "type": "SSE",
            "sse_endpoint": "/api/v1/mcp/sse",
            "legacy_sse_endpoint": "/mcp/sse",
            "messages_endpoint": "/api/v1/mcp/messages/",
            "auth_required": True,
            "auth_type": "Bearer Token / Admin JWT / X-MCP-API-Key"
        },
        "registered_tools_count": 8,
        "tools": [
            "ciam_health_check",
            "ciam_list_users",
            "ciam_get_ghost_accounts",
            "ciam_get_spoke_data",
            "ciam_deprovision_user",
            "ciam_reactivate_user",
            "ciam_get_audit_logs",
            "ciam_dispatch_spoke_command"
        ],
        "configuration_examples": {
            "remote_cloud_https": {
                "mcpServers": {
                    "central-iam-cloud": {
                        "url": "https://ciam.windowasia.com/api/v1/mcp/sse",
                        "headers": {
                            "Authorization": "Bearer <YOUR_ADMIN_JWT_OR_MCP_KEY>"
                        }
                    }
                }
            },
            "local_development_stdio": {
                "mcpServers": {
                    "central-iam-local": {
                        "command": "python",
                        "args": ["-m", "app.mcp.server"],
                        "cwd": "d:\\Python\\Central-IAM\\backend"
                    }
                }
            }
        }
    }
