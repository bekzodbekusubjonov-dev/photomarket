import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import base64
import jwt

from .config import settings

ALGORITHM = "HS256"


PBKDF2_ITERATIONS = 390_000


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 (Django uslubidagi format): pbkdf2_sha256$iter$salt$hash"""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${base64.b64encode(dk).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iters, salt, digest = password_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), int(iters))
        return hmac.compare_digest(base64.b64encode(dk).decode(), digest)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str, token_version: int, extra: dict | None = None,
                        minutes: int | None = None) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes or settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "tv": token_version, "exp": exp, **(extra or {})}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def code_matches(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code.strip()), code_hash)
