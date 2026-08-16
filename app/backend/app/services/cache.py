import json
import logging
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import Any, TypeVar, overload

from pydantic import BaseModel
from redis.asyncio import Redis

from app.core.config import settings

ModelT = TypeVar("ModelT", bound=BaseModel)

_redis: Redis | None = None

# When Redis is unreachable, stop dialling it on every call for a while. The
# OTP path alone asks for the cache four times per sign-in, so a host that is
# down — or worse, slow to refuse — turned one login into four connection
# attempts, each paying the full timeout while the user waited. Every caller
# degrades gracefully without Redis; they just need that answer quickly.
_REDIS_RETRY_SECONDS = 30.0
_redis_down_until = 0.0


async def get_cache() -> Redis | None:
    global _redis, _redis_down_until
    if _redis is not None:
        return _redis
    if time.monotonic() < _redis_down_until:
        return None
    try:
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
    except Exception:
        _redis_down_until = time.monotonic() + _REDIS_RETRY_SECONDS
        logging.getLogger(__name__).warning(
            "Redis unreachable; continuing without it for %ss.",
            int(_REDIS_RETRY_SECONDS),
        )
        return None
    _redis = client
    _redis_down_until = 0.0
    return _redis


async def close_cache() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


@overload
async def cached_json(
    key: str,
    model: type[ModelT],
    loader: Callable[[], Awaitable[ModelT]],
    *,
    many: bool = False,
) -> ModelT:
    ...


@overload
async def cached_json(
    key: str,
    model: type[ModelT],
    loader: Callable[[], Awaitable[list[ModelT]]],
    *,
    many: bool = True,
) -> list[ModelT]:
    ...


async def cached_json(key, model, loader, *, many=False):
    cache = await get_cache()
    if cache is not None:
        try:
            cached = await cache.get(key)
            if cached:
                payload = json.loads(cached)
                if many:
                    return [model.model_validate(item) for item in payload]
                return model.model_validate(payload)
        except Exception:
            cache = None

    value = await loader()

    if cache is not None:
        try:
            if many:
                payload = [item.model_dump(mode="json") for item in value]
            else:
                payload = value.model_dump(mode="json")
            await cache.set(key, json.dumps(payload), ex=settings.cache_ttl_seconds)
        except Exception:
            pass

    return value


# ── Market analytics cache ────────────────────────────────────────────────
#
# The Bazar analizi endpoints aggregate the SOURCE database directly, and the
# heaviest of them expands `prediction_info->price_trend` for every listing —
# roughly two million JSON rows on production — on *every page load*. The
# team asked us to stop doing that, and they are right: those aggregates only
# move when the scraper and the prediction queue add rows, which happens once
# a night. A past month's figures never change at all.
#
# So each result is computed at most once per rebuild cycle: cached until the
# next nightly job is due, and dropped explicitly the moment that job finishes
# so fresh numbers appear immediately rather than at the TTL's mercy.

logger = logging.getLogger(__name__)

MARKET_PREFIX = "homora:market:"

# Redis is optional here. When it is unreachable the process-local dict below
# still absorbs the repeat traffic within one worker, which is the difference
# between "every request" and "once a day per worker".
_local: dict[str, tuple[float, Any]] = {}


def _seconds_until_next_rebuild(hour: int = 0) -> int:
    """Seconds until the nightly job's next run, floored at a few minutes.

    Keeps a cache entry alive exactly as long as the data behind it is stable.
    """
    now = datetime.now(timezone.utc)
    nxt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return max(300, int((nxt - now).total_seconds()))


async def cached_market(key: str, loader: Callable[[], Awaitable[dict]]) -> dict:
    """Return a market aggregate, computing it only when the cache is cold."""
    full = MARKET_PREFIX + key
    ttl = _seconds_until_next_rebuild()

    hit = _local.get(full)
    if hit and hit[0] > time.monotonic():
        return hit[1]

    cache = await get_cache()
    if cache is not None:
        try:
            raw = await cache.get(full)
            if raw:
                value = json.loads(raw)
                _local[full] = (time.monotonic() + ttl, value)
                return value
        except Exception:
            cache = None

    value = await loader()

    _local[full] = (time.monotonic() + ttl, value)
    if cache is not None:
        try:
            await cache.set(full, json.dumps(value), ex=ttl)
        except Exception:
            pass
    return value


async def invalidate_market() -> None:
    """Drop every cached market aggregate — called when the nightly job lands."""
    _local.clear()
    cache = await get_cache()
    if cache is None:
        return
    try:
        keys = [k async for k in cache.scan_iter(match=MARKET_PREFIX + "*")]
        if keys:
            await cache.delete(*keys)
        logger.info("Market cache invalidated (%d key(s)).", len(keys))
    except Exception:
        logger.warning("Could not invalidate the market cache in Redis.", exc_info=True)
