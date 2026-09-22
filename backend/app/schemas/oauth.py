from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class AuthorizeParams(BaseModel):
    response_type: str = "code"
    client_id: str
    redirect_uri: str
    scope: str = "openid profile email"
    state: Optional[str] = None
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = "S256"


class PortalLoginRequest(BaseModel):
    username: str
    password: str
    client_id: str
    redirect_uri: str
    scope: str = "openid profile email"
    state: Optional[str] = None
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = "S256"


class TokenRequest(BaseModel):
    grant_type: str = Field(..., description="Must be 'authorization_code'")
    code: str = Field(..., description="Authorization code issued by Central IAM")
    redirect_uri: str = Field(..., description="Exact redirect URI used in authorize request")
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    code_verifier: Optional[str] = Field(None, description="PKCE code verifier")


class OIDCTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 3600
    id_token: str
    scope: str = "openid profile email"


class OIDCUserInfo(BaseModel):
    sub: str
    name: str
    preferred_username: str
    email: Optional[str] = None
    department: Optional[str] = None
    employee_id: Optional[str] = None
    roles: Dict[str, str] = {}
    groups: List[str] = []


class OpenIDConfigurationResponse(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    jwks_uri: str
    response_types_supported: List[str] = ["code"]
    subject_types_supported: List[str] = ["public"]
    id_token_signing_alg_values_supported: List[str] = ["RS256"]
    scopes_supported: List[str] = ["openid", "profile", "email"]
    token_endpoint_auth_methods_supported: List[str] = ["client_secret_post", "client_secret_basic", "none"]
    claims_supported: List[str] = ["sub", "aud", "iss", "exp", "iat", "name", "preferred_username", "email", "department", "employee_id", "roles"]
    code_challenge_methods_supported: List[str] = ["S256", "plain"]


class PortalAppItem(BaseModel):
    id: int
    app_code: str
    app_name: str
    category: str = "Enterprise Applications"
    description: Optional[str] = None
    connector_type: str
    base_url: Optional[str] = None
    client_id: Optional[str] = None
    sso_enabled: bool = True
    health_status: str = "UNKNOWN"
    latency_ms: Optional[int] = None
    launch_url: Optional[str] = None
    redirect_uris: Optional[str] = None


class PortalLaunchRequest(BaseModel):
    client_id: str
    state: Optional[str] = None
    target_redirect_uri: Optional[str] = None


class PortalLaunchResponse(BaseModel):
    status: str = "SUCCESS"
    app_code: str
    app_name: str
    launch_url: str
    code: str
    expires_in: int = 60


class PortalExchangeRequest(BaseModel):
    code: str
    redirect_uri: str


class PortalExchangeResponse(BaseModel):
    status: str = "SUCCESS"
    app_code: str
    app_name: str
    access_token: str
    id_token: str
    token_type: str = "bearer"
    expires_in: int
    user_info: Dict[str, Any]

