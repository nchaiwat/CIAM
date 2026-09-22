from fastapi import APIRouter, Request
from app.core.oidc_keys import get_jwks
from app.schemas.oauth import OpenIDConfigurationResponse

router = APIRouter(tags=["OIDC Discovery & JWKS"])


@router.get("/.well-known/jwks.json")
def get_jwks_endpoint():
    """
    Public JSON Web Key Set (JWKS) endpoint.
    Spoke applications fetch this public key to verify RS256 signed ID Tokens.
    """
    return get_jwks()


@router.get("/.well-known/openid-configuration", response_model=OpenIDConfigurationResponse)
def get_openid_configuration(request: Request):
    """
    OpenID Connect Discovery 1.0 endpoint.
    Exposes Central IAM's endpoints and supported cryptographic capabilities.
    """
    base_url = str(request.base_url).rstrip("/")
    return OpenIDConfigurationResponse(
        issuer=base_url,
        authorization_endpoint=f"{base_url}/api/v1/oauth/authorize",
        token_endpoint=f"{base_url}/api/v1/oauth/token",
        userinfo_endpoint=f"{base_url}/api/v1/oauth/userinfo",
        jwks_uri=f"{base_url}/.well-known/jwks.json"
    )
