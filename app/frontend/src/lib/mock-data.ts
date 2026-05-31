// ──────────────────────────────────────────────────────────────────────
// Mock data for shapes the backend does not yet serve.
//
// These functions mimic the async signature of `lib/api.ts` so swapping in
// a real fetch later is a 1-line change inside each `fetchX` body.
// ──────────────────────────────────────────────────────────────────────

import type {
  ActivityItem,
  DashboardFilters,
  FiltersResponse,
  HistogramBucket,
  MapDataPoint,
  MetricsResponse,
  Rayon,
  Sparklines,
  TrendSeries
} from "@/types/api";
import { latLngToCell } from "h3-js";

import { LISTINGS } from "@/lib/listings-data";

// ── Rayon roster ─────────────────────────────────────────────────────
const RAYONS: Rayon[] = [
  { name: "Nəsimi rayonu",    short: "Nəsimi",    listings: 1842, median: 3450, trend:  4.2, hot: true  },
  { name: "Səbail rayonu",    short: "Səbail",    listings: 1287, median: 3820, trend:  6.8, hot: true  },
  { name: "Nərimanov rayonu", short: "Nərimanov", listings: 1456, median: 3268, trend:  2.1, hot: false },
  { name: "Xətai rayonu",     short: "Xətai",     listings: 1198, median: 3737, trend:  3.5, hot: true  },
  { name: "Yasamal rayonu",   short: "Yasamal",   listings:  983, median: 2880, trend:  1.4, hot: false },
  { name: "Binəqədi rayonu",  short: "Binəqədi",  listings: 1124, median: 2480, trend: -0.8, hot: false },
  { name: "Sabunçu rayonu",   short: "Sabunçu",   listings:  876, median: 4363, trend: 12.4, hot: true  },
  { name: "Nizami rayonu",    short: "Nizami",    listings:  742, median: 2248, trend:  0.6, hot: false },
  { name: "Suraxanı rayonu",  short: "Suraxanı",  listings:  611, median: 1985, trend: -2.3, hot: false },
  { name: "Qaradağ rayonu",   short: "Qaradağ",   listings:  398, median: 1620, trend: -1.1, hot: false },
  { name: "Abşeron rayonu",   short: "Abşeron",   listings:  287, median: 1787, trend:  0.9, hot: false },
  { name: "Pirallahı rayonu", short: "Pirallahı", listings:  152, median: 1362, trend: -3.4, hot: false }
];

// ── Sparklines for the 4 KPI cards (last 8 periods, oldest→newest) ──
const SPARKLINES: Sparklines = {
  total_ads:        [8201, 8612, 8954, 9387, 9821, 10564, 11982, 12847],
  avg_median_price: [2830, 2920, 2908, 2961, 2982,  2941,  3004,  3142],
  trend_percentage: [ 1.1,  3.2, -0.4,  1.8,  0.7,  -1.4,   2.1,   4.6],
  active_h3_cells:  [ 942,  984, 1021, 1064, 1098,  1142,  1198,  1247]
};

// ── Filter-aware mock derived from the listings generator ────────────
// The fallback used to return a single static payload, so resolution /
// period / category / outlier changes did nothing when the backend was
// down. We now derive cells from LISTINGS so every filter visibly affects
// the result — exactly like the real backend.

function distinctMonths(): string[] {
  const set = new Set(LISTINGS.map((l) => l.date.slice(0, 7)));
  return [...set].sort().reverse(); // newest → oldest
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function med(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Approximate Baku rayon centroids (lat, lng) so mock listings get real
// coordinates → real H3 cells via h3-js. Without valid H3 indices the
// deck.gl H3HexagonLayer renders nothing.
const RAYON_CENTROIDS: Record<string, [number, number]> = {
  bineqedi: [40.455, 49.825],
  yasamal: [40.395, 49.805],
  nesimi: [40.405, 49.845],
  sabuncu: [40.47, 49.945],
  qaradag: [40.33, 49.66],
  nerimanov: [40.415, 49.87],
  sebail: [40.365, 49.835],
  nizami: [40.41, 49.915],
  pirallahi: [40.455, 50.115],
  absheron: [40.51, 49.72],
  xetai: [40.385, 49.92],
  suraxani: [40.42, 49.985]
};

// Deterministic jittered coordinate per listing, clustered around its
// rayon centroid (~±3 km). Resolution then controls hex size naturally.
function listingLatLng(rayonId: string, id: string): [number, number] {
  const [clat, clng] = RAYON_CENTROIDS[rayonId] ?? [40.4, 49.86];
  const h = hashStr(id);
  const jLat = ((h % 1000) / 1000 - 0.5) * 0.06;
  const jLng = (((h >>> 10) % 1000) / 1000 - 0.5) * 0.08;
  return [clat + jLat, clng + jLng];
}

function buildCells(
  period: string | undefined,
  categories: string[] | undefined,
  resolution: number,
  minAds: number
): MapDataPoint[] {
  const cats = categories && categories.length ? new Set(categories) : null;
  const rows = LISTINGS.filter(
    (l) => (!period || l.date.slice(0, 7) === period) && (!cats || cats.has(l.cat))
  );
  const buckets = new Map<string, { ppms: number[]; cats: Set<string>; rayons: Set<string> }>();
  for (const l of rows) {
    const [lat, lng] = listingLatLng(l.rayonId, l.id);
    const cell = latLngToCell(lat, lng, resolution); // real, valid H3 index
    let c = buckets.get(cell);
    if (!c) {
      c = { ppms: [], cats: new Set(), rayons: new Set() };
      buckets.set(cell, c);
    }
    c.ppms.push(l.ppm);
    c.cats.add(l.cat);
    c.rayons.add(l.rayon);
  }
  let cells: MapDataPoint[] = [...buckets.entries()].map(([cell, c]) => ({
    h3_index: cell,
    ad_count: c.ppms.length,
    median_price_kvm: med(c.ppms),
    category: [...c.cats].join(", "),
    rayon_name: [...c.rayons].join(", ")
  }));
  if (minAds > 0) cells = cells.filter((c) => c.ad_count > minAds);
  cells.sort((a, b) => b.ad_count - a.ad_count);
  return cells;
}

function metricsFor(
  period: string | undefined,
  categories: string[] | undefined,
  resolution: number,
  minAds: number
) {
  const cells = buildCells(period, categories, resolution, minAds);
  return {
    total_ads: cells.reduce((s, c) => s + c.ad_count, 0),
    avg_median_price: med(cells.map((c) => c.median_price_kvm)),
    active_h3_cells: cells.length
  };
}

// ── Price-distribution histogram (AZN/m², 10 bins) ───────────────────
const HISTOGRAM: HistogramBucket[] = [
  { bucket: "1.0k",  lo: 1000, hi: 1500, count:  412, hot: false },
  { bucket: "1.5k",  lo: 1500, hi: 2000, count:  982, hot: false },
  { bucket: "2.0k",  lo: 2000, hi: 2500, count: 1854, hot: false },
  { bucket: "2.5k",  lo: 2500, hi: 3000, count: 2641, hot: true  },
  { bucket: "3.0k",  lo: 3000, hi: 3500, count: 2310, hot: true  },
  { bucket: "3.5k",  lo: 3500, hi: 4000, count: 1683, hot: false },
  { bucket: "4.0k",  lo: 4000, hi: 4500, count:  998, hot: false },
  { bucket: "4.5k",  lo: 4500, hi: 5000, count:  624, hot: false },
  { bucket: "5.0k",  lo: 5000, hi: 5500, count:  287, hot: false },
  { bucket: "5.5k+", lo: 5500, hi: 9999, count:  156, hot: false }
];

// ── Trend chart (12 months × top 5 rayons, AZN/m²) ───────────────────
function rayonTrend(seed: number, base: number): number[] {
  const out: number[] = [];
  let v = base * 0.9;
  let rng = seed;
  for (let i = 0; i < 12; i++) {
    rng = (rng * 9301 + 49297) % 233280;
    const noise = (rng / 233280 - 0.5) * 120;
    v += (base - v) * 0.18 + noise;
    out.push(Math.round(v));
  }
  return out;
}

const TREND_SERIES: TrendSeries[] = [
  { label: "Nəsimi",    data: rayonTrend(11, 3450) },
  { label: "Səbail",    data: rayonTrend(22, 3820) },
  { label: "Nərimanov", data: rayonTrend(33, 3268) },
  { label: "Xətai",     data: rayonTrend(44, 3737) },
  { label: "Sabunçu",   data: rayonTrend(55, 4363) }
];

export const MONTH_LABELS_TR = ["May","Iyn","Iyl","Avq","Sen","Okt","Noy","Dek","Yan","Fev","Mar","Apr"];
export const MONTH_LABELS_EN = ["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr"];

// ── Activity feed (TR + EN) ──────────────────────────────────────────
const ACTIVITY_TR: ActivityItem[] = [
  { ts: "12 dk", rayon: "Sabunçu rayonu",   action: "new_listings",  detail: "23 yeni ilan",                tone: "ok"   },
  { ts: "1 sa",  rayon: "Səbail rayonu",    action: "price_alert",   detail: "Medyan +%6.8 (haftalık)",     tone: "warn" },
  { ts: "2 sa",  rayon: "Nəsimi rayonu",    action: "hexagon_added", detail: "H3 hücresi 862ce581 aktif",   tone: "info" },
  { ts: "3 sa",  rayon: "Xətai rayonu",     action: "report_export", detail: "PDF raporu dışa aktarıldı",   tone: "info" },
  { ts: "4 sa",  rayon: "Pirallahı rayonu", action: "price_drop",    detail: "Medyan −%3.4 (aylık)",        tone: "err"  },
  { ts: "6 sa",  rayon: "Nərimanov rayonu", action: "new_listings",  detail: "11 yeni ilan",                tone: "ok"   },
  { ts: "1 g",   rayon: "Binəqədi rayonu",  action: "data_sync",     detail: "Gecelik veri senkronu tamam", tone: "info" }
];

const ACTIVITY_EN: ActivityItem[] = [
  { ts: "12m", rayon: "Sabunçu rayonu",   action: "new_listings",  detail: "23 new listings",            tone: "ok"   },
  { ts: "1h",  rayon: "Səbail rayonu",    action: "price_alert",   detail: "Median +6.8% (weekly)",      tone: "warn" },
  { ts: "2h",  rayon: "Nəsimi rayonu",    action: "hexagon_added", detail: "H3 cell 862ce581 active",    tone: "info" },
  { ts: "3h",  rayon: "Xətai rayonu",     action: "report_export", detail: "PDF report exported",        tone: "info" },
  { ts: "4h",  rayon: "Pirallahı rayonu", action: "price_drop",    detail: "Median −3.4% (monthly)",     tone: "err"  },
  { ts: "6h",  rayon: "Nərimanov rayonu", action: "new_listings",  detail: "11 new listings",            tone: "ok"   },
  { ts: "1d",  rayon: "Binəqədi rayonu",  action: "data_sync",     detail: "Nightly data sync complete", tone: "info" }
];

// ── Async fetchers (mirror api.ts signatures) ────────────────────────
export async function fetchRayons(): Promise<Rayon[]> {
  return RAYONS;
}

export async function fetchFallbackFilters(): Promise<FiltersResponse> {
  return {
    periods: distinctMonths(),
    categories: ["Köhnə tikili", "Yeni tikili"],
    resolutions: [6, 7, 8],
    analysis_types: ["geom", "pure_h3"]
  };
}

export async function fetchFallbackMetrics(
  filters?: DashboardFilters,
  minAds = 0
): Promise<MetricsResponse> {
  const resolution = filters?.resolution ?? 7;
  const period = filters?.period;
  const cur = metricsFor(period, filters?.categories, resolution, minAds);

  const months = distinctMonths();
  const idx = period ? months.indexOf(period) : 0;
  const prevPeriod = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : undefined;
  const prev = prevPeriod ? metricsFor(prevPeriod, filters?.categories, resolution, minAds) : null;
  const trend =
    prev && prev.avg_median_price > 0
      ? ((cur.avg_median_price - prev.avg_median_price) / prev.avg_median_price) * 100
      : 0;

  return {
    total_ads: cur.total_ads,
    avg_median_price: cur.avg_median_price,
    trend_percentage: Math.round(trend * 100) / 100,
    active_h3_cells: cur.active_h3_cells,
    previous_period: prevPeriod ?? null,
    previous_total_ads: prev?.total_ads ?? null,
    previous_avg_median_price: prev?.avg_median_price ?? null,
    previous_active_h3_cells: prev?.active_h3_cells ?? null
  };
}

export async function fetchFallbackMapData(
  filters?: DashboardFilters,
  minAds = 0
): Promise<MapDataPoint[]> {
  return buildCells(filters?.period, filters?.categories, filters?.resolution ?? 7, minAds);
}

export async function fetchSparklines(): Promise<Sparklines> {
  return SPARKLINES;
}

export async function fetchHistogram(): Promise<HistogramBucket[]> {
  return HISTOGRAM;
}

export async function fetchTrendSeries(): Promise<TrendSeries[]> {
  return TREND_SERIES;
}

export async function fetchActivity(lang: "tr" | "en" | "az" = "tr"): Promise<ActivityItem[]> {
  return lang === "en" ? ACTIVITY_EN : ACTIVITY_TR;
}
