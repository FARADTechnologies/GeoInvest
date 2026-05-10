from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _project_root() -> Path:
    current = Path(__file__).resolve()
    parents = list(current.parents)
    if len(parents) > 4:
        return parents[4]
    return Path.cwd()


PROJECT_ROOT = _project_root()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GeoInvest Analytics API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://h3:h3@localhost:5433/h3_analytics"
    redis_url: str = "redis://localhost:6379/0"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    raw_data_csv_path: Path = Field(
        default=PROJECT_ROOT / "data" / "h3_analysis.csv"
    )
    boundaries_json_path: Path = Field(
        default=PROJECT_ROOT / "data" / "baku_districts.json"
    )
    cache_ttl_seconds: int = 120

    # Source (Ana) DB — standard libpq URL, e.g. postgresql://user:pass@host:5432/dbname
    # Leave empty to disable the nightly job.
    source_database_url: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
