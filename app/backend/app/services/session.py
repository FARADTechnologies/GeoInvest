"""Session tokens for the logged-in user.

Tokens used to be random strings kept in Redis. Redis is wiped on every deploy,
so a released container logged everyone out — but the browser still held the
token and looked signed in, so the next action failed with "Sessiya bitib"
instead of sending the user to the login page.

Tokens are now *signed* rather than stored: the token carries the email and an
expiry, plus an HMAC over both. Verification is a signature check, so a restart
(or a second backend replica) can validate a token it never issued. Explicit
logouts still go through the cache as a deny-list, which only has to survive as
long as the token itself.
"""

import base64
import hashlib
import hmac
import time

from app.core.config import settings
from app.services.cache import get_cache

SESSION_TTL_SECONDS = 7 * 24 * 3600  # 7 days

# Revoked tokens (explicit logout), only needed until they expire on their own.
_memory_revoked: dict[str, float] = {}


def _secret() -> bytes:
    """Signing key. SECRET_KEY when set, otherwise derived from the DB URL.

    The fallback keeps tokens valid across restarts without requiring new
    deployment config; it is stable per environment and never leaves the server.
    Production should still set SECRET_KEY explicitly.
    """
    raw = settings.secret_key or f"homora:{settings.database_url}"
    return hashlib.sha256(raw.encode()).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _sign(payload: str) -> str:
    return _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())


def _revoked_key(token: str) -> str:
    return f"session:revoked:{hashlib.sha256(token.encode()).hexdigest()[:32]}"


async def create(email: str) -> str:
    email = email.strip().lower()
    expires = int(time.time()) + SESSION_TTL_SECONDS
    payload = f"{_b64(email.encode())}.{expires}"
    return f"{payload}.{_sign(payload)}"


async def resolve(token: str) -> str | None:
    """Return the email behind a token, or None when it's invalid/expired."""
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    email_b64, expires_raw, signature = parts

    payload = f"{email_b64}.{expires_raw}"
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        if int(expires_raw) < time.time():
            return None
    except ValueError:
        return None

    if await _is_revoked(token):
        return None
    try:
        pad = "=" * (-len(email_b64) % 4)
        return base64.urlsafe_b64decode(email_b64 + pad).decode()
    except Exception:  # noqa: BLE001 — a malformed token is simply invalid
        return None


async def _is_revoked(token: str) -> bool:
    key = _revoked_key(token)
    redis = await get_cache()
    if redis is not None:
        return bool(await redis.exists(key))
    expires = _memory_revoked.get(key)
    if expires and expires > time.time():
        return True
    _memory_revoked.pop(key, None)
    return False


async def revoke(token: str) -> None:
    key = _revoked_key(token)
    redis = await get_cache()
    if redis is not None:
        await redis.setex(key, SESSION_TTL_SECONDS, "1")
    else:
        _memory_revoked[key] = time.time() + SESSION_TTL_SECONDS
