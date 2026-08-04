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
from datetime import date, datetime, timezone

import psycopg
from sqlalchemy import delete, text

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.h3_analytics import H3AnalyticsRecord

logger = logging.getLogger(__name__)

_RESOLUTIONS = [6, 7, 8]
_TARGET_CATEGORIES = (3, 4)  # Yeni Tikili, Köhne Tikili

# Noise floor: listings priced below this (AZN, total) are garbage/mislabeled
# (a real Baku flat is never < 5000 ₼) and are dropped BEFORE H3 aggregation,
# so they never distort a cell's median ₼/m² or ad_count. Fixed, not a slider.
_MIN_LISTING_PRICE = 5000

# item_app_items holds sale AND rent listings, both keeping the amount in
# owner_price, so rentals have to be excluded or they drag the ₼/m² medians
# down (a monthly rent averages ~413 ₼/m² against ~2 819 ₼/m² for a sale).
#
# type_id looks like the obvious discriminator but is unreliable: the lookup
# table itself is mislabeled (id 3 = "Kirayə" with description "Sales"), and
# filtering on type_id = 1 drops 669 genuine sale listings while still letting
# rentals through. The published title is authoritative — every listing starts
# with either "Satılır …" (for sale) or "İcarəyə verilir …" (for rent).
_SALE_TITLE_PREFIX = "Satılır%"

# Merge of the legacy bulk-import table (item_app_items_excel) into the source
# pool. Turned OFF by decision: the live table is the single source of truth.
# The merge code below is kept intact — flip this to True (and make sure the
# deployment role has SELECT on that table) to fold the archive back in.
_MERGE_ARCHIVE_TABLE = False

# Source rows, de-duplicated. `item_app_items` is the single source of truth.
#
# The same listing can appear more than once (re-scrapes share a source_url), so
# DISTINCT ON keeps the newest row per source_url; rows without one fall back to
# a table-qualified id and stay distinct. De-duplicating here — before the H3
# grouping — stops a repeat inflating a cell's ad_count or skewing its median.
#
# The UNION branch for the archive table is retained but disabled above; when
# re-enabled the live table wins ties (pri=1) since its rows are newer.
def _pool_select(table: str, pri: int) -> str:
    return f"""\
    SELECT {pri} AS pri, t.id, t.source_url, t.latitude, t.longitude,
           t.owner_price, t.size, t.created_date, t.category_id
    FROM {table} t
    WHERE t.deleted IS NOT TRUE
      AND t.title ILIKE '{{sale_title}}'
      AND t.latitude IS NOT NULL
      AND t.longitude IS NOT NULL
      AND t.owner_price IS NOT NULL
      AND t.owner_price >= {{min_price}}
      AND t.size > 0
      AND t.category_id IN ({{cats}})"""


def _source_cte(include_excel: bool) -> str:
    """Build the source CTE, optionally folding in the bulk-import table.

    The deployment's DB role may not be granted SELECT on
    item_app_items_excel. Losing those rows costs coverage, but failing the
    whole job would freeze every period — so the caller probes access first and
    the archive is simply left out when it is unreadable.
    """
    branches = [_pool_select("item_app_items", 1)]
    if include_excel:
        branches.append(_pool_select("item_app_items_excel", 2))
    return (
        "WITH pool AS (\n"
        + "\n    UNION ALL\n".join(branches)
        + """
), src AS (
    SELECT DISTINCT ON (COALESCE(source_url, pri::text || '-' || id::text))
        id, latitude, longitude, owner_price, size, created_date, category_id
    FROM pool
    ORDER BY COALESCE(source_url, pri::text || '-' || id::text), pri, created_date DESC, id DESC
)
"""
    )

_GEOM_BODY = """\
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
FROM src i
LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
JOIN index_app_object o
    ON ST_Contains(o.geom, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
WHERE o.type_id = 22
GROUP BY 1, 2, 3, 4, 8, 9
ORDER BY period DESC, rayon_name;
"""

_PURE_H3_BODY = """\
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
FROM src i
LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
GROUP BY 1, 2, 3, 4, 8, 9
ORDER BY period DESC, ad_count DESC;
"""


def _fetch_from_source_db(conn_str: str) -> list[tuple]:
    """Runs synchronously in a thread — must not use asyncio."""
    # SOURCE_DATABASE_URL is written as a SQLAlchemy URL ("postgresql+asyncpg://"),
    # but this path connects with psycopg, which rejects the "+driver" suffix
    # ("missing '=' ... in connection info string") — the job had been failing at
    # connect time on every run because of it. predict.py already strips it.
    conn_str = conn_str.replace("postgresql+asyncpg://", "postgresql://")
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
        # The archive merge is disabled (_MERGE_ARCHIVE_TABLE). When it is
        # switched back on, probe the table in its own transaction first: the
        # deployment role may lack SELECT on it, and a failed statement would
        # otherwise poison the connection for everything that follows.
        include_excel = False
        if _MERGE_ARCHIVE_TABLE:
            include_excel = True
            try:
                with conn.cursor() as probe:
                    probe.execute("SELECT 1 FROM item_app_items_excel LIMIT 1")
                    probe.fetchall()
            except psycopg.Error as exc:
                include_excel = False
                logger.warning(
                    "item_app_items_excel unavailable (%s) — continuing with "
                    "the live table only.",
                    type(exc).__name__,
                )
            conn.rollback()

        cte = _source_cte(include_excel)
        geom_sql, pure_sql = cte + _GEOM_BODY, cte + _PURE_H3_BODY
        fmt = {"cats": cats, "min_price": _MIN_LISTING_PRICE, "sale_title": _SALE_TITLE_PREFIX}
        with conn.cursor() as cur:
            for res in _RESOLUTIONS:
                logger.info("Fetching geom path (res=%d)…", res)
                cur.execute(geom_sql.format(res=res, **fmt))
                rows.extend(cur.fetchall())
                logger.info("Fetching pure_h3 path (res=%d)…", res)
                cur.execute(pure_sql.format(res=res, **fmt))
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


# Last-run bookkeeping so the dashboard can tell whether the data is fresh and
# why a refresh failed — the job used to be a black box (no manual trigger, no
# logs reachable from the app), which is how it stayed silently stale.
_last_run: dict[str, object] = {
    "started_at": None,
    "finished_at": None,
    "status": "never",  # never | running | ok | failed
    "rows": 0,
    "error": None,
}


def last_run_info() -> dict:
    return dict(_last_run)


async def run_nightly_job() -> None:
    """Full nightly job: fetch from source DB, then rebuild precomputed tables."""
    if not settings.source_database_url:
        logger.warning("SOURCE_DATABASE_URL not configured — nightly job skipped.")
        _last_run.update(status="failed", error="SOURCE_DATABASE_URL not configured")
        return

    logger.info("Nightly job started.")
    _last_run.update(
        started_at=datetime.now(timezone.utc).isoformat(),
        status="running",
        error=None,
    )
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

    except Exception as exc:
        logger.exception("Nightly job failed.")
        _last_run.update(
            finished_at=datetime.now(timezone.utc).isoformat(),
            status="failed",
            error=f"{type(exc).__name__}: {exc}"[:500],
        )
        raise
    else:
        logger.info("Nightly job completed successfully.")
        _last_run.update(
            finished_at=datetime.now(timezone.utc).isoformat(),
            status="ok",
            rows=len(records),
            error=None,
        )
