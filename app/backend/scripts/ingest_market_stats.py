import asyncio
import csv
from datetime import date
from pathlib import Path

from sqlalchemy import delete

from app.core.config import settings
from app.db.base import Base
from app.db.session import async_session_factory, engine
from app.models.market_stats import MarketStats


def parse_period(value: str) -> date:
    year, month = value.split("-", maxsplit=1)
    return date(int(year), int(month), 1)


async def create_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ingest() -> int:
    csv_path = Path("data/market_stats.csv")
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}. Run pipeline/generate_market_stats.py first.")

    await create_schema()

    rows: list[MarketStats] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rows.append(MarketStats(
                category=row["category"],
                period=parse_period(row["period"]),
                true_median_price_kvm=float(row["true_median_price_kvm"]),
                total_ad_count=int(float(row["total_ad_count"])),
            ))

    async with async_session_factory() as session:
        await session.execute(delete(MarketStats))
        session.add_all(rows)
        await session.commit()

    return len(rows)


async def main() -> None:
    n = await ingest()
    await engine.dispose()
    print(f"Inserted {n} market stats records.")


if __name__ == "__main__":
    asyncio.run(main())
