from pydantic import BaseModel


class PredictRequest(BaseModel):
    """Payload for the team's predict server — field names match its contract.

    The frontend builds this from the "Parametrlə qiymətləndir" form and POSTs
    it to our backend proxy (`routes/model.py`), which attaches the secret
    headers and forwards it to predict.homora.ai. The credentials therefore
    never reach the browser. Bounds are enforced on the frontend (BA §11); we
    keep this schema permissive so we don't reject anything predict accepts.
    """

    latitude: float
    longitude: float
    otaq_sayi: int
    sahe_kvm: float
    mertebe_yer: int
    mertebe_say: int
    date2: str
    kateqoriya: str
    temir: str
    residential_complex: int
    residence_owner: str | None = None
    cixaris: str


class LinkRequest(BaseModel):
    """Elan linki ilə qiymətləndirmə — only the listing URL (BA §2.2 / §15).

    No form fields: the link flow reads the precomputed prediction from the
    source DB (item_app_items.prediction_info) matched by source_url.
    """

    flat_link: str


class NearbyRequest(BaseModel):
    """Coordinates for the report's §12 nearby-objects / accessibility section."""

    latitude: float
    longitude: float
