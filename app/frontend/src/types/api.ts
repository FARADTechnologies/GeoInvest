// ──────────────────────────────────────────────────────────────────────
// API contract — mirrors the FastAPI backend (H3 Categorise/app/backend)
//
// The first 4 types (FiltersResponse / DashboardFilters / MetricsResponse /
// MapDataPoint) are the EXISTING contract — do not touch them, they match
// what the backend already returns.
//
// Types below "// ── Extended (dashboard-only) ──" are NEW shapes the Homora
// dashboard needs but the backend does not yet provide. They are served from
// `lib/mock-data.ts` for now. When the backend adds endpoints for them
// (e.g. /api/v1/rayons, /api/v1/activity), the dashboard code switches
// without touching components.
// ──────────────────────────────────────────────────────────────────────

export type FiltersResponse = {
  periods: string[];
  categories: string[];
  resolutions: number[];
  analysis_types: string[];
};

export type DashboardFilters = {
  period: string;
  categories: string[];
  resolution: number;
  analysis_type: string;
};

export type MetricsResponse = {
  total_ads: number;
  avg_median_price: number;
  trend_percentage: number;
  active_h3_cells: number;
  previous_period: string | null;
  previous_total_ads: number | null;
  previous_avg_median_price: number | null;
  previous_active_h3_cells: number | null;
};

export type MapDataPoint = {
  h3_index: string;
  ad_count: number;
  median_price_kvm: number;
  category: string;
  rayon_name: string;
};

// ── Extended (dashboard-only) ──────────────────────────────────────────

export type Rayon = {
  name: string;        // "Nəsimi rayonu"
  short: string;       // "Nəsimi"
  listings: number;
  median: number;      // AZN/m²
  trend: number;       // % vs previous period
  hot: boolean;        // surfaced as a HOT badge
};

export type ActivityTone = "ok" | "warn" | "err" | "info";

export type ActivityItem = {
  ts: string;          // "12 dk" / "1 sa" / "12m" / "1h"
  rayon: string;       // human label, full rayon name
  action:
    | "new_listings"
    | "price_alert"
    | "price_drop"
    | "hexagon_added"
    | "report_export"
    | "data_sync";
  detail: string;      // localized human string
  tone: ActivityTone;
};

export type Sparklines = {
  total_ads: number[];
  avg_median_price: number[];
  trend_percentage: number[];
  active_h3_cells: number[];
};

export type HistogramBucket = {
  bucket: string;      // "2.0k", "2.5k", "5.5k+"
  lo: number;
  hi: number;
  count: number;
  hot: boolean;
};

export type TrendSeries = {
  label: string;       // short rayon name
  data: number[];      // 12 months, oldest → newest
};

// ── v3 views (Rayons / Listings / B2C) — mock-fed ──────────────────────

export type Listing = {
  id: string;
  rayonId: string;
  rayon: string;
  title: string;
  rooms: number;
  area: number;        // m²
  ppm: number;         // AZN/m²
  price: number;       // total AZN
  cat: "Yeni tikili" | "Köhnə tikili";
  source: string;
  status: "active" | "paused" | "sold";
  date: string;        // YYYY-MM-DD
  floor: number;
};

export type RayonStat = {
  id: string;
  name: string;
  short: string;
  listings: number;
  median: number;      // AZN/m²
  trend: number;       // % vs previous period
  hot: boolean;
  avgArea: number;     // m²
  newShare: number;    // % of "Yeni tikili"
  base: number;
  col: number;
  row: number;
};

export type B2CSummary = {
  cityMedian: number;
  cityTrend: number;
  affordableRayon: RayonStat;
  premiumRayon: RayonStat;
  fastestRayon: RayonStat;
  byRooms: { rooms: number; count: number; medianPpm: number; medianPrice: number }[];
  newVsOld: { newMed: number; oldMed: number; newCount: number; oldCount: number };
};
