from datetime import date

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.h3_analytics import H3AnalyticsRecord
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


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_filters(self) -> FiltersResponse:
        periods_result = await self.session.execute(
            select(H3AnalyticsRecord.period).distinct().order_by(H3AnalyticsRecord.period.desc())
        )
        categories_result = await self.session.execute(
            select(H3AnalyticsRecord.category).distinct().order_by(H3AnalyticsRecord.category)
        )
        resolutions_result = await self.session.execute(
            select(H3AnalyticsRecord.resolution).distinct().order_by(H3AnalyticsRecord.resolution)
        )
        analysis_types_result = await self.session.execute(
            select(H3AnalyticsRecord.analysis_type).distinct().order_by(H3AnalyticsRecord.analysis_type)
        )

        return FiltersResponse(
            periods=[
                formatted
                for period in periods_result.scalars().all()
                if (formatted := format_period(period)) is not None
            ],
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
                H3AnalyticsRecord.h3_index.label("h3_index"),
                func.sum(H3AnalyticsRecord.ad_count).label("ad_count"),
                func.percentile_cont(0.5)
                .within_group(H3AnalyticsRecord.median_price_kvm)
                .label("median_price_kvm"),
                func.string_agg(distinct(H3AnalyticsRecord.category), ", ").label("category"),
                func.string_agg(distinct(H3AnalyticsRecord.rayon_name), ", ").label("rayon_name"),
            )
            .where(*self._filter_clauses(selected_period, categories, resolution, analysis_type))
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

    async def _metrics_for_period(
        self,
        period: date,
        *,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int = 0,
    ) -> dict[str, float | int | None]:
        filters = list(self._filter_clauses(period, categories, resolution, analysis_type))

        if min_ads_per_cell > 0:
            qualified_subq = (
                select(H3AnalyticsRecord.h3_index)
                .where(*self._filter_clauses(period, categories, resolution, analysis_type))
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

    async def _previous_period(
        self,
        period: date,
        *,
        categories: list[str],
        resolution: int,
        analysis_type: str,
    ) -> date | None:
        stmt: Select[tuple[date | None]] = select(func.max(H3AnalyticsRecord.period)).where(
            H3AnalyticsRecord.period < period,
            H3AnalyticsRecord.analysis_type == analysis_type,
            H3AnalyticsRecord.resolution == resolution,
            H3AnalyticsRecord.category.in_(categories),
        )
        return (await self.session.execute(stmt)).scalar_one()

    @staticmethod
    def _filter_clauses(
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
