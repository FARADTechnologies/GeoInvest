"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { TrendSeries } from "@/types/api";

type Props = {
  series: TrendSeries[];
  labels: string[];
};

const COLORS = [
  "var(--brand-600)",
  "var(--brand-400)",
  "#f59e0b",
  "#10b981",
  "#ef4444"
];

export function TrendChart({ series, labels }: Props) {
  // Recharts wants row-shaped data: [{ month, "Nəsimi": 3450, "Səbail": 3820, ... }]
  const data = labels.map((month, i) => {
    const row: Record<string, string | number> = { month };
    for (const s of series) row[s.label] = s.data[i];
    return row;
  });

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="month"
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
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--sh-2)"
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          {series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend (custom, compact) */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {series.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-3 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
