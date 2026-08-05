// Market endpoints shared by Bazar analizi and Xəritə analizi.
//
// Everything here is measured from the source DB. Nothing is generated: when
// an endpoint has no rows the caller gets an empty array and renders a gap.

import { apiUrl } from "@/lib/api-url";

async function get<T>(path: string, label: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${label} unavailable`);
  return res.json() as Promise<T>;
}

// Per-rayon median ₼/m² by build type + listing counts, city median, new share.
export type ApiMarketRayon = { rayon: string; ppm_new: number | null; ppm_old: number | null; ad_count: number };
export type ApiMarket = { period: string | null; city_median_kvm: number | null; new_share: number; total_ad_count: number; rayons: ApiMarketRayon[] };
export const fetchMarketAnalysis = () => get<ApiMarket>("/valuation/market", "market analysis");

// Room-count segments (₼/m², rent, yield, share) split by build type (team #3h).
export type SegRow = { rooms: string; ppm: number; rent: number; yield_pct: number; count: number; share: number };
export type SegData = { all: SegRow[]; new: SegRow[]; old: SegRow[] };
export const fetchMarketSegments = () => get<SegData>("/model/market/segments", "market segments");

// Monthly sale (₼/m²) + rent (₼) curves per build type (team #3b/d/e).
export type TrendPoint = { date: string; value: number };
export type TrendCat = { all: TrendPoint[]; new: TrendPoint[]; old: TrendPoint[] };
export type MarketTrends = { sale: TrendCat; rent: TrendCat };
export const fetchMarketTrends = () => get<MarketTrends>("/model/market/trends", "market trends");

// Per-rayon rental yield (last month, #3g) and price growth (#3j).
export type RayonRow = { rayon: string; yield_pct?: number; rent?: number; recent_count?: number; growth_pct?: number; growth_count?: number };
export type RayonData = { rayons: RayonRow[]; min_sample: number };
export const fetchMarketRayons = () => get<RayonData>("/model/market/rayons", "market rayons");

// Price index, base 100 = Aug 2023, per build type (team #3c).
export type IndexData = { base: string; all: TrendPoint[]; new: TrendPoint[]; old: TrendPoint[]; latest_yoy: { all?: number; new?: number; old?: number } };
export const fetchMarketIndex = () => get<IndexData>("/model/market/index", "market index");

/** Year-over-year change of a monthly series, matched on the calendar month so
 *  a gap in the data can't silently shift the comparison window. */
export function yoyPct(series?: TrendPoint[]): number | null {
  if (!series || series.length === 0) return null;
  const last = series[series.length - 1];
  const [y, m] = last.date.slice(0, 7).split("-").map(Number);
  if (!y || !m) return null;
  const prevKey = `${y - 1}-${String(m).padStart(2, "0")}`;
  const prev = series.find((p) => p.date.slice(0, 7) === prevKey);
  if (!prev?.value) return null;
  return +(((last.value - prev.value) / prev.value) * 100).toFixed(1);
}
