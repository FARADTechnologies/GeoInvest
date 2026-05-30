from datetime import date

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.h3_analytics import H3AnalyticsRecord
from app.models.market_stats import MarketStats
from app.schemas.analytics import (
    FiltersResponse,
    MapDataPoint,
    MetricsResponse,
    SparklinesResponse,
    TrendSeriesItem,
)


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
        market_current = await self._market_stats_for_period(selected_period, categories)
        market_previous = (
            await self._market_stats_for_period(previous_period, categories)
            if previous_period
            else None
        )

        current_total_ads = int(
            (market_current or {}).get("total_ads") or current["total_ads"] or 0
        )
        previous_total_ads = (
            int((market_previous or {}).get("total_ads") or previous["total_ads"] or 0)
            if previous
            else None
        )
        current_price = float(
            (market_current or {}).get("avg_median_price") or current["avg_median_price"] or 0
        )
        previous_price = (
            float((market_previous or {}).get("avg_median_price") or previous["avg_median_price"] or 0)
            if previous
            else 0
        )
        trend = (
            ((current_price - previous_price) / previous_price) * 100
            if previous_price > 0
            else 0
        )

        return MetricsResponse(
            total_ads=current_total_ads,
            avg_median_price=current_price,
            trend_percentage=round(trend, 2),
            active_h3_cells=int(current["active_h3_cells"] or 0),
            previous_period=format_period(previous_period),
            previous_total_ads=previous_total_ads,
            previous_avg_median_price=previous_price if previous else None,
            previous_active_h3_cells=int(previous["active_h3_cells"] or 0) if previous else None,
        )

    async def get_sparklines(
        self,
        *,
        period: str,
        categories: list[str],
        resolution: int,
        analysis_type: str,
        min_ads_per_cell: int = 0,
        limit: int = 8,
    ) -> SparklinesResponse:
        selected_period = parse_period(period)
        periods = await self._recent_periods(selected_period, limit)
        total_ads: list[int] = []
        median_prices: list[float] = []
        active_cells: list[int] = []

        for p in periods:
            market = await self._market_stats_for_period(p, categories)
            h3_metrics = await self._metrics_for_period(
                p,
                categories=categories,
                resolution=resolution,
                analysis_type=analysis_type,
                min_ads_per_cell=min_ads_per_cell,
            )
            total_ads.append(int((market or {}).get("total_ads") or h3_metrics["total_ads"] or 0))
            median_prices.append(
                float((market or {}).get("avg_median_price") or h3_metrics["avg_median_price"] or 0)
            )
            active_cells.append(int(h3_metrics["active_h3_cells"] or 0))

        trend_percentage = [0.0]
        for previous, current in zip(median_prices, median_prices[1:]):
            trend_percentage.append(
                round(((current - previous) / previous) * 100, 2) if previous > 0 else 0.0
            )

        return SparklinesResponse(
            total_ads=total_ads,
            avg_median_price=median_prices,
            trend_percentage=trend_percentage,
            active_h3_cells=active_cells,
        )

    async def get_trend_series(
        self,
        *,
        period: str,
        categories: list[str],
        limit: int = 12,
    ) -> list[TrendSeriesItem]:
        selected_period = parse_period(period)
        periods = await self._recent_periods(selected_period, limit)
        category_keys = await self._market_category_keys(categories)

        if not category_keys:
            return []

        stmt = (
            select(
                MarketStats.category,
                MarketStats.period,
                MarketStats.true_median_price_kvm,
            )
            .where(
                MarketStats.period.in_(periods),
                MarketStats.category.in_(category_keys),
            )
            .order_by(MarketStats.category, MarketStats.period)
        )
        rows = (await self.session.execute(stmt)).mappings().all()
        by_category = {
            key: {period: 0.0 for period in periods}
            for key in category_keys
        }
        for row in rows:
            by_category[row["category"]][row["period"]] = float(
                row["true_median_price_kvm"] or 0
            )

        return [
            TrendSeriesItem(
                label="All" if category == "ALL" else category,
                data=[by_category[category][p] for p in periods],
            )
            for category in category_keys
        ]

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

    async def _market_stats_for_period(
        self,
        period: date,
        categories: list[str],
    ) -> dict[str, float | int] | None:
        category_keys = await self._market_category_keys(categories, prefer_all=True)
        if not category_keys:
            return None

        stmt = select(
            func.coalesce(func.sum(MarketStats.total_ad_count), 0).label("total_ads"),
            func.coalesce(
                func.percentile_cont(0.5).within_group(MarketStats.true_median_price_kvm),
                0,
            ).label("avg_median_price"),
        ).where(
            MarketStats.period == period,
            MarketStats.category.in_(category_keys),
        )
        row = (await self.session.execute(stmt)).mappings().one()
        if not row["total_ads"]:
            return None
        return {
            "total_ads": int(row["total_ads"] or 0),
            "avg_median_price": float(row["avg_median_price"] or 0),
        }

    async def _market_category_keys(
        self,
        categories: list[str],
        *,
        prefer_all: bool = False,
    ) -> list[str]:
        distinct_result = await self.session.execute(select(MarketStats.category).distinct())
        available = set(distinct_result.scalars().all())
        if prefer_all and len(categories) > 1 and "ALL" in available:
            return ["ALL"]
        matched = [category for category in categories if category in available]
        if matched:
            return matched
        if "ALL" in available:
            return ["ALL"]
        return []

    async def _recent_periods(self, period: date, limit: int) -> list[date]:
        stmt = (
            select(MarketStats.period)
            .where(MarketStats.period <= period)
            .distinct()
            .order_by(MarketStats.period.desc())
            .limit(limit)
        )
        periods = list((await self.session.execute(stmt)).scalars().all())
        if not periods:
            stmt = (
                select(H3AnalyticsRecord.period)
                .where(H3AnalyticsRecord.period <= period)
                .distinct()
                .order_by(H3AnalyticsRecord.period.desc())
                .limit(limit)
            )
            periods = list((await self.session.execute(stmt)).scalars().all())
        return list(reversed(periods))

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
