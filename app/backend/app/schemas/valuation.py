from pydantic import BaseModel, Field


class ValuationRequest(BaseModel):
    """Parameters for a single property valuation.

    Mirrors the B2C "Parametrlə qiymətləndir" form. Only `type` and `area`
    are strictly required to produce a value; the rest refine the estimate
    or are carried through for display.
    """

    address: str | None = None
    rayon: str | None = None
    type: str = Field(description="Property type, e.g. 'Yeni tikili' / 'Köhnə tikili'.")
    area: float = Field(gt=0, description="Area in square meters.")
    rooms: int | None = None
    floor: int | None = None
    total_floors: int | None = None
    repair: str | None = None
    extract: str | None = None
    residence: str | None = None
    # Coordinates from the Google address picker (filled later); carried
    # through to the predict server when integrated.
    latitude: float | None = None
    longitude: float | None = None
    valuation_date: str | None = None


class BatchValuationRequest(BaseModel):
    items: list[ValuationRequest]


class ValuationResult(BaseModel):
    """Computed valuation for one property.

    `fair_value` and `price_per_m2` are anchored to real market medians
    (per rayon + category + period) pulled from the same precomputed tables
    that drive the map. Rent / yield / liquidity / score are modelled
    estimates derived from those anchors (the source DB carries no rent data).
    """

    # Inputs echoed back (so the row is self-contained)
    address: str | None = None
    rayon: str
    type: str
    area: float
    rooms: int | None = None
    floor: int | None = None
    total_floors: int | None = None
    repair: str | None = None
    extract: str | None = None
    residence: str | None = None

    # DB-anchored value
    fair_value: float
    price_per_m2: float
    price_range: list[float]
    market_median_kvm: float | None = None

    # Modelled estimates
    monthly_rent: float
    rent_range: list[float]
    yield_pct: float
    payback_years: float
    liquidity_days: int
    score: int
    risk: str

    # Transparency about how the price was sourced
    period: str | None = None
    price_basis: str = Field(
        description="Where price_per_m2 came from: 'rayon' | 'market' | 'fallback'."
    )


class BatchValuationResponse(BaseModel):
    results: list[ValuationResult]
    period: str | None = None


class RayonPrice(BaseModel):
    rayon: str
    median_price_kvm: float
    ad_count: int


class MarketRayon(BaseModel):
    """Real per-rayon market aggregates (median AZN/m² split by build type)."""

    rayon: str
    ppm_new: float | None = None
    ppm_old: float | None = None
    ad_count: int = 0


class MarketAnalysis(BaseModel):
    """City-market aggregates for the Bazar analizi page.

    `ppm_new` / `ppm_old` / `ad_count`, `city_median_kvm` and `new_share`
    are REAL — computed straight from the analytics tables. Yield, liquidity,
    rent, transaction volume and growth are modelled on the frontend from
    these anchors, because the source DB holds no such data.
    """

    period: str | None = None
    city_median_kvm: float | None = None
    new_share: int = 0
    total_ad_count: int = 0
    rayons: list[MarketRayon]


class ValuationMeta(BaseModel):
    """Real options to populate the valuation form / landing.

    Sourced from the precomputed analytics tables so the UI offers the
    same rayons / categories / period that the rest of the dashboard uses.
    """

    period: str | None = None
    categories: list[str]
    rayons: list[RayonPrice]
    market_median_kvm: float | None = None
