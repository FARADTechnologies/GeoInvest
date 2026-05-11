"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MapDataPoint } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  data: MapDataPoint[];
  loading?: boolean;
};

const P_LOW = 1;   // statik alt percentile
const P_HIGH = 99; // statik üst percentile

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildBuckets(prices: number[], min: number, max: number) {
  if (prices.length === 0) return [];
  const bucketCount = 8;
  const width = Math.max((max - min) / bucketCount, 1);

  return Array.from({ length: bucketCount }, (_, i) => {
    const low = min + i * width;
    const high = i === bucketCount - 1 ? max : low + width;
    const count = prices.filter((p) =>
      i === bucketCount - 1 ? p >= low && p <= high : p >= low && p < high
    ).length;
    return {
      range: `${Math.round(low)}-${Math.round(high)}`,
      hexagons: count
    };
  });
}

export function PricePercentileChart({ data, loading }: Props) {
  const { buckets, pMin, pMax, included } = useMemo(() => {
    if (data.length === 0) return { buckets: [], pMin: 0, pMax: 0, included: 0 };

    const sorted = data.map((d) => d.median_price_kvm).sort((a, b) => a - b);
    const pMin = computePercentile(sorted, P_LOW);
    const pMax = computePercentile(sorted, P_HIGH);
    const filtered = sorted.filter((p) => p >= pMin && p <= pMax);

    return {
      buckets: buildBuckets(filtered, pMin, pMax),
      pMin,
      pMax,
      included: filtered.length
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Price Analysis</CardTitle>
          <span className="text-xs text-muted-foreground">
            P{P_LOW}–P{P_HIGH} · {included} hex
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round(pMin).toLocaleString()} – {Math.round(pMax).toLocaleString()} AZN/m²
        </p>
      </CardHeader>

      <CardContent className="h-[200px] pt-0">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : buckets.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ left: -20, right: 4, top: 4, bottom: 32 }}>
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                interval={0}
                angle={-35}
                textAnchor="end"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))"
                }}
                formatter={(val: number) => [`${val} hex`, "Hexagons"]}
              />
              <Bar
                dataKey="hexagons"
                fill="hsl(var(--primary) / 0.75)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
