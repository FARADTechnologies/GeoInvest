"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MapDataPoint } from "@/types/api";
import type { ColorMetric } from "@/components/map/deck-h3-map";

const DeckH3Map = dynamic(
  () => import("@/components/map/deck-h3-map").then((module) => module.DeckH3Map),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[500px] w-full" />
  }
);

type ColorOption = { value: ColorMetric; label: string };

type Props = {
  data: MapDataPoint[];
  loading?: boolean;
  error?: boolean;
  t: Record<string, string>;
};

export function MapPanel({ data, loading, error, t }: Props) {
  const [colorMetric, setColorMetric] = useState<ColorMetric>("median_price_kvm");

  const COLOR_OPTIONS: ColorOption[] = [
    { value: "median_price_kvm", label: t.byPrice },
    { value: "ad_count",         label: t.byListings }
  ];

  return (
    <div className="relative h-full min-h-[500px] overflow-hidden rounded-lg">
      {/* top-left: cell count + loading */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <Badge className="bg-card/90 backdrop-blur">
          {data.length.toLocaleString()} cells
        </Badge>
        {loading ? (
          <Badge className="bg-card/90 backdrop-blur">Loading</Badge>
        ) : null}
      </div>

      {/* top-right: color-by toggle */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-card/90 p-1 backdrop-blur">
        <span className="px-1 text-[11px] text-muted-foreground">{t.colorBy}</span>
        {COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setColorMetric(opt.value)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              colorMetric === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* bottom-left: legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-md border bg-card/90 px-2.5 py-1.5 backdrop-blur">
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.low}
        </span>
        <div
          className="h-2 w-32 rounded-full"
          style={{
            background:
              "linear-gradient(to right, #fef3c7, #fcd34d, #f59e0b, #ea580c, #7c3aed, #5b21b6)"
          }}
        />
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.high}
        </span>
      </div>

      {error ? (
        <div className="flex h-full min-h-[500px] items-center justify-center text-sm text-muted-foreground">
          Map data unavailable
        </div>
      ) : (
        <DeckH3Map data={data} colorMetric={colorMetric} />
      )}
    </div>
  );
}
