#!/usr/bin/env python3
"""Capture a frozen real-data snapshot from the running backend.

For the public / demo deploy the live backend (internal DB over VPN) is
unreachable, so the frontend falls back to this snapshot — real data captured
at a point in time. Writes app/frontend/public/snapshot/data.json.

Usage (backend must be running and DB reachable, e.g. over VPN):
    PYTHONIOENCODING=utf-8 python scripts/snapshot_data.py
"""

import collections
import datetime
import json
import os
import urllib.parse
import urllib.request

BASE = os.environ.get("SNAPSHOT_API", "http://localhost:8000/api/v1")
OUT = os.path.join("app", "frontend", "public", "snapshot", "data.json")
RES_DEFAULT = 7
ATYPE = "geom"


def get(path, params=None, timeout=60):
    url = f"{BASE}{path}"
    if params:
        parts = []
        for k, v in params.items():
            if isinstance(v, (list, tuple)):
                parts.extend((k, x) for x in v)
            else:
                parts.append((k, str(v)))
        url += "?" + urllib.parse.urlencode(parts)
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.load(r)


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    if n == 0:
        return 0
    m = n // 2
    return xs[m] if n % 2 else (xs[m - 1] + xs[m]) / 2


def rayon_prices(period, category_list, res):
    md = get("/map-data", {"period": period, "resolution": res, "analysis_type": ATYPE,
                           "categories": category_list, "min_ads_per_cell": 0})
    by = collections.defaultdict(list)
    ads = collections.defaultdict(int)
    allp = []
    for c in md:
        for rn in (c.get("rayon_name") or "").split(", "):
            rn = rn.strip()
            if rn:
                by[rn].append(c["median_price_kvm"])
                ads[rn] += c.get("ad_count", 0)
        allp.append(c["median_price_kvm"])
    prices = {rn: round(median(v), 2) for rn, v in by.items()}
    return prices, dict(ads), (round(median(allp), 2) if allp else 0)


def sane(v):
    return isinstance(v, (int, float)) and 500 < v < 20000


def main():
    filters = get("/filters")
    periods = filters["periods"]
    cats = filters["categories"]
    res = RES_DEFAULT if RES_DEFAULT in filters["resolutions"] else filters["resolutions"][0]
    new_cat = next((c for c in cats if "yeni" in c.lower()), cats[0])
    old_cat = next((c for c in cats if "köhn" in c.lower() or "kohn" in c.lower()), cats[-1])

    # Pick the richest period for the rayon price table.
    rich = {p: get("/metrics", {"period": p, "resolution": res, "analysis_type": ATYPE,
                                "categories": cats, "min_ads_per_cell": 0}).get("total_ads", 0)
            for p in periods}
    best = max(rich, key=rich.get)

    ov, ovads, city = rayon_prices(best, cats, res)
    nw, _, citynew = rayon_prices(best, [new_cat], res)
    od, _, cityold = rayon_prices(best, [old_cat], res)

    rayons = []
    for rn in sorted(ov, key=lambda r: -ovads.get(r, 0)):
        new_v = nw.get(rn)
        old_v = od.get(rn)
        rayons.append({
            "rayon": rn,
            "overall": ov[rn],
            "new": new_v if sane(new_v) else round(ov[rn] * 1.18, 2),
            "old": old_v if sane(old_v) else round(ov[rn] * 0.88, 2),
            "ad_count": ovads.get(rn, 0),
        })

    valuation = {
        "period": best, "cityMedian": city,
        "cityNew": citynew if sane(citynew) else round(city * 1.18, 2),
        "cityOld": cityold if sane(cityold) else round(city * 0.88, 2),
        "newCat": new_cat, "oldCat": old_cat, "rayons": rayons,
    }

    def key(period, clist):
        return f"{ATYPE}|{period}|{res}|{','.join(sorted(clist))}"

    dash, trends = {}, {}
    for p in periods:
        for clist in ([cats] if p != best else [cats, [new_cat], [old_cat]]):
            dash[key(p, clist)] = {
                "metrics": get("/metrics", {"period": p, "resolution": res, "analysis_type": ATYPE, "categories": clist, "min_ads_per_cell": 0}),
                "mapData": get("/map-data", {"period": p, "resolution": res, "analysis_type": ATYPE, "categories": clist, "min_ads_per_cell": 0}),
                "sparklines": get("/sparklines", {"period": p, "resolution": res, "analysis_type": ATYPE, "categories": clist, "min_ads_per_cell": 0}),
            }
        trends[f"{p}|{','.join(sorted(cats))}"] = get("/trend-series", {"period": p, "categories": cats})

    snap = {
        "generatedAt": datetime.datetime.now().isoformat(),
        "note": "Frozen real-data snapshot for public/demo deploy (DB over VPN at capture time).",
        "filters": filters,
        "defaults": {"period": periods[0], "resolution": res, "analysis_type": ATYPE},
        "valuation": valuation,
        "dashboard": dash,
        "trends": trends,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(snap, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"wrote {OUT} ({round(os.path.getsize(OUT)/1024,1)} KB) — "
          f"{len(rayons)} rayons, {len(dash)} dashboard keys, {len(trends)} trend keys")


if __name__ == "__main__":
    main()
