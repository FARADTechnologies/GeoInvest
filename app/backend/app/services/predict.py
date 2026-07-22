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


# ── Rayon from coordinates (team #2) ─────────────────────────────────────────
#
# The source DB / predict server carry no rayon for a valuation, so we resolve
# it spatially: which of the 12 Baku rayon polygons (index_app_object type_id=22)
# contains the point. Same join the analytics pipeline uses. Read-only. This
# fixes the "rayon doesn't appear after valuation" problem in one place.

def _query_rayon(conn_str: str, lat: float, lon: float) -> str | None:
    with psycopg.connect(conn_str, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT o.name FROM index_app_object o "
                "WHERE o.type_id = 22 AND ST_Contains("
                "  o.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) LIMIT 1",
                (lon, lat),
            )
            row = cur.fetchone()
            return row[0] if row else None


async def resolve_rayon(lat: float | None, lon: float | None) -> str | None:
    """Baku rayon name for a coordinate, or None. Never raises (best-effort)."""
    if not settings.source_database_url or lat is None or lon is None:
        return None
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        return await asyncio.to_thread(_query_rayon, conn_str, float(lat), float(lon))
    except (psycopg.Error, ValueError, TypeError):
        return None


def _query_listings(conn_str: str, limit: int, offset: int) -> list[tuple]:
    """Runs synchronously in a thread (psycopg). Newest-predicted apartments."""
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=20000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT i.id, i.title, i.address, i.size, i.rooms_qty, "
                "i.floor_level, i.owner_price, i.predicted_sale_price, "
                "i.category_id, i.source_url, i.created_date, i.latitude, "
                "i.longitude, o.name AS rayon "
                "FROM item_app_items i "
                "LEFT JOIN index_app_object o ON o.type_id = 22 AND ST_Contains("
                "  o.geom, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)) "
                "WHERE i.deleted IS NOT TRUE AND i.prediction_info IS NOT NULL "
                "AND i.category_id IN (3, 4) AND i.size > 0 "
                "AND COALESCE(i.owner_price, i.predicted_sale_price, 0) >= %s "
                "ORDER BY i.prediction_updated_at DESC NULLS LAST "
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
        cat_id, source_url, created, lat, lon, rayon,
    ) in rows:
        area = float(size or 0)
        price = float(owner_price or pred_price or 0)
        out.append(
            {
                "id": str(rid),
                "title": title or address or "Mənzil",
                "address": address,
                # Real rayon from the spatial join; street address as last resort.
                "rayon": rayon or _derive_rayon(address),
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


# ── Bazar analizi — real room-count segments from the source DB (team #3h) ────
#
# Per room count (1..5+) and build type (all / new / old): average ₼/m², monthly
# rent, gross yield and share — computed straight from the valuated listings
# (item_app_items), so the Otaq sayına görə seqment block shows real numbers
# instead of modelled ones. Read-only. Liquidity is intentionally omitted (the
# team is providing that basis separately).

def _query_room_segments(conn_str: str) -> list[tuple]:
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=30000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT category_id, LEAST(rooms_qty, 5) AS rooms, "
                "  round(avg(predicted_sale_price / NULLIF(size, 0))) AS ppm, "
                "  round(avg(predicted_rent_price)) AS rent, "
                "  round(avg(predicted_rent_price * 12 / "
                "    NULLIF(predicted_sale_price, 0) * 100)::numeric, 1) AS yield_pct, "
                "  count(*) AS n "
                "FROM item_app_items "
                "WHERE category_id IN (3, 4) AND prediction_info IS NOT NULL "
                "  AND deleted IS NOT TRUE AND size > 0 AND rooms_qty BETWEEN 1 AND 8 "
                "  AND predicted_sale_price >= %s AND predicted_rent_price IS NOT NULL "
                "GROUP BY 1, 2 ORDER BY 2",
                (_MIN_LISTING_PRICE,),
            )
            return cur.fetchall()


async def market_room_segments() -> dict:
    """Room-count segments (₼/m², rent, yield, share) split by build type.

    Returns { "all": [...], "new": [...], "old": [...] } so the frontend's
    Kateqoriya dropdown (#3a) can switch between them. Each list item is
    { rooms, ppm, rent, yield_pct, count, share }.
    """
    if not settings.source_database_url:
        raise PredictError(503, "Bazar bazası konfiqurasiya olunmayıb.")
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        rows = await asyncio.to_thread(_query_room_segments, conn_str)
    except psycopg.Error as exc:
        raise PredictError(502, "Bazar seqment məlumatı alınmadı.") from exc

    labels = {1: "1 otaq", 2: "2 otaq", 3: "3 otaq", 4: "4 otaq", 5: "5+ otaq"}
    # rooms -> {"new": agg, "old": agg}; then fold into all/new/old lists.
    by_room: dict[int, dict[int, dict]] = {}
    for cat_id, rooms, ppm, rent, yield_pct, n in rows:
        by_room.setdefault(int(rooms), {})[int(cat_id)] = {
            "ppm": float(ppm or 0),
            "rent": float(rent or 0),
            "yield_pct": float(yield_pct or 0),
            "count": int(n or 0),
        }

    def build(pick_cats: tuple[int, ...]) -> list[dict]:
        segs = []
        for rooms in sorted(by_room):
            parts = [by_room[rooms][c] for c in pick_cats if c in by_room[rooms]]
            cnt = sum(p["count"] for p in parts)
            if cnt == 0:
                continue
            # count-weighted averages so mixing new+old is representative.
            wavg = lambda k: round(sum(p[k] * p["count"] for p in parts) / cnt)
            segs.append(
                {
                    "rooms": labels.get(rooms, f"{rooms} otaq"),
                    "ppm": wavg("ppm"),
                    "rent": wavg("rent"),
                    "yield_pct": round(
                        sum(p["yield_pct"] * p["count"] for p in parts) / cnt, 1
                    ),
                    "count": cnt,
                }
            )
        total = sum(s["count"] for s in segs) or 1
        for s in segs:
            s["share"] = round(s["count"] / total * 100)
        return segs

    return {"all": build((3, 4)), "new": build((3,)), "old": build((4,))}


# ── Bazar analizi — real monthly price / rent trends (team #3b/d/e) ───────────
#
# Each valuated listing carries a 12-month sale + rent price_trend inside its
# prediction (ai_data). Averaging the point estimates per month gives a real
# market curve: avg ₼/m² for sale, avg ₼/month for rent — split by build type
# so the Kateqoriya dropdown can switch (all / new / old). Read-only.

def _query_trend(conn_str: str, kind: str) -> list[tuple]:
    """(category_id, date, value, count) monthly averages for one metric.

    kind='sale' → avg ₼/m² (point_estimate / size); kind='rent' → avg ₼/month.
    """
    node = "sale_estimate" if kind == "sale" else "rent_estimate"
    value_expr = (
        "(pt->>'point_estimate')::numeric / NULLIF(i.size, 0)"
        if kind == "sale"
        else "(pt->>'point_estimate')::numeric"
    )
    with psycopg.connect(
        conn_str, connect_timeout=15, options="-c statement_timeout=60000"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT i.category_id, pt->>'date' AS d, "
                f"  round(avg({value_expr})) AS v, count(*) AS n "
                "FROM item_app_items i, jsonb_array_elements(COALESCE("
                f"  i.prediction_info->'{node}', "
                f"  i.prediction_info->'ai_data'->'{node}')->'price_trend') pt "
                "WHERE i.category_id IN (3, 4) AND i.prediction_info IS NOT NULL "
                "  AND i.deleted IS NOT TRUE AND i.size > 0 "
                "  AND i.predicted_sale_price >= %s "
                "GROUP BY 1, 2 ORDER BY 2",
                (_MIN_LISTING_PRICE,),
            )
            return cur.fetchall()


async def market_trends() -> dict:
    """Monthly sale ₼/m² and rent ₼ curves per build type (all / new / old).

    Returns { "sale": {all:[{date,value}], new:[...], old:[...]},
              "rent": {...} }.
    """
    if not settings.source_database_url:
        raise PredictError(503, "Bazar bazası konfiqurasiya olunmayıb.")
    conn_str = settings.source_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    try:
        sale_rows = await asyncio.to_thread(_query_trend, conn_str, "sale")
        rent_rows = await asyncio.to_thread(_query_trend, conn_str, "rent")
    except psycopg.Error as exc:
        raise PredictError(502, "Bazar trend məlumatı alınmadı.") from exc

    def fold(rows: list[tuple]) -> dict:
        # date -> {cat_id: (value, count)}
        by_date: dict[str, dict[int, tuple[float, int]]] = {}
        for cat_id, d, v, n in rows:
            by_date.setdefault(d, {})[int(cat_id)] = (float(v or 0), int(n or 0))
        dates = sorted(by_date)

        def series(cats: tuple[int, ...]) -> list[dict]:
            out = []
            for d in dates:
                parts = [by_date[d][c] for c in cats if c in by_date[d]]
                cnt = sum(p[1] for p in parts)
                if cnt == 0:
                    continue
                val = round(sum(p[0] * p[1] for p in parts) / cnt)
                out.append({"date": d, "value": val})
            return out

        return {"all": series((3, 4)), "new": series((3,)), "old": series((4,))}

    return {"sale": fold(sale_rows), "rent": fold(rent_rows)}
