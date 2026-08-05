// Dashboard-only fetchers, alongside the core ones in api.ts.
//
// Everything here returns real backend data or nothing at all. The generated
// sample data these used to fall back to has been removed: a screen with no
// numbers is honest, a screen with invented numbers is not.

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


// The legacy V1 views below have no backend endpoint. They used to be filled
// with generated sample data; that is gone, so they return nothing until a real
// endpoint exists.
export function fetchRayons(): Promise<Rayon[]> {
  return Promise.resolve([]);
}

export async function fetchSparklines(
  filters?: DashboardFilters,
  minAdsPerCell = 0
): Promise<Sparklines> {
  if (!filters) return {} as Sparklines;
  return apiGet<Sparklines>("/sparklines", filters, {
    min_ads_per_cell: String(minAdsPerCell)
  });
}

export function fetchHistogram(): Promise<HistogramBucket[]> {
  return Promise.resolve([]);
}

export async function fetchTrendSeries(filters?: DashboardFilters): Promise<TrendSeries[]> {
  if (!filters) return [];
  const res = await apiGet<TrendSeries[]>("/trend-series", filters);
  return Array.isArray(res) ? res : [];
}

export function fetchActivity(_lang: "tr" | "en" | "az" = "tr"): Promise<ActivityItem[]> {
  return Promise.resolve([]);
}

// ── v3 views (Rayons / Listings / B2C) — period + category aware ──────
// `fetchListings` with no args returns the full set (İlanlar has its own
// toolbar); with period/categories it returns the filtered set used by the
// Rayons detail modal and the B2C listing count.
export function fetchListings(_period?: string, _categories?: string[]): Promise<Listing[]> {
  return Promise.resolve([]);
}

// Elanlar view — real apartment listings from the source DB (team #10).
type ListingApiRow = {
  id: string; title: string; address: string | null; rayon: string; rooms: number; area: number;
  price: number; ppm: number; floor: number; cat: string; source: string;
  source_url: string | null; date: string;
};
// The listings payload is large (~170 KB, ~1.5-3 s), so it gets its own
// generous timeout rather than the shared one.
const LISTINGS_TIMEOUT_MS = 20_000;

// Number of real listings loaded into the Elanlar view for client-side
// filter/sort/paginate. The DB has ~13-19k; loading all is too heavy, so we
// load the newest LISTINGS_PAGE and surface the true total (COUNT) in the
// header — fixing the "13k shows as 500" the user hit.
export const LISTINGS_PAGE = 1000;
export type ListingsResult = { listings: Listing[]; total: number };

export async function fetchListingsDB(): Promise<ListingsResult> {
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
      // The source DB has no field telling us whether a listing is still live,
      // sold or paused — every row used to be stamped "active", so the Status
      // column and its filter were decoration. Left unset until the team
      // confirms which column carries it.
      status: undefined,
      address: r.address ?? undefined,
      date: r.date,
      floor: r.floor,
      sourceUrl: r.source_url ?? undefined
    }));
    return { listings, total: res.total || listings.length };
}

export function fetchRayonStats(_period?: string, _categories?: string[]): Promise<RayonStat[]> {
  return Promise.resolve([]);
}

export function fetchB2C(_period?: string, _categories?: string[]): Promise<B2CSummary> {
  return Promise.resolve({} as B2CSummary);
}
