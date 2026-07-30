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
    source_database_url: str = ""  # Ana DB — postgresql://user:pass@host:port/dbname

    # Predict server (team) — used by the backend proxy so the secret never
    # reaches the browser. Left empty until the .env supplies them; routes
    # return a clear "not configured" error in that case.
    predict_url: str = ""
    predict_client_id: str = ""
    predict_client_secret: str = ""
    predict_timeout_seconds: float = 120.0

    # Email (Resend) + OTP auth. Secrets live in the gitignored .env only.
    resend_api_key: str = ""
    default_from_email: str = "hello@updates.homora.ai"
    account_request_email: str = "m.aydayev@gmail.com"  # #7 — submissions go here
    # Seed a first admin so the OTP login has a user to check against.
    seed_admin_email: str = "admin@homora.ai"
    seed_admin_password: str = "12345"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
