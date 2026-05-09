"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapDataPoint } from "@/types/api";
import type { ColorMetric } from "@/components/map/deck-h3-map";

const DeckH3Map = dynamic(
  () => import("@/components/map/deck-h3-map").then((module) => module.DeckH3Map),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[560px] w-full" />
  }
);

const COLOR_OPTIONS: { value: ColorMetric; label: string }[] = [
  { value: "median_price_kvm", label: "Median Price" },
  { value: "ad_count",         label: "Ad Count" },
];

type Props = {
  data: MapDataPoint[];
  loading?: boolean;
  error?: boolean;
};

export function MapPanel({ data, loading, error }: Props) {
  const [colorMetric, setColorMetric] = useState<ColorMetric>("median_price_kvm");

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-lg border bg-card">
      {/* top-left: cell count + loading */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <Badge className="bg-card/90 backdrop-blur">{data.length} cells</Badge>
        {loading ? <Badge className="bg-card/90 backdrop-blur">Loading</Badge> : null}
      </div>

      {/* top-right: color-by toggle */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-white/10 bg-card/90 p-1 backdrop-blur">
        <span className="px-1 text-[11px] text-muted-foreground">Color by</span>
        {COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setColorMetric(opt.value)}
            className={[
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              colorMetric === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-muted-foreground">
          Map data unavailable
        </div>
      ) : (
        <DeckH3Map data={data} colorMetric={colorMetric} />
      )}
    </div>
  );
}
