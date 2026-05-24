"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { HistogramBucket } from "@/types/api";

type Props = {
  data: HistogramBucket[];
};

export function HistogramChart({ data }: Props) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--sh-2)"
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value: number) => [value.toLocaleString(), "İlan"]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.hot ? "var(--brand-600)" : "var(--brand-300)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
