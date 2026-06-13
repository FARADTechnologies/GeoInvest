"""Property valuation built on the precomputed analytics tables.

The fair value and price/m² are anchored to **real market medians** — the
same `h3_analytics_records` / `market_stats` data that powers the map and KPI
cards. Given a property's rayon + category we look up the median AZN/m² for the
latest available period and multiply by area (with small, documented quality
adjustments). Rent, yield, payback, liquidity and the investment score are
modelled estimates derived from that anchor, because the source database holds
no rental data.

Read-only: this service issues SELECT queries only.
"""

from __future__ import annotations

import hashlib
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.h3_analytics import H3AnalyticsRecord
from app.models.market_stats import MarketStats
from app.schemas.valuation import (
    RayonPrice,
    ValuationMeta,
    ValuationRequest,
    ValuationResult,
)
from app.services.analytics import format_period

# Default analysis mode for rayon-level price lookups (administrative boundary).
_ANALYSIS_TYPE = "geom"

# Quality multipliers applied on top of the market median (documented + mild).
# 2-option repair field (rate-my-apartment): Təmirli / Təmirsiz.
_REPAIR_FACTOR = {
    "Təmirli": 1.05,
    "Təmirsiz": 0.92,
    # legacy 4-option values kept for backward compatibility with old data
    "Əla": 1.06,
    "Var": 1.00,
    "Orta": 0.96,
    "Yox": 0.90,
}
# Annual gross rental yield assumptions by build type (no rent data in DB).
_YIELD_NEW = 0.055
_YIELD_OLD = 0.072
# Base time-on-market (days) by build type.
_LIQUIDITY_NEW = 70
_LIQUIDITY_OLD = 95


def _is_new(category: str | None) -> bool:
    return bool(category) and "yeni" in category.lower()


def _stable_jitter(seed_text: str, spread: float) -> float:
    """Deterministic value in [-spread, +spread] from a text seed.

    Keeps re-valuations reproducible (same inputs → same output) while giving
    analytics charts a natural spread instead of identical numbers.
    """
    digest = hashlib.md5(seed_text.encode("utf-8")).hexdigest()
    unit = int(digest[:8], 16) / 0xFFFFFFFF  # 0..1
    return (unit - 0.5) * 2 * spread


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

    async def valuate_one(self, req: ValuationRequest) -> ValuationResult:
        period = await self._latest_period()
        category = await self._match_category(req.type)
        price_per_m2, basis = await self._price_per_m2(period, req.rayon, category)
        market_median = await self._market_median(period, category)
        return self._build_result(
            req,
            period=period,
            category=category,
            base_price_per_m2=price_per_m2,
            basis=basis,
            market_median=market_median,
        )

    async def valuate_many(self, items: list[ValuationRequest]) -> tuple[list[ValuationResult], date | None]:
        period = await self._latest_period()
        # Cache per (rayon, category) so a batch hits the DB once per group.
        price_cache: dict[tuple[str | None, str | None], tuple[float, str]] = {}
        market_cache: dict[str | None, float | None] = {}
        results: list[ValuationResult] = []
        for req in items:
            category = await self._match_category(req.type)
            key = ((req.rayon or "").lower() or None, category)
            if key not in price_cache:
                price_cache[key] = await self._price_per_m2(period, req.rayon, category)
            if category not in market_cache:
                market_cache[category] = await self._market_median(period, category)
            price_per_m2, basis = price_cache[key]
            results.append(
                self._build_result(
                    req,
                    period=period,
                    category=category,
                    base_price_per_m2=price_per_m2,
                    basis=basis,
                    market_median=market_cache[category],
                )
            )
        return results, period

    # ── DB lookups (read-only) ────────────────────────────────────────

    async def _latest_period(self) -> date | None:
        stmt = select(func.max(H3AnalyticsRecord.period))
        period = (await self.session.execute(stmt)).scalar_one_or_none()
        if period is None:
            stmt = select(func.max(MarketStats.period))
            period = (await self.session.execute(stmt)).scalar_one_or_none()
        return period

    async def _categories(self) -> list[str]:
        stmt = select(H3AnalyticsRecord.category).distinct().order_by(H3AnalyticsRecord.category)
        cats = list((await self.session.execute(stmt)).scalars().all())
        return cats

    async def _match_category(self, type_value: str | None) -> str | None:
        """Map a UI build-type label to an actual DB category string."""
        cats = await self._categories()
        if not type_value or not cats:
            return cats[0] if cats else None
        wants_new = "yeni" in type_value.lower()
        for cat in cats:
            if wants_new and "yeni" in cat.lower():
                return cat
            if not wants_new and ("köhn" in cat.lower() or "kohn" in cat.lower()):
                return cat
        return cats[0]

    async def _price_per_m2(
        self,
        period: date | None,
        rayon: str | None,
        category: str | None,
    ) -> tuple[float, str]:
        """Median AZN/m² for the rayon+category, with graceful fallbacks.

        Returns (price_per_m2, basis) where basis is 'rayon' | 'market' | 'fallback'.
        """
        if period is not None and rayon:
            clauses = [
                H3AnalyticsRecord.period == period,
                H3AnalyticsRecord.analysis_type == _ANALYSIS_TYPE,
                H3AnalyticsRecord.rayon_name.ilike(f"%{rayon}%"),
            ]
            if category:
                clauses.append(H3AnalyticsRecord.category == category)
            stmt = select(
                func.percentile_cont(0.5).within_group(H3AnalyticsRecord.median_price_kvm)
            ).where(*clauses)
            value = (await self.session.execute(stmt)).scalar_one_or_none()
            if value:
                return float(value), "rayon"

        market = await self._market_median(period, category)
        if market:
            return float(market), "market"

        # Last-resort constant so the UI never shows a zero value offline.
        return 1800.0, "fallback"

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

    # ── Pure modelling (no DB) ────────────────────────────────────────

    def _build_result(
        self,
        req: ValuationRequest,
        *,
        period: date | None,
        category: str | None,
        base_price_per_m2: float,
        basis: str,
        market_median: float | None,
    ) -> ValuationResult:
        is_new = _is_new(category) if category else _is_new(req.type)

        # Quality adjustment on the market median.
        adj = _REPAIR_FACTOR.get((req.repair or "").strip(), 1.0)
        if req.floor and req.total_floors:
            if req.floor == 1:
                adj *= 0.97
            elif req.floor >= req.total_floors:
                adj *= 0.98
        price_per_m2 = base_price_per_m2 * adj

        seed = f"{req.address or ''}|{req.rayon or ''}|{req.area}|{req.rooms or ''}|{req.floor or ''}"

        fair_value = round(price_per_m2 * req.area / 10) * 10

        # Rent / yield (modelled — no rent data in source DB).
        yield_rate = (_YIELD_NEW if is_new else _YIELD_OLD) + _stable_jitter(seed + "y", 0.006)
        monthly_rent = round(fair_value * yield_rate / 12 / 10) * 10
        yield_pct = round(monthly_rent * 12 / fair_value * 100, 1) if fair_value else 0.0
        payback_years = round(100 / yield_pct, 1) if yield_pct else 0.0

        liquidity = (_LIQUIDITY_NEW if is_new else _LIQUIDITY_OLD)
        if market_median:
            # Pricier-than-market homes take longer to sell.
            liquidity += int((price_per_m2 - market_median) / max(market_median, 1) * 60)
        liquidity += int(_stable_jitter(seed + "l", 18))
        liquidity_days = max(20, min(260, liquidity))

        score = (
            60
            + (yield_pct - 6) * 6
            - (payback_years - 12) * 1.5
            - (liquidity_days - 90) * 0.15
            + _stable_jitter(seed + "s", 7)
        )
        score_int = max(38, min(96, round(score)))
        risk = "Aşağı" if score_int >= 78 else "Orta" if score_int >= 60 else "Yüksək"

        return ValuationResult(
            address=req.address,
            rayon=req.rayon or "",
            type=req.type,
            area=req.area,
            rooms=req.rooms,
            floor=req.floor,
            total_floors=req.total_floors,
            repair=req.repair,
            extract=req.extract,
            residence=req.residence,
            fair_value=fair_value,
            price_per_m2=round(fair_value / req.area) if req.area else round(price_per_m2),
            price_range=[round(fair_value * 0.91), round(fair_value * 1.09)],
            market_median_kvm=round(market_median, 2) if market_median else None,
            monthly_rent=monthly_rent,
            rent_range=[round(monthly_rent * 0.82), round(monthly_rent * 1.18)],
            yield_pct=yield_pct,
            payback_years=payback_years,
            liquidity_days=liquidity_days,
            score=score_int,
            risk=risk,
            period=format_period(period),
            price_basis=basis,
        )
