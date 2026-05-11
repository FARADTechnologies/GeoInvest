import json
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar, overload

from pydantic import BaseModel
from redis.asyncio import Redis

from app.core.config import settings

ModelT = TypeVar("ModelT", bound=BaseModel)

_redis: Redis | None = None
_redis_unavailable: bool = False  # set True after first failed attempt, skip retrying

# In-memory fallback cache (used when Redis is unavailable)
_mem_cache: dict[str, tuple[str, float]] = {}  # key -> (json_str, expires_at)


async def get_cache() -> Redis | None:
    global _redis, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis is None:
        try:
            _redis = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,  # fail fast if Redis is down
                socket_timeout=1,
            )
            await _redis.ping()
        except Exception:
            _redis = None
            _redis_unavailable = True  # stop retrying for this process lifetime
    return _redis


async def close_cache() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


def _mem_get(key: str) -> str | None:
    entry = _mem_cache.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    _mem_cache.pop(key, None)
    return None


def _mem_set(key: str, value: str, ttl: int) -> None:
    _mem_cache[key] = (value, time.monotonic() + ttl)


@overload
async def cached_json(
    key: str,
    model: type[ModelT],
    loader: Callable[[], Awaitable[ModelT]],
    *,
    many: bool = False,
) -> ModelT: ...


@overload
async def cached_json(
    key: str,
    model: type[ModelT],
    loader: Callable[[], Awaitable[list[ModelT]]],
    *,
    many: bool = True,
) -> list[ModelT]: ...


async def cached_json(key, model, loader, *, many=False):
    # 1. Try Redis
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

    # 2. Try in-memory fallback
    mem_hit = _mem_get(key)
    if mem_hit is not None:
        payload = json.loads(mem_hit)
        if many:
            return [model.model_validate(item) for item in payload]
        return model.model_validate(payload)

    # 3. Load from DB
    value = await loader()

    # Serialize and store in both caches
    if many:
        serialized = json.dumps([item.model_dump(mode="json") for item in value])
    else:
        serialized = json.dumps(value.model_dump(mode="json"))

    if cache is not None:
        try:
            await cache.set(key, serialized, ex=settings.cache_ttl_seconds)
        except Exception:
            pass

    _mem_set(key, serialized, settings.cache_ttl_seconds)

    return value
