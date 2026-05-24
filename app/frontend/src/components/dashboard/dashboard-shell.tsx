"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { FiltersPanel } from "@/components/dashboard/filters-panel";
import { HistogramChart } from "@/components/dashboard/histogram-chart";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { NavSidebar } from "@/components/dashboard/nav-sidebar";
import { RayonList } from "@/components/dashboard/rayon-list";
import { TopBar } from "@/components/dashboard/top-bar";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { MapPanel } from "@/components/map/map-panel";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { fetchFilters, fetchMapData, fetchMetrics } from "@/lib/api";
import {
  fetchActivity,
  fetchHistogram,
  fetchRayons,
  fetchSparklines,
  fetchTrendSeries
} from "@/lib/dashboard-api";
import { MONTH_LABELS_EN, MONTH_LABELS_TR } from "@/lib/mock-data";
import { useStrings, type Lang } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardFilters, FiltersResponse } from "@/types/api";

// ──────────────────────────────────────────────────────────────────────
// DashboardShell
// Layout: [nav | filters] | [topbar / KPI / map+rayons / charts / activity]
// All data is wired through TanStack Query. The 4 backend-served queries
// (filters / metrics / map-data) drive the core dashboard. The 5
// dashboard-only queries (rayons, sparklines, histogram, trend, activity)
// hit lib/dashboard-api.ts which is currently mock-backed — they switch
// to live fetches as the backend grows endpoints.
// ──────────────────────────────────────────────────────────────────────

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
  const [lang, setLang] = useState<Lang>("tr");
  const t = useStrings(lang);

  const [filters, setFilters] = useState<DashboardFilters | null>(null);
  const [minAdsThreshold, setMinAdsThreshold] = useState(2);
  const [colorBy, setColorBy] = useState<"price" | "listings">("price");

  // ── Backend-served queries ────────────────────────────────────────
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
    enabled: filters !== null,
    placeholderData: keepPreviousData
  });

  const mapQuery = useQuery({
    queryKey: filters ? queryKeys.mapData(filters, minAdsThreshold) : ["map-data", "empty"],
    queryFn: () => fetchMapData(filters as DashboardFilters, minAdsThreshold),
    enabled: filters !== null,
    placeholderData: keepPreviousData
  });

  // ── Dashboard-only queries (mock-backed) ──────────────────────────
  const rayonsQuery      = useQuery({ queryKey: queryKeys.rayons,      queryFn: fetchRayons });
  const sparklinesQuery  = useQuery({ queryKey: queryKeys.sparklines,  queryFn: fetchSparklines });
  const histogramQuery   = useQuery({ queryKey: queryKeys.histogram,   queryFn: fetchHistogram });
  const trendSeriesQuery = useQuery({ queryKey: queryKeys.trendSeries, queryFn: fetchTrendSeries });
  const activityQuery    = useQuery({
    queryKey: queryKeys.activity(lang),
    queryFn: () => fetchActivity(lang)
  });

  const hasCatalog = Boolean(filtersQuery.data && filters);
  const isLoading = filtersQuery.isLoading || !hasCatalog;

  const refresh = () => {
    void metricsQuery.refetch();
    void mapQuery.refetch();
    void rayonsQuery.refetch();
    void sparklinesQuery.refetch();
    void histogramQuery.refetch();
    void trendSeriesQuery.refetch();
    void activityQuery.refetch();
  };

  const mapData = useMemo(() => mapQuery.data ?? [], [mapQuery.data]);

  const monthLabels = lang === "tr" ? MONTH_LABELS_TR : MONTH_LABELS_EN;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Left rail: nav + filters */}
        <aside className="border-b bg-card/40 lg:border-b-0 lg:border-r">
          <NavSidebar t={t} />
          {filtersQuery.data && filters ? (
            <FiltersPanel
              catalog={filtersQuery.data}
              value={filters}
              onChange={setFilters}
              minAdsThreshold={minAdsThreshold}
              onMinAdsThresholdChange={setMinAdsThreshold}
              colorBy={colorBy}
              onColorByChange={setColorBy}
              disabled={metricsQuery.isFetching || mapQuery.isFetching}
              t={t}
            />
          ) : (
            <div className="space-y-3 p-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </aside>

        {/* Right: top bar + content */}
        <section className="flex min-w-0 flex-col">
          <TopBar
            t={t}
            lang={lang}
            onLangChange={setLang}
            analysisType={(filters?.analysis_type === "pure_h3" ? "pure_h3" : "geom") as "geom" | "pure_h3"}
            onAnalysisTypeChange={(v) =>
              filters && setFilters({ ...filters, analysis_type: v })
            }
            onRefresh={refresh}
            refreshing={metricsQuery.isFetching || mapQuery.isFetching}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            {filtersQuery.error ? (
              <Alert>Unable to load filter catalog from the API.</Alert>
            ) : null}
            {metricsQuery.error ? (
              <Alert>Unable to load metrics for the selected filters.</Alert>
            ) : null}

            {/* KPI strip */}
            <KpiGrid
              t={t}
              metrics={metricsQuery.data}
              sparklines={sparklinesQuery.data}
              loading={isLoading || metricsQuery.isLoading}
            />

            {/* Map + Rayon ranking */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <DashboardCard
                title={t.secMap}
                subtitle={t.secMapSub}
                bodyClassName="p-0"
                className="min-h-[520px]"
              >
                <MapPanel
                  data={mapData}
                  loading={mapQuery.isFetching}
                  error={Boolean(mapQuery.error)}
                  t={t}
                />
              </DashboardCard>

              <DashboardCard
                title={t.secRayons}
                subtitle={t.secRayonsSub}
                action={
                  <button className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--brand-600)] transition-colors hover:text-[var(--brand-700)]">
                    {t.viewAll}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                }
              >
                {rayonsQuery.data ? (
                  <RayonList t={t} rayons={rayonsQuery.data} />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </DashboardCard>
            </div>

            {/* Trend + Histogram */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <DashboardCard title={t.secTrend} subtitle={t.secTrendSub}>
                {trendSeriesQuery.data ? (
                  <TrendChart series={trendSeriesQuery.data} labels={monthLabels} />
                ) : (
                  <Skeleton className="h-[260px] w-full" />
                )}
              </DashboardCard>

              <DashboardCard title={t.secHisto} subtitle={t.secHistoSub}>
                {histogramQuery.data ? (
                  <HistogramChart data={histogramQuery.data} />
                ) : (
                  <Skeleton className="h-[260px] w-full" />
                )}
              </DashboardCard>
            </div>

            {/* Activity */}
            <DashboardCard
              title={t.secActivity}
              subtitle={t.secActivitySub}
              action={
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              }
            >
              {activityQuery.data ? (
                <ActivityFeed activity={activityQuery.data} />
              ) : (
                <Skeleton className="h-48 w-full" />
              )}
            </DashboardCard>
          </div>
        </section>
      </div>
    </main>
  );
}
