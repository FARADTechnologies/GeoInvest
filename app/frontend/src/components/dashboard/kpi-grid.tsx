"use client";

import { Activity, Database, Hexagon, TrendingUp } from "lucide-react";

import { Sparkline } from "@/components/dashboard/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MetricsResponse, Sparklines } from "@/types/api";

type Props = {
  t: Record<string, string>;
  metrics: MetricsResponse | undefined;
  sparklines: Sparklines | undefined;
  loading?: boolean;
};

type Card = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  unit?: string;
  trend: number | null;  // null = no previous-period data to compare against
  data: number[];
};

const fmt = (n: number) => n.toLocaleString();

export function KpiGrid({ t, metrics, sparklines, loading }: Props) {
  if (loading || !metrics || !sparklines) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px]" />
        ))}
      </div>
    );
  }

  // Compute real % change from backend's previous-period absolute values.
  // Returns null when previous data is missing (no period to compare against).
  const delta = (curr: number, prev: number | null | undefined): number | null => {
    if (prev == null || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  const items: Card[] = [
    {
      label: t.kpiTotalAds,
      icon: Database,
      value: fmt(metrics.total_ads),
      trend: delta(metrics.total_ads, metrics.previous_total_ads),
      data: sparklines.total_ads
    },
    {
      label: t.kpiMedian,
      icon: TrendingUp,
      value: fmt(Math.round(metrics.avg_median_price)),
      unit: t.perM2,
      trend: delta(metrics.avg_median_price, metrics.previous_avg_median_price),
      data: sparklines.avg_median_price
    },
    {
      label: t.kpiTrend,
      icon: Activity,
      value: (metrics.trend_percentage > 0 ? "+" : "") + metrics.trend_percentage.toFixed(1),
      unit: "%",
      trend: metrics.trend_percentage,
      data: sparklines.trend_percentage
    },
    {
      label: t.kpiCells,
      icon: Hexagon,
      value: fmt(metrics.active_h3_cells),
      trend: delta(metrics.active_h3_cells, metrics.previous_active_h3_cells),
      data: sparklines.active_h3_cells
    }
  ];

  const source: "db" | "mock" = metrics._source === "db" ? "db" : "mock";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((k, i) => {
        const Icon = k.icon;
        const hasTrend = k.trend !== null;
        const dir = !hasTrend
          ? "flat"
          : k.trend! > 0.5
          ? "up"
          : k.trend! < -0.5
          ? "down"
          : "flat";
        const trendColor =
          dir === "up"
            ? "text-emerald-500"
            : dir === "down"
            ? "text-red-500"
            : "text-muted-foreground";
        const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";

        return (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {k.label}
              {i === 0 ? (
                <span
                  className={cn(
                    "ml-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide",
                    source === "db"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                      : "border-red-500/40 bg-red-500/15 text-red-600"
                  )}
                  title={source === "db" ? "Canlı veritabanı" : "Mock (DB bağlı değil)"}
                >
                  {source === "db" ? "DB" : "MOCK"}
                </span>
              ) : null}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-semibold tracking-tight text-foreground tabular-nums">
                  {k.value}
                </span>
                {k.unit ? (
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {k.unit}
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[12px] font-semibold tabular-nums",
                  trendColor
                )}
              >
                {hasTrend ? `${arrow} ${Math.abs(k.trend!).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="h-9">
              <Sparkline data={k.data} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
