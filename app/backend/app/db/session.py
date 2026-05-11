from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,  # recycle connections every 5 min instead of pinging
)

async_session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)


async def dispose_engine() -> None:
    await engine.dispose()
