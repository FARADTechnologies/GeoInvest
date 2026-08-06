"use client";

// Bazar analizi — city-wide Baku market metrics.
//
// Every figure on this page comes from the backend. There is no baseline
// dataset and nothing is modelled on the client any more: what the source DB
// cannot answer renders as "—" rather than as a plausible-looking number.
//
// Real sources:
//   /valuation/market      → per-rayon median ₼/m² (yeni/köhnə) + listing counts,
//                            city median, new-build share
//   /model/market/rayons   → per-rayon rental yield, rent, price growth
//   /model/market/trends   → monthly sale ₼/m² and rent ₼ curves per build type
//   /model/market/index    → price index, base 100 = Aug 2023
//   /model/market/segments → room-count segments (₼/m², rent, yield, share)
//
// Still missing at the source (asked of the team, tracker S1–S4): days on
// market (likvidlik), monthly transaction volume (əqd həcmi), per-rayon trend
// curves, and the YoY deltas for those two.

import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketAnalysis,
  fetchMarketIndex,
  fetchMarketRayons,
  fetchMarketSegments,
  fetchMarketTrends,
  yoyPct,
  type ApiMarket,
  type RayonRow,
  type SegData,
  type TrendCat,
  type TrendPoint
} from "@/lib/market-api";
import { formatMonthShort } from "@/lib/format-date";
import { useEffect, useMemo, useRef, useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Delta, DonutChart, HBars, Icons, Pill, fmtMoney, fmtNumber } from "@/components/dashboard/valuation/valuation-ui";

// ─── Types ────────────────────────────────────────────────────────────

// A rayon row. `ppmNew` / `ppmOld` / `supply` are measured; `yield` / `rent` /
// `growth` come from the valuation pipeline and are null where the sample is
// too small; `liq` / `txn` have no source at all and are always null.
type Dist = {
  name: string;
  ppmNew: number | null;
  ppmOld: number | null;
  yield: number | null;
  liq: number | null;
  rent: number | null;
  txn: number | null;
  supply: number;
  growth: number | null;
  tier: "premium" | "mid" | "value";
};

// City-level aggregates. Nullable wherever the DB has nothing to say.
type City = {
  ppm: number | null;
  ppmIndex: number | null;
  ppmIndexYoY: number | null;
  yield: number | null;
  yieldYoY: number | null;
  liquidity: number | null;
  liquidityYoY: number | null;
  rent: number | null;
  rentYoY: number | null;
  txnVolume: number | null;
  txnYoY: number | null;
  supply: number | null;
  newShare: number | null;
};

// Only the metrics with a real monthly curve behind them are offered here.
// Yield / liquidity / transactions have no time series in the source DB, so
// charting them would mean inventing one.
const MKT_METRICS: Record<string, { label: string; fmt: (v: number) => string }> = {
  ppm: { label: "Qiymət (₼/m²)", fmt: (v) => fmtMoney(v, " ₼/m²") },
  index: { label: "Qiymət indeksi", fmt: (v) => v.toFixed(1) },
  rent: { label: "Orta kirayə (₼/ay)", fmt: (v) => fmtMoney(v) }
};
const MKT_METRIC_KEYS = Object.keys(MKT_METRICS);

// ─── Assembly ─────────────────────────────────────────────────────────

// The two endpoints name rayons slightly differently (the spatial join keeps
// the " rayonu" suffix, the analytics tables do not), so they are matched on a
// normalised key rather than on the raw string.
const shortRayon = (n: string) => n.replace(/\s*rayonu\s*$/i, "").trim();
const rayonKey = (n: string) => shortRayon(n).toLocaleLowerCase("az");

const EMPTY_CITY: City = {
  ppm: null, ppmIndex: null, ppmIndexYoY: null, yield: null, yieldYoY: null,
  liquidity: null, liquidityYoY: null, rent: null, rentYoY: null,
  txnVolume: null, txnYoY: null, supply: null, newShare: null
};

function buildDistricts(api: ApiMarket, rayons: RayonRow[]): Dist[] {
  // Treat implausibly-low medians (bad source rows) as missing rather than
  // showing an absurd ₼/m² or inventing a counterpart from it.
  const sane = (v: number | null | undefined) => (v && v > 300 ? v : null);
  const byKey = new Map(rayons.map((r) => [rayonKey(r.rayon), r]));
  const city = sane(api.city_median_kvm);

  return api.rayons
    .filter((r) => sane(r.ppm_new) || sane(r.ppm_old))
    .map((r) => {
      const ppmNew = sane(r.ppm_new);
      const ppmOld = sane(r.ppm_old);
      const extra = byKey.get(rayonKey(r.rayon));
      // Segment is a classification of a measured price, not a new figure.
      const ref = ppmNew ?? ppmOld;
      const rel = city && ref ? ref / city : null;
      const tier: Dist["tier"] = rel == null ? "mid" : rel >= 1.28 ? "premium" : rel >= 0.9 ? "mid" : "value";
      return {
        name: shortRayon(r.rayon),
        ppmNew,
        ppmOld,
        yield: extra?.yield_pct != null ? +extra.yield_pct.toFixed(1) : null,
        rent: extra?.rent != null && extra.rent > 0 ? Math.round(extra.rent) : null,
        growth: extra?.growth_pct != null ? +extra.growth_pct.toFixed(1) : null,
        // No days-on-market and no transaction feed in the source DB (S1/S2).
        liq: null,
        txn: null,
        supply: r.ad_count,
        tier
      };
    });
}

const TIME_RANGES = [
  { key: "6m", label: "6 ay", months: 6 },
  { key: "12m", label: "12 ay", months: 12 },
  { key: "24m", label: "2 il", months: 24 },
  { key: "36m", label: "3 il", months: 36 }
];

// ─── Small controls ───────────────────────────────────────────────────

function MktSelect({ label, value, onChange, options, minWidth = 168 }: { label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; minWidth?: number }) {
  return (
    <div>
      {label && <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 12px", background: "var(--card)", border: "1.5px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-1)", minWidth, outline: "none" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TimeRange({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, gap: 2 }}>
      {TIME_RANGES.map((r) => (
        <button key={r.key} onClick={() => onChange(r.key)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: value === r.key ? "var(--card)" : "transparent", color: value === r.key ? "var(--text-1)" : "var(--text-3)", boxShadow: value === r.key ? "var(--shadow-sm)" : "none" }}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function MktStat({ accent, label, value, delta, sub, icon }: { accent?: boolean; label: string; value: string; delta?: number | null; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="fl-row" style={{ gap: 10 }}>
        {icon && <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--orange-tint)", color: "var(--orange)", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {(sub || delta != null) && (
            <div className="fl-row" style={{ marginTop: 2, gap: 6 }}>
              {delta != null && <Delta value={delta} />}
              {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown in place of a chart whose data the source DB does not hold. */
function NoData({ note }: { note: string }) {
  return (
    <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
      {note}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export function ValuationMarketView({ lang = "az" }: { lang?: Lang }) {
  setValLang(lang);

  // Per-rayon median ₼/m², listing counts, city median and new-build share.
  const marketQuery = useQuery({ queryKey: ["valuation", "market"], queryFn: fetchMarketAnalysis });
  // Real room-count segments (team #3h).
  const segQuery = useQuery({ queryKey: ["valuation", "market", "segments"], queryFn: fetchMarketSegments });
  // Real monthly sale/rent curves (team #3b/d/e).
  const trendsQuery = useQuery({ queryKey: ["valuation", "market", "trends"], queryFn: fetchMarketTrends });
  // Real per-rayon yield (#3g) + growth ranking (#3j).
  const rayonsQuery = useQuery({ queryKey: ["valuation", "market", "rayons"], queryFn: fetchMarketRayons });
  // Real price index, base 100 = Aug 2023 (#3c).
  const indexQuery = useQuery({ queryKey: ["valuation", "market", "index"], queryFn: fetchMarketIndex });

  const districts = useMemo<Dist[]>(
    () => (marketQuery.data ? buildDistricts(marketQuery.data, rayonsQuery.data?.rayons ?? []) : []),
    [marketQuery.data, rayonsQuery.data]
  );

  const [range, setRange] = useState("12m");
  const [trendMetric, setTrendMetric] = useState("ppm");
  const [trendCat, setTrendCat] = useState("all");
  const [sortKey, setSortKey] = useState<keyof Dist>("supply");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [segMetric, setSegMetric] = useState("ppm");
  const [segCat, setSegCat] = useState("all");

  const months = TIME_RANGES.find((r) => r.key === range)!.months;

  // ── City KPIs — each one measured or "—" ───────────────────────────
  const saleSeries = trendsQuery.data?.sale.all;
  const rentSeries = trendsQuery.data?.rent.all;
  const indexSeries = indexQuery.data?.all;

  const city = useMemo<City>(() => {
    const api = marketQuery.data;
    if (!api && !trendsQuery.data && !indexQuery.data && !segQuery.data) return EMPTY_CITY;
    // Weighted mean gross yield across the room segments — every input is a
    // real per-segment figure from the DB.
    const segs = segQuery.data?.all ?? [];
    const segN = segs.reduce((s, x) => s + x.count, 0);
    return {
      ppm: saleSeries?.at(-1)?.value ?? api?.city_median_kvm ?? null,
      ppmIndex: indexSeries?.at(-1)?.value ?? null,
      ppmIndexYoY: indexQuery.data?.latest_yoy?.all ?? null,
      yield: segN ? +(segs.reduce((s, x) => s + x.yield_pct * x.count, 0) / segN).toFixed(1) : null,
      // The team has no history for gross yield yet, so no YoY to show.
      yieldYoY: null,
      // Days on market is not stored anywhere in the source DB (S1).
      liquidity: null,
      liquidityYoY: null,
      rent: rentSeries?.at(-1)?.value ?? null,
      rentYoY: yoyPct(rentSeries),
      // No transaction (əqd) feed — only listings (S2).
      txnVolume: null,
      txnYoY: null,
      supply: api?.total_ad_count ?? null,
      newShare: api?.new_share ?? null
    };
  }, [marketQuery.data, segQuery.data, trendsQuery.data, indexQuery.data, saleSeries, rentSeries, indexSeries]);

  const indexBase = indexQuery.data?.base;
  const kpis = [
    { label: "Orta qiymət/m²", value: fmtMoney(city.ppm, " ₼"), delta: yoyPct(saleSeries), icon: <Icons.Coin size={16} /> },
    { label: "Qiymət indeksi", value: city.ppmIndex != null ? city.ppmIndex.toFixed(1) : "—", delta: city.ppmIndexYoY, sub: `baza 100 = ${indexBase === "2023-08" ? "avqust 2023" : indexBase ?? "avqust 2023"}`, icon: <Icons.TrendUp size={16} />, accent: true },
    { label: "Orta gəlirlilik", value: city.yield != null ? city.yield.toFixed(1) + "%" : "—", delta: city.yieldYoY, icon: <Icons.Sparkle size={16} /> },
    { label: "Orta likvidlik", value: city.liquidity != null ? city.liquidity + " gün" : "—", delta: city.liquidityYoY, icon: <Icons.Refresh size={16} /> },
    { label: "Orta kirayə", value: fmtMoney(city.rent), delta: city.rentYoY, icon: <Icons.Building size={16} /> },
    { label: "Aylıq əqd həcmi", value: fmtNumber(city.txnVolume), delta: city.txnYoY, icon: <Icons.Layers size={16} /> }
  ];

  // ── Trend chart — real monthly curves only ─────────────────────────
  const trendSource = useMemo<TrendPoint[]>(() => {
    const cat = trendCat as keyof TrendCat;
    if (trendMetric === "index") return indexQuery.data?.[cat] ?? [];
    if (trendMetric === "ppm") return trendsQuery.data?.sale[cat] ?? [];
    if (trendMetric === "rent") return trendsQuery.data?.rent[cat] ?? [];
    return [];
  }, [trendsQuery.data, indexQuery.data, trendMetric, trendCat]);

  const chartPoints = trendSource.slice(-months);
  const chartSeries = chartPoints.map((p) => p.value);
  const chartLabels = chartPoints.map((p) => ({ short: formatMonthShort(p.date) }));
  const trendMeta = MKT_METRICS[trendMetric];
  const startV = chartSeries[0];
  const endV = chartSeries[chartSeries.length - 1];
  const changePct = startV && endV != null ? ((endV - startV) / startV) * 100 : null;
  const hasTrend = chartSeries.length >= 2;

  // ── Rayon table ────────────────────────────────────────────────────
  // Rows with no value for the sorted column go last in both directions —
  // an empty cell is not "the smallest", it is unknown.
  const sortedDistricts = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...districts].sort((a, b) => {
      const av = a[sortKey] as number | null;
      const bv = b[sortKey] as number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [districts, sortKey, sortDir]);
  const toggleSort = (key: keyof Dist) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // #3g — rental yield per rayon from listings valuated in the last month.
  const yieldBars = useMemo(
    () =>
      [...(rayonsQuery.data?.rayons ?? [])]
        .filter((r) => r.yield_pct != null)
        .sort((a, b) => (b.yield_pct ?? 0) - (a.yield_pct ?? 0))
        .map((r) => ({ label: shortRayon(r.rayon), value: r.yield_pct ?? 0 })),
    [rayonsQuery.data]
  );

  // #3j — fastest / slowest growing rayons. Rayons with too few valuated
  // listings are excluded so a 3-listing rayon can't top the ranking.
  const { rising, falling } = useMemo(() => {
    const min = rayonsQuery.data?.min_sample ?? 20;
    const ranked = (rayonsQuery.data?.rayons ?? [])
      .filter((r) => r.growth_pct != null && (r.growth_count ?? 0) >= min)
      .sort((a, b) => (b.growth_pct ?? 0) - (a.growth_pct ?? 0))
      .map((r) => ({ name: shortRayon(r.rayon), growth: r.growth_pct ?? 0 }));
    // slice(0,5) and slice(-5) overlap once fewer than ten rayons qualify, and
    // with four qualifying rayons both lists showed the same four names —
    // "fastest growing" and "slowest growing" reading identically. The slowest
    // list now draws only from what the fastest one did not take, and stays
    // empty (and hidden) when there is nothing left to show.
    const rising = ranked.slice(0, 5);
    const falling = ranked.slice(rising.length).slice(-5).reverse();
    return { rising, falling };
  }, [rayonsQuery.data]);

  // ── Room segments — real only ──────────────────────────────────────
  const segRows = segQuery.data ? (segQuery.data[segCat as keyof SegData] ?? segQuery.data.all) : [];
  const segValues = segRows.map((s) => ({
    label: s.rooms,
    value: segMetric === "ppm" ? s.ppm : segMetric === "yield" ? s.yield_pct : s.rent,
    share: s.share
  }));
  const segMax = Math.max(...segValues.map((s) => s.value), 1);

  // ── New vs old ─────────────────────────────────────────────────────
  const withNew = districts.filter((d) => d.ppmNew != null);
  const withOld = districts.filter((d) => d.ppmOld != null);
  const avgNew = withNew.length ? withNew.reduce((s, d) => s + (d.ppmNew ?? 0), 0) / withNew.length : null;
  const avgOld = withOld.length ? withOld.reduce((s, d) => s + (d.ppmOld ?? 0), 0) / withOld.length : null;
  const newOldGap = avgNew && avgOld ? Math.round((avgNew / avgOld - 1) * 100) : null;

  const loading = marketQuery.isLoading;

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        <div className="page-header">
          <div>
            <div className="crumbs"><span>{T(`Bazar analizi`)}</span></div>
            <h1 className="page-title">{T(`Bazar analizi · Bakı`)}</h1>
            <p className="page-sub">{T(`Şəhər üzrə əmlak bazarının göstəriciləri — qiymət indeksi, kirayə gəlirliyi və rayonlar üzrə müqayisə. Bütün rəqəmlər mənbə bazasından hesablanır; məlumat olmayan sahələr "—" göstərilir.`)}</p>
          </div>
          <div className="page-actions">
            <TimeRange value={range} onChange={setRange} />
            <button className="btn btn-secondary"><Icons.Download size={14} /> {T(`İxrac`)}</button>
            <button className="btn btn-secondary"><Icons.PDF size={14} /> {T(`Hesabat`)}</button>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", marginBottom: 16 }}>
          {kpis.map((k, i) => <MktStat key={i} accent={k.accent} label={k.label} value={k.value} delta={k.delta} sub={k.sub} icon={k.icon} />)}
        </div>

        {/* Trend chart */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="fl-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="card-title">{T(trendMeta.label)} dinamikası</div>
              <div className="card-sub" style={{ marginTop: 4 }}>{T(`Bütün Bakı üzrə son`)} {months} {T(`ayın trendi.`)}</div>
            </div>
            <div className="fl-row" style={{ gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <MktSelect label={T(`Kateqoriya`)} value={trendCat} onChange={setTrendCat} options={[{ value: "all", label: T(`Mənzillər`) }, { value: "new", label: T(`Yeni tikili`) }, { value: "old", label: T(`Köhnə tikili`) }]} minWidth={130} />
              <MktSelect label={T(`Metrika`)} value={trendMetric} onChange={setTrendMetric} options={MKT_METRIC_KEYS.map((k) => ({ value: k, label: T(MKT_METRICS[k].label) }))} />
            </div>
          </div>
          {hasTrend ? (
            <>
              <div className="fl-row" style={{ gap: 22, margin: "14px 0 4px", flexWrap: "wrap" }}>
                <TrendKpi k={T(`Hal-hazırkı`)} v={trendMeta.fmt(endV)} tone="orange" />
                <TrendKpi k={`${chartSeries.length} ay əvvəl`} v={trendMeta.fmt(startV)} />
                <TrendKpi k={T(`Dəyişiklik`)} v={changePct == null ? "—" : `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%`} tone={changePct && changePct > 0 ? "green" : changePct && changePct < 0 ? "red" : "gray"} />
              </div>
              <MarketLineChart series={chartSeries} labels={chartLabels} metricKey={trendMetric} />
            </>
          ) : (
            <NoData note={loading ? T(`Yüklənir…`) : T(`Bu metrika üçün mənbə bazasında aylıq məlumat yoxdur.`)} />
          )}
        </div>

        {/* Rayon table */}
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <div className="table-tools">
            <div className="card-title">{T(`Rayonlar üzrə müqayisə`)}</div>
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{districts.length} rayon</span>
            <span className="sp" />
            <span className="muted" style={{ fontSize: 11.5 }}>{T(`Sütun başlığına klikləyib sıralayın`)}</span>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>{T(`Rayon`)}</th>
                  <th>{T(`Seqment`)}</th>
                  <SortTh label="Yeni ₼/m²" k="ppmNew" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Köhnə ₼/m²" k="ppmOld" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Gəlirlilik`)} k="yield" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Kirayə ₼`)} k="rent" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Likvidlik`)} k="liq" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Əqd/ay`)} k="txn" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Təklif`)} k="supply" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label={T(`Artım (illik)`)} k="growth" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedDistricts.map((d) => (
                  <tr key={d.name}>
                    <td className="cell-primary">{d.name}</td>
                    <td className="pill-cell">
                      <Pill tone={d.tier === "premium" ? "orange" : d.tier === "mid" ? "teal" : "gray"}>
                        {d.tier === "premium" ? "Premium" : d.tier === "mid" ? "Orta" : "Əlçatan"}
                      </Pill>
                    </td>
                    <td className="num cell-strong">{fmtMoney(d.ppmNew, "")}</td>
                    <td className="num">{fmtMoney(d.ppmOld, "")}</td>
                    <td className="num">
                      {d.yield == null ? "—" : (
                        <span style={{ color: city.yield != null && d.yield >= city.yield ? "var(--green)" : "var(--text-1)", fontWeight: 600 }}>{d.yield.toFixed(1)}%</span>
                      )}
                    </td>
                    <td className="num">{fmtMoney(d.rent)}</td>
                    <td className="num">{d.liq == null ? "—" : `${d.liq} gün`}</td>
                    <td className="num">{fmtNumber(d.txn)}</td>
                    <td className="num">{fmtNumber(d.supply)}</td>
                    <td className="num">
                      {d.growth == null ? "—" : (
                        <span style={{ color: d.growth >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                          {d.growth >= 0 ? "↑" : "↓"} {Math.abs(d.growth).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedDistricts.length === 0 && (
                  <tr><td colSpan={10}><NoData note={loading ? T(`Yüklənir…`) : T(`Məlumat yoxdur.`)} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Days on market — no source yet (tracker S1) */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">{T(`Qiymət aralığına görə satış günləri`)}</div>
          <NoData note={T(`Mənbə bazasında elanın neçə günə satıldığı saxlanılmır — bu göstərici üçün hələ məlumat yoxdur.`)} />
        </div>

        {/* Yield + movers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="card card-pad">
            <div className="card-title">{T(`Rayonlar üzrə kirayə gəlirliyi`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 16px" }}>{T(`Son ayda qiymətləndirilmiş elanlar üzrə brüt kirayə gəlirliyi.`)}</div>
            {yieldBars.length > 0
              ? <HBars items={yieldBars} max={10} color="#2A8B7E" valueFmt={(v) => v.toFixed(1) + "%"} />
              : <NoData note={loading ? T(`Yüklənir…`) : T(`Məlumat yoxdur.`)} />}
          </div>
          <div className="card card-pad">
            <div className="card-title">{T(`Ən sürətli artan rayonlar`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 14px" }}>{T(`İllik qiymət artımı üzrə.`)}</div>
            {rising.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rising.map((d, i) => <MoverRow key={d.name} rank={i + 1} name={d.name} value={d.growth} dir="up" />)}
                </div>
                {falling.length > 0 && (
                  <>
                    <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
                    <div className="card-sub" style={{ marginBottom: 10 }}>{T(`Ən yavaş artan rayonlar`)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {falling.map((d, i) => <MoverRow key={d.name} rank={i + 1} name={d.name} value={d.growth} dir="slow" />)}
                    </div>
                  </>
                )}
              </>
            ) : (
              <NoData note={loading ? T(`Yüklənir…`) : T(`Məlumat yoxdur.`)} />
            )}
          </div>
        </div>

        {/* Segments + new vs old */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          <div className="card card-pad">
            <div className="fl-row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div className="card-title">{T(`Otaq sayına görə seqment`)}</div>
                <div className="card-sub" style={{ marginTop: 4 }}>{T(`Bazarın otaq sayı üzrə bölgüsü və göstəriciləri.`)}</div>
              </div>
              <div className="fl-row" style={{ gap: 8, flexWrap: "wrap" }}>
                <MktSelect value={segCat} onChange={setSegCat} options={[{ value: "all", label: T(`Mənzillər`) }, { value: "new", label: T(`Yeni tikili`) }, { value: "old", label: T(`Köhnə tikili`) }]} minWidth={130} />
                <MktSelect value={segMetric} onChange={setSegMetric} options={[{ value: "ppm", label: "Qiymət ₼/m²" }, { value: "yield", label: "Gəlirlilik" }, { value: "rent", label: "Kirayə ₼" }]} minWidth={140} />
              </div>
            </div>
            {segValues.length > 0 ? (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {segValues.map((s, i) => (
                  <div key={i} className="fl-row" style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, width: 78 }}>{s.label}</span>
                    <div style={{ flex: 1, height: 22, background: "var(--bg-subtle)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                      <div style={{ width: `${(s.value / segMax) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--orange) 0%, var(--orange-soft) 100%)", borderRadius: 6 }} />
                    </div>
                    <span style={{ width: 96, textAlign: "right", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {segMetric === "ppm" ? fmtMoney(s.value, " ₼") : segMetric === "yield" ? s.value.toFixed(1) + "%" : fmtMoney(s.value)}
                    </span>
                    <span style={{ width: 56, textAlign: "right", fontSize: 11.5, color: "var(--text-3)" }}>{s.share}% pay</span>
                  </div>
                ))}
              </div>
            ) : (
              <NoData note={loading ? T(`Yüklənir…`) : T(`Məlumat yoxdur.`)} />
            )}
          </div>

          <div className="card card-pad">
            <div className="card-title">{T(`Yeni vs köhnə tikili`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 16px" }}>{T(`Şəhər üzrə təklif strukturu.`)}</div>
            {city.newShare != null ? (
              <div className="fl-row" style={{ gap: 18, alignItems: "center" }}>
                <DonutChart value={city.newShare} label={T(`Yeni tikili`)} size={104} color="#2A8B7E" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <SplitRow color="#2A8B7E" label={T(`Yeni tikili`)} ppm={avgNew} share={city.newShare} />
                  <SplitRow color="#0F1E3D" label={T(`Köhnə tikili`)} ppm={avgOld} share={100 - city.newShare} />
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <div className="fl-row" style={{ fontSize: 12.5 }}>
                    <span className="muted">{T(`Yeni/köhnə qiymət fərqi`)}</span>
                    <span className="sp" />
                    <strong style={{ color: "var(--orange)" }}>{newOldGap == null ? "—" : `${newOldGap > 0 ? "+" : ""}${newOldGap}%`}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <NoData note={loading ? T(`Yüklənir…`) : T(`Məlumat yoxdur.`)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortTh({ label, k, sortKey, sortDir, onClick }: { label: string; k: keyof Dist; sortKey: keyof Dist; sortDir: string; onClick: (k: keyof Dist) => void }) {
  return (
    <th className="num" style={{ cursor: "pointer" }} onClick={() => onClick(k)}>
      {label}
      {sortKey === k && <span style={{ marginLeft: 4, color: "var(--orange)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function TrendKpi({ k, v, tone = "gray" }: { k: string; v: string; tone?: string }) {
  const c = ({ orange: "var(--orange)", green: "var(--green)", red: "var(--red)", gray: "var(--text-1)" } as Record<string, string>)[tone];
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{v}</div>
    </div>
  );
}

function MoverRow({ rank, name, value, dir }: { rank: number; name: string; value: number; dir: "up" | "slow" }) {
  const up = value >= 0;
  return (
    <div className="fl-row" style={{ gap: 10 }}>
      <span style={{ width: 18, fontWeight: 700, fontSize: 12, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{rank}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{name}</span>
      <div style={{ width: 90, height: 6, background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.abs(value) / 13 * 100)}%`, height: "100%", background: dir === "up" ? "var(--green)" : "var(--amber)", borderRadius: 99 }} />
      </div>
      <span style={{ width: 52, textAlign: "right", fontWeight: 700, fontSize: 13, color: dir === "up" ? "var(--green)" : "var(--amber)", fontVariantNumeric: "tabular-nums" }}>{up ? "↑" : "↓"}{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
}

function SplitRow({ color, label, ppm, share }: { color: string; label: string; ppm: number | null; share: number }) {
  return (
    <div className="fl-row" style={{ gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{label}</span>
      <span className="sp" />
      <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 8 }}>{fmtMoney(ppm, " ₼/m²")}</span>
      <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{share}%</strong>
    </div>
  );
}

function MarketLineChart({ series, labels, metricKey, color = "#D9531E", height = 300 }: { series: number[]; labels: { short: string }[]; metricKey: string; color?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1120);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setWidth(Math.max(420, Math.round(e.contentRect.width))); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const meta = MKT_METRICS[metricKey];
  const padL = 70, padR = 24, padT = 28, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const min = Math.min(...series) * 0.96, max = Math.max(...series) * 1.04;
  const range = max - min || 1;
  const sx = (i: number) => padL + (i / (series.length - 1)) * innerW;
  const sy = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const pts = series.map((v, i) => [sx(i), sy(v)]);
  let path = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    path += ` C ${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  const fill = path + ` L ${sx(series.length - 1)},${padT + innerH} L ${sx(0)},${padT + innerH} Z`;
  const gid = "mkt-" + metricKey;

  return (
    <div ref={ref} style={{ width: "100%", marginTop: 8 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, i) => {
          const v = min + (i / 4) * range;
          return (
            <g key={i}>
              <line x1={padL} y1={sy(v)} x2={width - padR} y2={sy(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={padL - 10} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" fontFamily="Manrope">{meta.fmt(v)}</text>
            </g>
          );
        })}
        <path d={fill} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((v, i) => (i === series.length - 1 ? <circle key={i} cx={sx(i)} cy={sy(v)} r={5} fill={color} stroke="white" strokeWidth="2"><title>{`${labels[i].short}\n${meta.fmt(v)}`}</title></circle> : null))}
        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1 ? (
            <text key={i} x={sx(i)} y={height - 14} textAnchor="middle" fontSize="10.5" fill="var(--text-3)" fontFamily="Manrope">{l.short}</text>
          ) : null
        )}
      </svg>
    </div>
  );
}
