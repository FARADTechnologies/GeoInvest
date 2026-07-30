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
                )
            )
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_admin()
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
