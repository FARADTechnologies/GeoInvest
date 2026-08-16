"use client";

import { cn } from "@/lib/utils";
import type { Rayon } from "@/types/api";

type Props = {
  t: Record<string, string>;
  rayons: Rayon[];
  limit?: number;
};

export function RayonList({ t, rayons, limit = 8 }: Props) {
  const top = rayons.slice(0, limit);
  const maxListings = Math.max(...top.map((r) => r.listings), 1);

  return (
    <div className="-mx-2 flex flex-col">
      {top.map((r, i) => {
        const dir = r.trend > 0.5 ? "up" : r.trend < -0.5 ? "down" : "flat";
        const trendColor =
          dir === "up"
            ? "text-emerald-500"
            : dir === "down"
            ? "text-red-500"
            : "text-muted-foreground";
        const intensity = Math.max(0.3, Math.min(1, r.listings / maxListings));

        return (
          <div
            key={r.name}
            className={cn(
              "group grid grid-cols-[28px_1fr_auto_4px] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
            )}
          >
            <span className="text-center text-[12px] font-semibold tabular-nums text-muted-foreground">
              {i + 1}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {r.short}
                </span>
                {r.hot ? (
                  <span className="rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-700)]">
                    {t.hot}
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {r.listings.toLocaleString()} {t.listings.toLowerCase()}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[13px] font-semibold tabular-nums text-foreground">
                {r.median.toLocaleString()}
                <small className="ml-0.5 text-[10px] font-medium text-muted-foreground">
                  {t.perM2}
                </small>
              </div>
              <div className={cn("text-[11px] font-semibold tabular-nums", trendColor)}>
                {r.trend > 0 ? "+" : ""}
                {r.trend.toFixed(1)}%
              </div>
            </div>

            <div
              className="h-8 w-1 rounded-full"
              style={{
                background: r.hot ? "var(--brand-600)" : "var(--ink-300)",
                opacity: intensity
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
