from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.valuation import (
    BatchValuationRequest,
    BatchValuationResponse,
    ExcelParseResponse,
    MarketAnalysis,
    ParsedListing,
    ValuationMeta,
    ValuationRequest,
    ValuationResult,
)
from app.services.analytics import format_period
from app.services.excel import parse_listings
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


@router.post("/valuation/parse-excel", response_model=ExcelParseResponse)
async def parse_excel(file: UploadFile = File(...)) -> ExcelParseResponse:
    """Parse an uploaded mass-valuation Excel (.xlsx) into listing rows.

    Read-only parse (openpyxl data_only) — no formulas/macros run. Coordinates
    are not in the file; the frontend geocodes each address before predict.
    """
    name = (file.filename or "").lower()
    if not (name.endswith(".xlsx") or name.endswith(".xlsm")):
        raise HTTPException(status_code=400, detail="Yalnız .xlsx faylı qəbul olunur.")
    data = await file.read()
    if len(data) > 5_000_000:
        raise HTTPException(status_code=400, detail="Fayl çox böyükdür (maksimum 5 MB).")
    try:
        rows = parse_listings(data)
    except Exception as exc:  # noqa: BLE001 — any openpyxl failure → 400
        raise HTTPException(status_code=400, detail="Excel faylını oxumaq mümkün olmadı.") from exc
    parsed = [ParsedListing(**r) for r in rows]
    return ExcelParseResponse(rows=parsed, count=len(parsed))


@router.post("/valuation/batch", response_model=BatchValuationResponse)
async def valuate_batch(
    payload: BatchValuationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BatchValuationResponse:
    """Valuate a portfolio (5–500 properties) in one call."""
    results, period = await ValuationService(session).valuate_many(payload.items)
    return BatchValuationResponse(results=results, period=format_period(period))
