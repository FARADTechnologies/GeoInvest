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
import { loadSnapshot, type Snapshot } from "@/lib/snapshot";


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

export async function fetchValuationMeta(): Promise<Sourced<ValuationMeta>> {
  try {
    const data = await request<ValuationMeta>("/valuation/meta");
    return { data, source: "db" };
  } catch {
    return { data: mockMeta(await loadSnapshot()), source: "mock" };
  }
}

export async function valuateSingle(input: ValuationInput): Promise<Sourced<ValuationResult>> {
  try {
    const data = await request<ValuationResult>("/valuation/single", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return { data, source: "db" };
  } catch {
    return { data: mockValuate(input, await loadSnapshot()), source: "mock" };
  }
}

export async function valuateBatch(inputs: ValuationInput[]): Promise<Sourced<ValuationResult[]>> {
  try {
    const data = await request<{ results: ValuationResult[]; period: string | null }>(
      "/valuation/batch",
      { method: "POST", body: JSON.stringify({ items: inputs }) }
    );
    return { data: data.results, source: "db" };
  } catch {
    const snap = await loadSnapshot();
    return { data: inputs.map((i) => mockValuate(i, snap)), source: "mock" };
  }
}

// ── Deterministic local mock (used only when the backend is down) ──────
// Mirrors the backend formula so the UI behaves identically offline.

const MOCK_RAYON_PRICE: Record<string, number> = {
  Səbail: 3200,
  Nərimanov: 2450,
  Yasamal: 2300,
  Nəsimi: 2350,
  Nizami: 1950,
  Xətai: 1850,
  Binəqədi: 1550,
  Sabunçu: 1300,
  Suraxanı: 1250,
  Xəzər: 1200,
  Qaradağ: 1050,
  Pirallahı: 1000
};
const MOCK_RAYONS = Object.keys(MOCK_RAYON_PRICE);
const REPAIR_FACTOR: Record<string, number> = { Əla: 1.06, Var: 1.0, Orta: 0.96, Yox: 0.9 };

function hashUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
const jitter = (seed: string, spread: number) => (hashUnit(seed) - 0.5) * 2 * spread;

function mockRayonPrice(rayon?: string | null): number {
  if (rayon) {
    const key = MOCK_RAYONS.find((r) => rayon.toLowerCase().includes(r.toLowerCase()));
    if (key) return MOCK_RAYON_PRICE[key];
  }
  return 1800;
}

export function mockMeta(snap?: Snapshot | null): ValuationMeta {
  // Prefer the frozen real-data snapshot when available (demo/public deploy).
  if (snap?.valuation?.rayons?.length) {
    return {
      period: snap.valuation.period,
      categories: [snap.valuation.newCat, snap.valuation.oldCat],
      rayons: snap.valuation.rayons.map((r) => ({ rayon: r.rayon, median_price_kvm: r.overall, ad_count: r.ad_count })),
      market_median_kvm: snap.valuation.cityMedian
    };
  }
  const rayons: RayonPrice[] = MOCK_RAYONS.map((r) => ({
    rayon: `${r} rayonu`,
    median_price_kvm: MOCK_RAYON_PRICE[r],
    ad_count: 40 + Math.round(hashUnit(r) * 320)
  }));
  return { period: null, categories: ["Yeni tikili", "Köhnə tikili"], rayons, market_median_kvm: 1900 };
}

// Look up a real per-type ₼/m² from the snapshot for a rayon (fuzzy match).
function snapPrice(snap: Snapshot, rayon: string | null | undefined, isNew: boolean): { price: number; market: number } | null {
  const v = snap.valuation;
  if (!v?.rayons?.length) return null;
  let row = null as Snapshot["valuation"]["rayons"][number] | null;
  if (rayon) {
    const a = rayon.toLowerCase();
    row =
      v.rayons.find((r) => a.includes(r.rayon.replace(/\s*rayonu$/i, "").toLowerCase())) ||
      v.rayons.find((r) => r.rayon.toLowerCase().includes(a)) ||
      null;
  }
  const price = row ? (isNew ? row.new : row.old) : isNew ? v.cityNew : v.cityOld;
  const market = row ? row.overall : v.cityMedian;
  return { price, market };
}

export function mockValuate(input: ValuationInput, snap?: Snapshot | null): ValuationResult {
  const isNew = (input.type || "").toLowerCase().includes("yeni");
  const snapped = snap ? snapPrice(snap, input.rayon, isNew) : null;
  const base = snapped ? snapped.price : mockRayonPrice(input.rayon) * (isNew ? 1.12 : 0.94);
  let adj = REPAIR_FACTOR[(input.repair || "").trim()] ?? 1.0;
  if (input.floor && input.total_floors) {
    if (input.floor === 1) adj *= 0.97;
    else if (input.floor >= input.total_floors) adj *= 0.98;
  }
  const pricePerM2raw = base * adj;
  const area = input.area || 70;
  const seed = `${input.address ?? ""}|${input.rayon ?? ""}|${area}|${input.rooms ?? ""}|${input.floor ?? ""}`;
  const fairValue = Math.round((pricePerM2raw * area) / 10) * 10;

  const yieldRate = (isNew ? 0.055 : 0.072) + jitter(seed + "y", 0.006);
  const monthlyRent = Math.round((fairValue * yieldRate) / 12 / 10) * 10;
  const yieldPct = fairValue ? +(((monthlyRent * 12) / fairValue) * 100).toFixed(1) : 0;
  const payback = yieldPct ? +(100 / yieldPct).toFixed(1) : 0;

  const market = snapped ? snapped.market : mockRayonPrice(input.rayon);
  let liquidity = isNew ? 70 : 95;
  liquidity += Math.round(((pricePerM2raw - market) / Math.max(market, 1)) * 60);
  liquidity += Math.round(jitter(seed + "l", 18));
  const liquidityDays = Math.max(20, Math.min(260, liquidity));

  const scoreRaw =
    60 + (yieldPct - 6) * 6 - (payback - 12) * 1.5 - (liquidityDays - 90) * 0.15 + jitter(seed + "s", 7);
  const score = Math.max(38, Math.min(96, Math.round(scoreRaw)));
  const risk = score >= 78 ? "Aşağı" : score >= 60 ? "Orta" : "Yüksək";

  return {
    address: input.address ?? null,
    rayon: input.rayon || "—",
    type: input.type,
    area,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    total_floors: input.total_floors ?? null,
    repair: input.repair ?? null,
    extract: input.extract ?? null,
    residence: input.residence ?? null,
    fair_value: fairValue,
    price_per_m2: area ? Math.round(fairValue / area) : Math.round(pricePerM2raw),
    price_range: [Math.round(fairValue * 0.91), Math.round(fairValue * 1.09)],
    market_median_kvm: market,
    monthly_rent: monthlyRent,
    rent_range: [Math.round(monthlyRent * 0.82), Math.round(monthlyRent * 1.18)],
    yield_pct: yieldPct,
    payback_years: payback,
    liquidity_days: liquidityDays,
    score,
    risk,
    period: snap?.valuation?.period ?? null,
    price_basis: snapped ? "rayon" : "fallback"
  };
}

// ── Aggregates + formatters (shared by the views) ─────────────────────

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
