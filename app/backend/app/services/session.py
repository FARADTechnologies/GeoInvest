"""Session tokens for the logged-in user.

Login used to hand out `secrets.token_urlsafe(32)` and forget it, so the token
proved nothing and no endpoint could tell who was calling. Approving a pending
account needs a real caller identity, so tokens are now stored (Redis, with an
in-memory fallback like otp.py) and resolved back to the user's email.
"""

import secrets
import time

from app.services.cache import get_cache

SESSION_TTL_SECONDS = 7 * 24 * 3600  # 7 days

# token -> (email, expires_at) — only used when Redis is unreachable.
_memory: dict[str, tuple[str, float]] = {}


def _key(token: str) -> str:
    return f"session:{token}"


async def create(email: str) -> str:
    token = secrets.token_urlsafe(32)
    email = email.strip().lower()
    redis = await get_cache()
    if redis is not None:
        await redis.setex(_key(token), SESSION_TTL_SECONDS, email)
    else:
        _memory[_key(token)] = (email, time.time() + SESSION_TTL_SECONDS)
    return token


async def resolve(token: str) -> str | None:
    """Return the email behind a token, or None when it's unknown/expired."""
    if not token:
        return None
    key = _key(token)
    redis = await get_cache()
    if redis is not None:
        stored = await redis.get(key)
        if isinstance(stored, bytes):
            stored = stored.decode()
        return stored or None
    entry = _memory.get(key)
    if entry and entry[1] > time.time():
        return entry[0]
    _memory.pop(key, None)
    return None


async def revoke(token: str) -> None:
    key = _key(token)
    redis = await get_cache()
    if redis is not None:
        await redis.delete(key)
    _memory.pop(key, None)
