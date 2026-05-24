// Query keys for the dashboard.
// Extends the existing query-keys.ts pattern. Merge with the existing file
// if it already exports `queryKeys` (just add the new entries).

import type { DashboardFilters } from "@/types/api";

export const queryKeys = {
  filters: ["filters"] as const,
  metrics: (filters: DashboardFilters, minAdsPerCell: number) =>
    ["metrics", filters, minAdsPerCell] as const,
  mapData: (filters: DashboardFilters, minAdsPerCell: number) =>
    ["map-data", filters, minAdsPerCell] as const,

  // Dashboard extensions (served from mock-data for now)
  rayons:        ["rayons"] as const,
  sparklines:    ["sparklines"] as const,
  histogram:     ["histogram"] as const,
  trendSeries:   ["trend-series"] as const,
  activity:      (lang: "tr" | "en") => ["activity", lang] as const
};
