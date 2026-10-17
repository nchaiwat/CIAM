"""
Central IAM - Model Context Protocol (MCP) Module
Provides standardized AI Agent integration for enterprise identity and spoke applications.
Supports both Local (stdio) and Remote Cloud (SSE / HTTPS) transports.
"""
from app.mcp.server import mcp_server
from app.mcp.remote import create_remote_mcp_app, router as mcp_router, validate_mcp_auth_token

__all__ = ["mcp_server", "create_remote_mcp_app", "mcp_router", "validate_mcp_auth_token"]
