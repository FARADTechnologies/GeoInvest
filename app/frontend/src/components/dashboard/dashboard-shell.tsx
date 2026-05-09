"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, RefreshCcw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchFilters, fetchMapData, fetchMetrics } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardFilters, FiltersResponse } from "@/types/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltersSidebar } from "@/components/dashboard/filters-sidebar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PriceDistributionChart } from "@/components/dashboard/price-distribution-chart";
import { MapPanel } from "@/components/map/map-panel";

function createDefaultFilters(catalog: FiltersResponse): DashboardFilters | null {
  if (
    catalog.periods.length === 0 ||
    catalog.categories.length === 0 ||
    catalog.resolutions.length === 0 ||
    catalog.analysis_types.length === 0
  ) {
    return null;
  }

  return {
    period: catalog.periods[0],
    categories: catalog.categories,
    resolution: catalog.resolutions.includes(7) ? 7 : catalog.resolutions[0],
    analysis_type: catalog.analysis_types.includes("geom")
      ? "geom"
      : catalog.analysis_types[0]
  };
}

export function DashboardShell() {
  const [filters, setFilters] = useState<DashboardFilters | null>(null);
  const [minAdsThreshold, setMinAdsThreshold] = useState(0);

  const filtersQuery = useQuery({
    queryKey: queryKeys.filters,
    queryFn: fetchFilters
  });

  useEffect(() => {
    if (filtersQuery.data && filters === null) {
      setFilters(createDefaultFilters(filtersQuery.data));
    }
  }, [filters, filtersQuery.data]);

  const metricsQuery = useQuery({
    queryKey: filters ? queryKeys.metrics(filters, minAdsThreshold) : ["metrics", "empty"],
    queryFn: () => fetchMetrics(filters as DashboardFilters, minAdsThreshold),
    enabled: filters !== null
  });

  const mapQuery = useQuery({
    queryKey: filters ? queryKeys.mapData(filters, minAdsThreshold) : ["map-data", "empty"],
    queryFn: () => fetchMapData(filters as DashboardFilters, minAdsThreshold),
    enabled: filters !== null
  });

  const hasCatalog = Boolean(filtersQuery.data && filters);
  const isLoading = filtersQuery.isLoading || !hasCatalog;

  const refresh = () => {
    void metricsQuery.refetch();
    void mapQuery.refetch();
  };

  const mapData = useMemo(() => mapQuery.data ?? [], [mapQuery.data]);
  const metricData = metricsQuery.data;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="border-b bg-card/70 lg:border-b-0 lg:border-r">
          {filtersQuery.data && filters ? (
            <FiltersSidebar
              catalog={filtersQuery.data}
              value={filters}
              onChange={setFilters}
              disabled={metricsQuery.isFetching || mapQuery.isFetching}
              minAdsThreshold={minAdsThreshold}
              onMinAdsThresholdChange={setMinAdsThreshold}
            />
          ) : (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h1 className="text-xl font-semibold tracking-normal md:text-2xl">
                Analytics
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                H3 hexagonal real estate intelligence · Baku
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={!filters || metricsQuery.isFetching || mapQuery.isFetching}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {filtersQuery.error ? (
              <Alert>Unable to load filter catalog from the API.</Alert>
            ) : null}

            {metricsQuery.error ? (
              <Alert>Unable to load metrics for the selected filters.</Alert>
            ) : null}

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Total Ads"
                  value={metricData?.total_ads ?? 0}
                  icon={Database}
                  loading={metricsQuery.isFetching}
                />
                <MetricCard
                  title="Median Price"
                  value={metricData?.avg_median_price ?? 0}
                  suffix="AZN/m2"
                  icon={TrendingUp}
                  loading={metricsQuery.isFetching}
                />
                <MetricCard
                  title="Trend"
                  value={metricData?.trend_percentage ?? 0}
                  suffix="%"
                  icon={Activity}
                  loading={metricsQuery.isFetching}
                  signed
                />
                <MetricCard
                  title="Active H3 Cells"
                  value={metricData?.active_h3_cells ?? 0}
                  icon={Activity}
                  loading={metricsQuery.isFetching}
                />
              </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <MapPanel
                data={mapData}
                loading={mapQuery.isFetching}
                error={Boolean(mapQuery.error)}
              />
              <PriceDistributionChart data={mapData} loading={mapQuery.isFetching} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
