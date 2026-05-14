"""Nightly ETL job: Source DB → h3_analytics_records → precomputed tables.

Flow:
  1. Fetch raw hex aggregations from the source (Ana) DB via psycopg.
  2. Replace h3_analytics_records (atomic truncate + batch insert).
  3. Replace h3_map_precomputed (SQL INSERT … SELECT, no outlier filter).
  4. Replace h3_metrics_precomputed (aggregated KPIs per filter combo,
     including the combined-category row so the API never has to compute it).
"""

import asyncio
import logging
from datetime import date

import psycopg
from sqlalchemy import delete, text

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.h3_analytics import H3AnalyticsRecord

logger = logging.getLogger(__name__)

_RESOLUTIONS = [6, 7, 8]
_TARGET_CATEGORIES = (3, 4)  # Yeni Tikili, Köhne Tikili

_GEOM_SQL = """\
SELECT
    'geom'                                                               AS analysis_type,
    o.name                                                               AS rayon_name,
    h3_lat_lng_to_cell(point(i.longitude, i.latitude), {res})::text      AS h3_index,
    c.name                                                               AS category_name,
    COUNT(*)                                                             AS ad_count,
    AVG(i.owner_price / NULLIF(i.size, 0))                              AS avg_price_kvm,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (i.owner_price / NULLIF(i.size, 0))
    )                                                                    AS median_price_kvm,
    {res}                                                                AS resolution,
    TO_CHAR(i.created_date, 'YYYY-MM')                                  AS period
FROM item_app_items_excel i
LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
JOIN index_app_object o
    ON ST_Contains(o.geom, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
WHERE i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL
  AND i.owner_price IS NOT NULL
  AND o.type_id = 22
  AND i.category_id IN ({cats})
GROUP BY 1, 2, 3, 4, 8, 9
ORDER BY period DESC, rayon_name;
"""

_PURE_H3_SQL = """\
SELECT
    'pure_h3'                                                            AS analysis_type,
    'GLOBAL'                                                             AS rayon_name,
    h3_lat_lng_to_cell(point(i.longitude, i.latitude), {res})::text      AS h3_index,
    c.name                                                               AS category_name,
    COUNT(*)                                                             AS ad_count,
    AVG(i.owner_price / NULLIF(i.size, 0))                              AS avg_price_kvm,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (i.owner_price / NULLIF(i.size, 0))
    )                                                                    AS median_price_kvm,
    {res}                                                                AS resolution,
    TO_CHAR(i.created_date, 'YYYY-MM')                                  AS period
FROM item_app_items_excel i
LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
WHERE i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL
  AND i.owner_price IS NOT NULL
  AND i.category_id IN ({cats})
GROUP BY 1, 2, 3, 4, 8, 9
ORDER BY period DESC, ad_count DESC;
"""


def _fetch_from_source_db(conn_str: str) -> list[tuple]:
    """Runs synchronously in a thread — must not use asyncio."""
    cats = ", ".join(str(c) for c in _TARGET_CATEGORIES)
    rows: list[tuple] = []
    # Keep-alive params prevent server-side SSL close on long-running queries.
    with psycopg.connect(
        conn_str,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        options="-c statement_timeout=300000",  # 5 min per statement
    ) as conn:
        with conn.cursor() as cur:
            for res in _RESOLUTIONS:
                logger.info("Fetching geom path (res=%d)…", res)
                cur.execute(_GEOM_SQL.format(res=res, cats=cats))
                rows.extend(cur.fetchall())
                logger.info("Fetching pure_h3 path (res=%d)…", res)
                cur.execute(_PURE_H3_SQL.format(res=res, cats=cats))
                rows.extend(cur.fetchall())
    return rows


def _row_to_record(row: tuple) -> H3AnalyticsRecord:
    analysis_type, rayon_name, h3_index, category, ad_count, avg_price_kvm, median_price_kvm, resolution, period_str = row
    year, month = period_str.split("-")
    return H3AnalyticsRecord(
        h3_index=h3_index,
        resolution=int(resolution),
        period=date(int(year), int(month), 1),
        category=category,
        analysis_type=analysis_type,
        ad_count=int(ad_count),
        avg_price_kvm=float(avg_price_kvm) if avg_price_kvm is not None else None,
        median_price_kvm=float(median_price_kvm),
        rayon_name=rayon_name,
    )


async def rebuild_precomputed() -> None:
    """Compute precomputed tables from the existing h3_analytics_records.

    Call this to bootstrap the precomputed tables after an initial CSV ingest,
    or whenever you want to refresh without re-fetching from the source DB.
    """
    async with async_session_factory() as session:
        async with session.begin():
            await session.execute(text("TRUNCATE h3_map_precomputed;"))
            # Aggregate by h3_index — a single hex can span multiple rayons,
            # so h3_analytics_records may have >1 row per hex.
            await session.execute(text("""\
                INSERT INTO h3_map_precomputed
                    (h3_index, resolution, period, category, analysis_type,
                     ad_count, avg_price_kvm, median_price_kvm, rayon_name, computed_at)
                SELECT
                    h3_index, resolution, period, category, analysis_type,
                    SUM(ad_count),
                    AVG(avg_price_kvm),
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_price_kvm),
                    STRING_AGG(DISTINCT rayon_name, ', '),
                    NOW()
                FROM h3_analytics_records
                GROUP BY h3_index, resolution, period, category, analysis_type;
            """))

        async with session.begin():
            await session.execute(text("TRUNCATE h3_metrics_precomputed;"))
            # Per-category rows
            await session.execute(text("""\
                INSERT INTO h3_metrics_precomputed
                    (analysis_type, period, resolution, category_key,
                     total_ads, median_price_kvm, active_h3_cells, computed_at)
                SELECT
                    analysis_type, period, resolution, category,
                    SUM(ad_count),
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_price_kvm),
                    COUNT(DISTINCT h3_index),
                    NOW()
                FROM h3_analytics_records
                GROUP BY analysis_type, period, resolution, category;
            """))
            # Combined-category rows (all categories together per resolution/period/type)
            await session.execute(text("""\
                INSERT INTO h3_metrics_precomputed
                    (analysis_type, period, resolution, category_key,
                     total_ads, median_price_kvm, active_h3_cells, computed_at)
                SELECT
                    r.analysis_type,
                    r.period,
                    r.resolution,
                    (
                        SELECT STRING_AGG(DISTINCT sub.category, ',' ORDER BY sub.category)
                        FROM h3_analytics_records sub
                        WHERE sub.analysis_type = r.analysis_type
                          AND sub.period = r.period
                          AND sub.resolution = r.resolution
                    ),
                    SUM(r.ad_count),
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.median_price_kvm),
                    COUNT(DISTINCT r.h3_index),
                    NOW()
                FROM h3_analytics_records r
                GROUP BY r.analysis_type, r.period, r.resolution
                ON CONFLICT (analysis_type, period, resolution, category_key) DO NOTHING;
            """))

    logger.info("Precomputed tables rebuilt from h3_analytics_records.")


async def run_nightly_job() -> None:
    """Full nightly job: fetch from source DB, then rebuild precomputed tables."""
    if not settings.source_database_url:
        logger.warning("SOURCE_DATABASE_URL not configured — nightly job skipped.")
        return

    logger.info("Nightly job started.")
    try:
        rows = await asyncio.to_thread(_fetch_from_source_db, settings.source_database_url)
        logger.info("Fetched %d rows from source DB.", len(rows))

        async with async_session_factory() as session:
            async with session.begin():
                await session.execute(delete(H3AnalyticsRecord))
                batch_size = 2_000
                records = [_row_to_record(r) for r in rows]
                for i in range(0, len(records), batch_size):
                    session.add_all(records[i : i + batch_size])
                    await session.flush()
        logger.info("h3_analytics_records refreshed (%d rows).", len(records))

        await rebuild_precomputed()

    except Exception:
        logger.exception("Nightly job failed.")
        raise
    else:
        logger.info("Nightly job completed successfully.")
