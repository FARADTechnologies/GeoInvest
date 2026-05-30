// ──────────────────────────────────────────────────────────────────────
// Mock data for shapes the backend does not yet serve.
//
// These functions mimic the async signature of `lib/api.ts` so swapping in
// a real fetch later is a 1-line change inside each `fetchX` body.
// ──────────────────────────────────────────────────────────────────────

import type {
  ActivityItem,
  FiltersResponse,
  HistogramBucket,
  MapDataPoint,
  MetricsResponse,
  Rayon,
  Sparklines,
  TrendSeries
} from "@/types/api";

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

const FALLBACK_FILTERS: FiltersResponse = {
  periods: ["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"],
  categories: ["Köhnə tikili", "Yeni tikili"],
  resolutions: [6, 7, 8],
  analysis_types: ["geom", "pure_h3"]
};

const FALLBACK_METRICS: MetricsResponse = {
  total_ads: 35,
  avg_median_price: 2948,
  trend_percentage: 4.8,
  active_h3_cells: 13,
  previous_period: "2026-04",
  previous_total_ads: 31,
  previous_avg_median_price: 2812,
  previous_active_h3_cells: 11
};

const FALLBACK_MAP_DATA: MapDataPoint[] = [
  { h3_index: "872ce581cffffff", ad_count: 10, median_price_kvm: 3340, category: "Yeni tikili", rayon_name: "Nəsimi rayonu, Yasamal rayonu" },
  { h3_index: "872ce5819ffffff", ad_count: 5, median_price_kvm: 4045, category: "Köhnə tikili, Yeni tikili", rayon_name: "Nərimanov rayonu, Xətai rayonu" },
  { h3_index: "872ce581dffffff", ad_count: 5, median_price_kvm: 3109, category: "Yeni tikili", rayon_name: "Nərimanov rayonu, Nəsimi rayonu" },
  { h3_index: "872ce5802ffffff", ad_count: 3, median_price_kvm: 2633, category: "Yeni tikili", rayon_name: "Yasamal rayonu" },
  { h3_index: "872ce580affffff", ad_count: 2, median_price_kvm: 3080, category: "Yeni tikili", rayon_name: "Nərimanov rayonu" },
  { h3_index: "872ce58e3ffffff", ad_count: 2, median_price_kvm: 2524, category: "Köhnə tikili", rayon_name: "Nizami rayonu, Xətai rayonu" },
  { h3_index: "872ce58e1ffffff", ad_count: 2, median_price_kvm: 1894, category: "Yeni tikili", rayon_name: "Nizami rayonu, Sabunçu rayonu" },
  { h3_index: "872ce58c4ffffff", ad_count: 1, median_price_kvm: 2697, category: "Yeni tikili", rayon_name: "Xətai rayonu" },
  { h3_index: "872ce58e2ffffff", ad_count: 1, median_price_kvm: 2471, category: "Köhnə tikili", rayon_name: "Xətai rayonu" },
  { h3_index: "872ce580effffff", ad_count: 1, median_price_kvm: 2611, category: "Yeni tikili", rayon_name: "Binəqədi rayonu" },
  { h3_index: "872ce58e5ffffff", ad_count: 1, median_price_kvm: 2609, category: "Yeni tikili", rayon_name: "Nizami rayonu" },
  { h3_index: "872ce580cffffff", ad_count: 1, median_price_kvm: 2350, category: "Yeni tikili", rayon_name: "Binəqədi rayonu" },
  { h3_index: "872ce5803ffffff", ad_count: 1, median_price_kvm: 2950, category: "Yeni tikili", rayon_name: "Nəsimi rayonu" }
];

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
  return FALLBACK_FILTERS;
}

export async function fetchFallbackMetrics(): Promise<MetricsResponse> {
  return FALLBACK_METRICS;
}

export async function fetchFallbackMapData(): Promise<MapDataPoint[]> {
  return FALLBACK_MAP_DATA;
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
