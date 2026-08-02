from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.user import User
from app.models.valuation_job import ValuationJob
from app.schemas.predict import PredictRequest
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
from app.services import valuation_jobs
from app.services.analytics import format_period
from app.services.excel import parse_listings
from app.services.valuation import ValuationService
from pydantic import BaseModel


class JobCreateRequest(BaseModel):
    items: list[PredictRequest]
    portfolio_id: str | None = None

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


# ── Server-side batch jobs (predict model) ───────────────────────────────────
# The browser used to loop over the portfolio itself, calling /model/predict per
# flat, so leaving the page cancelled the run and lost the work. It now submits
# a job and polls; the loop belongs to the backend.


@router.post("/valuation/jobs")
async def create_valuation_job(
    payload: JobCreateRequest,
    background: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    if not payload.items:
        raise HTTPException(status_code=422, detail="Ən azı bir mənzil göndərin")
    if len(payload.items) > 500:
        raise HTTPException(status_code=422, detail="Maksimum 500 mənzil")
    job = await valuation_jobs.create_job(
        session,
        [item.model_dump() for item in payload.items],
        owner_email=user.email,
        portfolio_id=payload.portfolio_id or "",
    )
    background.add_task(valuation_jobs.run_job, job.id)
    return {"job_id": job.id, "status": job.status, "total": job.total}


@router.get("/valuation/jobs/{job_id}")
async def get_valuation_job(
    job_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    job = await session.get(ValuationJob, job_id)
    if job is None or (job.owner_email and job.owner_email != user.email):
        raise HTTPException(status_code=404, detail="Tapılmadı")
    return {
        "job_id": job.id,
        "status": job.status,
        "total": job.total,
        "done": job.done,
        "portfolio_id": job.portfolio_id,
        "results": job.results or [],
        "error": job.error,
    }


@router.get("/valuation/jobs")
async def list_valuation_jobs(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Recent jobs for this user — lets the UI re-attach after a reload."""
    rows = (
        await session.execute(
            select(ValuationJob)
            .where(ValuationJob.owner_email == user.email)
            .order_by(ValuationJob.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "job_id": j.id,
                "status": j.status,
                "total": j.total,
                "done": j.done,
                "portfolio_id": j.portfolio_id,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in rows
        ]
    }
