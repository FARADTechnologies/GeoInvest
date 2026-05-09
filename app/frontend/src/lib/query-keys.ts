import type { DashboardFilters } from "@/types/api";

export const queryKeys = {
  filters: ["filters"] as const,
  metrics: (filters: DashboardFilters, minAdsPerCell: number) =>
    ["metrics", filters, minAdsPerCell] as const,
  mapData: (filters: DashboardFilters, minAdsPerCell: number) =>
    ["map-data", filters, minAdsPerCell] as const
};
