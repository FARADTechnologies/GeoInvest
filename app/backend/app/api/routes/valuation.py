from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.valuation import (
    BatchValuationRequest,
    BatchValuationResponse,
    MarketAnalysis,
    ValuationMeta,
    ValuationRequest,
    ValuationResult,
)
from app.services.analytics import format_period
from app.services.valuation import ValuationService

router = APIRouter()


@router.get("/valuation/meta", response_model=ValuationMeta)
async def get_valuation_meta(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ValuationMeta:
    """Real rayons / categories / latest period to populate the form + landing."""
    return await ValuationService(session).get_meta()


@router.get("/valuation/market", response_model=MarketAnalysis)
async def get_market_analysis(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MarketAnalysis:
    """Real city-market aggregates (per-rayon median ₼/m² by build type) for
    the Bazar analizi page."""
    return await ValuationService(session).market_analysis()


@router.post("/valuation/single", response_model=ValuationResult)
async def valuate_single(
    payload: ValuationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ValuationResult:
    """Valuate one property against real market medians (rayon + category)."""
    return await ValuationService(session).valuate_one(payload)


@router.post("/valuation/batch", response_model=BatchValuationResponse)
async def valuate_batch(
    payload: BatchValuationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BatchValuationResponse:
    """Valuate a portfolio (5–500 properties) in one call."""
    results, period = await ValuationService(session).valuate_many(payload.items)
    return BatchValuationResponse(results=results, period=format_period(period))
