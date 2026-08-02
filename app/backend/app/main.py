from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import dispose_engine, engine
from app.models import H3AnalyticsRecord, MarketStats, User  # noqa: F401 — ensure models are registered
from app.models.precomputed import H3MapPrecomputed, H3MetricsPrecomputed  # noqa: F401
from app.scheduler import start_scheduler, stop_scheduler
from app.services.cache import close_cache


async def _migrate_users() -> None:
    """Add app_users.status to databases created before the column existed.

    `create_all` only creates missing tables, never missing columns, so a
    deployment that already has app_users would otherwise keep failing every
    query that selects `status`. Existing rows default to 'active' — they were
    created before self-registration, so they're already approved.
    """
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE app_users "
                "ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'"
            )
        )


async def _refresh_if_stale() -> None:
    """Rebuild the H3 analytics on boot when they are behind the source.

    The cron only fires at 00:00, so a deploy that ships a data fix — or a
    container that was down at midnight — would keep serving stale periods
    until the following night with no way to tell. Runs in the background so
    startup is not blocked; the nightly schedule still applies afterwards.
    """
    import asyncio
    import logging
    from datetime import date, timedelta

    from sqlalchemy import func, select

    from app.db.session import async_session_factory
    from app.models.h3_analytics import H3AnalyticsRecord
    from app.services.nightly_job import run_nightly_job

    log = logging.getLogger(__name__)
    if not settings.source_database_url:
        return
    async with async_session_factory() as session:
        newest = (
            await session.execute(select(func.max(H3AnalyticsRecord.period)))
        ).scalar_one_or_none()
    # "Behind" = empty, or the newest month predates last month. Anything more
    # eager would rebuild on every restart for no reason.
    cutoff = date.today().replace(day=1) - timedelta(days=31)
    if newest is None or newest < cutoff:
        log.info("Analytics stale (newest=%s, cutoff=%s) — rebuilding.", newest, cutoff)
        asyncio.create_task(run_nightly_job())


async def _seed_admin() -> None:
    """Seed a first admin so the OTP login has a user to check against (team #8)."""
    from sqlalchemy import select

    from app.db.session import async_session_factory
    from app.services.security import hash_password

    email = settings.seed_admin_email.strip().lower()
    async with async_session_factory() as session:
        exists = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if exists is None:
            session.add(
                User(
                    email=email,
                    password_hash=hash_password(settings.seed_admin_password),
                    name="Admin",
                    role="super_admin",
                    # Explicit: the model defaults new rows to "pending", which
                    # would lock the seeded admin out of its own instance.
                    status="active",
                )
            )
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_users()
    await _seed_admin()
    await _refresh_if_stale()
    # A batch valuation that was mid-flight when the process stopped picks up
    # where it left off instead of being silently abandoned.
    from app.services.valuation_jobs import resume_unfinished

    await resume_unfinished()
    start_scheduler()
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
    # Always allow the platform's own domains (any subdomain / port), so the
    # deployed frontend (e.g. gitlab.homora.ai:31300) works even when the host's
    # ALLOWED_ORIGINS env isn't set. Without an allowed origin the browser's
    # CORS preflight fails and every API call — including the valuation
    # /model/predict proxy — is blocked, making the UI show a connection error.
    allow_origin_regex=r"https?://([a-z0-9-]+\.)*homora\.ai(:\d+)?",
    allow_credentials=True,
    # POST is needed by the valuation endpoints (single/batch/model proxy/link);
    # without it the browser's preflight blocks them and the UI silently falls
    # back to local data.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_prefix)
