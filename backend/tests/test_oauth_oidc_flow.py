import base64
import hashlib
import secrets
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.oidc_keys import verify_rs256_token, get_jwks

client = TestClient(app)


def _generate_pkce():
    """Helper to generate standard PKCE code_verifier and code_challenge (S256)."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
    return verifier, challenge


def test_oidc_discovery_endpoint():
    """Verify OpenID Connect Discovery document complies with standard spec."""
    response = client.get("/.well-known/openid-configuration")
    assert response.status_code == 200
    data = response.json()
    assert "issuer" in data
    assert data["authorization_endpoint"].endswith("/api/v1/oauth/authorize")
    assert data["token_endpoint"].endswith("/api/v1/oauth/token")
    assert data["userinfo_endpoint"].endswith("/api/v1/oauth/userinfo")
    assert data["jwks_uri"].endswith("/.well-known/jwks.json")
    assert "code" in data["response_types_supported"]
    assert "RS256" in data["id_token_signing_alg_values_supported"]
    assert "S256" in data["code_challenge_methods_supported"]


def test_jwks_endpoint():
    """Verify JWKS endpoint returns valid RSA public key parameters."""
    response = client.get("/.well-known/jwks.json")
    assert response.status_code == 200
    data = response.json()
    assert "keys" in data
    assert len(data["keys"]) >= 1

    rsa_key = data["keys"][0]
    assert rsa_key["kty"] == "RSA"
    assert rsa_key["use"] == "sig"
    assert rsa_key["alg"] == "RS256"
    assert rsa_key["kid"] == "ciam-oidc-key-v1"
    assert "n" in rsa_key and len(rsa_key["n"]) > 200
    assert rsa_key["e"] in ["AQAB", "AAEAAQ"]


def test_oauth_authorize_get_validation():
    """Test OAuth authorize parameter pre-validation."""
    # 1. Valid request for IRM spoke client
    res = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback",
            "scope": "openid profile email",
            "state": "state_test_123"
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "READY_FOR_AUTHENTICATION"
    assert res.json()["client_id"] == "irm-spoke-client"

    # 2. Unknown client ID
    res_bad_client = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": "non-existent-client",
            "redirect_uri": "http://localhost:3000/portal/callback"
        }
    )
    assert res_bad_client.status_code == 400
    assert "Unknown client_id" in res_bad_client.json()["detail"]

    # 3. Unauthorized redirect URI
    res_bad_uri = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": "irm-spoke-client",
            "redirect_uri": "https://attacker.evil.com/callback"
        }
    )
    assert res_bad_uri.status_code == 400
    assert "not authorized" in res_bad_uri.json()["detail"]

    # 4. Unsupported response type
    res_bad_type = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "token",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback"
        }
    )
    assert res_bad_type.status_code == 400


def test_full_oidc_pkce_login_token_exchange():
    """
    Test End-to-End OIDC Flow:
    1. Employee Authenticates at CIAM with PKCE S256
    2. Receives Authorization Code
    3. Spoke exchanges Code + PKCE Verifier for Tokens
    4. Validates RS256 signature and claims of ID Token
    5. Retrieves User Profile via /userinfo
    """
    code_verifier, code_challenge = _generate_pkce()

    # Step 1: Employee login and code authorization
    auth_resp = client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback",
            "scope": "openid profile email",
            "state": "random_secure_state_xyz",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
    )
    assert auth_resp.status_code == 200
    auth_data = auth_resp.json()
    assert auth_data["status"] == "SUCCESS"
    assert "code" in auth_data
    auth_code = auth_data["code"]
    assert "state=random_secure_state_xyz" in auth_data["redirect_to"]

    # Step 2: Spoke backend exchanges Code for RS256 ID Token (JSON Body)
    token_resp = client.post(
        "/api/v1/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": "http://localhost:3000/portal/callback",
            "client_id": "irm-spoke-client",
            "client_secret": "sec_irm_oauth_secret_2026",
            "code_verifier": code_verifier
        }
    )
    assert token_resp.status_code == 200
    token_data = token_resp.json()
    assert "id_token" in token_data
    assert "access_token" in token_data
    assert token_data["token_type"] == "Bearer"
    assert token_data["expires_in"] == 28800

    id_token = token_data["id_token"]
    access_token = token_data["access_token"]

    # Step 3: Cryptographic Verification of ID Token using Public Key
    claims = verify_rs256_token(id_token, audience="irm-spoke-client")
    assert claims["sub"] == "admin"
    assert "Somchai N." in claims["name"] or "Administrator" in claims["name"]
    assert claims["aud"] == "irm-spoke-client"
    assert "roles" in claims

    # Step 4: Call UserInfo Endpoint using Access Token
    userinfo_resp = client.get(
        "/api/v1/oauth/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert userinfo_resp.status_code == 200
    userinfo = userinfo_resp.json()
    assert userinfo["sub"] == "admin"
    assert "email" in userinfo


def test_anti_replay_code_burn():
    """Ensure authorization codes are strictly single-use."""
    code_verifier, code_challenge = _generate_pkce()

    # Issue code
    auth_resp = client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
    )
    code = auth_resp.json()["code"]

    # First exchange: Success
    token_resp1 = client.post(
        "/api/v1/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost:3000/portal/callback",
            "client_id": "irm-spoke-client",
            "client_secret": "sec_irm_oauth_secret_2026",
            "code_verifier": code_verifier
        }
    )
    assert token_resp1.status_code == 200

    # Second exchange (Replay Attack): Must fail
    token_resp2 = client.post(
        "/api/v1/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost:3000/portal/callback",
            "client_id": "irm-spoke-client",
            "client_secret": "sec_irm_oauth_secret_2026",
            "code_verifier": code_verifier
        }
    )
    assert token_resp2.status_code == 400
    assert "redeemed" in token_resp2.json()["detail"].lower() or "already" in token_resp2.json()["detail"].lower()


def test_pkce_mismatch_fails():
    """Attempting to exchange token with an invalid code_verifier must fail."""
    code_verifier, code_challenge = _generate_pkce()

    auth_resp = client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
    )
    code = auth_resp.json()["code"]

    # Exchange with incorrect verifier
    token_resp = client.post(
        "/api/v1/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost:3000/portal/callback",
            "client_id": "irm-spoke-client",
            "client_secret": "sec_irm_oauth_secret_2026",
            "code_verifier": "completely_wrong_verifier_string"
        }
    )
    assert token_resp.status_code == 400
    assert "PKCE" in token_resp.json()["detail"]


def test_form_urlencoded_token_exchange():
    """Ensure standard RFC 6749 application/x-www-form-urlencoded exchange works."""
    code_verifier, code_challenge = _generate_pkce()

    auth_resp = client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "admin123",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
    )
    code = auth_resp.json()["code"]

    # Exchange using form data
    token_resp = client.post(
        "/api/v1/oauth/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost:3000/portal/callback",
            "client_id": "irm-spoke-client",
            "client_secret": "sec_irm_oauth_secret_2026",
            "code_verifier": code_verifier
        }
    )
    assert token_resp.status_code == 200
    assert "id_token" in token_resp.json()


def test_invalid_credentials_fails():
    """Wrong employee password during authorization fails."""
    auth_resp = client.post(
        "/api/v1/oauth/authorize",
        json={
            "username": "admin",
            "password": "wrong_password_1234",
            "client_id": "irm-spoke-client",
            "redirect_uri": "http://localhost:3000/portal/callback"
        }
    )
    assert auth_resp.status_code in [401, 403]
