"use client";

// Bazar analizi — city-wide Baku market metrics. 1:1 port of the prototype's
// MarketAnalysisPage (self-contained dataset + interactive charts + table),
// scoped under .hm-val. Dataset is the prototype's static baseline.

import { useEffect, useMemo, useRef, useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Delta, DonutChart, HBars, Icons, Pill, fmtMoney, fmtNumber } from "@/components/dashboard/valuation/valuation-ui";

// ─── Dataset (ported 1:1) ─────────────────────────────────────────────

type Dist = { name: string; ppmNew: number; ppmOld: number; yield: number; liq: number; rent: number; txn: number; supply: number; growth: number; tier: string };

const MKT_DISTRICTS: Dist[] = [
  { name: "Səbail", ppmNew: 4200, ppmOld: 2950, yield: 5.4, liq: 72, rent: 1650, txn: 312, supply: 1840, growth: 12.4, tier: "premium" },
  { name: "Nəsimi", ppmNew: 3450, ppmOld: 2480, yield: 6.1, liq: 64, rent: 1280, txn: 486, supply: 2310, growth: 11.1, tier: "premium" },
  { name: "Nərimanov", ppmNew: 3200, ppmOld: 2350, yield: 6.4, liq: 68, rent: 1180, txn: 524, supply: 2480, growth: 10.8, tier: "mid" },
  { name: "Yasamal", ppmNew: 2950, ppmOld: 2180, yield: 6.8, liq: 76, rent: 1050, txn: 612, supply: 2960, growth: 10.2, tier: "mid" },
  { name: "Xətai", ppmNew: 2650, ppmOld: 1920, yield: 7.2, liq: 84, rent: 920, txn: 548, supply: 2740, growth: 9.6, tier: "mid" },
  { name: "Nizami", ppmNew: 2480, ppmOld: 1840, yield: 7.4, liq: 88, rent: 860, txn: 472, supply: 2380, growth: 9.1, tier: "mid" },
  { name: "Binəqədi", ppmNew: 2050, ppmOld: 1480, yield: 8.1, liq: 102, rent: 720, txn: 698, supply: 3420, growth: 8.4, tier: "value" },
  { name: "Sabunçu", ppmNew: 1780, ppmOld: 1290, yield: 8.6, liq: 118, rent: 640, txn: 542, supply: 2980, growth: 7.8, tier: "value" },
  { name: "Suraxanı", ppmNew: 1620, ppmOld: 1180, yield: 8.9, liq: 128, rent: 580, txn: 418, supply: 2540, growth: 7.2, tier: "value" },
  { name: "Xəzər", ppmNew: 1880, ppmOld: 1340, yield: 8.3, liq: 124, rent: 690, txn: 286, supply: 1680, growth: 8.9, tier: "value" },
  { name: "Qaradağ", ppmNew: 1450, ppmOld: 1050, yield: 9.2, liq: 142, rent: 510, txn: 224, supply: 1420, growth: 6.4, tier: "value" },
  { name: "Pirallahı", ppmNew: 1280, ppmOld: 940, yield: 9.6, liq: 156, rent: 460, txn: 96, supply: 580, growth: 5.8, tier: "value" }
];

const MKT_CITY = {
  ppm: 2640, ppmIndex: 142.6, ppmIndexYoY: 9.8, yield: 7.6, yieldYoY: -0.4,
  liquidity: 98, liquidityYoY: -6, rent: 920, rentYoY: 13.2,
  txnVolume: 5268, txnYoY: 4.6, supply: 29720, supplyYoY: -3.1, newShare: 38
};

const MKT_ROOM_SEGMENTS = [
  { rooms: "1 otaq", ppm: 2980, yield: 8.2, share: 14, rent: 640, liq: 78 },
  { rooms: "2 otaq", ppm: 2740, yield: 7.8, share: 34, rent: 880, liq: 86 },
  { rooms: "3 otaq", ppm: 2560, yield: 7.4, share: 31, rent: 1180, liq: 98 },
  { rooms: "4 otaq", ppm: 2420, yield: 6.9, share: 15, rent: 1520, liq: 124 },
  { rooms: "5+ otaq", ppm: 2280, yield: 6.2, share: 6, rent: 1980, liq: 152 }
];

const MKT_METRICS: Record<string, { label: string; fmt: (v: number) => string; cityKey: keyof typeof MKT_CITY }> = {
  ppm: { label: "Qiymət (₼/m²)", fmt: (v) => fmtMoney(v, " ₼/m²"), cityKey: "ppm" },
  index: { label: "Qiymət indeksi", fmt: (v) => v.toFixed(1), cityKey: "ppmIndex" },
  yield: { label: "Kirayə gəlirliyi", fmt: (v) => v.toFixed(1) + "%", cityKey: "yield" },
  rent: { label: "Orta kirayə (₼/ay)", fmt: (v) => fmtMoney(v), cityKey: "rent" },
  liq: { label: "Likvidlik (gün)", fmt: (v) => Math.round(v) + " gün", cityKey: "liquidity" },
  txn: { label: "Əqd həcmi", fmt: (v) => fmtNumber(v), cityKey: "txnVolume" }
};
const MKT_METRIC_KEYS = Object.keys(MKT_METRICS);

const TIME_RANGES = [
  { key: "6m", label: "6 ay", months: 6 },
  { key: "12m", label: "12 ay", months: 12 },
  { key: "24m", label: "2 il", months: 24 },
  { key: "36m", label: "3 il", months: 36 }
];

const SALES_DAYS = [
  { bucket: "<100k", old: 92, new: 91, oldMed: 84, newMed: 82 },
  { bucket: "100k-200k", old: 136, new: 98, oldMed: 122, newMed: 88 },
  { bucket: "200k-300k", old: 135, new: 122, oldMed: 120, newMed: 109 },
  { bucket: "300k-500k", old: 164, new: 140, oldMed: 146, newMed: 126 },
  { bucket: "500k-800k", old: 209, new: 159, oldMed: 184, newMed: 142 },
  { bucket: ">800k", old: 225, new: 202, oldMed: 196, newMed: 178 }
];

const seedRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

function mktSeries(base: number, months: number, seedStr: string, annualGrowth = 0.09, vol = 0.012): number[] {
  const seed = seedStr.split("").reduce((s, c) => s + c.charCodeAt(0), 0) + months;
  const r = seedRandom(seed);
  const monthlyGrowth = Math.pow(1 + annualGrowth, 1 / 12) - 1;
  const out: number[] = [];
  let v = base / Math.pow(1 + monthlyGrowth, months - 1);
  for (let i = 0; i < months; i++) {
    const noise = (r() - 0.5) * vol * 2;
    const season = Math.sin((i / 12) * Math.PI * 2) * vol * 0.6;
    v = v * (1 + monthlyGrowth + noise + season);
    out.push(v);
  }
  const scale = base / out[out.length - 1];
  return out.map((x) => x * scale);
}

function mktMonthLabels(months: number) {
  const names = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  const now = new Date(2026, 5, 1);
  const out: { short: string }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    out.push({ short: `${names[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return out;
}

// ─── Small controls (ported) ──────────────────────────────────────────

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

function MktStat({ accent, label, value, delta, sub, icon }: { accent?: boolean; label: string; value: string; delta?: number; sub?: string; icon?: React.ReactNode }) {
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

function MiniBar({ data, width = 80, height = 26, color = "#D9531E" }: { data: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(...data) || 1;
  const gap = 2;
  const bw = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4));
        return <rect key={i} x={i * (bw + gap)} y={height - h - 2} width={bw} height={h} rx="1.5" fill={color} fillOpacity={0.4 + (v / max) * 0.55} />;
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export function ValuationMarketView({ lang = "az" }: { lang?: Lang }) {
  setValLang(lang);
  const [range, setRange] = useState("12m");
  const [trendMetric, setTrendMetric] = useState("index");
  const [trendDistrict, setTrendDistrict] = useState("all");
  const [sortKey, setSortKey] = useState<keyof Dist>("growth");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [segMetric, setSegMetric] = useState("ppm");
  const [salesCat, setSalesCat] = useState("all");
  const [salesRegion, setSalesRegion] = useState("all");
  const salesBuffer = 30;
  const [salesAgg, setSalesAgg] = useState("mean");

  const months = TIME_RANGES.find((r) => r.key === range)!.months;
  const labels = mktMonthLabels(months);

  const kpis = [
    { label: "Orta qiymət/m²", value: fmtMoney(MKT_CITY.ppm, " ₼"), delta: MKT_CITY.ppmIndexYoY, icon: <Icons.Coin size={16} /> },
    { label: "Qiymət indeksi", value: MKT_CITY.ppmIndex.toFixed(1), delta: MKT_CITY.ppmIndexYoY, sub: "baza 100 = Yan 2022", icon: <Icons.TrendUp size={16} />, accent: true },
    { label: "Orta gəlirlilik", value: MKT_CITY.yield.toFixed(1) + "%", delta: MKT_CITY.yieldYoY, icon: <Icons.Sparkle size={16} /> },
    { label: "Orta likvidlik", value: MKT_CITY.liquidity + " gün", delta: -MKT_CITY.liquidityYoY, icon: <Icons.Refresh size={16} /> },
    { label: "Orta kirayə", value: fmtMoney(MKT_CITY.rent), delta: MKT_CITY.rentYoY, icon: <Icons.Building size={16} /> },
    { label: "Aylıq əqd həcmi", value: fmtNumber(MKT_CITY.txnVolume), delta: MKT_CITY.txnYoY, icon: <Icons.Layers size={16} /> }
  ];

  const trendSeries = useMemo(() => {
    let base: number;
    if (trendDistrict === "all") {
      base = MKT_CITY[MKT_METRICS[trendMetric].cityKey] as number;
    } else {
      const d = MKT_DISTRICTS.find((x) => x.name === trendDistrict)!;
      base = trendMetric === "ppm" ? d.ppmNew : trendMetric === "index" ? 100 + d.growth * 3.6 : trendMetric === "yield" ? d.yield : trendMetric === "rent" ? d.rent : trendMetric === "liq" ? d.liq : d.txn;
    }
    let growth: number, vol: number;
    if (trendMetric === "ppm" || trendMetric === "index" || trendMetric === "rent") { growth = 0.1; vol = 0.01; }
    else if (trendMetric === "yield") { growth = -0.01; vol = 0.014; }
    else if (trendMetric === "liq") { growth = -0.05; vol = 0.02; }
    else { growth = 0.05; vol = 0.03; }
    return mktSeries(base, months, trendMetric + trendDistrict, growth, vol);
  }, [trendMetric, trendDistrict, months]);

  const trendMeta = MKT_METRICS[trendMetric];
  const startV = trendSeries[0], endV = trendSeries[trendSeries.length - 1];
  const changePct = ((endV - startV) / startV) * 100;

  const sortedDistricts = useMemo(
    () => [...MKT_DISTRICTS].sort((a, b) => (sortDir === "asc" ? (a[sortKey] as number) - (b[sortKey] as number) : (b[sortKey] as number) - (a[sortKey] as number))),
    [sortKey, sortDir]
  );
  const toggleSort = (key: keyof Dist) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const movers = [...MKT_DISTRICTS].sort((a, b) => b.growth - a.growth);
  const rising = movers.slice(0, 4);
  const falling = movers.slice(-4).reverse();
  const yieldBars = [...MKT_DISTRICTS].sort((a, b) => b.yield - a.yield).map((d) => ({ label: d.name, value: d.yield }));

  const segValues = MKT_ROOM_SEGMENTS.map((s) => ({
    label: s.rooms,
    value: segMetric === "ppm" ? s.ppm : segMetric === "yield" ? s.yield : segMetric === "rent" ? s.rent : s.liq,
    share: s.share
  }));
  const segMax = Math.max(...segValues.map((s) => s.value));

  const distOptions = [{ value: "all", label: "Bütün Bakı" }, ...MKT_DISTRICTS.map((d) => ({ value: d.name, label: d.name }))];

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        <div className="page-header">
          <div>
            <div className="crumbs"><span>{T(`Bazar analizi`)}</span></div>
            <h1 className="page-title">{T(`Bazar analizi · Bakı`)}</h1>
            <p className="page-sub">{T(`Şəhər üzrə əmlak bazarının canlı göstəriciləri — qiymət indeksi, kirayə gəlirliyi, likvidlik və əqd həcmi. Məlumat 12 rayon üzrə yenilənir.`)}</p>
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
              <div className="card-sub" style={{ marginTop: 4 }}>{trendDistrict === "all" ? "Bütün Bakı" : trendDistrict} üzrə son {months} ayın trendi.</div>
            </div>
            <div className="fl-row" style={{ gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <MktSelect label={T(`Metrika`)} value={trendMetric} onChange={setTrendMetric} options={MKT_METRIC_KEYS.map((k) => ({ value: k, label: T(MKT_METRICS[k].label) }))} />
              <MktSelect label={T(`Rayon`)} value={trendDistrict} onChange={setTrendDistrict} options={distOptions} />
            </div>
          </div>
          <div className="fl-row" style={{ gap: 22, margin: "14px 0 4px", flexWrap: "wrap" }}>
            <TrendKpi k={T(`Hal-hazırkı`)} v={trendMeta.fmt(endV)} tone="orange" />
            <TrendKpi k={`${months} ay əvvəl`} v={trendMeta.fmt(startV)} />
            <TrendKpi k={T(`Dəyişiklik`)} v={`${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%`} tone={changePct > 0 ? "green" : changePct < 0 ? "red" : "gray"} />
          </div>
          <MarketLineChart series={trendSeries} labels={labels} metricKey={trendMetric} color={trendMetric === "liq" || trendMetric === "yield" ? "#2A6FDB" : "#D9531E"} />
        </div>

        {/* District table */}
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <div className="table-tools">
            <div className="card-title">{T(`Rayonlar üzrə müqayisə`)}</div>
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{MKT_DISTRICTS.length} rayon</span>
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
                  <th style={{ width: 90 }}>{T(`Trend`)}</th>
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
                    <td className="num"><span style={{ color: d.yield >= MKT_CITY.yield ? "var(--green)" : "var(--text-1)", fontWeight: 600 }}>{d.yield.toFixed(1)}%</span></td>
                    <td className="num">{fmtMoney(d.rent)}</td>
                    <td className="num">{d.liq} gün</td>
                    <td className="num">{fmtNumber(d.txn)}</td>
                    <td className="num">{fmtNumber(d.supply)}</td>
                    <td className="num"><span style={{ color: "var(--green)", fontWeight: 700 }}>↑ {d.growth.toFixed(1)}%</span></td>
                    <td><div style={{ width: 80 }}><MiniBar data={mktSeries(d.ppmNew, 12, "spark" + d.name, 0.1, 0.012).map(Math.round)} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales-days by price bucket × category */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="fl-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="card-title">{T(`Qiymət aralığı və kateqoriyaya görə satış günlərinin ortalaması`)}</div>
              <div className="card-sub" style={{ marginTop: 4 }}>
                Hər qiymət seqmentində mənzilin satılması üçün orta gün sayı. Açıq rəng — <strong>+{salesBuffer} gün</strong> ssenari fərziyyəsi (bəd-bin şərait / az likvid bazar).
              </div>
            </div>
            <div className="fl-row" style={{ gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <MktSelect label={T(`Kateqoriya`)} value={salesCat} onChange={setSalesCat} options={[{ value: "all", label: "Hamısı" }, { value: "new", label: "Yeni tikili" }, { value: "old", label: "Köhnə tikili" }]} minWidth={140} />
              <MktSelect label={T(`Rayon`)} value={salesRegion} onChange={setSalesRegion} options={distOptions} />
              <MktSelect label={T(`Mərkəz`)} value={salesAgg} onChange={setSalesAgg} options={[{ value: "mean", label: "Orta" }, { value: "median", label: "Median" }]} minWidth={130} />
            </div>
          </div>
          <SalesDaysChart category={salesCat} region={salesRegion} buffer={salesBuffer} agg={salesAgg} />
        </div>

        {/* Yield + movers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="card card-pad">
            <div className="card-title">{T(`Rayonlar üzrə kirayə gəlirliyi`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 16px" }}>{T(`Əlçatan rayonlarda gəlirlilik daha yüksək, premium rayonlarda daha aşağıdır.`)}</div>
            <HBars items={yieldBars} max={10} color="#2A8B7E" valueFmt={(v) => v.toFixed(1) + "%"} />
          </div>
          <div className="card card-pad">
            <div className="card-title">{T(`Ən sürətli artan rayonlar`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 14px" }}>{T(`İllik qiymət artımı üzrə.`)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rising.map((d, i) => <MoverRow key={d.name} rank={i + 1} name={d.name} value={d.growth} dir="up" />)}
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
            <div className="card-sub" style={{ marginBottom: 10 }}>{T(`Ən yavaş artan rayonlar`)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {falling.map((d, i) => <MoverRow key={d.name} rank={i + 1} name={d.name} value={d.growth} dir="slow" />)}
            </div>
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
              <MktSelect value={segMetric} onChange={setSegMetric} options={[{ value: "ppm", label: "Qiymət ₼/m²" }, { value: "yield", label: "Gəlirlilik" }, { value: "rent", label: "Kirayə ₼" }, { value: "liq", label: "Likvidlik" }]} minWidth={140} />
            </div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {segValues.map((s, i) => (
                <div key={i} className="fl-row" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 78 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 22, background: "var(--bg-subtle)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <div style={{ width: `${(s.value / segMax) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--orange) 0%, var(--orange-soft) 100%)", borderRadius: 6 }} />
                  </div>
                  <span style={{ width: 96, textAlign: "right", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    {segMetric === "ppm" ? fmtMoney(s.value, " ₼") : segMetric === "yield" ? s.value.toFixed(1) + "%" : segMetric === "rent" ? fmtMoney(s.value) : s.value + " gün"}
                  </span>
                  <span style={{ width: 56, textAlign: "right", fontSize: 11.5, color: "var(--text-3)" }}>{s.share}% pay</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">{T(`Yeni vs köhnə tikili`)}</div>
            <div className="card-sub" style={{ margin: "4px 0 16px" }}>{T(`Şəhər üzrə təklif strukturu.`)}</div>
            <div className="fl-row" style={{ gap: 18, alignItems: "center" }}>
              <DonutChart value={MKT_CITY.newShare} label={T(`Yeni tikili`)} size={104} color="#2A8B7E" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <SplitRow color="#2A8B7E" label={T(`Yeni tikili`)} ppm={MKT_DISTRICTS.reduce((s, d) => s + d.ppmNew, 0) / MKT_DISTRICTS.length} share={MKT_CITY.newShare} />
                <SplitRow color="#0F1E3D" label={T(`Köhnə tikili`)} ppm={MKT_DISTRICTS.reduce((s, d) => s + d.ppmOld, 0) / MKT_DISTRICTS.length} share={100 - MKT_CITY.newShare} />
                <div style={{ height: 1, background: "var(--border)" }} />
                <div className="fl-row" style={{ fontSize: 12.5 }}>
                  <span className="muted">{T(`Yeni/köhnə qiymət fərqi`)}</span>
                  <span className="sp" />
                  <strong style={{ color: "var(--orange)" }}>+38%</strong>
                </div>
              </div>
            </div>
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
  return (
    <div className="fl-row" style={{ gap: 10 }}>
      <span style={{ width: 18, fontWeight: 700, fontSize: 12, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{rank}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{name}</span>
      <div style={{ width: 90, height: 6, background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${(value / 13) * 100}%`, height: "100%", background: dir === "up" ? "var(--green)" : "var(--amber)", borderRadius: 99 }} />
      </div>
      <span style={{ width: 52, textAlign: "right", fontWeight: 700, fontSize: 13, color: dir === "up" ? "var(--green)" : "var(--amber)", fontVariantNumeric: "tabular-nums" }}>↑{value.toFixed(1)}%</span>
    </div>
  );
}

function SplitRow({ color, label, ppm, share }: { color: string; label: string; ppm: number; share: number }) {
  return (
    <div className="fl-row" style={{ gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{label}</span>
      <span className="sp" />
      <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 8 }}>{fmtMoney(Math.round(ppm), " ₼/m²")}</span>
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

function SalesDaysChart({ category, region, buffer, agg, height = 420 }: { category: string; region: string; buffer: number; agg: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1120);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setWidth(Math.max(520, Math.round(e.contentRect.width))); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const factor = region === "all" ? 1 : MKT_DISTRICTS.find((d) => d.name === region)!.liq / MKT_CITY.liquidity;
  const data = SALES_DAYS.map((b) => ({
    bucket: b.bucket,
    old: Math.round((agg === "median" ? b.oldMed : b.old) * factor),
    new: Math.round((agg === "median" ? b.newMed : b.new) * factor)
  }));

  const showOld = category === "all" || category === "old";
  const showNew = category === "all" || category === "new";
  const barsPerGroup = (showOld ? 1 : 0) + (showNew ? 1 : 0);

  const padL = 56, padR = 20, padT = 36, padB = 64;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const maxVal = Math.max(...data.flatMap((d) => [(showOld ? d.old : 0) + buffer, (showNew ? d.new : 0) + buffer]));
  const yMax = Math.ceil((maxVal * 1.08) / 50) * 50;
  const sy = (v: number) => padT + innerH - (v / yMax) * innerH;
  const groupW = innerW / data.length;
  const barW = Math.min(64, (groupW * 0.62) / Math.max(1, barsPerGroup));
  const gap = barsPerGroup > 1 ? 10 : 0;

  const COL = { oldBase: "#2A6FDB", oldBuf: "#A9C7F0", newBase: "#D9531E", newBuf: "#F4C6AC" };

  const renderBar = (cx: number, base: number, bufCol: string, baseCol: string, label: string) => {
    const total = base + buffer;
    return (
      <g>
        <rect x={cx - barW / 2} y={sy(base)} width={barW} height={sy(0) - sy(base)} rx="3" fill={baseCol}>
          <title>{`${label}\nBaza: ${base} gün${buffer ? `\n+${buffer} gün ssenari = ${total} gün` : ""}`}</title>
        </rect>
        <text x={cx} y={(sy(0) + sy(base)) / 2 + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="white" fontFamily="Manrope">{base}</text>
        {buffer > 0 && (
          <>
            <rect x={cx - barW / 2} y={sy(total)} width={barW} height={sy(base) - sy(total)} rx="3" fill={bufCol}>
              <title>{`+${buffer} gün ssenari fərziyyəsi`}</title>
            </rect>
            <text x={cx} y={(sy(base) + sy(total)) / 2 + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--navy-900)" fontFamily="Manrope">{buffer}</text>
          </>
        )}
        <text x={cx} y={sy(total) - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-1)" fontFamily="Manrope">{total}</text>
      </g>
    );
  };

  return (
    <div ref={ref} style={{ width: "100%", marginTop: 14 }}>
      <div className="fl-row" style={{ gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        {showOld && (
          <>
            <LegendSwatch color={COL.oldBase} label={T(`Köhnə tikili`)} />
            {buffer > 0 && <LegendSwatch color={COL.oldBuf} label={`Köhnə tikili +${buffer} gün`} />}
          </>
        )}
        {showNew && (
          <>
            <LegendSwatch color={COL.newBase} label={T(`Yeni tikili`)} />
            {buffer > 0 && <LegendSwatch color={COL.newBuf} label={`Yeni tikili +${buffer} gün`} />}
          </>
        )}
        <span className="sp" />
        <span className="muted" style={{ fontSize: 12 }}>{region === "all" ? "Bütün Bakı" : region} · vahid: gün</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const v = (i / 5) * yMax;
          return (
            <g key={i}>
              <line x1={padL} y1={sy(v)} x2={width - padR} y2={sy(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={padL - 10} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" fontFamily="Manrope">{Math.round(v)}</text>
            </g>
          );
        })}
        <text x={16} y={padT + innerH / 2} transform={`rotate(-90 16 ${padT + innerH / 2})`} textAnchor="middle" fontSize="11.5" fill="var(--text-2)" fontFamily="Manrope" fontWeight="600">
          Orta satış günləri
        </text>
        {data.map((d, i) => {
          const gx = padL + i * groupW + groupW / 2;
          const cols: { side: number; base: number; baseCol: string; bufCol: string; label: string }[] = [];
          if (showOld && showNew) {
            cols.push({ side: -1, base: d.old, baseCol: COL.oldBase, bufCol: COL.oldBuf, label: `${d.bucket} · Köhnə tikili` });
            cols.push({ side: 1, base: d.new, baseCol: COL.newBase, bufCol: COL.newBuf, label: `${d.bucket} · Yeni tikili` });
          } else if (showOld) {
            cols.push({ side: 0, base: d.old, baseCol: COL.oldBase, bufCol: COL.oldBuf, label: `${d.bucket} · Köhnə tikili` });
          } else {
            cols.push({ side: 0, base: d.new, baseCol: COL.newBase, bufCol: COL.newBuf, label: `${d.bucket} · Yeni tikili` });
          }
          return (
            <g key={i}>
              {cols.map((c, j) => {
                const cx = barsPerGroup > 1 ? gx + c.side * (barW / 2 + gap / 2) : gx;
                return <g key={j}>{renderBar(cx, c.base, c.bufCol, c.baseCol, c.label)}</g>;
              })}
              <text x={gx} y={height - 30} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-1)" fontFamily="Manrope">{d.bucket}</text>
            </g>
          );
        })}
        <text x={padL + innerW / 2} y={height - 8} textAnchor="middle" fontSize="11.5" fill="var(--text-2)" fontFamily="Manrope" fontWeight="600">{T(`Qiymət aralığı (₼)`)}</text>
      </svg>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="fl-row" style={{ gap: 6 }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
      <span style={{ color: "var(--text-2)", fontSize: 12 }}>{label}</span>
    </div>
  );
}
