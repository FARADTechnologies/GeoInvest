from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.analytics import (
    BoundaryFeatureCollection,
    FiltersResponse,
    MapDataPoint,
    MetricsResponse,
)
from app.services.analytics import AnalyticsService
from app.services.boundaries import BoundaryService
from app.services.cache import cached_json
from app.services.query_params import parse_categories

router = APIRouter()


@router.get("/filters", response_model=FiltersResponse)
async def get_filters(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FiltersResponse:
    async def loader() -> FiltersResponse:
        return await AnalyticsService(session).get_filters()

    return await cached_json("filters:v1", FiltersResponse, loader)


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: Annotated[str, Query(description="Period in YYYY-MM format")],
    resolution: Annotated[int, Query(ge=0, le=15)],
    analysis_type: Annotated[str, Query(min_length=1)],
    min_ads_per_cell: Annotated[int, Query(ge=0)] = 0,
) -> MetricsResponse:
    categories = parse_categories(request)
    if not categories:
        raise HTTPException(status_code=422, detail="At least one category is required.")

    cache_key = (
        "metrics:v1:"
        f"{analysis_type}:{period}:{resolution}:{min_ads_per_cell}:{','.join(sorted(categories))}"
    )

    async def loader() -> MetricsResponse:
        return await AnalyticsService(session).get_metrics(
            period=period,
            categories=categories,
            resolution=resolution,
            analysis_type=analysis_type,
            min_ads_per_cell=min_ads_per_cell,
        )

    return await cached_json(cache_key, MetricsResponse, loader)


@router.get("/map-data", response_model=list[MapDataPoint])
async def get_map_data(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: Annotated[str, Query(description="Period in YYYY-MM format")],
    resolution: Annotated[int, Query(ge=0, le=15)],
    analysis_type: Annotated[str, Query(min_length=1)],
    min_ads_per_cell: Annotated[int, Query(ge=0)] = 0,
) -> list[MapDataPoint]:
    categories = parse_categories(request)
    if not categories:
        raise HTTPException(status_code=422, detail="At least one category is required.")

    cache_key = (
        "map-data:v1:"
        f"{analysis_type}:{period}:{resolution}:{min_ads_per_cell}:{','.join(sorted(categories))}"
    )

    async def loader() -> list[MapDataPoint]:
        return await AnalyticsService(session).get_map_data(
            period=period,
            categories=categories,
            resolution=resolution,
            analysis_type=analysis_type,
            min_ads_per_cell=min_ads_per_cell,
        )

    return await cached_json(cache_key, MapDataPoint, loader, many=True)


@router.get("/boundaries", response_model=BoundaryFeatureCollection)
async def get_boundaries() -> BoundaryFeatureCollection:
    async def loader() -> BoundaryFeatureCollection:
        return BoundaryService().load_feature_collection()

    return await cached_json("boundaries:v1", BoundaryFeatureCollection, loader)
