"use client";

// Shared UI primitives + hand-built SVG charts, ported 1:1 from the team's
// Homora B2B prototype. Rendered inside a `.hm-val` wrapper so the scoped
// design tokens (valuation-orange.css) resolve.

import type { ReactNode } from "react";

import { Icons } from "@/components/dashboard/valuation/valuation-icons";
import { fmtMoney } from "@/lib/valuation-data";

export { fmtMoney };
export const fmtNumber = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("az-AZ").format(Math.round(n));
export const fmtPercent = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1) + "%");

// A genTrend()/monthsLabels() pair used to live here — a seeded random walk
// that manufactured a 12-month curve around any single number, plus the month
// labels to put under it. Every chart it fed has been either wired to a real
// series or removed, so it is gone.

// ── Pills / badges ────────────────────────────────────────────────────

export const Pill = ({ tone = "gray", children, dot = false }: { tone?: string; children: ReactNode; dot?: boolean }) => (
  <span className={`pill pill-${tone}`}>
    {dot && <span className="pill-dot" />}
    {children}
  </span>
);

export const TypePill = ({ type }: { type: string }) => (
  <Pill tone={(type || "").toLowerCase().includes("yeni") ? "teal" : "navy"}>{type}</Pill>
);


export const Delta = ({ value, suffix = "%", invert = false }: { value: number | null; suffix?: string; invert?: boolean }) => {
  if (value == null || isNaN(value)) return <span className="stat-delta flat">—</span>;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const tone = invert ? (direction === "up" ? "down" : direction === "down" ? "up" : "flat") : direction;
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "–";
  return (
    <span className={`stat-delta ${tone}`}>
      {arrow} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
};

export const InfoCell = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="info-cell">
    <div className="k">{k}</div>
    <div className="v">{children}</div>
  </div>
);

// Source badge (DB vs MOCK) — keeps the dashboard's data-provenance convention.
export const SourceBadge = ({ source }: { source: "db" | "mock" }) => (
  <Pill tone={source === "db" ? "green" : "amber"} dot>
    {source === "db" ? "DB" : "MOCK"}
  </Pill>
);

// ── Modal ─────────────────────────────────────────────────────────────

export const Modal = ({
  open,
  onClose,
  children,
  maxWidth = 1080
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

// ── Charts ────────────────────────────────────────────────────────────

export function DonutChart({
  value,
  max = 100,
  size = 84,
  label = "",
  suffix = "%",
  color = "#2A8B7E"
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  /** Unit shown after the number. Pass "" for a bare count. */
  suffix?: string;
  color?: string;
}) {
  // This used to pick its colour from the investment score's risk bands
  // (>=78 green, >=60 amber, else red) and, worse, derive the halo from those
  // same thresholds even when a caller passed an explicit colour. Both of the
  // remaining callers show a share of the market, where "38" is neither good
  // nor bad — yet it was being drawn with a red halo. The ring is now one
  // colour, given by the caller, and the track is neutral.
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const stroke = Math.max(6, Math.round(size / 11));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const mid = size / 2;

  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
      role="img"
      aria-label={`${label ? label + ": " : ""}${value}${suffix}`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ display: "block", transform: "rotate(-90deg)" }}
      >
        <circle cx={mid} cy={mid} r={r} fill={color} fillOpacity={0.07} stroke="none" />
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          lineHeight: 1.05
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: Math.round(size / 3.6),
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {Math.round(value)}
            {suffix && (
              <span style={{ fontSize: Math.round(size / 7), fontWeight: 600, color: "var(--text-3)" }}>
                {suffix}
              </span>
            )}
          </div>
          {label && (
            <div
              style={{
                fontSize: Math.max(8.5, Math.round(size / 10)),
                color: "var(--text-3)",
                fontWeight: 600,
                marginTop: 3,
                maxWidth: size - stroke * 2.6,
                marginInline: "auto",
                lineHeight: 1.2
              }}
            >
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LineChart({
  data = [],
  labels = [],
  width = 720,
  height = 220,
  color = "#2A8B7E",
  yPad = 0.12
}: {
  data?: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  yPad?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data) * (1 - yPad);
  const max = Math.max(...data) * (1 + yPad);
  const range = max - min || 1;
  const padL = 56,
    padR = 12,
    padT = 18,
    padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const x = (i: number) => padL + (i * innerW) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH;
  const points = data.map((v, i) => [x(i), y(v)]);
  let path = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  const fillPath = path + ` L ${x(data.length - 1)},${padT + innerH} L ${x(0)},${padT + innerH} Z`;
  const ticks = [min, (min + max) / 2, max];
  const fmtTick = (v: number) => (v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v).toString());
  const id = `lg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={width - padR} y2={y(t)} stroke="var(--border)" strokeDasharray="3 3" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-3)" fontFamily="Manrope">
            {fmtTick(t)}
          </text>
        </g>
      ))}
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="4" fill={color} stroke="white" strokeWidth="1.5" />
      {labels.map((l, i) =>
        i % 2 === 0 ? (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-3)" fontFamily="Manrope">
            {l}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function HBars({
  items,
  max,
  color = "#D9531E",
  valueFmt = (v: number) => String(v)
}: {
  items: { label: string; value: number; color?: string }[];
  max?: number;
  color?: string;
  valueFmt?: (v: number) => string;
}) {
  const m = max ?? Math.max(...items.map((x) => x.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} className="fl-row" style={{ gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {it.label}
          </div>
          <div style={{ flex: 1, height: 10, borderRadius: 99, background: "var(--bg-subtle)", overflow: "hidden" }}>
            <div style={{ width: `${(it.value / m) * 100}%`, height: "100%", background: it.color || color, borderRadius: 99 }} />
          </div>
          <div style={{ width: 60, fontSize: 12, color: "var(--text-1)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {valueFmt(it.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export { Icons };
