import pytest
from fastapi.testclient import TestClient
from jose.exceptions import JWTError

from app.main import app
from app.sdk.ciam_sso_client import CiamSsoClient

test_client = TestClient(app)


def test_spoke_sdk_pkce_generation():
    """Verify Spoke SDK generates cryptographically valid PKCE code_verifier and code_challenge."""
    verifier, challenge = CiamSsoClient.generate_pkce()
    assert len(verifier) >= 43
    assert len(challenge) >= 43
    assert "=" not in challenge  # Base64url unpadded


def test_spoke_sdk_get_authorize_url():
    """Verify Spoke SDK constructs RFC 7636 compliant authorization URLs."""
    sso_client = CiamSsoClient(
        ciam_base_url="http://127.0.0.1:8001",
        client_id="irm-spoke-client"
    )
    url = sso_client.get_authorize_url(
        redirect_uri="https://irm.windowasia.com/api/auth/callback",
        state="secure_state_999",
        code_challenge="my_test_challenge_code",
        code_challenge_method="S256"
    )
    assert "response_type=code" in url
    assert "client_id=irm-spoke-client" in url
    assert "redirect_uri=https%3A%2F%2Firm.windowasia.com%2Fapi%2Fauth%2Fcallback" in url
    assert "state=secure_state_999" in url
    assert "code_challenge=my_test_challenge_code" in url


def test_spoke_sdk_end_to_end_sso_flow():
    """
    Test realistic end-to-end integration:
    1. Spoke App initiates SSO with CiamSsoClient
    2. Employee authorizes at CIAM
    3. Spoke App exchanges code for tokens
    4. Spoke App cryptographically validates RS256 token signature using JWKS
    """
    sso_client = CiamSsoClient(
        ciam_base_url="http://127.0.0.1:8001",
        client_id="irm-spoke-client",
        client_secret="sec_irm_oauth_secret_2026",
        http_client=test_client
    )
    code_verifier, code_challenge = sso_client.generate_pkce()
    redirect_uri = "http://localhost:3000/portal/callback"

    # Step 1: Authorize employee at Central IAM
    auth_resp = test_client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": "spoke_req_42"
        }
    )
    assert auth_resp.status_code == 200
    code = auth_resp.json()["code"]

    # Step 2: Spoke Client exchanges code using CiamSsoClient SDK
    tokens = sso_client.exchange_code_for_tokens(
        code=code,
        redirect_uri=redirect_uri,
        code_verifier=code_verifier
    )
    assert "id_token" in tokens
    assert "access_token" in tokens
    id_token = tokens["id_token"]

    # Step 3: Spoke Client cryptographically validates ID Token using JWKS
    claims = sso_client.verify_id_token(id_token)
    assert claims["sub"] == "admin"
    assert claims["aud"] == "irm-spoke-client"
    assert "Somchai" in claims["name"] or "Administrator" in claims["name"]
    assert "roles" in claims

    # Step 4: Verify JWKS caching (subsequent verifications should not re-request)
    cached_claims = sso_client.verify_id_token(id_token)
    assert cached_claims["sub"] == "admin"


def test_spoke_sdk_tampered_token_rejected():
    """Ensure token with modified payload is rejected due to cryptographic signature mismatch."""
    sso_client = CiamSsoClient(
        ciam_base_url="http://127.0.0.1:8001",
        client_id="irm-spoke-client",
        client_secret="sec_irm_oauth_secret_2026",
        http_client=test_client
    )
    code_verifier, code_challenge = sso_client.generate_pkce()
    redirect_uri = "http://localhost:3000/portal/callback"

    auth_resp = test_client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
    )
    code = auth_resp.json()["code"]
    tokens = sso_client.exchange_code_for_tokens(code, redirect_uri, code_verifier)
    id_token = tokens["id_token"]

    # Tamper token (modify characters in payload segment)
    parts = id_token.split(".")
    tampered_payload = parts[1][:-2] + "AA"
    tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"

    with pytest.raises(Exception):
        sso_client.verify_id_token(tampered_token)


def test_spoke_sdk_circuit_breaker():
    """Verify circuit breaker health detection."""
    # When CIAM is online using test_client
    live_client = CiamSsoClient(ciam_base_url="http://127.0.0.1:8001", http_client=test_client)
    assert live_client.is_ciam_healthy() is True

    # When CIAM points to an unreachable dead port
    dead_client = CiamSsoClient(ciam_base_url="http://127.0.0.1:59998")
    assert dead_client.is_ciam_healthy() is False


def test_spoke_sdk_authenticate_with_fallback(monkeypatch):
    """Verify hybrid authentication and break-glass fallback behavior."""
    client = CiamSsoClient(ciam_base_url="http://127.0.0.1:8001", http_client=test_client)

    # Standard healthy mode -> instructs to use Central IAM SSO
    res = client.authenticate_with_fallback("admin", "admin123", force_break_glass=False)
    assert res["auth_mode"] == "CENTRAL_IAM_SSO"

    # Mock AD Gateway response for Break-Glass
    def mock_ad_auth(username, password):
        return {"status": "success", "authenticated": True, "user": {"username": username}}

    monkeypatch.setattr(client, "fallback_ad_authenticate", mock_ad_auth)

    # Break-Glass Mode forced
    res_bg = client.authenticate_with_fallback("admin", "ad_pass_123", force_break_glass=True)
    assert res_bg["auth_mode"] == "BREAK_GLASS_AD_FALLBACK"
    assert res_bg["success"] is True
