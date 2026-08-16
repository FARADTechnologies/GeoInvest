import type {
  DashboardFilters,
  FiltersResponse,
  MapDataPoint,
  MetricsResponse
} from "@/types/api";
import { apiUrl } from "@/lib/api-url";


// ── Backend availability short-circuit ────────────────────────────────
// When the backend is unreachable (DB down, container stopped), every
// query used to wait for a fetch timeout before falling back to mock —
// adding a ~1s lag to each filter change. Once a call fails we mark the
// backend "down" for a cooldown window so subsequent calls skip the
// network entirely and resolve to mock instantly. After the cooldown we
// retry, so the app auto-recovers when the backend returns.
const BACKEND_COOLDOWN_MS = 15_000;
// 1.5 s was far too tight for a real deployment: a cold container, a VPN hop
// or any brief hiccup aborted the request, and the app silently served the
// frozen snapshot instead — with the period list stuck months in the past.
// Worse, one such abort tripped the cooldown below and pushed every other
// query to the fallback too. The backend answers in ~0.2–0.6 s when healthy,
// so this only fires when something is genuinely wrong.
const FETCH_TIMEOUT_MS = 12_000;
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

  const url = new URL(apiUrl(path));
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

// No fallbacks below. When a call fails the error propagates and the view
// renders an empty/error state — a figure nobody can trace is worse than a gap.
export function fetchFilters() {
  return apiGet<FiltersResponse>("/filters");
}

export async function fetchMetrics(filters: DashboardFilters, minAdsPerCell: number) {
  let metrics = await apiGet<MetricsResponse>("/metrics", filters, {
      min_ads_per_cell: String(minAdsPerCell)
    });
  if (minAdsPerCell > 0 && metrics.active_h3_cells === 0 && metrics.total_ads === 0) {
    metrics = await apiGet<MetricsResponse>("/metrics", filters, { min_ads_per_cell: "0" });
  }
  return { ...metrics, _source: "db" as const };
}

export async function fetchMapData(filters: DashboardFilters, minAdsPerCell: number) {
  const rows = await apiGet<MapDataPoint[]>("/map-data", filters, {
    min_ads_per_cell: String(minAdsPerCell)
  });
  if (rows.length === 0 && minAdsPerCell > 0) {
    return apiGet<MapDataPoint[]>("/map-data", filters, { min_ads_per_cell: "0" });
  }
  return rows;
}
