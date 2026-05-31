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
import { apiGet } from "@/lib/api";
import {
  fetchActivity as mockActivity,
  fetchHistogram as mockHistogram,
  fetchRayons as mockRayons,
  fetchSparklines as mockSparklines,
  fetchTrendSeries as mockTrendSeries
} from "@/lib/mock-data";
import { buildB2C, buildRayonStats, filterListings } from "@/lib/listings-data";

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
  } catch {
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
      return await apiGet<TrendSeries[]>("/trend-series", filters);
    } catch {
      /* fall through to mock */
    }
  }
  // Mock path — derive from the period/category-filtered rayon stats.
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

export function fetchRayonStats(period?: string, categories?: string[]): Promise<RayonStat[]> {
  return Promise.resolve(buildRayonStats(filterListings(period, categories)));
}

export function fetchB2C(period?: string, categories?: string[]): Promise<B2CSummary> {
  return Promise.resolve(buildB2C(filterListings(period, categories)));
}
