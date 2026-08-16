"use client";

import { useMemo } from "react";

type Props = {
  data: number[];
  height?: number;
  className?: string;
};

/**
 * Compact inline sparkline. Single path + gradient fill.
 * Uses currentColor so the parent controls the stroke color.
 */
export function Sparkline({ data, height = 36, className }: Props) {
  const { path, area } = useMemo(() => {
    if (data.length < 2) return { path: "", area: "" };
    const w = 100;
    const h = height;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return [x, y] as const;
    });

    const path = points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");

    const area = `${path} L ${w} ${h} L 0 ${h} Z`;
    return { path, area };
  }, [data, height]);

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height, display: "block", color: "var(--brand-600)" }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
