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
import { dashKey, loadSnapshot } from "@/lib/snapshot";
import { mockAllowed } from "@/lib/mock-gate";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

// ── Backend availability short-circuit ────────────────────────────────
// When the backend is unreachable (DB down, container stopped), every
// query used to wait for a fetch timeout before falling back to mock —
// adding a ~1s lag to each filter change. Once a call fails we mark the
// backend "down" for a cooldown window so subsequent calls skip the
// network entirely and resolve to mock instantly. After the cooldown we
// retry, so the app auto-recovers when the backend returns.
const BACKEND_COOLDOWN_MS = 15_000;
const FETCH_TIMEOUT_MS = 1_500;
let backendDownUntil = 0;

function backendIsDown(): boolean {
  return Date.now() < backendDownUntil;
}
function markBackendDown(): void {
  backendDownUntil = Date.now() + BACKEND_COOLDOWN_MS;
}

export async function apiGet<T>(
  path: string,
  filters?: DashboardFilters,
  extra?: Record<string, string>
): Promise<T> {
  // Skip the network during the cooldown — callers fall straight to mock.
  if (backendIsDown()) {
    throw new Error("backend-cooldown");
  }

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } catch (error) {
    // network failure or timeout → backend is unreachable
    markBackendDown();
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status >= 500) markBackendDown();
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchFilters() {
  try {
    return await apiGet<FiltersResponse>("/filters");
  } catch (err) {
    // In production only a super admin may see fallback data (mock-gate.ts).
    if (!mockAllowed()) throw err;
    const snap = await loadSnapshot();
    if (snap?.filters) return snap.filters;
    return fetchFallbackFilters();
  }
}

export async function fetchMetrics(filters: DashboardFilters, minAdsPerCell: number) {
  try {
    let metrics = await apiGet<MetricsResponse>("/metrics", filters, {
      min_ads_per_cell: String(minAdsPerCell)
    });
    if (minAdsPerCell > 0 && metrics.active_h3_cells === 0 && metrics.total_ads === 0) {
      metrics = await apiGet<MetricsResponse>("/metrics", filters, { min_ads_per_cell: "0" });
    }
    return { ...metrics, _source: "db" as const };
  } catch (err) {
    if (!mockAllowed()) throw err;
    const snap = await loadSnapshot();
    const hit = snap?.dashboard[dashKey(filters.analysis_type, filters.period, filters.resolution, filters.categories)];
    if (hit?.metrics) return { ...hit.metrics, _source: "mock" as const };
    const mock = await fetchFallbackMetrics(filters, minAdsPerCell);
    return { ...mock, _source: "mock" as const };
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
  } catch (err) {
    if (!mockAllowed()) throw err;
    const snap = await loadSnapshot();
    const hit = snap?.dashboard[dashKey(filters.analysis_type, filters.period, filters.resolution, filters.categories)];
    if (hit?.mapData) return hit.mapData;
    return fetchFallbackMapData(filters, minAdsPerCell);
  }
}
