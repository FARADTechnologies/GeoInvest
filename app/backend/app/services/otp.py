"""One-time password store (team #8).

A 6-digit code with a 5-minute TTL, kept in Redis (auto-expires; the code dies
in the backend when the time runs out, per the spec). Falls back to an in-memory
store when Redis is unavailable.
"""

import secrets
import time

from app.services.cache import get_cache

OTP_TTL_SECONDS = 300  # 5 minutes

# email -> (code, expires_at) — only used when Redis is unreachable.
_memory: dict[str, tuple[str, float]] = {}


def _key(email: str) -> str:
    return f"otp:{email.strip().lower()}"


async def generate(email: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    redis = await get_cache()
    if redis is not None:
        await redis.setex(_key(email), OTP_TTL_SECONDS, code)
    else:
        _memory[_key(email)] = (code, time.time() + OTP_TTL_SECONDS)
    return code


async def verify(email: str, code: str) -> bool:
    key = _key(email)
    redis = await get_cache()
    if redis is not None:
        stored = await redis.get(key)
        if isinstance(stored, bytes):
            stored = stored.decode()
        if stored and secrets.compare_digest(stored, code):
            await redis.delete(key)
            return True
        return False
    entry = _memory.get(key)
    if entry and entry[1] > time.time() and secrets.compare_digest(entry[0], code):
        _memory.pop(key, None)
        return True
    return False
