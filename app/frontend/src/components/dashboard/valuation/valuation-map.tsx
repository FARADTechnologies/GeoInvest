"use client";

// Analiz xəritəsi — port of the prototype's Xəritə page chrome (KPI row,
// toolbar, trend + distribution cards), with the synthetic hex canvas
// replaced by our real deck.gl map (MapPanel) fed from /map-data.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import "@/components/dashboard/valuation/valuation-orange.css";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import { Icons, LineChart, Pill, fmtMoney, fmtNumber } from "@/components/dashboard/valuation/valuation-ui";
import { MapPanel } from "@/components/map/map-panel";
import { fetchFilters, fetchMapData, fetchRayonPolygons } from "@/lib/api";
import { rayonForCell, setRayonBoundaries } from "@/lib/rayon-lookup";
import { fetchMarketTrends } from "@/lib/market-api";
import { formatMonth, formatMonthShort } from "@/lib/format-date";
import { useStrings, type Lang } from "@/lib/i18n";
import type { DashboardFilters } from "@/types/api";

// Fixed noise floor: H3 cells with fewer than this many listings are dropped
// from the map (team ask — a constant filter, not a slider).
const MIN_ADS_PER_CELL = 5;

const METRICS: Record<string, { label: string; short: string; fmt: (v: number) => string }> = {
  price: { label: "Qiymət (₼/m²)", short: "Qiymət/m²", fmt: (v) => fmtMoney(v, " ₼/m²") },
  listings: { label: "Elan sayı", short: "Elan", fmt: (v) => fmtNumber(v) }
};

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0;
};

function MapSelect({ value, onChange, options, minWidth = 150 }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; minWidth?: number }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 12px", background: "var(--card)", border: "1.5px solid var(--border-strong)", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-1)", minWidth, outline: "none" }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ToolField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      {children}
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ padding: "6px 13px", borderRadius: 6, border: "none", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: value === o.value ? "var(--card)" : "transparent", color: value === o.value ? "var(--text-1)" : "var(--text-3)", boxShadow: value === o.value ? "var(--shadow-sm)" : "none" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const HEAT_STOPS: [number, number[]][] = [[0, [42, 139, 126]], [0.4, [224, 179, 65]], [0.72, [217, 83, 30]], [1, [176, 32, 42]]];
function heatColor(t: number) {
  t = Math.max(0, Math.min(1, t));
  let a = HEAT_STOPS[0], b = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (t >= HEAT_STOPS[i][0] && t <= HEAT_STOPS[i + 1][0]) { a = HEAT_STOPS[i]; b = HEAT_STOPS[i + 1]; break; }
  }
  const k = (t - a[0]) / ((b[0] - a[0]) || 1);
  const rgb = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function ValuationMapView({ lang = "az" }: { lang?: Lang }) {
  setValLang(lang);
  const t = useStrings(lang);

  // Cell aggregation stays on H3 internally; the Geom/H3 switch was removed
  // from the UI (team request — no "H3" jargon shown to users).
  const [analysisType] = useState<"geom" | "pure_h3">("pure_h3");
  const [period, setPeriod] = useState<string | null>(null);
  const [res, setRes] = useState(7);
  const [metric, setMetric] = useState("price");
  const [agg, setAgg] = useState("mean");
  const [category, setCategory] = useState("all");

  // Rayon polygons for the hover card. The pure-hex aggregation has no rayon
  // to report, so the cell's own centre is matched against these instead.
  const boundariesQuery = useQuery({
    queryKey: ["rayon-polygons"],
    queryFn: fetchRayonPolygons,
    staleTime: Infinity
  });
  useEffect(() => {
    if (boundariesQuery.data?.features?.length) {
      setRayonBoundaries(boundariesQuery.data.features);
    }
  }, [boundariesQuery.data]);

  const filtersQuery = useQuery({ queryKey: ["filters"], queryFn: fetchFilters });
  const catalog = filtersQuery.data;
  const periods = catalog?.periods ?? [];
  // The newest period is often only partially populated in the snapshot (e.g.
  // 2026-05 collapses to ~1 cell), which makes the map look empty / "broken".
  // Default to the previous complete month so data shows immediately; the user
  // can still pick any period from the Dövr dropdown.
  const activePeriod = period ?? periods[1] ?? periods[0] ?? "2026-05";

  const cats = useMemo(() => {
    const all = catalog?.categories ?? ["Köhnə tikili", "Yeni tikili"];
    if (category === "new") return all.filter((c) => c.toLowerCase().includes("yeni"));
    if (category === "old") return all.filter((c) => !c.toLowerCase().includes("yeni"));
    return all;
  }, [catalog, category]);

  const filters: DashboardFilters = { period: activePeriod, categories: cats, resolution: res, analysis_type: analysisType };
  const mapQuery = useQuery({
    queryKey: ["val-map", activePeriod, category, res, analysisType],
    // Fixed noise filter: drop H3 cells with fewer than 5 listings (team ask).
    queryFn: () => fetchMapData(filters, MIN_ADS_PER_CELL),
    enabled: !!catalog,
    placeholderData: keepPreviousData
  });
  const data = mapQuery.data ?? [];

  const kpis = useMemo(() => {
    const prices = data.map((d) => d.median_price_kvm).filter((v) => v > 0);
    const counts = data.map((d) => d.ad_count);
    const a = agg === "median" ? median : mean;
    // Every pure-hex row is stamped "GLOBAL", which counted as one rayon for
    // the whole city. Fall back to the cell's own centre so the tile reports
    // how many rayons the visible cells actually cover.
    const rayons = new Set<string>();
    data.forEach((d) => {
      const name = d.rayon_name && d.rayon_name !== "GLOBAL" ? d.rayon_name : rayonForCell(d.h3_index);
      (name || "").split(", ").forEach((r) => r && rayons.add(r));
    });
    return {
      totalListings: counts.reduce((s, x) => s + x, 0),
      ppm: Math.round(a(prices)),
      cells: data.length,
      rayons: rayons.size
    };
  }, [data, agg, boundariesQuery.data]);

  const aggLabel = agg === "median" ? T(`Median`) : T(`Orta`);
  const meta = METRICS[metric];

  // Real monthly ₼/m² curve for Baku, split by build type so the Kateqoriya
  // selector applies. This card used to draw a seeded random walk around the
  // current KPI; there is no monthly series for "Elan sayı", so that metric
  // shows a gap rather than a fabricated one.
  const trendsQuery = useQuery({ queryKey: ["market", "trends"], queryFn: fetchMarketTrends });
  const trendPoints = useMemo(() => {
    if (metric !== "price") return [];
    const cat = category === "new" ? "new" : category === "old" ? "old" : "all";
    return (trendsQuery.data?.sale[cat] ?? []).slice(-12);
  }, [trendsQuery.data, metric, category]);
  const trendData = trendPoints.map((p) => p.value);
  const months = trendPoints.map((p) => formatMonthShort(p.date));

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        <div className="page-header">
          <div>
            <div className="crumbs"><span>{T(`Xəritə analizi`)}</span></div>
            <h1 className="page-title">{T(`Xəritə analizi`)} · Bakı</h1>
            <p className="page-sub">{T(`Əmlak istilik xəritəsi — hücrə başına göstəricilər və elan sıxlığı.`)}</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary" onClick={() => mapQuery.refetch()}><Icons.Refresh size={14} /> {T(`Yenilə`)}</button>
            <button className="btn btn-primary"><Icons.Download size={14} /> {T(`İxrac`)}</button>
          </div>
        </div>

        {/* KPI row (computed from the real map data) */}
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          <KStat accent label={T(`Toplam elan`)} value={fmtNumber(kpis.totalListings)} icon={<Icons.Layers size={16} />} />
          <KStat label={`${aggLabel} ${T(`Qiymət/m²`).toLowerCase()}`} value={fmtMoney(kpis.ppm, " ₼/m²")} icon={<Icons.Coin size={16} />} />
          <KStat label={T(`Aktiv hücrə`)} value={String(kpis.cells)} icon={<Icons.MapPin size={16} />} />
          <KStat label={T(`Rayon sayı`)} value={String(kpis.rayons)} icon={<Icons.Building size={16} />} />
        </div>

        {/* Toolbar */}
        <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
          <div className="fl-row" style={{ gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
            <ToolField label={T(`Dövr`)}>
              <MapSelect value={activePeriod} onChange={setPeriod} options={periods.map((p) => ({ value: p, label: formatMonth(p) }))} minWidth={130} />
            </ToolField>
            <ToolField label={T(`Kateqoriya`)}>
              <MapSelect value={category} onChange={setCategory} options={[{ value: "all", label: T(`Hamısı`) }, { value: "new", label: T(`Yeni tikili`) }, { value: "old", label: T(`Köhnə tikili`) }]} minWidth={150} />
            </ToolField>
            <ToolField label={T(`Göstərici`)}>
              <MapSelect value={metric} onChange={setMetric} options={Object.keys(METRICS).map((k) => ({ value: k, label: T(METRICS[k].label) }))} minWidth={170} />
            </ToolField>
            <ToolField label={T(`Mərkəz`)}>
              <MapSelect value={agg} onChange={setAgg} options={[{ value: "mean", label: T(`Orta`) }, { value: "median", label: T(`Median`) }]} minWidth={120} />
            </ToolField>
            <ToolField label={T(`Dəqiqlik`)}>
              <MapSelect value={String(res)} onChange={(v) => setRes(+v)} options={[{ value: "6", label: T(`Böyük`) }, { value: "7", label: T(`Orta`) }, { value: "8", label: T(`Kiçik`) }]} minWidth={130} />
            </ToolField>
            <div className="sp" />
            <div className="fl-row" style={{ gap: 8, alignItems: "center", color: "var(--text-3)", fontSize: 12, paddingBottom: 6 }}>
              <Icons.Info size={13} /> {T(`Hücrə üzərinə kursoru gətirin`)}
            </div>
          </div>
        </div>

        {/* Full-width REAL map (our deck.gl panel) */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <div className="card-title">{T(`Bakı İstilik Xəritəsi`)}</div>
              <div className="card-sub">{aggLabel} {T(meta.label).toLowerCase()} · {formatMonth(activePeriod)}</div>
            </div>
            <span className="sp" />
            <Pill tone="navy">{category === "all" ? T(`Bütün kateqoriyalar`) : category === "new" ? T(`Yeni tikili`) : T(`Köhnə tikili`)}</Pill>
          </div>
          <div style={{ height: 560 }}>
            <MapPanel data={data} loading={mapQuery.isFetching} error={Boolean(mapQuery.error)} t={t} metric={metric === "listings" ? "listings" : "price"} />
          </div>
        </div>

        {/* Bottom: trend + distribution */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-title">{T(`12 aylıq trend`)} · {T(`Qiymət/m²`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 10px" }}>
              {T(`Bakı üzrə median satış qiyməti`)} · {category === "new" ? T(`Yeni tikili`) : category === "old" ? T(`Köhnə tikili`) : T(`Hamısı`)}
            </div>
            {trendData.length >= 2 ? (
              <LineChart data={trendData} labels={months} height={220} color="#D9531E" />
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {metric === "listings"
                  ? T(`Elan sayı üçün aylıq seriya yoxdur.`)
                  : trendsQuery.isLoading
                    ? T(`Yüklənir…`)
                    : T(`Məlumat yoxdur.`)}
              </div>
            )}
          </div>
          <div className="card card-pad">
            <Distribution data={data} metric={metric} agg={agg} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KStat({ accent, label, value, icon }: { accent?: boolean; label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="fl-row" style={{ gap: 10 }}>
        {icon && <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--orange-tint)", color: "var(--orange)", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Distribution({ data, metric, agg }: { data: { median_price_kvm: number; ad_count: number }[]; metric: string; agg: string }) {
  const meta = METRICS[metric];
  const vals = data.map((d) => (metric === "price" ? d.median_price_kvm : d.ad_count)).filter((v) => v > 0);
  if (vals.length === 0) return <div className="card-sub">—</div>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const n = 8;
  const step = (max - min) / n || 1;
  const counts = new Array(n).fill(0);
  vals.forEach((v) => counts[Math.min(n - 1, Math.floor((v - min) / step))]++);
  const maxC = Math.max(...counts, 1);
  void agg;
  return (
    <>
      <div className="card-title">{T(meta.short)} {T(`paylanması`)}</div>
      <div className="card-sub" style={{ margin: "4px 0 16px" }}>{T(`Hücrələrin aralıq üzrə sayı`)}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180 }}>
        {counts.map((c, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>{c || ""}</div>
            <div style={{ width: "100%", height: `${(c / maxC) * 130}px`, minHeight: c ? 4 : 0, background: heatColor((i + 0.5) / n), borderRadius: "4px 4px 0 0" }} />
            <div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600 }}>
              {metric === "price" ? Math.round((min + step * i) / 100) / 10 + "k" : Math.round(min + step * i)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
