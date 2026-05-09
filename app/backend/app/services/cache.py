import json
from collections.abc import Awaitable, Callable
from typing import TypeVar, overload

from pydantic import BaseModel
from redis.asyncio import Redis

from app.core.config import settings

ModelT = TypeVar("ModelT", bound=BaseModel)

_redis: Redis | None = None


async def get_cache() -> Redis | None:
    global _redis
    if _redis is None:
        try:
            _redis = Redis.from_url(settings.redis_url, decode_responses=True)
            await _redis.ping()
        except Exception:
            _redis = None
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
