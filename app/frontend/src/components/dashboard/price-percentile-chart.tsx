"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MapDataPoint } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";

type Props = {
  data: MapDataPoint[];
  loading?: boolean;
};

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
      i === bucketCount - 1
        ? p >= low && p <= high
        : p >= low && p < high
    ).length;
    return {
      range: `${Math.round(low)}-${Math.round(high)}`,
      hexagons: count
    };
  });
}

export function PricePercentileChart({ data, loading }: Props) {
  const [range, setRange] = useState([1, 99]);

  const { pMin, pMax, buckets, included } = useMemo(() => {
    if (data.length === 0) return { pMin: 0, pMax: 0, buckets: [], included: 0 };

    const sorted = data.map((d) => d.median_price_kvm).sort((a, b) => a - b);
    const pMin = computePercentile(sorted, range[0]);
    const pMax = computePercentile(sorted, range[1]);
    const filtered = sorted.filter((p) => p >= pMin && p <= pMax);

    return {
      pMin,
      pMax,
      buckets: buildBuckets(filtered, pMin, pMax),
      included: filtered.length
    };
  }, [data, range]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Price Analysis</CardTitle>

        <div className="mt-2 space-y-3">
          <Slider
            value={range}
            min={0}
            max={100}
            step={1}
            onValueChange={(val) => {
              if (val[0] < val[1]) setRange(val);
            }}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">
              P{range[0]} · {Math.round(pMin).toLocaleString()} AZN/m²
            </span>
            <span className="text-[10px]">{included} hex</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">
              P{range[1]} · {Math.round(pMax).toLocaleString()} AZN/m²
            </span>
          </div>
        </div>
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
