// Cosmetic extension to the existing api.ts.
// Keeps the existing fetchFilters / fetchMetrics / fetchMapData unchanged
// (they live in api.ts) and adds dashboard-only fetchers that proxy to
// lib/mock-data.ts / lib/listings-data.ts.
//
// Rayons / Trends / B2C react to the global Period + Category controls
// (NOT resolution / outlier — those are map-level). When the backend grows
// endpoints for these shapes, change the body of each fetcher to a real
// fetch — components don't need to change.

import type {
  ActivityItem,
  B2CSummary,
  DashboardFilters,
  HistogramBucket,
  Listing,
  Rayon,
  RayonStat,
  Sparklines,
  TrendSeries
} from "@/types/api";
import { apiUrl } from "@/lib/api-url";
import { apiGet } from "@/lib/api";
import {
  fetchActivity as mockActivity,
  fetchHistogram as mockHistogram,
  fetchRayons as mockRayons,
  fetchSparklines as mockSparklines,
  fetchTrendSeries as mockTrendSeries
} from "@/lib/mock-data";
import { buildB2C, buildRayonStats, filterListings } from "@/lib/listings-data";
import { dashKey, loadSnapshot, trendKey } from "@/lib/snapshot";
import { mockAllowed } from "@/lib/mock-gate";

export function fetchRayons(): Promise<Rayon[]> {
  return mockRayons();
}

export async function fetchSparklines(
  filters?: DashboardFilters,
  minAdsPerCell = 0
): Promise<Sparklines> {
  if (!filters) return mockSparklines();

  try {
    return await apiGet<Sparklines>("/sparklines", filters, {
      min_ads_per_cell: String(minAdsPerCell)
    });
  } catch (err) {
    if (!mockAllowed()) throw err;
    const snap = await loadSnapshot();
    const hit = snap?.dashboard[dashKey(filters.analysis_type, filters.period, filters.resolution, filters.categories)];
    if (hit?.sparklines) return hit.sparklines;
    return mockSparklines();
  }
}

export function fetchHistogram(): Promise<HistogramBucket[]> {
  return mockHistogram();
}

// 12-month trend for the top-5 rayons, reacting to period + category.
function seriesFor(base: number, seed: number): number[] {
  const out: number[] = [];
  let v = base * 0.9;
  let rng = seed * 9973 + 7;
  for (let i = 0; i < 12; i++) {
    rng = (rng * 9301 + 49297) % 233280;
    const noise = (rng / 233280 - 0.5) * 120;
    v += (base - v) * 0.18 + noise;
    out.push(Math.round(v));
  }
  out[11] = base;
  return out;
}

export async function fetchTrendSeries(filters?: DashboardFilters): Promise<TrendSeries[]> {
  if (filters) {
    try {
      const res = await apiGet<TrendSeries[]>("/trend-series", filters);
      // Backend endpoint exists but currently returns [] for real data —
      // only use it when it actually has series, else fall to mock so the
      // Trends view never renders empty.
      if (Array.isArray(res) && res.length > 0) return res;
    } catch {
      /* fall through to snapshot / mock */
    }
    const snap = await loadSnapshot();
    const hit = snap?.trends[trendKey(filters.period, filters.categories)];
    if (hit && hit.length > 0) return hit;
  }
  // Mock path — derive from the period/category-filtered rayon stats.
  // Gated: in production a customer gets an empty chart rather than invented
  // series (the backend's /trend-series currently returns [] — see below).
  if (!mockAllowed()) return [];
  const stats = buildRayonStats(filterListings(filters?.period, filters?.categories));
  const ranked = stats.filter((s) => s.listings > 0).sort((a, b) => b.listings - a.listings);
  const top = (ranked.length ? ranked : stats.slice().sort((a, b) => b.listings - a.listings)).slice(0, 5);
  if (top.length === 0) return mockTrendSeries();
  return top.map((r, i) => ({ label: r.short, data: seriesFor(r.median, i + 7) }));
}

export function fetchActivity(lang: "tr" | "en" | "az" = "tr"): Promise<ActivityItem[]> {
  return mockActivity(lang);
}

// ── v3 views (Rayons / Listings / B2C) — period + category aware ──────
// `fetchListings` with no args returns the full set (İlanlar has its own
// toolbar); with period/categories it returns the filtered set used by the
// Rayons detail modal and the B2C listing count.
export function fetchListings(period?: string, categories?: string[]): Promise<Listing[]> {
  return Promise.resolve(filterListings(period, categories));
}

// Elanlar view — real apartment listings from the source DB (team #10).
// Falls back to the mock set when the backend / source DB is unreachable,
// matching the resilience pattern the rest of the dashboard uses.
type ListingApiRow = {
  id: string; title: string; address: string | null; rayon: string; rooms: number; area: number;
  price: number; ppm: number; floor: number; cat: string; source: string;
  source_url: string | null; date: string;
};
// The listings payload is large (~170 KB, ~1.5-3 s). The shared apiGet timeout
// is 1.5 s, so it aborted this call, silently fell back to mock AND tripped the
// 15 s backend-down cooldown that pushed other views to mock too. Use a
// dedicated fetch with a generous timeout instead.
const LISTINGS_TIMEOUT_MS = 20_000;

// Number of real listings loaded into the Elanlar view for client-side
// filter/sort/paginate. The DB has ~13-19k; loading all is too heavy, so we
// load the newest LISTINGS_PAGE and surface the true total (COUNT) in the
// header — fixing the "13k shows as 500" the user hit.
export const LISTINGS_PAGE = 1000;
export type ListingsResult = { listings: Listing[]; total: number };

export async function fetchListingsDB(): Promise<ListingsResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LISTINGS_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(apiUrl(`/model/listings?limit=${LISTINGS_PAGE}`), {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`listings ${response.status}`);
    const res = (await response.json()) as { items: ListingApiRow[]; total: number };
    const listings = res.items.map((r) => ({
      id: r.id,
      // The source DB has no rayon column and addresses are street-only, so a
      // rayon is only sometimes derivable. Fall back to the street so the
      // "Bölge" column is never empty; only real rayons feed the filter.
      rayonId: r.rayon !== "—" ? r.rayon : "",
      rayon: r.rayon !== "—" ? r.rayon : (r.address ?? "—"),
      title: r.title,
      rooms: r.rooms,
      area: r.area,
      ppm: r.ppm,
      price: r.price,
      cat: (r.cat === "Köhnə tikili" ? "Köhnə tikili" : "Yeni tikili") as Listing["cat"],
      source: r.source,
      status: "active" as const,
      date: r.date,
      floor: r.floor,
      sourceUrl: r.source_url ?? undefined
    }));
    return { listings, total: res.total || listings.length };
  } catch (err) {
    // Production customers must not silently get invented listings.
    if (!mockAllowed()) throw err;
    const mock = filterListings();
    return { listings: mock, total: mock.length };
  }
}

export function fetchRayonStats(period?: string, categories?: string[]): Promise<RayonStat[]> {
  return Promise.resolve(buildRayonStats(filterListings(period, categories)));
}

export function fetchB2C(period?: string, categories?: string[]): Promise<B2CSummary> {
  return Promise.resolve(buildB2C(filterListings(period, categories)));
}
