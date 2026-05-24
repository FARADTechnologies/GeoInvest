// Cosmetic extension to the existing api.ts.
// Keeps the existing fetchFilters / fetchMetrics / fetchMapData unchanged
// (they live in api.ts) and adds dashboard-only fetchers that proxy to
// lib/mock-data.ts.
//
// When the backend grows endpoints for these shapes, change the body of
// each fetcher to a real fetch — components don't need to change.

import type {
  ActivityItem,
  HistogramBucket,
  Rayon,
  Sparklines,
  TrendSeries
} from "@/types/api";
import {
  fetchActivity as mockActivity,
  fetchHistogram as mockHistogram,
  fetchRayons as mockRayons,
  fetchSparklines as mockSparklines,
  fetchTrendSeries as mockTrendSeries
} from "@/lib/mock-data";

export function fetchRayons(): Promise<Rayon[]> {
  return mockRayons();
}

export function fetchSparklines(): Promise<Sparklines> {
  return mockSparklines();
}

export function fetchHistogram(): Promise<HistogramBucket[]> {
  return mockHistogram();
}

export function fetchTrendSeries(): Promise<TrendSeries[]> {
  return mockTrendSeries();
}

export function fetchActivity(lang: "tr" | "en" = "tr"): Promise<ActivityItem[]> {
  return mockActivity(lang);
}
