"""One-time password store (team #8).

A 6-digit code with a 5-minute TTL, kept in Redis (auto-expires; the code dies
in the backend when the time runs out, per the spec). Falls back to an in-memory
store when Redis is unavailable.
"""

import secrets
import time

from app.services.cache import get_cache

OTP_TTL_SECONDS = 300  # 5 minutes

# Anti-abuse. /auth/login is public, and every call used to send a fresh email,
# so a bot (or a retrying client) could burn the whole Resend daily quota and
# spam the account owner's inbox. A code may be re-sent once a minute, and at
# most MAX_SENDS_PER_DAY times a day per address.
RESEND_COOLDOWN_SECONDS = 60
MAX_SENDS_PER_DAY = 10
_DAY_SECONDS = 24 * 3600

# email -> (code, expires_at) — only used when Redis is unreachable.
_memory: dict[str, tuple[str, float]] = {}
# key -> (count, expires_at) for the memory fallback's counters.
_counters: dict[str, tuple[int, float]] = {}


def _key(email: str) -> str:
    return f"otp:{email.strip().lower()}"


def _cooldown_key(email: str) -> str:
    return f"otp:cooldown:{email.strip().lower()}"


def _quota_key(email: str) -> str:
    return f"otp:sent:{email.strip().lower()}"


async def _bump(key: str, ttl: int) -> int:
    """Increment a counter that expires after `ttl`; returns the new value."""
    redis = await get_cache()
    if redis is not None:
        value = await redis.incr(key)
        if value == 1:
            await redis.expire(key, ttl)
        return int(value)
    count, expires = _counters.get(key, (0, 0.0))
    if expires <= time.time():
        count, expires = 0, time.time() + ttl
    count += 1
    _counters[key] = (count, expires)
    return count


async def _exists(key: str) -> bool:
    redis = await get_cache()
    if redis is not None:
        return bool(await redis.exists(key))
    entry = _counters.get(key)
    return bool(entry and entry[1] > time.time())


async def check_send_allowed(email: str) -> tuple[bool, str]:
    """(allowed, reason). Enforces the per-minute cooldown and daily cap."""
    if await _exists(_cooldown_key(email)):
        return False, "cooldown"
    sent_today = await _bump(_quota_key(email), _DAY_SECONDS)
    if sent_today > MAX_SENDS_PER_DAY:
        return False, "daily"
    return True, ""


async def mark_sent(email: str) -> None:
    """Start the cooldown window after an email actually went out."""
    redis = await get_cache()
    if redis is not None:
        await redis.setex(_cooldown_key(email), RESEND_COOLDOWN_SECONDS, "1")
    else:
        _counters[_cooldown_key(email)] = (1, time.time() + RESEND_COOLDOWN_SECONDS)


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
