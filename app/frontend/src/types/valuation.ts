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

// ──────────────────────────────────────────────────────────────────────
// B2C "Mənzili qiymətləndir" report contract.
//
// Mirrors the predict-server response shape from the team's BA document so
// the report renders against the final contract today. Until the predict
// server (id/secret) is delivered, lib/valuation-report.ts adapts our
// /valuation/single output into this shape; swapping to the real endpoint
// later changes nothing in the report UI.
// ──────────────────────────────────────────────────────────────────────

export type EstimateBounds = {
  lower_bound: number;
  point_estimate: number;
  upper_bound: number;
};

export type TrendPoint = {
  date: string; // ISO date (month-end), e.g. "2026-04-30"
  lower_bound: number;
  point_estimate: number;
  upper_bound: number;
};

export type AiEstimate = {
  current_valuation: EstimateBounds;
  price_trend: TrendPoint[];
};

export type InvestmentMetrics = {
  annual_rent: number;
  rent_yield_percent: number;
  payback_period_years: number;
  price_per_sqm: number;
  assumed_renovated_for_yield?: boolean;
};

export type AiData = {
  sale_estimate: AiEstimate;
  rent_estimate: AiEstimate;
  investment_metrics: InvestmentMetrics;
  as_of_date?: string | null;
};

// Accessibility / nearby-object context (team #9 — empty until the POI API).
export type AccessibilityData = Record<string, unknown>;

// Property features shown in the report's "Mənzil xüsusiyyətləri" grid.
// Populated from the form payload (Parametrlə flow). For the link flow MVP
// this is null — no form-data fallback is allowed (BA §6, §15).
export type ReportFeatures = {
  address: string | null;
  type: string | null;
  repair: string | null;
  extract: string | null;
  area: number | null;
  total_floors: number | null;
  rooms: number | null;
  floor: number | null;
  residential_complex: 0 | 1;
  residence_owner: string | null;
};

// Which flow produced the report. The "link" variant carries the source URL
// that the report surfaces in its "Mənbə" section.
export type ReportSource = { kind: "form" } | { kind: "link"; url: string };

// Full payload the report modal consumes (predict response + UI context).
export type RateReportData = {
  ai_data: AiData;
  accessibility_data?: AccessibilityData;
  latitude?: number | null;
  longitude?: number | null;
  // Actual listing price (link flow) — drives the mortgage calculator. When
  // null the calculator uses the predicted sale price with a "Homora
  // qiymətləndirməsinə əsasən" label.
  listing_price?: number | null;
  features: ReportFeatures | null;
  source: ReportSource;
};
