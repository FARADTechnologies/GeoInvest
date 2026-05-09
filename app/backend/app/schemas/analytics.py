from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FiltersResponse(BaseModel):
    periods: list[str]
    categories: list[str]
    resolutions: list[int]
    analysis_types: list[str]


class MetricsResponse(BaseModel):
    total_ads: int
    avg_median_price: float
    trend_percentage: float
    active_h3_cells: int
    previous_period: str | None = None


class MapDataPoint(BaseModel):
    h3_index: str
    ad_count: int
    median_price_kvm: float
    category: str
    rayon_name: str


class BoundaryFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any] = Field(default_factory=dict)


class BoundaryFeatureCollection(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[BoundaryFeature]
