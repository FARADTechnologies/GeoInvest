from datetime import date

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.h3_analytics import H3AnalyticsRecord
from app.models.precomputed import H3MapPrecomputed, H3MetricsPrecomputed
from app.schemas.analytics import FiltersResponse, MapDataPoint, MetricsResponse


def parse_period(value: str) -> date:
    try:
        year, month = value.split("-", maxsplit=1)
        return date(int(year), int(month), 1)
    except ValueError as exc:
        raise ValueError("Period must use YYYY-MM format.") from exc


def format_period(value: date | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m")


def _category_key(categories: list[str]) -> str:
    """Sorted, comma-joined category string matching what the nightly job stores."""
    return ",".join(sorted(categories))


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_filters(self) -> FiltersResponse:
        # Read from h3_map_precomputed (live pre-computed layer).
        # Falls back to h3_analytics_records when precomputed table is empty.
        source = H3MapPrecomputed

        periods_result = await self.session.execute(
            select(source.period).distinct().order_by(source.period.desc())
        )
        periods = [formatted for p in periods_result.scalars().all() if (formatted := format_period(p))]

        if not periods:
            # Bootstrap fallback: precomputed tables not yet populated.
            source = H3AnalyticsRecord  # type: ignore[assignment]
            periods_result = await self.session.execute(
                select(source.period).distinct().order_by(source.period.desc())
            )
            periods = [formatted for p in periods_result.scalars().all() if (formatted := format_period(p))]

        categories_result = await self.session.execute(
            select(source.category).distinct().order_by(source.category)
        )
        resolutions_result = await self.session.execute(
            select(source.resolution).distinct().order_by(source.resolution)
        )
        analysis_types_result = await self.session.execute(
            select(source.analysis_type).distinct().order_by(source.analysis_type)
        )

        return FiltersResponse(
            periods=periods,
            categories=list(categories_result.scalars().all()),
            resolutions=list(resolutions_result.scalars().all()),
            analysis_types=list(analysis_types_result.scalars().all()),
        )

    async def get_metrics(
        self,
        *,
        period: str,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int = 0,
    ) -> MetricsResponse:
        selected_period = parse_period(period)
        current = await self._metrics_for_period(
            selected_period,
            categories=categories,
            resolution=resolution,
            analysis_type=analysis_type,
            min_ads_per_cell=min_ads_per_cell,
        )
        previous_period = await self._previous_period(
            selected_period,
            categories=categories,
            resolution=resolution,
            analysis_type=analysis_type,
        )
        previous = (
            await self._metrics_for_period(
                previous_period,
                categories=categories,
                resolution=resolution,
                analysis_type=analysis_type,
                min_ads_per_cell=min_ads_per_cell,
            )
            if previous_period
            else None
        )

        current_price = float(current["avg_median_price"] or 0)
        previous_price = float(previous["avg_median_price"] or 0) if previous else 0
        trend = (
            ((current_price - previous_price) / previous_price) * 100
            if previous_price > 0
            else 0
        )

        return MetricsResponse(
            total_ads=int(current["total_ads"] or 0),
            avg_median_price=current_price,
            trend_percentage=round(trend, 2),
            active_h3_cells=int(current["active_h3_cells"] or 0),
            previous_period=format_period(previous_period),
        )

    async def get_map_data(
        self,
        *,
        period: str,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int = 0,
    ) -> list[MapDataPoint]:
        selected_period = parse_period(period)
        stmt = (
            select(
                H3MapPrecomputed.h3_index.label("h3_index"),
                func.sum(H3MapPrecomputed.ad_count).label("ad_count"),
                func.percentile_cont(0.5)
                .within_group(H3MapPrecomputed.median_price_kvm)
                .label("median_price_kvm"),
                func.string_agg(distinct(H3MapPrecomputed.category), ", ").label("category"),
                func.string_agg(distinct(H3MapPrecomputed.rayon_name), ", ").label("rayon_name"),
            )
            .where(*self._map_filter_clauses(selected_period, categories, resolution, analysis_type))
            .group_by(H3MapPrecomputed.h3_index)
            .order_by(func.sum(H3MapPrecomputed.ad_count).desc())
        )
        if min_ads_per_cell > 0:
            stmt = stmt.having(func.sum(H3MapPrecomputed.ad_count) > min_ads_per_cell)

        rows = (await self.session.execute(stmt)).mappings().all()

        # Fallback: if precomputed table is empty, read from raw records.
        if not rows:
            return await self._map_data_fallback(
                period=period,
                categories=categories,
                resolution=resolution,
                analysis_type=analysis_type,
                min_ads_per_cell=min_ads_per_cell,
            )

        return [
            MapDataPoint(
                h3_index=row["h3_index"],
                ad_count=int(row["ad_count"] or 0),
                median_price_kvm=float(row["median_price_kvm"] or 0),
                category=row["category"] or "",
                rayon_name=row["rayon_name"] or "",
            )
            for row in rows
        ]

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    async def _metrics_for_period(
        self,
        period: date,
        *,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int = 0,
    ) -> dict[str, float | int | None]:
        # Fast path: pre-computed table (no outlier filter required).
        if min_ads_per_cell == 0:
            key = _category_key(categories)
            stmt = select(
                func.coalesce(H3MetricsPrecomputed.total_ads, 0).label("total_ads"),
                func.coalesce(H3MetricsPrecomputed.median_price_kvm, 0).label("avg_median_price"),
                func.coalesce(H3MetricsPrecomputed.active_h3_cells, 0).label("active_h3_cells"),
            ).where(
                H3MetricsPrecomputed.period == period,
                H3MetricsPrecomputed.resolution == resolution,
                H3MetricsPrecomputed.analysis_type == analysis_type,
                H3MetricsPrecomputed.category_key == key,
            )
            row = (await self.session.execute(stmt)).mappings().one_or_none()
            if row:
                return dict(row)
            # Table is empty (before first job run) — fall through to computation.

        # Slower path: compute from h3_map_precomputed (pre-aggregated hex rows,
        # much cheaper than operating on raw item_app_items data).
        filters = list(self._map_filter_clauses(period, categories, resolution, analysis_type))

        if min_ads_per_cell > 0:
            qualified_subq = (
                select(H3MapPrecomputed.h3_index)
                .where(*self._map_filter_clauses(period, categories, resolution, analysis_type))
                .group_by(H3MapPrecomputed.h3_index)
                .having(func.sum(H3MapPrecomputed.ad_count) > min_ads_per_cell)
                .scalar_subquery()
            )
            filters.append(H3MapPrecomputed.h3_index.in_(qualified_subq))

        stmt = select(
            func.coalesce(func.sum(H3MapPrecomputed.ad_count), 0).label("total_ads"),
            func.coalesce(
                func.percentile_cont(0.5).within_group(H3MapPrecomputed.median_price_kvm),
                0,
            ).label("avg_median_price"),
            func.count(distinct(H3MapPrecomputed.h3_index)).label("active_h3_cells"),
        ).where(*filters)

        row = (await self.session.execute(stmt)).mappings().one_or_none()
        if row is not None:
            return dict(row)

        # Ultimate fallback: compute from raw h3_analytics_records.
        return await self._metrics_from_raw(
            period, categories=categories, resolution=resolution,
            analysis_type=analysis_type, min_ads_per_cell=min_ads_per_cell,
        )

    async def _previous_period(
        self,
        period: date,
        *,
        categories: list[str],
        resolution: int,
        analysis_type: str,
    ) -> date | None:
        key = _category_key(categories)
        stmt: Select[tuple[date | None]] = select(func.max(H3MetricsPrecomputed.period)).where(
            H3MetricsPrecomputed.period < period,
            H3MetricsPrecomputed.analysis_type == analysis_type,
            H3MetricsPrecomputed.resolution == resolution,
            H3MetricsPrecomputed.category_key == key,
        )
        result = (await self.session.execute(stmt)).scalar_one_or_none()
        if result:
            return result

        # Fallback: check h3_map_precomputed or raw records.
        stmt = select(func.max(H3MapPrecomputed.period)).where(
            H3MapPrecomputed.period < period,
            H3MapPrecomputed.analysis_type == analysis_type,
            H3MapPrecomputed.resolution == resolution,
            H3MapPrecomputed.category.in_(categories),
        )
        result = (await self.session.execute(stmt)).scalar_one_or_none()
        if result:
            return result

        stmt = select(func.max(H3AnalyticsRecord.period)).where(
            H3AnalyticsRecord.period < period,
            H3AnalyticsRecord.analysis_type == analysis_type,
            H3AnalyticsRecord.resolution == resolution,
            H3AnalyticsRecord.category.in_(categories),
        )
        return (await self.session.execute(stmt)).scalar_one()

    async def _map_data_fallback(
        self,
        *,
        period: str,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int,
    ) -> list[MapDataPoint]:
        """Read from raw h3_analytics_records when precomputed table is empty."""
        selected_period = parse_period(period)
        stmt = (
            select(
                H3AnalyticsRecord.h3_index.label("h3_index"),
                func.sum(H3AnalyticsRecord.ad_count).label("ad_count"),
                func.percentile_cont(0.5)
                .within_group(H3AnalyticsRecord.median_price_kvm)
                .label("median_price_kvm"),
                func.string_agg(distinct(H3AnalyticsRecord.category), ", ").label("category"),
                func.string_agg(distinct(H3AnalyticsRecord.rayon_name), ", ").label("rayon_name"),
            )
            .where(*self._raw_filter_clauses(selected_period, categories, resolution, analysis_type))
            .group_by(H3AnalyticsRecord.h3_index)
            .order_by(func.sum(H3AnalyticsRecord.ad_count).desc())
        )
        if min_ads_per_cell > 0:
            stmt = stmt.having(func.sum(H3AnalyticsRecord.ad_count) > min_ads_per_cell)

        rows = (await self.session.execute(stmt)).mappings().all()
        return [
            MapDataPoint(
                h3_index=row["h3_index"],
                ad_count=int(row["ad_count"] or 0),
                median_price_kvm=float(row["median_price_kvm"] or 0),
                category=row["category"] or "",
                rayon_name=row["rayon_name"] or "",
            )
            for row in rows
        ]

    async def _metrics_from_raw(
        self,
        period: date,
        *,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int,
    ) -> dict[str, float | int | None]:
        """Compute metrics directly from h3_analytics_records (bootstrap fallback)."""
        filters = list(self._raw_filter_clauses(period, categories, resolution, analysis_type))

        if min_ads_per_cell > 0:
            qualified_subq = (
                select(H3AnalyticsRecord.h3_index)
                .where(*self._raw_filter_clauses(period, categories, resolution, analysis_type))
                .group_by(H3AnalyticsRecord.h3_index)
                .having(func.sum(H3AnalyticsRecord.ad_count) > min_ads_per_cell)
                .scalar_subquery()
            )
            filters.append(H3AnalyticsRecord.h3_index.in_(qualified_subq))

        stmt = select(
            func.coalesce(func.sum(H3AnalyticsRecord.ad_count), 0).label("total_ads"),
            func.coalesce(
                func.percentile_cont(0.5).within_group(H3AnalyticsRecord.median_price_kvm),
                0,
            ).label("avg_median_price"),
            func.count(distinct(H3AnalyticsRecord.h3_index)).label("active_h3_cells"),
        ).where(*filters)

        row = (await self.session.execute(stmt)).mappings().one()
        return dict(row)

    @staticmethod
    def _map_filter_clauses(
        period: date,
        categories: list[str],
        resolution: int,
        analysis_type: str,
    ):
        return (
            H3MapPrecomputed.period == period,
            H3MapPrecomputed.category.in_(categories),
            H3MapPrecomputed.resolution == resolution,
            H3MapPrecomputed.analysis_type == analysis_type,
        )

    @staticmethod
    def _raw_filter_clauses(
        period: date,
        categories: list[str],
        resolution: int,
        analysis_type: str,
    ):
        return (
            H3AnalyticsRecord.period == period,
            H3AnalyticsRecord.category.in_(categories),
            H3AnalyticsRecord.resolution == resolution,
            H3AnalyticsRecord.analysis_type == analysis_type,
        )
