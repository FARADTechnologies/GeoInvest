"""Backend proxy to the team's predict server.

Keeps the X-Client-Id / X-Client-Secret server-side (read from the gitignored
.env) so they never reach the browser. The predict model is slow (~19s warm,
60s+ on a cold start), so the timeout is generous and callers must invoke it
sequentially for batch / mass valuation.
"""

import asyncio
import json
import re

import httpx
import psycopg

from app.core.config import settings


class PredictError(Exception):
    """Raised when the predict proxy cannot return a usable result.

    `status` is the HTTP status the API route should surface; `message` is an
    Azerbaijani end-user message aligned with BA §17 error copy.
    """

    def __init__(self, status: int, message: str) -> None:
        self.status = status
        self.message = message
        super().__init__(message)


async def call_predict(payload: dict) -> dict:
    """POST one property to predict.homora.ai and return its raw JSON response.

    The response is top-level (sale_estimate / rent_estimate /
    investment_metrics, no `ai_data` wrapper); the frontend adapter maps it
    into the report's ai_data shape.
    """
    if not settings.predict_url or not settings.predict_client_id:
        raise PredictError(503, "Qiymətləndirmə modeli konfiqurasiya olunmayıb.")

    headers = {
        "X-Client-Id": settings.predict_client_id,
        "X-Client-Secret": settings.predict_client_secret,
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(settings.predict_timeout_seconds, connect=15.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(settings.predict_url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise PredictError(
            504, "Qiymətləndirmə modeli vaxtında cavab vermədi, yenidən cəhd edin."
        ) from exc
    except httpx.HTTPError as exc:
        raise PredictError(
            502, "Qiymətləndirmə modelinə qoşulmaq mümkün olmadı."
        ) from exc

    if resp.status_code in (401, 403):
        raise PredictError(502, "Qiymətləndirmə modeli avtorizasiyası uğursuz oldu.")
    if resp.status_code >= 400:
        # 4xx from predict → no value for these features; 5xx → upstream issue.
        status = resp.status_code if 400 <= resp.status_code < 500 else 502
        raise PredictError(status, "Bu xüsusiyyətlərə uyğun qiymət tapılmadı!")

    try:
        return resp.json()
    except ValueError as exc:
        raise PredictError(
            502, "Qiymətləndirmə modelindən etibarsız cavab gəldi."
        ) from exc


# ── Elan linki flow: source DB lookup (team: items.source_url → prediction_info)
#
# The link valuation is precomputed in the source DB. We match the pasted
# listing URL to item_app_items.source_url and return its prediction_info
# (jsonb), which has the exact same shape as the predict response
# (sale_estimate / rent_estimate / investment_metrics / as_of_date). Source DB
# is read-only — SELECT only.

def _normalize_link(url: str) -> str:
    return url.strip().split("?")[0].split("#")[0].rstrip("/")


def _query_link(conn_str: str, url: str) -> tuple | None:
    """Runs synchronously in a thread (psycopg) — must not use asyncio.

    Matches the listing by exact source_url first, then by the trailing
    numeric listing id (handles trailing slash / query-string variations).
    """
    norm = _normalize_link(url)
    m = re.search(r"(\d{4,})\D*$", norm)
    item_id = m.group(1) if m else ""
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=20000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT prediction_info, latitude, longitude, owner_price
                FROM item_app_items
                WHERE prediction_info IS NOT NULL
                  AND (
                        source_url = %(u)s
                     OR source_url = %(u)s || '/'
                     OR (%(id)s <> '' AND source_url LIKE '%%/' || %(id)s)
                     OR (%(id)s <> '' AND source_url LIKE '%%/' || %(id)s || '/')
                  )
                ORDER BY prediction_updated_at DESC NULLS LAST
                LIMIT 1
                """,
                {"u": norm, "id": item_id},
            )
            return cur.fetchone()


async def predict_by_link(flat_link: str) -> dict:
    """Resolve a listing link to its precomputed prediction from the source DB.

    Returns the same envelope the frontend's valuateByLink expects:
    { ai_data, latitude, longitude, listing_price, accessibility_data }.
    """
    if not settings.source_database_url:
        raise PredictError(503, "Qiymətləndirmə bazası konfiqurasiya olunmayıb.")
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        row = await asyncio.to_thread(_query_link, conn_str, flat_link)
    except psycopg.Error as exc:
        raise PredictError(502, "Qiymətləndirmə bazasına qoşulmaq mümkün olmadı.") from exc

    if not row:
        raise PredictError(404, "Elan bazamızda tapılmadı")

    info, latitude, longitude, owner_price = row
    ai_data = info if isinstance(info, dict) else json.loads(info)
    return {
        "ai_data": ai_data,
        "latitude": latitude,
        "longitude": longitude,
        # Actual listing price drives the mortgage calculator (BA §14); falls
        # back to the predicted sale price on the frontend when null/0.
        "listing_price": owner_price if owner_price else None,
        "accessibility_data": {},
    }


# ── §9/§12 Nearby objects (team: get_nearby_objects_by_lon_lat) ──────────────
#
# Source-DB function returning nearby POIs grouped by accessibility category
# (Nəqliyyat / Əyləncə / Təhsil / …) with the distance in metres. Drives the
# report's "Lokasiya / əlçatanlıq" section. Read-only.

def _query_nearby(conn_str: str, lat: float, lon: float) -> list[tuple]:
    """Runs synchronously in a thread (psycopg). Function args are (lat, lon)."""
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=20000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, latitude, longitude, accessibility_index, distance "
                "FROM public.get_nearby_objects_by_lon_lat(%s, %s)",
                (lat, lon),
            )
            return cur.fetchall()


async def nearby_objects(lat: float, lon: float) -> dict:
    """Group nearby POIs by category, each sorted by distance.

    Returns { "categories": [ {category, items:[{name, latitude, longitude,
    distance}]} ] } ordered by the nearest object in each category.
    """
    if not settings.source_database_url:
        raise PredictError(503, "Əlçatanlıq bazası konfiqurasiya olunmayıb.")
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        rows = await asyncio.to_thread(_query_nearby, conn_str, lat, lon)
    except psycopg.Error as exc:
        raise PredictError(502, "Əlçatanlıq məlumatı alınmadı.") from exc

    groups: dict[str, list] = {}
    for name, la, lo, category, dist in rows:
        groups.setdefault(category or "Digər", []).append(
            {"name": name, "latitude": la, "longitude": lo, "distance": dist}
        )
    cats = []
    for category, items in groups.items():
        items.sort(key=lambda o: o["distance"] if o["distance"] is not None else 10**9)
        cats.append({"category": category, "items": items})
    # Categories ordered by their nearest object so the most relevant lead.
    cats.sort(key=lambda c: c["items"][0]["distance"] if c["items"] else 10**9)
    return {"categories": cats}


# ── §10 Elanlar — real listings from the source DB ───────────────────────────
#
# The Elanlar view is fed from item_app_items (real scraped + predicted
# listings) instead of mock data. Each row carries its source_url so clicking
# it opens the stored prediction through the existing link flow. Read-only.

# item_app_itemcategory: 3 = Yeni tikili, 4 = Köhnə tikili (apartment listings).
_LISTING_CATEGORY = {3: "Yeni tikili", 4: "Köhnə tikili"}

# Noise floor (AZN, total): listings below this are garbage/mislabeled and are
# dropped from Elanlar — same fixed threshold the analytics pipeline applies
# before H3 aggregation (services/nightly_job.py `_MIN_LISTING_PRICE`).
_MIN_LISTING_PRICE = 5000

# item_app_items has no rayon column — derive a label from the free-text
# address by matching known Baku rayon names (best effort; "—" when unknown).
_BAKU_RAYONS = [
    "Yasamal", "Səbail", "Nərimanov", "Xətai", "Nəsimi", "Binəqədi", "Nizami",
    "Sabunçu", "Suraxanı", "Qaradağ", "Xəzər", "Abşeron", "Pirallahı", "Xırdalan",
]


def _derive_rayon(address: str | None) -> str:
    if not address:
        return "—"
    low = address.lower()
    for r in _BAKU_RAYONS:
        if r.lower() in low:
            return r
    return "—"


def _source_host(url: str | None) -> str:
    if not url:
        return "—"
    m = re.search(r"https?://(?:www\.)?([^/]+)", url)
    return m.group(1) if m else "—"


def _query_listings(conn_str: str, limit: int, offset: int) -> list[tuple]:
    """Runs synchronously in a thread (psycopg). Newest-predicted apartments."""
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=20000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, address, size, rooms_qty, floor_level, "
                "owner_price, predicted_sale_price, category_id, source_url, "
                "created_date, latitude, longitude "
                "FROM item_app_items "
                "WHERE deleted IS NOT TRUE AND prediction_info IS NOT NULL "
                "AND category_id IN (3, 4) AND size > 0 "
                "AND COALESCE(owner_price, predicted_sale_price, 0) >= %s "
                "ORDER BY prediction_updated_at DESC NULLS LAST "
                "LIMIT %s OFFSET %s",
                (_MIN_LISTING_PRICE, limit, offset),
            )
            return cur.fetchall()


async def list_listings(limit: int = 500, offset: int = 0) -> list[dict]:
    """Real apartment listings (Yeni/Köhnə tikili with a stored prediction).

    Feeds the Elanlar view; each row's source_url drives the click-to-report
    link flow. Read-only.
    """
    if not settings.source_database_url:
        raise PredictError(503, "Elan bazası konfiqurasiya olunmayıb.")
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        rows = await asyncio.to_thread(_query_listings, conn_str, limit, offset)
    except psycopg.Error as exc:
        raise PredictError(502, "Elan siyahısı alınmadı.") from exc

    out: list[dict] = []
    for (
        rid, title, address, size, rooms, floor, owner_price, pred_price,
        cat_id, source_url, created, lat, lon,
    ) in rows:
        area = float(size or 0)
        price = float(owner_price or pred_price or 0)
        out.append(
            {
                "id": str(rid),
                "title": title or address or "Mənzil",
                "address": address,
                "rayon": _derive_rayon(address),
                "rooms": int(rooms or 0),
                "area": round(area, 1),
                "price": round(price),
                "ppm": round(price / area) if area else 0,
                "floor": int(floor or 0),
                "cat": _LISTING_CATEGORY.get(cat_id, "Yeni tikili"),
                "source": _source_host(source_url),
                "source_url": source_url,
                "date": created.date().isoformat() if created else "",
                "latitude": lat,
                "longitude": lon,
            }
        )
    return out
