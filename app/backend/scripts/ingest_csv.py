import asyncio
import csv
from datetime import date
from pathlib import Path

from sqlalchemy import delete

from app.core.config import settings
from app.db.base import Base
from app.db.session import async_session_factory, engine
from app.models import H3AnalyticsRecord


def resolve_input_path() -> Path:
    path = settings.raw_data_csv_path
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def parse_period(value: str) -> date:
    year, month = value.split("-", maxsplit=1)
    return date(int(year), int(month), 1)


def row_to_record(row: dict[str, str]) -> H3AnalyticsRecord:
    return H3AnalyticsRecord(
        analysis_type=row["analysis_type"],
        rayon_name=row["rayon_name"],
        h3_index=row["h3_index"],
        category=row["category"],
        ad_count=int(float(row["ad_count"])),
        avg_price_kvm=float(row["avg_price_kvm"]) if row.get("avg_price_kvm") else None,
        median_price_kvm=float(row["median_price_kvm"]),
        resolution=int(row["resolution"]),
        period=parse_period(row["period"]),
    )


async def create_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ingest() -> int:
    csv_path = resolve_input_path()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    await create_schema()

    inserted = 0
    batch: list[H3AnalyticsRecord] = []
    batch_size = 2_000

    async with async_session_factory() as session:
        await session.execute(delete(H3AnalyticsRecord))

        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                batch.append(row_to_record(row))
                if len(batch) >= batch_size:
                    session.add_all(batch)
                    await session.flush()
                    inserted += len(batch)
                    batch.clear()

        if batch:
            session.add_all(batch)
            await session.flush()
            inserted += len(batch)

        await session.commit()

    return inserted


async def main() -> None:
    inserted = await ingest()
    await engine.dispose()
    print(f"Inserted {inserted} H3 analytics records.")


if __name__ == "__main__":
    asyncio.run(main())
