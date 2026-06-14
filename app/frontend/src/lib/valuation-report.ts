// Report adapter — maps our valuation output into the predict-server report
// contract (types/valuation.ts → RateReportData) that the BA document
// specifies. The RateReport modal renders against this contract only, so
// when the real /api/v1/model/predict[/link] endpoints land (team #3/#12)
// the data source swaps here and the report UI is untouched.

import type {
  AiEstimate,
  RateReportData,
  ReportFeatures,
  TrendPoint,
  ValuationInput,
  ValuationResult
} from "@/types/valuation";
import { genTrend } from "@/components/dashboard/valuation/valuation-ui";

// ── Date helpers ───────────────────────────────────────────────────────

// Month-end ISO dates for the `n` months ending at (and including) `asOf`.
function trendDates(asOf: Date, n: number): string[] {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // Day 0 of month (m - i + 1) is the last day of month (m - i); Date
    // normalises negative/overflow months, so the year rolls correctly.
    out.push(new Date(Date.UTC(y, m - i + 1, 0)).toISOString().slice(0, 10));
  }
  return out;
}

function asOfFrom(period?: string | null): Date {
  const mm = period && /^(\d{4})-(\d{2})/.exec(period);
  if (mm) {
    const y = Number(mm[1]);
    const m = Number(mm[2]) - 1;
    return new Date(Date.UTC(y, m + 1, 0)); // month-end of that period
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
}

// ── Estimate / trend builders ──────────────────────────────────────────

function buildEstimate(
  point: number,
  lower: number,
  upper: number,
  vol: number,
  seed: number,
  dates: string[]
): AiEstimate {
  const loRatio = point ? lower / point : 0.9;
  const hiRatio = point ? upper / point : 1.1;
  const series = genTrend(point, vol, seed); // 12 values ending at `point`
  const n = Math.min(series.length, dates.length);
  const trend: TrendPoint[] = [];
  for (let i = 0; i < n; i++) {
    const v = series[series.length - n + i];
    trend.push({
      date: dates[dates.length - n + i],
      lower_bound: Math.round(v * loRatio),
      point_estimate: v,
      upper_bound: Math.round(v * hiRatio)
    });
  }
  return {
    current_valuation: {
      lower_bound: Math.round(lower),
      point_estimate: Math.round(point),
      upper_bound: Math.round(upper)
    },
    price_trend: trend
  };
}

function featuresFromInput(input: ValuationInput): ReportFeatures {
  return {
    address: input.address ?? null,
    type: input.type ?? null,
    repair: input.repair ?? null,
    extract: input.extract ?? null,
    area: input.area ?? null,
    total_floors: input.total_floors ?? null,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    residential_complex: input.residence ? 1 : 0,
    residence_owner: input.residence ?? null
  };
}

// ── Parametrlə flow: our /valuation/single result → report contract ─────

export function reportFromResult(result: ValuationResult, input: ValuationInput): RateReportData {
  const asOf = asOfFrom(result.period);
  const asOfISO = asOf.toISOString().slice(0, 10);
  const dates = trendDates(asOf, 12);

  const saleRange = (result.price_range as number[]) ?? [result.fair_value, result.fair_value];
  const rentRange = (result.rent_range as number[]) ?? [result.monthly_rent, result.monthly_rent];
  const seed = (result.fair_value % 9973) + 1;

  return {
    ai_data: {
      sale_estimate: buildEstimate(result.fair_value, saleRange[0], saleRange[1], 0.08, seed, dates),
      rent_estimate: buildEstimate(result.monthly_rent, rentRange[0], rentRange[1], 0.06, seed + 3, dates),
      investment_metrics: {
        annual_rent: Math.round(result.monthly_rent * 12),
        rent_yield_percent: result.yield_pct,
        payback_period_years: result.payback_years,
        price_per_sqm: result.price_per_m2,
        // We assume a renovated property when modelling yield unless the user
        // explicitly marked it unrenovated (team #4 repair field).
        assumed_renovated_for_yield: (result.repair || "").trim() !== "Təmirsiz"
      },
      as_of_date: asOfISO
    },
    accessibility_data: {},
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    listing_price: null, // form flow → no actual price; mortgage uses predicted
    features: featuresFromInput(input),
    source: { kind: "form" }
  };
}

// ── Elan linki flow ────────────────────────────────────────────────────
//
// The real predict-link endpoint (team #3/#12) is not wired yet, so when it
// is unreachable lib/valuation-data.ts falls back to this deterministic
// placeholder. Crucially it derives ONLY from the URL — never from form
// state (BA §15) — and carries the source URL so the report's "Mənbə"
// section renders. features stays null: the link report shows no feature
// grid in the MVP (BA §6).

function hashUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

// Thrown for explicit HTTP failures from the real predict-link endpoint so
// the UI can map 400/404/other to the BA-specified copy (§17).
export class LinkValuationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "LinkValuationError";
  }
}

export type LinkResult = { data: RateReportData; source: "db" | "mock" };

// Link flow request. Sends ONLY { flat_link } (BA §2.2 / §15) to the real
// predict-link endpoint. While that endpoint is unwired (team #3/#12) the
// call fails at the network layer and we fall back to a URL-only placeholder
// so the link report is demoable today. A real 4xx/5xx throws a typed error.
export async function valuateByLink(url: string): Promise<LinkResult> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      res = await fetch(`${API_BASE_URL}${API_PREFIX}/model/predict/link/`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ flat_link: url }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { data: reportFromLinkMock(url), source: "mock" };
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string; detail?: string };
      msg = j?.message || j?.detail || "";
    } catch {
      /* no body */
    }
    throw new LinkValuationError(res.status, msg);
  }
  const resp = (await res.json()) as {
    ai_data: RateReportData["ai_data"];
    accessibility_data?: RateReportData["accessibility_data"];
    latitude?: number | null;
    longitude?: number | null;
    listing_price?: number | null;
    actual_price?: number | null;
  };
  return {
    data: {
      ai_data: resp.ai_data,
      accessibility_data: resp.accessibility_data ?? {},
      latitude: resp.latitude ?? null,
      longitude: resp.longitude ?? null,
      listing_price: resp.listing_price ?? resp.actual_price ?? null,
      features: null,
      source: { kind: "link", url }
    },
    source: "db"
  };
}

export function reportFromLinkMock(url: string): RateReportData {
  const u = hashUnit(url);
  const u2 = hashUnit(url + "#a");
  const pricePerM2 = Math.round(1200 + u * 2300); // 1200–3500 ₼/m²
  const area = Math.round(45 + u2 * 95); // 45–140 m²
  const sale = Math.round((pricePerM2 * area) / 100) * 100;
  const yieldRate = 0.05 + u2 * 0.022;
  const monthlyRent = Math.round((sale * yieldRate) / 12 / 10) * 10;
  const annualRent = monthlyRent * 12;

  const asOf = asOfFrom(null);
  const asOfISO = asOf.toISOString().slice(0, 10);
  const dates = trendDates(asOf, 12);
  const seed = Math.round(u * 9973) + 1;

  return {
    ai_data: {
      sale_estimate: buildEstimate(sale, sale * 0.91, sale * 1.09, 0.08, seed, dates),
      rent_estimate: buildEstimate(monthlyRent, monthlyRent * 0.82, monthlyRent * 1.18, 0.06, seed + 3, dates),
      investment_metrics: {
        annual_rent: annualRent,
        rent_yield_percent: +(((annualRent) / sale) * 100).toFixed(2),
        payback_period_years: +(sale / Math.max(annualRent, 1)).toFixed(1),
        price_per_sqm: pricePerM2,
        assumed_renovated_for_yield: true
      },
      as_of_date: asOfISO
    },
    accessibility_data: {},
    latitude: null,
    longitude: null,
    // For a listing link the price is "actual"; the mortgage calculator uses
    // it without the predicted-price label.
    listing_price: sale,
    features: null,
    source: { kind: "link", url }
  };
}
