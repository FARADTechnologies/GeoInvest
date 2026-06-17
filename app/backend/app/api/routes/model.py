from fastapi import APIRouter, HTTPException

from app.schemas.predict import LinkRequest, PredictRequest
from app.services.predict import PredictError, call_predict, predict_by_link

router = APIRouter()


@router.post("/model/predict")
async def model_predict(payload: PredictRequest) -> dict:
    """Proxy a single property to the team's predict server.

    Keeps the predict credentials server-side. Returns the predict server's
    raw response (top-level sale_estimate / rent_estimate /
    investment_metrics); the frontend adapter maps it into the report's
    ai_data shape. Heavy/slow call — the frontend shows a loading state and
    batches must call this sequentially (one property at a time).
    """
    try:
        return await call_predict(payload.model_dump())
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.post("/model/predict/link")
async def model_predict_link(payload: LinkRequest) -> dict:
    """Resolve a listing link to its precomputed prediction (source DB).

    Matches item_app_items.source_url and returns prediction_info as ai_data
    plus latitude/longitude and the actual listing price. The link report
    shows no form feature grid (features stays null on the frontend, BA §6).
    """
    try:
        return await predict_by_link(payload.flat_link)
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
