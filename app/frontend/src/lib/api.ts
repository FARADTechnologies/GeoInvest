import type {
  DashboardFilters,
  FiltersResponse,
  MapDataPoint,
  MetricsResponse
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

async function apiGet<T>(
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

export function fetchFilters() {
  return apiGet<FiltersResponse>("/filters");
}

export function fetchMetrics(filters: DashboardFilters, minAdsPerCell: number) {
  return apiGet<MetricsResponse>("/metrics", filters, {
    min_ads_per_cell: String(minAdsPerCell)
  });
}

export function fetchMapData(filters: DashboardFilters, minAdsPerCell: number) {
  return apiGet<MapDataPoint[]>("/map-data", filters, {
    min_ads_per_cell: String(minAdsPerCell)
  });
}
