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

    # 3.1 Authorized redirect URI for MTPulse (https://wa-mtpulse.wa.net/auth/callback)
    res_mtpulse = client.get(
        "/api/v1/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": "mtpulse-spoke-client",
            "redirect_uri": "https://wa-mtpulse.wa.net/auth/callback"
        }
    )
    assert res_mtpulse.status_code == 200
    assert res_mtpulse.json()["status"] == "READY_FOR_AUTHENTICATION"
    assert res_mtpulse.json()["client_id"] == "mtpulse-spoke-client"

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


def test_portal_apps_authorization_filtering_and_launch():
    """Verify that employee portal filters apps by authorization and issues token for employee."""
    from app.core.database import SessionLocal
    from app.core.security import create_access_token, hash_password
    from app.models.user import AdminUser
    from app.models.identity import MasterIdentity
    from app.models.application import ConnectedApplication
    from app.models.mapping import AppAccountMapping

    db = SessionLocal()
    try:
        # Create an employee user
        emp_user = db.query(AdminUser).filter(AdminUser.username == "test.employee").first()
        if not emp_user:
            emp_user = AdminUser(
                username="test.employee",
                full_name="Test Employee",
                email="test.emp@windowasia.com",
                hashed_password=hash_password("Pass123!"),
                role="PORTAL_USER",
                is_active=True
            )
            db.add(emp_user)
            db.commit()
            db.refresh(emp_user)

        # Create MasterIdentity
        ident = db.query(MasterIdentity).filter(MasterIdentity.username == "test.employee").first()
        if not ident:
            ident = MasterIdentity(
                username="test.employee",
                full_name="Test Employee",
                email="test.emp@windowasia.com",
                department="Purchasing",
                is_active_in_ad=True
            )
            db.add(ident)
            db.commit()
            db.refresh(ident)

        # Map ONLY to 'irm' app
        irm_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "irm").first()
        assert irm_app is not None

        mapping = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == ident.id,
            AppAccountMapping.application_id == irm_app.id
        ).first()
        if not mapping:
            mapping = AppAccountMapping(
                identity_id=ident.id,
                application_id=irm_app.id,
                app_username="test.employee",
                is_active_in_app=True
            )
            db.add(mapping)
            db.commit()

        # Generate token for employee
        emp_token = create_access_token(subject="test.employee")
        headers = {"Authorization": f"Bearer {emp_token}"}

        # 1. Employee should ONLY see IRM app in /portal/apps
        res = client.get("/api/v1/oauth/portal/apps", headers=headers)
        assert res.status_code == 200
        apps_data = res.json()
        app_codes = [a["app_code"] for a in apps_data]
        assert "irm" in app_codes
        # Should not see apps they don't have access to (e.g. qms, qol, sap_b1)
        assert "qms" not in app_codes

        # 2. Employee launches IRM (authorized) -> Success, token issued for test.employee
        launch_res = client.post(
            "/api/v1/oauth/portal/launch",
            headers=headers,
            json={"client_id": irm_app.client_id}
        )
        assert launch_res.status_code == 200
        launch_data = launch_res.json()
        assert "code" in launch_data
        assert "launch_url" in launch_data

        # 3. Employee attempts to launch QMS (unauthorized) -> 403 Forbidden
        qms_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "qms").first()
        if qms_app:
            unauth_res = client.post(
                "/api/v1/oauth/portal/launch",
                headers=headers,
                json={"client_id": qms_app.client_id}
            )
            assert unauth_res.status_code == 403

        # 4. Admin sees ALL apps
        admin_token = create_access_token(subject="admin")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        admin_res = client.get("/api/v1/oauth/portal/apps", headers=admin_headers)
        assert admin_res.status_code == 200
        admin_app_codes = [a["app_code"] for a in admin_res.json()]
        assert "irm" in admin_app_codes
        assert "qms" in admin_app_codes
    finally:
        db.close()


def test_wa_rdt2_portal_entitlement_and_rdp_download():
    """
    Test WA-RDT2 Remote Desktop Spoke App:
    1. Employee WITHOUT SAP B1 mapping CANNOT see WA-RDT2 on Portal and CANNOT launch/download it.
    2. Employee WITH SAP B1 mapping CAN see WA-RDT2 on Portal and CAN launch/download it.
    3. Dynamic RDP download endpoint returns valid RDP configuration with WINDOWASIA domain.
    """
    from app.core.database import SessionLocal
    from app.core.security import create_access_token, hash_password
    from app.models.mapping import AppAccountMapping
    from app.models.user import AdminUser
    from app.models.identity import MasterIdentity
    from app.models.application import ConnectedApplication

    db = SessionLocal()
    try:
        # Ensure wa_rdt2 application exists
        rdt2_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "wa_rdt2").first()
        if not rdt2_app:
            rdt2_app = ConnectedApplication(
                app_code="wa_rdt2",
                app_name="WA-RDT2 (SAP Remote Desktop)",
                connector_type="RDP",
                base_url="rdp://WA-RDT2",
                portal_launch_url="/api/v1/oauth/portal/rdp/wa_rdt2.rdp",
                client_id="wa-rdt2-spoke-client",
                client_secret="sec_wa_rdt2_oauth_secret_2026",
                redirect_uris="http://localhost:3000/portal/callback",
                sso_enabled=True,
                network_policy="VPN_ONLY",
                health_status="ONLINE"
            )
            db.add(rdt2_app)
            db.commit()

        # Ensure sap_b1 app exists
        sap_app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "sap_b1").first()
        if not sap_app:
            sap_app = ConnectedApplication(
                app_code="sap_b1",
                app_name="SAP Business One",
                connector_type="SAP_B1",
                base_url="https://sapb1.waapps.net",
                client_id="sap-b1-spoke-client",
                client_secret="sec_sap_b1_oauth_secret_2026",
                redirect_uris="http://localhost:3000/portal/callback",
                sso_enabled=False,
                health_status="ONLINE"
            )
            db.add(sap_app)
            db.commit()

        # 1. User without SAP B1 access (User A)
        admin_a = db.query(AdminUser).filter(AdminUser.username == "test.nosap").first()
        if not admin_a:
            admin_a = AdminUser(
                username="test.nosap",
                full_name="No SAP User",
                email="nosap@windowasia.com",
                hashed_password=hash_password("Pass123!"),
                role="PORTAL_USER",
                is_active=True
            )
            db.add(admin_a)
            db.commit()

        user_a = db.query(MasterIdentity).filter(MasterIdentity.username == "test.nosap").first()
        if not user_a:
            user_a = MasterIdentity(
                username="test.nosap",
                full_name="No SAP User",
                email="nosap@windowasia.com",
                is_active_in_ad=True
            )
            db.add(user_a)
            db.commit()
            db.refresh(user_a)

        token_a = create_access_token(subject=user_a.username)
        headers_a = {"Authorization": f"Bearer {token_a}"}

        res_a = client.get("/api/v1/oauth/portal/apps", headers=headers_a)
        assert res_a.status_code == 200
        codes_a = [a["app_code"] for a in res_a.json()]
        assert "wa_rdt2" not in codes_a

        # Attempt launch as User A -> 403
        launch_a = client.post(
            "/api/v1/oauth/portal/launch",
            headers=headers_a,
            json={"client_id": rdt2_app.client_id}
        )
        assert launch_a.status_code == 403

        # 2. User with SAP B1 access (User B)
        admin_b = db.query(AdminUser).filter(AdminUser.username == "test.hassap").first()
        if not admin_b:
            admin_b = AdminUser(
                username="test.hassap",
                full_name="Has SAP User",
                email="hassap@windowasia.com",
                hashed_password=hash_password("Pass123!"),
                role="PORTAL_USER",
                is_active=True
            )
            db.add(admin_b)
            db.commit()

        user_b = db.query(MasterIdentity).filter(MasterIdentity.username == "test.hassap").first()
        if not user_b:
            user_b = MasterIdentity(
                username="test.hassap",
                full_name="Has SAP User",
                email="hassap@windowasia.com",
                is_active_in_ad=True
            )
            db.add(user_b)
            db.commit()
            db.refresh(user_b)

        # Map User B to sap_b1
        map_b = db.query(AppAccountMapping).filter(
            AppAccountMapping.identity_id == user_b.id,
            AppAccountMapping.application_id == sap_app.id
        ).first()
        if not map_b:
            map_b = AppAccountMapping(
                identity_id=user_b.id,
                application_id=sap_app.id,
                app_username="sap_user_b",
                is_active_in_app=True
            )
            db.add(map_b)
            db.commit()

        token_b = create_access_token(subject=user_b.username)
        headers_b = {"Authorization": f"Bearer {token_b}"}

        res_b = client.get("/api/v1/oauth/portal/apps", headers=headers_b)
        assert res_b.status_code == 200
        codes_b = [a["app_code"] for a in res_b.json()]
        assert "wa_rdt2" in codes_b

        # Attempt launch as User B -> Success
        launch_b = client.post(
            "/api/v1/oauth/portal/launch",
            headers=headers_b,
            json={"client_id": rdt2_app.client_id, "client_vpn_verified": True}
        )
        assert launch_b.status_code == 200
        data_b = launch_b.json()
        assert data_b["app_code"] == "wa_rdt2"
        assert "/portal/rdp/wa_rdt2.rdp" in data_b["launch_url"]

        # 3. Dynamic RDP Download Endpoint
        rdp_url = data_b["launch_url"]
        rdp_res = client.get(rdp_url, headers=headers_b)
        assert rdp_res.status_code == 200
        assert rdp_res.headers["content-type"].startswith("application/x-rdp")
        rdp_text = rdp_res.text
        assert "full address:s:WA-RDT2" in rdp_text
        assert "WINDOWASIA\\sap_user_b" in rdp_text
        assert "prompt for credentials:i:1" in rdp_text

    finally:
        db.close()


