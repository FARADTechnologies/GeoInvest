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

  // Dashboard extensions (fallback to mock-data when live endpoints are absent)
  rayons: ["rayons"] as const,
  sparklines: (filters: DashboardFilters | null, minAdsPerCell: number) =>
    ["sparklines", filters, minAdsPerCell] as const,
  histogram:     ["histogram"] as const,
  trendSeries: (filters: DashboardFilters | null) => ["trend-series", filters] as const,
  activity:      (lang: "tr" | "en" | "az") => ["activity", lang] as const
};
