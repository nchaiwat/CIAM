import base64
import os
from pathlib import Path
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jose import jwt
from app.core.config import BASE_DIR, settings

# Directory to persist RSA keys
_DEFAULT_KEYS_DIR = Path(__file__).resolve().parent.parent.parent / "keys"
KEYS_DIR = Path(os.getenv("KEYS_DIR", str(_DEFAULT_KEYS_DIR if _DEFAULT_KEYS_DIR.exists() or not (BASE_DIR / "backend" / "keys").exists() else (BASE_DIR / "backend" / "keys"))))
PRIVATE_KEY_PATH = KEYS_DIR / "oidc_private_key.pem"
PUBLIC_KEY_PATH = KEYS_DIR / "oidc_public_key.pem"
DEFAULT_KID = "ciam-oidc-key-v1"

_private_key_pem: Optional[str] = None
_public_key_pem: Optional[str] = None
_cached_jwks: Optional[Dict[str, Any]] = None


def _int_to_base64url(val: int) -> str:
    """Convert an integer to a URL-safe Base64 encoded string with no padding."""
    length = (val.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(val.to_bytes(length, "big")).decode("utf-8").rstrip("=")


def ensure_rsa_keys() -> None:
    """Load existing RSA keys from disk or generate a new 2048-bit keypair."""
    global _private_key_pem, _public_key_pem, _cached_jwks

    if _private_key_pem and _public_key_pem:
        return

    KEYS_DIR.mkdir(parents=True, exist_ok=True)

    if PRIVATE_KEY_PATH.exists() and PUBLIC_KEY_PATH.exists():
        _private_key_pem = PRIVATE_KEY_PATH.read_text(encoding="utf-8")
        _public_key_pem = PUBLIC_KEY_PATH.read_text(encoding="utf-8")
    else:
        # Generate new 2048-bit RSA keypair
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        _private_key_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode("utf-8")

        _public_key_pem = key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode("utf-8")

        PRIVATE_KEY_PATH.write_text(_private_key_pem, encoding="utf-8")
        PUBLIC_KEY_PATH.write_text(_public_key_pem, encoding="utf-8")

    # Build JWKS
    pub_key_obj = serialization.load_pem_public_key(_public_key_pem.encode("utf-8"))
    if isinstance(pub_key_obj, rsa.RSAPublicKey):
        pub_numbers = pub_key_obj.public_numbers()
        n_b64 = _int_to_base64url(pub_numbers.n)
        e_b64 = _int_to_base64url(pub_numbers.e)

        _cached_jwks = {
            "keys": [
                {
                    "kty": "RSA",
                    "use": "sig",
                    "alg": "RS256",
                    "kid": DEFAULT_KID,
                    "n": n_b64,
                    "e": e_b64
                }
            ]
        }


def get_private_key_pem() -> str:
    ensure_rsa_keys()
    assert _private_key_pem is not None
    return _private_key_pem


def get_public_key_pem() -> str:
    ensure_rsa_keys()
    assert _public_key_pem is not None
    return _public_key_pem


def get_jwks() -> Dict[str, Any]:
    ensure_rsa_keys()
    assert _cached_jwks is not None
    return _cached_jwks


def sign_rs256_token(payload: Dict[str, Any], kid: str = DEFAULT_KID) -> str:
    """Sign a JWT token using Central IAM's RSA Private Key."""
    ensure_rsa_keys()
    headers = {"kid": kid, "alg": "RS256"}
    return jwt.encode(payload, get_private_key_pem(), algorithm="RS256", headers=headers)


def verify_rs256_token(token: str, audience: Optional[str] = None) -> Dict[str, Any]:
    """Verify and decode a JWT token using Central IAM's RSA Public Key."""
    ensure_rsa_keys()
    options = {}
    if audience is None:
        options["verify_aud"] = False
    return jwt.decode(
        token,
        get_public_key_pem(),
        algorithms=["RS256"],
        audience=audience,
        options=options
    )
