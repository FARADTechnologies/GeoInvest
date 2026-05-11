import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import async_session_factory, dispose_engine
from app.scheduler import start_scheduler, stop_scheduler
from app.services.analytics import AnalyticsService
from app.services.cache import _mem_set, close_cache
from app.schemas.analytics import FiltersResponse, MapDataPoint, MetricsResponse

logger = logging.getLogger(__name__)


async def _warm_cache() -> None:
    """Pre-load filters into memory cache on startup so first request is instant."""
    try:
        async with async_session_factory() as session:
            filters = await AnalyticsService(session).get_filters()
        import json
        _mem_set("filters:v1", json.dumps(filters.model_dump(mode="json")), ttl=300)
        logger.info("Cache warmed up: %d periods loaded.", len(filters.periods))
    except Exception as exc:
        logger.warning("Cache warm-up failed (non-fatal): %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    asyncio.create_task(_warm_cache())
    yield
    stop_scheduler()
    await close_cache()
    await dispose_engine()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}



app.include_router(api_router, prefix=settings.api_prefix)
