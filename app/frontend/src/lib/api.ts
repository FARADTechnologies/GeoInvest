import type {
  DashboardFilters,
  FiltersResponse,
  MapDataPoint,
  MetricsResponse
} from "@/types/api";
import {
  fetchFallbackFilters,
  fetchFallbackMapData,
  fetchFallbackMetrics
} from "@/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

export async function apiGet<T>(
  path: string,
  filters?: DashboardFilters,
  extra?: Record<string, string>
): Promise<T> {
  const url = new URL(`${API_PREFIX}${path}`, API_BASE_URL);

  if (filters) {
    url.searchParams.set("period", filters.period);
    url.searchParams.set("resolution", String(filters.resolution));
    url.searchParams.set("analysis_type", filters.analysis_type);
    for (const category of filters.categories) {
      url.searchParams.append("categories", category);
    }
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchFilters() {
  try {
    return await apiGet<FiltersResponse>("/filters");
  } catch {
    return fetchFallbackFilters();
  }
}

export async function fetchMetrics(filters: DashboardFilters, minAdsPerCell: number) {
  try {
    const metrics = await apiGet<MetricsResponse>("/metrics", filters, {
      min_ads_per_cell: String(minAdsPerCell)
    });
    if (minAdsPerCell > 0 && metrics.active_h3_cells === 0 && metrics.total_ads === 0) {
      return apiGet<MetricsResponse>("/metrics", filters, { min_ads_per_cell: "0" });
    }
    return metrics;
  } catch {
    return fetchFallbackMetrics();
  }
}

export async function fetchMapData(filters: DashboardFilters, minAdsPerCell: number) {
  try {
    const rows = await apiGet<MapDataPoint[]>("/map-data", filters, {
      min_ads_per_cell: String(minAdsPerCell)
    });
    if (rows.length === 0 && minAdsPerCell > 0) {
      return apiGet<MapDataPoint[]>("/map-data", filters, { min_ads_per_cell: "0" });
    }
    return rows;
  } catch {
    return fetchFallbackMapData();
  }
}
