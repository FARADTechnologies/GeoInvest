"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { FiltersPanel } from "@/components/dashboard/filters-panel";
import { HistogramChart } from "@/components/dashboard/histogram-chart";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { NavSidebar, type DashboardView } from "@/components/dashboard/nav-sidebar";
import { RayonList } from "@/components/dashboard/rayon-list";
import { TopBar } from "@/components/dashboard/top-bar";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { MapPanel } from "@/components/map/map-panel";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { B2CView, ListingsViewV3, RayonsViewV3 } from "@/components/dashboard/v3-views";
import { AdminView } from "@/components/dashboard/admin-view";

import { fetchFilters, fetchMapData, fetchMetrics } from "@/lib/api";
import {
  fetchActivity,
  fetchB2C,
  fetchHistogram,
  fetchListings,
  fetchRayons,
  fetchRayonStats,
  fetchSparklines,
  fetchTrendSeries
} from "@/lib/dashboard-api";
import { MONTH_LABELS_EN, MONTH_LABELS_TR } from "@/lib/mock-data";
import { useStrings, type Lang } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
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

// ──────────────────────────────────────────────────────────────────────
// DashboardShell
// Layout: [nav | filters] | [topbar / KPI / map+rayons / charts / activity]
// All data is wired through TanStack Query. Backend-served queries drive
// filters, metrics, map data, sparklines, and trend series; remaining
// dashboard-only panels fall back to mock data until dedicated endpoints exist.
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
  const [minAdsThreshold, setMinAdsThreshold] = useState(0);
  const [colorBy, setColorBy] = useState<"price" | "listings">("price");
  const [activeView, setActiveView] = useState<DashboardView>("overview");

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

  // ── Dashboard extension queries ──────────────────────────────────
  const rayonsQuery = useQuery({ queryKey: queryKeys.rayons, queryFn: fetchRayons });
  const sparklinesQuery = useQuery({
    queryKey: queryKeys.sparklines(filters, minAdsThreshold),
    queryFn: () => fetchSparklines(filters ?? undefined, minAdsThreshold),
    enabled: filters !== null,
    placeholderData: keepPreviousData
  });
  const histogramQuery = useQuery({ queryKey: queryKeys.histogram, queryFn: fetchHistogram });
  const trendSeriesQuery = useQuery({
    queryKey: queryKeys.trendSeries(filters),
    queryFn: () => fetchTrendSeries(filters ?? undefined),
    enabled: filters !== null,
    placeholderData: keepPreviousData
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activity(lang),
    queryFn: () => fetchActivity(lang)
  });

  // ── v3 views (Rayons / Listings / B2C) — mock-fed ──────────────────
  const listingsQuery = useQuery({ queryKey: ["v3", "listings"], queryFn: fetchListings });
  const rayonStatsQuery = useQuery({ queryKey: ["v3", "rayon-stats"], queryFn: fetchRayonStats });
  const b2cQuery = useQuery({ queryKey: ["v3", "b2c"], queryFn: fetchB2C });

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

  const monthLabels = lang === "en" ? MONTH_LABELS_EN : MONTH_LABELS_TR;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Left rail: nav + filters */}
        <aside className="border-b bg-card/40 lg:border-b-0 lg:border-r">
          <NavSidebar t={t} activeView={activeView} onViewChange={setActiveView} />
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

            {activeView === "overview" ? (
              <OverviewView
                t={t}
                metrics={metricsQuery.data}
                sparklines={sparklinesQuery.data}
                metricsLoading={isLoading || metricsQuery.isLoading}
                mapData={mapData}
                mapLoading={mapQuery.isFetching}
                mapError={Boolean(mapQuery.error)}
                rayons={rayonsQuery.data}
                trendSeries={trendSeriesQuery.data}
                histogram={histogramQuery.data}
                activity={activityQuery.data}
                monthLabels={monthLabels}
              />
            ) : null}

            {activeView === "map" ? (
              <MapView
                t={t}
                metrics={metricsQuery.data}
                sparklines={sparklinesQuery.data}
                metricsLoading={isLoading || metricsQuery.isLoading}
                mapData={mapData}
                mapLoading={mapQuery.isFetching}
                mapError={Boolean(mapQuery.error)}
                rayons={rayonsQuery.data}
                histogram={histogramQuery.data}
              />
            ) : null}

            {activeView === "rayons" ? (
              <RayonsViewV3
                t={t}
                rayons={rayonStatsQuery.data ?? []}
                listings={listingsQuery.data ?? []}
              />
            ) : null}
            {activeView === "trends" ? (
              <TrendsView t={t} trendSeries={trendSeriesQuery.data ?? []} labels={monthLabels} />
            ) : null}
            {activeView === "listings" ? (
              <ListingsViewV3
                t={t}
                listings={listingsQuery.data ?? []}
                rayons={rayonStatsQuery.data ?? []}
              />
            ) : null}
            {activeView === "b2c" ? (
              b2cQuery.data ? (
                <B2CView
                  t={t}
                  b2c={b2cQuery.data}
                  rayons={rayonStatsQuery.data ?? []}
                  listingsCount={listingsQuery.data?.length ?? 0}
                />
              ) : (
                <Skeleton className="h-96 w-full" />
              )
            ) : null}
            {activeView === "reports" ? <ReportsView t={t} /> : null}
            {activeView === "alerts" ? <AlertsView t={t} /> : null}
            {activeView === "admin" ? <AdminView t={t} /> : null}
            {activeView === "settings" || activeView === "account" ? (
              <PlaceholderView
                title={activeView === "settings" ? t.navSettings : t.navAccount}
                subtitle="Profile, permissions, billing, and workspace controls."
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewView({
  t,
  metrics,
  sparklines,
  metricsLoading,
  mapData,
  mapLoading,
  mapError,
  rayons,
  trendSeries,
  histogram,
  activity,
  monthLabels
}: {
  t: Record<string, string>;
  metrics?: MetricsResponse;
  sparklines?: Sparklines;
  metricsLoading: boolean;
  mapData: MapDataPoint[];
  mapLoading: boolean;
  mapError: boolean;
  rayons?: Rayon[];
  trendSeries?: TrendSeries[];
  histogram?: HistogramBucket[];
  activity?: ActivityItem[];
  monthLabels: string[];
}) {
  return (
    <>
      <KpiGrid t={t} metrics={metrics} sparklines={sparklines} loading={metricsLoading} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <DashboardCard title={t.secMap} subtitle={t.secMapSub} bodyClassName="p-0" className="min-h-[520px]">
          <MapPanel data={mapData} loading={mapLoading} error={mapError} t={t} />
        </DashboardCard>
        <DashboardCard
          title={t.secRayons}
          subtitle={t.secRayonsSub}
          action={<button className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--brand-600)]">{t.viewAll}<ArrowRight className="h-3 w-3" /></button>}
        >
          {rayons ? <RayonList t={t} rayons={rayons} /> : <Skeleton className="h-64 w-full" />}
        </DashboardCard>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DashboardCard title={t.secTrend} subtitle={t.secTrendSub}>
          {trendSeries ? <TrendChart series={trendSeries} labels={monthLabels} /> : <Skeleton className="h-[260px] w-full" />}
        </DashboardCard>
        <DashboardCard title={t.secHisto} subtitle={t.secHistoSub}>
          {histogram ? <HistogramChart data={histogram} /> : <Skeleton className="h-[260px] w-full" />}
        </DashboardCard>
      </div>
      <DashboardCard title={t.secActivity} subtitle={t.secActivitySub}>
        {activity ? <ActivityFeed activity={activity} /> : <Skeleton className="h-48 w-full" />}
      </DashboardCard>
    </>
  );
}

function MapView(props: {
  t: Record<string, string>;
  metrics?: MetricsResponse;
  sparklines?: Sparklines;
  metricsLoading: boolean;
  mapData: MapDataPoint[];
  mapLoading: boolean;
  mapError: boolean;
  rayons?: Rayon[];
  histogram?: HistogramBucket[];
}) {
  return (
    <>
      <KpiGrid t={props.t} metrics={props.metrics} sparklines={props.sparklines} loading={props.metricsLoading} />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_420px]">
        <DashboardCard title={props.t.secMap} subtitle={props.t.secMapSub} bodyClassName="p-0" className="min-h-[680px]">
          <MapPanel data={props.mapData} loading={props.mapLoading} error={props.mapError} t={props.t} />
        </DashboardCard>
        <div className="grid gap-4">
          <DashboardCard title={props.t.secRayons} subtitle={props.t.secRayonsSub}>
            {props.rayons ? <RayonList t={props.t} rayons={props.rayons.slice(0, 6)} /> : <Skeleton className="h-64 w-full" />}
          </DashboardCard>
          <DashboardCard title={props.t.secHisto} subtitle={props.t.secHistoSub}>
            {props.histogram ? <HistogramChart data={props.histogram} /> : <Skeleton className="h-[220px] w-full" />}
          </DashboardCard>
        </div>
      </div>
    </>
  );
}

function TrendsView({ t, trendSeries, labels }: { t: Record<string, string>; trendSeries: TrendSeries[]; labels: string[] }) {
  return (
    <DashboardCard title={t.secTrend} subtitle={t.secTrendSub}>
      <TrendChart series={trendSeries} labels={labels} />
    </DashboardCard>
  );
}

function ReportsView({ t }: { t: Record<string, string> }) {
  return <ActionCards title={t.navReports} items={["Market pulse export", "Scheduled board report", "PDF investor pack"]} />;
}

function AlertsView({ t }: { t: Record<string, string> }) {
  return <ActionCards title={t.navAlerts} items={["Sabail median +5%", "Low inventory in Xetai", "New hot H3 cells"]} />;
}

function ActionCards({ title, items }: { title: string; items: string[] }) {
  return (
    <DashboardCard title={title} subtitle="Operational controls are ready for backend wiring.">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-lg border bg-background p-4">
            <div className="text-sm font-semibold">{item}</div>
            <div className="mt-2 text-xs text-muted-foreground">Configured as a functional placeholder.</div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function PlaceholderView({ title, subtitle }: { title: string; subtitle: string }) {
  return <DashboardCard title={title} subtitle={subtitle}><div className="text-sm text-muted-foreground">Workspace controls are grouped here for the next backend pass.</div></DashboardCard>;
}

function DataTable({
  headers,
  rows,
  actionLabel,
  renderActions
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  actionLabel?: string;
  renderActions?: (index: number) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => <th key={h} className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>)}
            {renderActions || actionLabel ? <th className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {row.map((cell, j) => <td key={`${i}-${j}`} className="border-b px-3 py-2">{cell}</td>)}
              {renderActions || actionLabel ? (
                <td className="border-b px-3 py-2">
                  {renderActions ? renderActions(i) : <button className="rounded-md border px-2 py-1 text-xs">{actionLabel}</button>}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
