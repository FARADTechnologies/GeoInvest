from pydantic import BaseModel


# ValuationRequest / ValuationResult / the two Batch* wrappers used to live
# here, describing the local valuation engine's contract. That engine invented
# rent, yield, payback, liquidity and score, so it and its endpoints are gone;
# the predict model's own contract (schemas/predict.py) is the only one left.


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


class ParsedListing(BaseModel):
    """One listing row parsed from the mass-valuation Excel template.

    No coordinates — the frontend geocodes `address` before calling predict.
    """

    type: str | None = None
    extract: str | None = None
    is_residence: bool = False
    residence: str | None = None
    repair: str | None = None
    area: float | None = None
    rooms: int | None = None
    floor: int | None = None
    total_floors: int | None = None
    address: str | None = None


class ExcelParseResponse(BaseModel):
    rows: list[ParsedListing]
    count: int
