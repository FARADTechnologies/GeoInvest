"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapDataPoint } from "@/types/api";

type Props = {
  data: MapDataPoint[];
  loading?: boolean;
};

function buildBuckets(data: MapDataPoint[]) {
  if (data.length === 0) {
    return [];
  }

  const prices = data.map((item) => item.median_price_kvm);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const bucketCount = 5;
  const width = Math.max((max - min) / bucketCount, 1);

  return Array.from({ length: bucketCount }, (_, index) => {
    const low = min + index * width;
    const high = index === bucketCount - 1 ? max : low + width;
    const ads = data
      .filter((item) =>
        index === bucketCount - 1
          ? item.median_price_kvm >= low && item.median_price_kvm <= high
          : item.median_price_kvm >= low && item.median_price_kvm < high
      )
      .reduce((sum, item) => sum + item.ad_count, 0);

    return {
      range: `${Math.round(low)}-${Math.round(high)}`,
      ads
    };
  });
}

export function PriceDistributionChart({ data, loading }: Props) {
  const buckets = buildBuckets(data);

  return (
    <Card className="min-h-[300px] xl:min-h-0">
      <CardHeader>
        <CardTitle>Price Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px] xl:h-[calc(100vh-410px)] xl:min-h-[280px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : buckets.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ left: -20, right: 4, top: 8, bottom: 8 }}>
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))"
                }}
              />
              <Bar dataKey="ads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
