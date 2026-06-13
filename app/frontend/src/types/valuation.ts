// ──────────────────────────────────────────────────────────────────────
// Valuation contract — mirrors the FastAPI backend (/api/v1/valuation/*).
//
// Single (Tək) + Mass (Kütləvi) valuation. fair_value / price_per_m2 are
// anchored to real market medians from the precomputed analytics tables;
// rent / yield / liquidity / score are modelled estimates.
//
// All fetchers fall back to a local mock (lib/valuation-data.ts) when the
// backend is unreachable — the same resilience pattern the map/KPIs use.
// ──────────────────────────────────────────────────────────────────────

export type BuildType = "Yeni tikili" | "Köhnə tikili";

// Form input for one property (mirrors the B2C "Parametrlə qiymətləndir" form).
export type ValuationInput = {
  address?: string | null;
  rayon?: string | null;
  type: string; // BuildType, kept as string for form flexibility
  area: number;
  rooms?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  repair?: string | null;
  extract?: string | null;
  residence?: string | null;
  // Filled by the Google address picker (team #1/#2) — optional for now.
  latitude?: number | null;
  longitude?: number | null;
  valuation_date?: string | null;
};

// Computed valuation returned by the backend (and produced by the mock).
export type ValuationResult = {
  address?: string | null;
  rayon: string;
  type: string;
  area: number;
  rooms?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  repair?: string | null;
  extract?: string | null;
  residence?: string | null;

  fair_value: number;
  price_per_m2: number;
  price_range: [number, number] | number[];
  market_median_kvm?: number | null;

  monthly_rent: number;
  rent_range: [number, number] | number[];
  yield_pct: number;
  payback_years: number;
  liquidity_days: number;
  score: number;
  risk: string; // Aşağı | Orta | Yüksək

  period?: string | null;
  price_basis: "rayon" | "market" | "fallback";
};

export type RayonPrice = {
  rayon: string;
  median_price_kvm: number;
  ad_count: number;
};

export type ValuationMeta = {
  period: string | null;
  categories: string[];
  rayons: RayonPrice[];
  market_median_kvm: number | null;
};

// A property as held in a portfolio / single-history list. Extends the
// computed result with a local id and a `valued` flag (false = draft).
export type ValuationItem = ValuationResult & {
  id: string;
  valued: boolean;
};

export type Portfolio = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  items: ValuationItem[];
};

// Where the rendered numbers came from — surfaced as a DB/MOCK badge,
// matching the existing dashboard convention.
export type ValuationSource = "db" | "mock";
