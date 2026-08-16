from fastapi import APIRouter, HTTPException

from app.schemas.predict import (
    LinkRequest,
    ListingRow,
    ListingsResponse,
    NearbyRequest,
    PredictRequest,
)
from app.services.predict import (
    PredictError,
    call_predict,
    list_listings,
    market_index,
    market_rayons,
    market_room_segments,
    market_trends,
    nearby_objects,
    predict_by_link,
    resolve_rayon,
    rayon_polygons,
)

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
        result = await call_predict(payload.model_dump())
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    # Resolve the rayon from the coordinates so the report can show it (team #2).
    result["rayon"] = await resolve_rayon(payload.latitude, payload.longitude)
    return result


@router.post("/model/predict/link")
async def model_predict_link(payload: LinkRequest) -> dict:
    """Resolve a listing link to its precomputed prediction (source DB).

    Matches item_app_items.source_url and returns prediction_info as ai_data
    plus latitude/longitude and the actual listing price. The link report
    shows no form feature grid (features stays null on the frontend, BA §6).
    """
    try:
        result = await predict_by_link(payload.flat_link)
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    result["rayon"] = await resolve_rayon(result.get("latitude"), result.get("longitude"))
    return result


@router.post("/model/nearby")
async def model_nearby(payload: NearbyRequest) -> dict:
    """Nearby objects grouped by accessibility category for the report's map
    section (BA §9/§12). Sourced from the read-only DB function."""
    try:
        return await nearby_objects(payload.latitude, payload.longitude)
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.get("/model/listings", response_model=ListingsResponse)
async def model_listings(limit: int = 500, offset: int = 0) -> ListingsResponse:
    """Real apartment listings (source DB) for the Elanlar view (team #10).

    Only Yeni/Köhnə tikili rows that already carry a prediction. Each row's
    source_url lets the frontend open the stored prediction via the link flow.
    """
    limit = max(1, min(limit, 2000))
    offset = max(0, offset)
    try:
        rows, total = await list_listings(limit, offset)
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    return ListingsResponse(items=[ListingRow(**r) for r in rows], total=total)


@router.get("/model/market/segments")
async def model_market_segments() -> dict:
    """Real room-count market segments (₼/m², rent, yield, share) split by build
    type for the Bazar analizi 'Otaq sayına görə seqment' block (team #3h)."""
    try:
        return await market_room_segments()
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.get("/model/market/trends")
async def model_market_trends() -> dict:
    """Real monthly sale ₼/m² and rent ₼ curves per build type for the Bazar
    analizi trend chart (team #3b/d/e)."""
    try:
        return await market_trends()
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.get("/model/market/rayons")
async def model_market_rayons() -> dict:
    """Per-rayon rental yield (last month) and price growth for the Bazar
    analizi yield bars and fastest/slowest growing lists (team #3g / #3j)."""
    try:
        return await market_rayons()
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.get("/model/rayon-polygons")
async def model_rayon_polygons() -> dict:
    """Baku rayon boundaries as GeoJSON, so the map can name the rayon a cell
    falls in. Same rows the nightly job joins against, so the two agree."""
    try:
        return await rayon_polygons()
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.get("/model/market/index")
async def model_market_index() -> dict:
    """City price index (base 100 = Aug 2023) per build type for the Bazar
    analizi Qiymət indeksi KPI + trend (team #3c)."""
    try:
        return await market_index()
    except PredictError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
