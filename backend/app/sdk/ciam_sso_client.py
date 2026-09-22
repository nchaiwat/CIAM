"""
Central IAM - Spoke Application Single Sign-On (SSO) Client SDK
Enterprise-grade OpenID Connect (OIDC) / OAuth 2.0 with PKCE & Break-Glass Fallback.
Designed for Window Asia spoke applications (IRM, QMS, QOL, SAP B1, etc.).
"""

import base64
import hashlib
import json
import logging
import secrets
import time
from typing import Optional, Dict, Any, Tuple
import urllib.request
import urllib.parse
from jose import jwt, jwk
from jose.utils import base64url_decode

logger = logging.getLogger("ciam.spoke_sdk")


class CiamSsoClient:
    """
    Client library for Spoke Applications to integrate with Window Asia Central IAM.
    Supports PKCE S256, Asymmetric RS256 token verification via JWKS,
    and automatic Break-Glass Failover to AD Gateway.
    """

    def __init__(
        self,
        ciam_base_url: str = "http://127.0.0.1:8001",
        client_id: str = "irm-spoke-client",
        client_secret: Optional[str] = None,
        ad_gateway_url: str = "http://192.168.12.11:3100",
        jwks_cache_ttl_seconds: int = 3600,
        timeout_seconds: float = 3.0,
        http_client: Optional[Any] = None,
    ):
        self.ciam_base_url = ciam_base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.ad_gateway_url = ad_gateway_url.rstrip("/")
        self.jwks_cache_ttl = jwks_cache_ttl_seconds
        self.timeout = timeout_seconds
        self.http_client = http_client

        # JWKS in-memory cache
        self._cached_jwks: Optional[Dict[str, Any]] = None
        self._jwks_cached_at: float = 0.0

    @staticmethod
    def generate_pkce() -> Tuple[str, str]:
        """
        Generate a cryptographically random code_verifier and code_challenge (S256).
        Returns: (code_verifier, code_challenge)
        """
        code_verifier = secrets.token_urlsafe(64)
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
        return code_verifier, code_challenge

    def get_authorize_url(
        self,
        redirect_uri: str,
        state: Optional[str] = None,
        code_challenge: Optional[str] = None,
        code_challenge_method: str = "S256",
        scope: str = "openid profile email",
    ) -> str:
        """
        Build the Central IAM SSO Login URL to redirect employee browsers to.
        """
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
        }
        if state:
            params["state"] = state
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = code_challenge_method

        qs = urllib.parse.urlencode(params)
        return f"{self.ciam_base_url}/api/v1/oauth/authorize?{qs}"

    def _http_get(self, url: str) -> Dict[str, Any]:
        """Internal helper to perform GET requests with http_client or urllib."""
        if self.http_client:
            path = url[len(self.ciam_base_url):] if url.startswith(self.ciam_base_url) else url
            resp = self.http_client.get(path)
            if resp.status_code >= 400:
                raise RuntimeError(f"HTTP GET failed: HTTP {resp.status_code} - {resp.text}")
            return resp.json()

        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def _http_post(self, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Internal helper to perform POST requests with http_client or urllib."""
        if self.http_client:
            path = url[len(self.ciam_base_url):] if url.startswith(self.ciam_base_url) else url
            resp = self.http_client.post(path, json=payload)
            if resp.status_code >= 400:
                raise RuntimeError(f"Token exchange failed: HTTP {resp.status_code} - {resp.text}")
            return resp.json()

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error("CIAM Token Exchange failed HTTP %d: %s", e.code, err_body)
            raise RuntimeError(f"Token exchange failed: HTTP {e.code} - {err_body}")
        except Exception as e:
            logger.error("CIAM Token Exchange connection error: %s", e)
            raise ConnectionError(f"Could not connect to Central IAM at {url}: {e}")

    def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: str,
        code_verifier: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Backend-to-Backend token exchange.
        Exchanges one-time authorization code + PKCE verifier for ID Token and Access Token.
        """
        token_url = f"{self.ciam_base_url}/api/v1/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
        }
        if self.client_secret:
            payload["client_secret"] = self.client_secret
        if code_verifier:
            payload["code_verifier"] = code_verifier

        return self._http_post(token_url, payload)

    def get_jwks(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Fetch and cache Central IAM's public keys from /.well-known/jwks.json.
        """
        now = time.time()
        if not force_refresh and self._cached_jwks and (now - self._jwks_cached_at < self.jwks_cache_ttl):
            return self._cached_jwks

        jwks_url = f"{self.ciam_base_url}/.well-known/jwks.json"
        try:
            self._cached_jwks = self._http_get(jwks_url)
            self._jwks_cached_at = now
            return self._cached_jwks
        except Exception as e:
            logger.error("Failed to fetch JWKS from %s: %s", jwks_url, e)
            if self._cached_jwks:
                logger.warning("Using stale JWKS cache as fallback")
                return self._cached_jwks
            raise

    def verify_id_token(
        self,
        id_token: str,
        audience: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Cryptographically verify the RS256 signature of an ID Token using CIAM's Public Key.
        Does not require making a network call if JWKS is cached.
        """
        target_aud = audience or self.client_id
        jwks_data = self.get_jwks()

        # Extract kid from token header
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")

        # Find matching key in JWKS
        rsa_key = None
        for key in jwks_data.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = key
                break

        if not rsa_key:
            # Refresh JWKS once in case key was rotated
            jwks_data = self.get_jwks(force_refresh=True)
            for key in jwks_data.get("keys", []):
                if key.get("kid") == kid:
                    rsa_key = key
                    break

        if not rsa_key:
            raise ValueError(f"Matching key with kid='{kid}' not found in Central IAM JWKS")

        # Construct public key and verify signature
        public_key = jwk.construct(rsa_key)
        claims = jwt.decode(
            id_token,
            public_key.to_pem().decode("utf-8"),
            algorithms=["RS256"],
            audience=target_aud,
            options={"verify_aud": bool(target_aud), "verify_exp": True},
        )
        return claims

    def is_ciam_healthy(self) -> bool:
        """
        Circuit Breaker Healthcheck.
        Checks whether Central IAM Discovery endpoint is responsive within timeout.
        """
        if self.http_client:
            try:
                resp = self.http_client.get("/.well-known/openid-configuration")
                return resp.status_code == 200
            except Exception:
                return False

        discovery_url = f"{self.ciam_base_url}/.well-known/openid-configuration"
        try:
            req = urllib.request.Request(discovery_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=1.5) as response:
                return response.status == 200
        except Exception:
            return False

    def fallback_ad_authenticate(self, username: str, password: str) -> Dict[str, Any]:
        """
        Break-Glass Fallback Mode:
        When Central IAM is unreachable, spoke apps can fallback directly to AD Gateway (:3100)
        per ADAuthen.md to allow employee sign-in with zero disruption.
        """
        ad_url = f"{self.ad_gateway_url}/api/v2/login"
        payload = {"username": username, "password": password}
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            ad_url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            logger.error("AD Gateway break-glass failover error: %s", e)
            raise ConnectionError(f"Break-Glass AD Gateway at {ad_url} failed: {e}")

    def authenticate_with_fallback(
        self,
        username: str,
        password: str,
        force_break_glass: bool = False,
    ) -> Dict[str, Any]:
        """
        Smart Hybrid Authenticator for Spoke Applications:
        1. If force_break_glass is True or CIAM is unhealthy -> Authenticates via AD Gateway (Break-Glass Mode)
        2. Otherwise, returns instructions to proceed via Central IAM SSO
        """
        if force_break_glass or not self.is_ciam_healthy():
            logger.warning("Central IAM offline or Break-Glass enabled. Executing AD Gateway failover for %s", username)
            ad_result = self.fallback_ad_authenticate(username, password)
            return {
                "auth_mode": "BREAK_GLASS_AD_FALLBACK",
                "success": ad_result.get("status") == "success" or ad_result.get("authenticated", False),
                "data": ad_result,
            }

        return {
            "auth_mode": "CENTRAL_IAM_SSO",
            "message": "CIAM is healthy. User should authenticate through Central IAM SSO Portal.",
        }
