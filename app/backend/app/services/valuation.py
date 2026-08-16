"""Market aggregates read from the precomputed analytics tables.

Supplies the valuation form's dropdowns (`get_meta`) and the Bazar analizi
figures (`market_analysis`) — per-rayon median AZN/m² by build type, listing
counts, the city median and the new-build share, all straight from
`h3_analytics_records` / `market_stats`.

This module used to carry a second job: a local valuation engine that answered
/valuation/single and /valuation/batch. It anchored fair value on a real market
median, but rent, yield, payback, liquidity and the investment score were
produced from fixed assumptions plus a hash-derived jitter — reproducible, and
entirely invented. Valuation now runs only through the team's predict model
(services/predict.py), so the engine and its two endpoints are gone.

Read-only: this service issues SELECT queries only.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.h3_analytics import H3AnalyticsRecord
from app.models.market_stats import MarketStats
from app.schemas.valuation import (
    MarketAnalysis,
    MarketRayon,
    RayonPrice,
    ValuationMeta,
)
from app.services.analytics import format_period

# Default analysis mode for rayon-level price lookups (administrative boundary).
_ANALYSIS_TYPE = "geom"

class ValuationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Public API ────────────────────────────────────────────────────

    async def get_meta(self) -> ValuationMeta:
        period = await self._latest_period()
        categories = await self._categories()
        rayons = await self._rayon_prices(period) if period else []
        market = await self._market_median(period, None) if period else None
        return ValuationMeta(
            period=format_period(period),
            categories=categories,
            rayons=rayons,
            market_median_kvm=market,
        )

    async def market_analysis(self) -> MarketAnalysis:
        """Real city-market aggregates for the Bazar analizi page.

        Per rayon we return the median AZN/m² split by build type (yeni /
        köhnə) plus the listing count — all straight from the analytics
        tables. City median + new-build share are real too. The frontend
        models yield / liquidity / rent / txn / growth from these anchors.
        """
        # The newest period is often only partially scraped (collapses to a
        # rayon or two), so the market overview uses the richest period — the
        # one with the most listings — for a full, representative snapshot.
        period = await self._richest_period() or await self._latest_period()
        if period is None:
            return MarketAnalysis(rayons=[])

        new_map = await self._rayon_median_by_cat(period, "yeni")
        old_map = await self._rayon_median_by_cat(period, "köhn")

        rayons: list[MarketRayon] = []
        new_ads = 0
        total_ads = 0
        for name in sorted(set(new_map) | set(old_map)):
            ppm_new, ad_new = new_map.get(name, (None, 0))
            ppm_old, ad_old = old_map.get(name, (None, 0))
            new_ads += ad_new
            total_ads += ad_new + ad_old
            rayons.append(
                MarketRayon(
                    rayon=name,
                    ppm_new=round(ppm_new, 2) if ppm_new else None,
                    ppm_old=round(ppm_old, 2) if ppm_old else None,
                    ad_count=ad_new + ad_old,
                )
            )
        rayons.sort(key=lambda r: r.ad_count, reverse=True)

        city_median = await self._market_median(period, None)
        if not city_median:
            # MarketStats may not cover this period → average the rayon medians.
            ppms = [v[0] for v in [*new_map.values(), *old_map.values()] if v[0]]
            city_median = sum(ppms) / len(ppms) if ppms else None
        new_share = round(new_ads / total_ads * 100) if total_ads else 0
        return MarketAnalysis(
            period=format_period(period),
            city_median_kvm=round(city_median, 2) if city_median else None,
            new_share=new_share,
            total_ad_count=total_ads,
            rayons=rayons,
        )

    # ── DB lookups (read-only) ────────────────────────────────────────

    async def _latest_period(self) -> date | None:
        stmt = select(func.max(H3AnalyticsRecord.period))
        period = (await self.session.execute(stmt)).scalar_one_or_none()
        if period is None:
            stmt = select(func.max(MarketStats.period))
            period = (await self.session.execute(stmt)).scalar_one_or_none()
        return period

    async def _richest_period(self) -> date | None:
        """Period with the most listings — a fuller snapshot than the newest
        (often partially-scraped) period."""
        stmt = (
            select(H3AnalyticsRecord.period)
            .where(
                H3AnalyticsRecord.analysis_type == _ANALYSIS_TYPE,
                H3AnalyticsRecord.rayon_name != "",
            )
            .group_by(H3AnalyticsRecord.period)
            .order_by(func.sum(H3AnalyticsRecord.ad_count).desc())
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def _categories(self) -> list[str]:
        stmt = select(H3AnalyticsRecord.category).distinct().order_by(H3AnalyticsRecord.category)
        cats = list((await self.session.execute(stmt)).scalars().all())
        return cats

    async def _market_median(self, period: date | None, category: str | None) -> float | None:
        if period is None:
            return None
        clauses = [MarketStats.period == period]
        if category:
            clauses.append(MarketStats.category == category)
        stmt = select(
            func.percentile_cont(0.5).within_group(MarketStats.true_median_price_kvm)
        ).where(*clauses)
        value = (await self.session.execute(stmt)).scalar_one_or_none()
        if value:
            return float(value)
        # Category may not exist as its own MarketStats row → city-wide median.
        stmt = select(
            func.percentile_cont(0.5).within_group(MarketStats.true_median_price_kvm)
        ).where(MarketStats.period == period)
        value = (await self.session.execute(stmt)).scalar_one_or_none()
        return float(value) if value else None

    async def _rayon_prices(self, period: date) -> list[RayonPrice]:
        stmt = (
            select(
                H3AnalyticsRecord.rayon_name.label("rayon"),
                func.percentile_cont(0.5)
                .within_group(H3AnalyticsRecord.median_price_kvm)
                .label("median_price_kvm"),
                func.sum(H3AnalyticsRecord.ad_count).label("ad_count"),
            )
            .where(
                H3AnalyticsRecord.period == period,
                H3AnalyticsRecord.analysis_type == _ANALYSIS_TYPE,
                H3AnalyticsRecord.rayon_name != "",
            )
            .group_by(H3AnalyticsRecord.rayon_name)
            .order_by(func.sum(H3AnalyticsRecord.ad_count).desc())
        )
        rows = (await self.session.execute(stmt)).mappings().all()
        return [
            RayonPrice(
                rayon=row["rayon"],
                median_price_kvm=round(float(row["median_price_kvm"] or 0), 2),
                ad_count=int(row["ad_count"] or 0),
            )
            for row in rows
            if row["rayon"]
        ]

    async def _rayon_median_by_cat(
        self, period: date, kw: str
    ) -> dict[str, tuple[float, int]]:
        """Median AZN/m² + listing count per rayon for one build-type keyword.

        `kw` is matched against the category with ILIKE (e.g. "yeni", "köhn").
        Returns { rayon_name: (median_price_kvm, ad_count) }.
        """
        stmt = (
            select(
                H3AnalyticsRecord.rayon_name.label("rayon"),
                func.percentile_cont(0.5)
                .within_group(H3AnalyticsRecord.median_price_kvm)
                .label("ppm"),
                func.sum(H3AnalyticsRecord.ad_count).label("ad_count"),
            )
            .where(
                H3AnalyticsRecord.period == period,
                H3AnalyticsRecord.analysis_type == _ANALYSIS_TYPE,
                H3AnalyticsRecord.rayon_name != "",
                H3AnalyticsRecord.category.ilike(f"%{kw}%"),
                # Drop obviously-bad rows (some records carry a near-zero
                # median) so they don't corrupt the per-rayon median.
                H3AnalyticsRecord.median_price_kvm > 200,
            )
            .group_by(H3AnalyticsRecord.rayon_name)
        )
        rows = (await self.session.execute(stmt)).mappings().all()
        return {
            row["rayon"]: (float(row["ppm"] or 0), int(row["ad_count"] or 0))
            for row in rows
            if row["rayon"]
        }

