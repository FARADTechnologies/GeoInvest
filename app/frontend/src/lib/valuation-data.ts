// Valuation data layer — talks to the backend /valuation/* endpoints and
// falls back to a deterministic local mock when the backend is unreachable
// (same resilience pattern as lib/api.ts). Components consume these fetchers
// and never call the network directly.

import type {
  RayonPrice,
  ValuationInput,
  ValuationItem,
  ValuationMeta,
  ValuationResult,
  ValuationSource
} from "@/types/valuation";
import { apiUrl } from "@/lib/api-url";


const COOLDOWN_MS = 15_000;
const TIMEOUT_MS = 2_000;
let backendDownUntil = 0;
const isDown = () => Date.now() < backendDownUntil;
const markDown = () => {
  backendDownUntil = Date.now() + COOLDOWN_MS;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (isDown()) throw new Error("backend-cooldown");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(`${path}`), {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: controller.signal
    });
    if (!res.ok) {
      if (res.status >= 500) markDown();
      throw new Error(`Request failed ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    markDown();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public fetchers (return data + source so the UI can show a DB/MOCK badge)

export type Sourced<T> = { data: T; source: ValuationSource };

// These used to fall back to a local approximation of the backend formula when
// a call failed. That produced numbers indistinguishable from real valuations,
// so it is gone — a failure now surfaces as a failure.
export async function fetchValuationMeta(): Promise<Sourced<ValuationMeta>> {
  return { data: await request<ValuationMeta>("/valuation/meta"), source: "db" };
}

export async function valuateSingle(input: ValuationInput): Promise<Sourced<ValuationResult>> {
  const data = await request<ValuationResult>("/valuation/single", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return { data, source: "db" };
}

export async function valuateBatch(inputs: ValuationInput[]): Promise<Sourced<ValuationResult[]>> {
  const data = await request<{ results: ValuationResult[]; period: string | null }>(
    "/valuation/batch",
    { method: "POST", body: JSON.stringify({ items: inputs }) }
  );
  return { data: data.results, source: "db" };
}

// ── Portfolio stats + formatting helpers (used across the views) ──────
export const fmtMoney = (n: number | null | undefined, suffix = " ₼") =>
  n == null ? "—" : new Intl.NumberFormat("az-AZ").format(Math.round(n)) + suffix;
export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("az-AZ").format(Math.round(n));

export type PortfolioStats = {
  n: number;
  totalValue: number;
  totalRent: number;
  avgYield: number;
  avgScore: number;
  avgPayback: number;
  avgPricePerM2: number;
  avgLiquidity: number;
  avgArea: number;
  newCount: number;
  byRayon: Record<string, number>;
};

export function portfolioStats(items: ValuationItem[]): PortfolioStats {
  const valued = items.filter((x) => x.valued !== false);
  const n = valued.length;
  if (n === 0) {
    return {
      n: 0, totalValue: 0, totalRent: 0, avgYield: 0, avgScore: 0,
      avgPayback: 0, avgPricePerM2: 0, avgLiquidity: 0, avgArea: 0, newCount: 0, byRayon: {}
    };
  }
  const sum = (f: (x: ValuationItem) => number) => valued.reduce((s, x) => s + (f(x) || 0), 0);
  return {
    n,
    totalValue: sum((x) => x.fair_value),
    totalRent: sum((x) => x.monthly_rent),
    avgYield: +(sum((x) => x.yield_pct) / n).toFixed(2),
    avgScore: Math.round(sum((x) => x.score) / n),
    avgPayback: +(sum((x) => x.payback_years) / n).toFixed(1),
    avgPricePerM2: Math.round(sum((x) => x.price_per_m2) / n),
    avgLiquidity: Math.round(sum((x) => x.liquidity_days) / n),
    avgArea: Math.round(sum((x) => x.area) / n),
    newCount: valued.filter((x) => (x.type || "").toLowerCase().includes("yeni")).length,
    byRayon: valued.reduce<Record<string, number>>((m, x) => {
      const k = x.rayon || "—";
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {})
  };
}

export const newId = (prefix = "V") =>
  `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
