// Frozen real-data snapshot loader.
//
// On a public/demo deploy the live backend (internal DB over VPN) is
// unreachable, so the dashboard + valuation fall back to this snapshot —
// real data captured at a point in time (see scripts/snapshot_data.py).
// Served as a static asset at /snapshot/data.json. When a requested slice
// isn't in the snapshot, callers fall through to the synthetic mock.

import type { FiltersResponse, MapDataPoint, MetricsResponse, Sparklines, TrendSeries } from "@/types/api";

export type SnapshotRayon = { rayon: string; overall: number; new: number; old: number; ad_count: number };

export type Snapshot = {
  generatedAt: string;
  note: string;
  filters: FiltersResponse;
  defaults: { period: string; resolution: number; analysis_type: string };
  valuation: {
    period: string;
    cityMedian: number;
    cityNew: number;
    cityOld: number;
    newCat: string;
    oldCat: string;
    rayons: SnapshotRayon[];
  };
  dashboard: Record<string, { metrics: MetricsResponse; mapData: MapDataPoint[]; sparklines: Sparklines }>;
  trends: Record<string, TrendSeries[]>;
};

let cache: Snapshot | null | undefined; // undefined = not loaded, null = unavailable
let inflight: Promise<Snapshot | null> | null = null;

export async function loadSnapshot(): Promise<Snapshot | null> {
  if (cache !== undefined) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/snapshot/data.json", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      cache = (await res.json()) as Snapshot;
    } catch {
      cache = null;
    }
    return cache;
  })();
  return inflight;
}

export const dashKey = (analysisType: string, period: string, resolution: number, categories: string[]) =>
  `${analysisType}|${period}|${resolution}|${[...categories].sort().join(",")}`;

export const trendKey = (period: string, categories: string[]) => `${period}|${[...categories].sort().join(",")}`;
