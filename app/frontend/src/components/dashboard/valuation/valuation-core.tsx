"use client";

// Core shared pieces for the valuation views, ported 1:1 from the team's
// Homora B2B prototype: the property shape used by the UI, the entry-form
// modal, and the detail report modal. Data is fed from our /valuation/* API
// (mapped from snake_case to the prototype's camelCase shape).

import { useEffect, useMemo, useState } from "react";

import {
  Delta,
  DonutChart,
  Icons,
  InfoCell,
  LineChart,
  Modal,
  fmtMoney,
  fmtPercent,
  genTrend,
  monthsLabels
} from "@/components/dashboard/valuation/valuation-ui";
import type { RayonPrice, ValuationInput, ValuationMeta, ValuationResult } from "@/types/valuation";

// Prototype property shape (camelCase) the UI components expect.
export type OProp = {
  id: string;
  valued: boolean;
  address: string;
  district: string;
  type: string;
  area: number;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  fairValue: number;
  pricePerM2: number;
  monthlyRent: number;
  yield: number;
  payback: number;
  liquidity: number;
  score: number;
  risk: string;
  residence: string | null;
  repair: string | null;
  extract: string | null;
  range: number[];
  rentRange: number[];
  priceBasis?: string;
  marketMedian?: number | null;
};

export function toOProp(r: ValuationResult, id: string, valued = true): OProp {
  return {
    id,
    valued,
    address: r.address || r.rayon || "",
    district: r.rayon || "—",
    type: r.type,
    area: r.area,
    rooms: r.rooms ?? null,
    floor: r.floor ?? null,
    totalFloors: r.total_floors ?? null,
    fairValue: r.fair_value,
    pricePerM2: r.price_per_m2,
    monthlyRent: r.monthly_rent,
    yield: r.yield_pct,
    payback: r.payback_years,
    liquidity: r.liquidity_days,
    score: r.score,
    risk: r.risk,
    residence: r.residence ?? null,
    repair: r.repair ?? null,
    extract: r.extract ?? null,
    range: (r.price_range as number[]) ?? [r.fair_value, r.fair_value],
    rentRange: (r.rent_range as number[]) ?? [r.monthly_rent, r.monthly_rent],
    priceBasis: r.price_basis,
    marketMedian: r.market_median_kvm ?? null
  };
}

export type Stats = {
  n: number;
  totalValue: number;
  totalRent: number;
  avgYield: number;
  avgScore: number;
  avgPayback: number;
  avgPricePerM2: number;
  avgLiquidity: number;
  avgArea: number;
  newCount: number;
  byDistrict: Record<string, number>;
};

export function statsOf(items: OProp[]): Stats {
  const xs = items.filter((x) => x.valued !== false);
  const n = xs.length;
  if (n === 0)
    return { n: 0, totalValue: 0, totalRent: 0, avgYield: 0, avgScore: 0, avgPayback: 0, avgPricePerM2: 0, avgLiquidity: 0, avgArea: 0, newCount: 0, byDistrict: {} };
  const sum = (f: (x: OProp) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0);
  return {
    n,
    totalValue: sum((x) => x.fairValue),
    totalRent: sum((x) => x.monthlyRent),
    avgYield: +(sum((x) => x.yield) / n).toFixed(2),
    avgScore: Math.round(sum((x) => x.score) / n),
    avgPayback: +(sum((x) => x.payback) / n).toFixed(1),
    avgPricePerM2: Math.round(sum((x) => x.pricePerM2) / n),
    avgLiquidity: Math.round(sum((x) => x.liquidity) / n),
    avgArea: Math.round(sum((x) => x.area) / n),
    newCount: xs.filter((x) => (x.type || "").toLowerCase().includes("yeni")).length,
    byDistrict: xs.reduce<Record<string, number>>((m, x) => {
      m[x.district] = (m[x.district] || 0) + 1;
      return m;
    }, {})
  };
}

// ── Entry form modal (ported markup; submits a ValuationInput) ─────────

const REPAIR_OPTIONS = ["Əla", "Var", "Orta", "Yox"];
const EXTRACT_OPTIONS = ["Var", "Yox"];
const TYPE_OPTIONS = ["Yeni tikili", "Köhnə tikili"];
const RESIDENCE_YN = ["Bəli", "Xeyr"];

type FormState = {
  address: string;
  rayon: string;
  type: string;
  repair: string;
  extract: string;
  isResidence: string;
  residence: string;
  area: string;
  totalFloors: string;
  floor: string;
  rooms: string;
};

// Residence options from the prototype's "Yaşayış kompleksi adı" select.
const RESIDENCES = [
  "Port Baku Residence", "White City", "Crescent Place", "Demirchi Tower",
  "Khazar Islands", "Old City Plaza", "Caspian Plaza", "Park Bulvar Towers",
  "Sea Breeze", "Garden Plaza", "Mətanət-A Yasamal", "AAAF Park"
];

const emptyForm = (): FormState => ({
  address: "", rayon: "", type: "", repair: "", extract: "", isResidence: "",
  residence: "", area: "", totalFloors: "", floor: "", rooms: ""
});

const fromOProp = (p: OProp): FormState => ({
  address: p.address || "",
  rayon: p.district || "",
  type: p.type || "",
  repair: p.repair || "",
  extract: p.extract || "",
  isResidence: p.residence ? "Bəli" : "",
  residence: p.residence || "",
  area: p.area != null ? String(p.area) : "",
  totalFloors: p.totalFloors != null ? String(p.totalFloors) : "",
  floor: p.floor != null ? String(p.floor) : "",
  rooms: p.rooms != null ? String(p.rooms) : ""
});

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", display: "block", marginBottom: 6 }}>
      {children}
      {hint && <span style={{ display: "block", fontSize: 11.5, color: "var(--text-3)", fontWeight: 500, marginTop: 3 }}>{hint}</span>}
    </label>
  );
}
function HintRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="fl-row" style={{ gap: 6, marginTop: 6, fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.4 }}>
      <Icons.Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}
const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid var(--border)", borderRadius: 12,
  background: "var(--card)", color: "var(--text-1)", font: "inherit", outline: "none"
};

export function PropertyEntryModal({
  open,
  onClose,
  onSubmit,
  portfolioName,
  meta,
  initial,
  busy
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ValuationInput, valued: boolean) => void;
  portfolioName: string;
  meta?: ValuationMeta | null;
  initial?: OProp | null;
  busy?: boolean;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormState>(() => (initial ? fromOProp(initial) : emptyForm()));
  const upd = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(initial ? fromOProp(initial) : emptyForm());
  }, [open, initial]);

  const rayonOptions = useMemo(() => (meta?.rayons ?? []).map((r: RayonPrice) => r.rayon), [meta]);
  // Same required fields as the prototype: ünvan, növ, sahə, otaq.
  const valid = !!form.address && !!form.type && !!form.area && !!form.rooms;

  const build = (): ValuationInput => ({
    address: form.address.trim() || null,
    rayon: form.rayon || guessRayon(form.address, rayonOptions),
    type: form.type,
    area: +form.area || 0,
    rooms: form.rooms ? +form.rooms : null,
    floor: form.floor ? +form.floor : null,
    total_floors: form.totalFloors ? +form.totalFloors : null,
    repair: form.repair || null,
    extract: form.extract || null,
    residence: form.isResidence === "Bəli" ? form.residence || null : null
  });

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="crumbs" style={{ marginBottom: 4 }}>
              <span>{portfolioName}</span>
              <span className="sep">/</span>
              <span>{isEdit ? "Mənzili redaktə et" : "Yeni qiymətləndirmə"}</span>
            </div>
            <div className="modal-title">Mənzil haqqında məlumat</div>
          </div>
          <div className="sp" />
          <div className="fl-row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: "var(--orange)", color: "var(--orange)", borderRadius: 99, padding: "6px 14px" }}>
              <Icons.Sort size={14} /> Parametrlə qiymətləndir
            </button>
            <button className="btn btn-ghost btn-sm" style={{ borderRadius: 99, padding: "6px 14px" }}>
              <Icons.Layers size={14} /> Elan linki ilə qiymətləndir
            </button>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icons.X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "24px 28px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "22px 24px" }}>
            {/* Row 1 — exactly as the prototype: Ünvan (span 2) | Mənzil növü */}
            <div style={{ gridColumn: "span 2" }}>
              <FieldLabel>Ünvan</FieldLabel>
              <div style={{ position: "relative" }}>
                <input value={form.address} onChange={(e) => upd("address", e.target.value)} placeholder="Ünvan" style={fieldStyle} />
                <button className="btn btn-sm" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", borderRadius: 99, border: "1.5px solid var(--orange)", color: "var(--orange)", background: "var(--card)", padding: "6px 14px", fontWeight: 600 }}>
                  <Icons.MapPin size={13} /> Xəritədən seç
                </button>
              </div>
              <HintRow>Dəqiq qiymətləndirmə üçün tam ünvanı daxil edin (məs. Mir Cəlal küç. 89) və ya xəritədən mənzilin yerləşdiyi binanı seçin.</HintRow>
            </div>
            <div>
              <FieldLabel>Mənzil növü</FieldLabel>
              <Select value={form.type} onChange={(v) => upd("type", v)} options={TYPE_OPTIONS} />
            </div>

            {/* Row 2 — Təmir | Çıxarış | Rezidens (with hint) */}
            <div>
              <FieldLabel>Təmir vəziyyəti</FieldLabel>
              <Select value={form.repair} onChange={(v) => upd("repair", v)} options={REPAIR_OPTIONS} />
            </div>
            <div>
              <FieldLabel>Çıxarış</FieldLabel>
              <Select value={form.extract} onChange={(v) => upd("extract", v)} options={EXTRACT_OPTIONS} />
            </div>
            <div>
              <FieldLabel>Yaşayış kompleksi (rezidens)</FieldLabel>
              <Select value={form.isResidence} onChange={(v) => upd("isResidence", v)} options={RESIDENCE_YN} />
              <HintRow>Rezidensiya və ya kompleksdirsə — Bəli. Adi binalar bu kateqoriyaya aid deyil.</HintRow>
            </div>

            {/* Row 3 — Kompleks adı | Sahə | Binanın mərtəbə sayı */}
            <div>
              <FieldLabel>Yaşayış kompleksi adı</FieldLabel>
              <Select value={form.residence} onChange={(v) => upd("residence", v)} options={RESIDENCES} />
            </div>
            <div>
              <FieldLabel>Sahə kv.m</FieldLabel>
              <div style={{ position: "relative" }}>
                <input value={form.area} onChange={(e) => upd("area", e.target.value)} placeholder="Sahə kv.m" inputMode="numeric" style={{ ...fieldStyle, paddingRight: 48 }} />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 12, fontWeight: 500, pointerEvents: "none" }}>m²</span>
              </div>
            </div>
            <div>
              <FieldLabel>Binanın mərtəbə sayı</FieldLabel>
              <input value={form.totalFloors} onChange={(e) => upd("totalFloors", e.target.value)} placeholder="Binanın mərtəbə sayı" inputMode="numeric" style={fieldStyle} />
            </div>

            {/* Row 4 — Yerləşdiyi mərtəbə | Otaq sayı | (empty) */}
            <div>
              <FieldLabel>Yerləşdiyi mərtəbə</FieldLabel>
              <input value={form.floor} onChange={(e) => upd("floor", e.target.value)} placeholder="Yerləşdiyi mərtəbə" inputMode="numeric" style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Otaq sayı</FieldLabel>
              <input value={form.rooms} onChange={(e) => upd("rooms", e.target.value)} placeholder="Otaq sayı" inputMode="numeric" style={fieldStyle} />
            </div>
            <div />
          </div>

          <div style={{ marginTop: 22, padding: "12px 14px", background: "var(--orange-tint)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-2)" }}>
            <Icons.Sparkle size={14} style={{ color: "var(--orange)", flexShrink: 0 }} />
            <span>
              <strong style={{ color: "var(--text-1)" }}>Yadda saxla</strong> — mənzili portfelə əlavə et, qaralama olaraq saxla.
              <strong style={{ color: "var(--text-1)", marginLeft: 6 }}>Qiymətləndir</strong> — dərhal fair value, kirayə və skoru hesabla.
            </span>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", background: "var(--card-2)", display: "flex", gap: 10, alignItems: "center" }}>
          {isEdit && (
            <span className="muted" style={{ fontSize: 12 }}>
              <Icons.File size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              ID: <strong style={{ color: "var(--text-1)" }}>{initial!.id}</strong>
            </span>
          )}
          <span className="sp" />
          <button className="btn btn-ghost" onClick={onClose}>Ləğv et</button>
          <button className="btn btn-secondary" disabled={!valid || busy} onClick={() => onSubmit(build(), false)} style={{ opacity: valid ? 1 : 0.55 }}>
            <Icons.Bookmark size={14} /> Yadda saxla
          </button>
          <button className="btn btn-primary btn-lg" disabled={!valid || busy} onClick={() => onSubmit(build(), true)} style={{ opacity: valid ? 1 : 0.55 }}>
            <Icons.Sparkle size={16} /> {busy ? "Hesablanır…" : "Qiymətləndir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, options, placeholder = "Seçin" }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, appearance: "none", cursor: "pointer", paddingRight: 36, color: value ? "var(--text-1)" : "var(--text-3)" }}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <Icons.ChevronDown size={16} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-3)" }} />
    </div>
  );
}

function guessRayon(address: string, rayons: string[]): string | null {
  if (!address) return null;
  const a = address.toLowerCase();
  const hit = rayons.find((r) => a.includes(r.replace(/\s*rayonu$/i, "").toLowerCase()));
  return hit ?? null;
}

// ── Property detail report modal (ported 1:1) ─────────────────────────

export function PropertyReport({
  property,
  portfolioName,
  itemsCount,
  stats,
  rank,
  onClose,
  onPrev,
  onNext
}: {
  property: OProp;
  portfolioName: string;
  itemsCount: number;
  stats: Stats;
  rank: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const p = property;
  const salesTrend = useMemo(() => genTrend(p.fairValue, 0.08, parseInt(p.id.slice(-3)) || 1), [p.id, p.fairValue]);
  const rentTrend = useMemo(() => genTrend(p.monthlyRent, 0.06, (parseInt(p.id.slice(-3)) || 1) + 3), [p.id, p.monthlyRent]);
  const labels = monthsLabels("2025-06");
  const deltaPct = (v: number, avg: number) => (avg ? +(((v - avg) / avg) * 100).toFixed(1) : 0);

  const benches = [
    { k: "500m radiusda orta qiymət", v: fmtMoney(Math.round(p.pricePerM2 * 0.98), " ₼/m²"), d: -1.2 },
    { k: "Kirayə gəlirliyi", v: fmtPercent(p.yield), d: deltaPct(p.yield, stats.avgYield), vsLabel: "portfel orta" },
    { k: "Kirayə ilə geri ödəmə", v: `${p.payback} il`, d: deltaPct(p.payback, stats.avgPayback), invert: true, vsLabel: "portfel orta" },
    { k: "Mənzilin qiymət artımı (12 ay)", v: "+9.1%", d: 9.1 },
    { k: "Bakı üzrə qiymət artımı", v: "+10.2%", d: 10.2 },
    { k: `${p.district} üzrə qiymət artımı`, v: "+10.1%", d: 10.1 }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="crumbs" style={{ marginBottom: 4 }}>
              <span>{portfolioName}</span>
              <span className="sep">/</span>
              <span>{p.id}</span>
            </div>
            <div className="modal-title">Nəticə · {p.address}</div>
          </div>
          <div className="sp" />
          <button className="btn btn-ghost btn-sm" onClick={onPrev} title="Əvvəlki"><Icons.ChevronLeft size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={onNext} title="Növbəti"><Icons.ChevronRight size={14} /></button>
          <div className="divider-y" style={{ height: 22, margin: "0 4px" }} />
          <button className="btn btn-secondary btn-sm"><Icons.PDF size={14} /> PDF</button>
          <button className="modal-close" onClick={onClose}><Icons.X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
            <div className="cell-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Ünvan</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{p.address}</div>
          </div>

          <div className="info-grid" style={{ marginBottom: 16 }}>
            <InfoCell k="Mənzil növü">{p.type}</InfoCell>
            <InfoCell k="Təmir vəziyyəti">{p.repair ?? "—"}</InfoCell>
            <InfoCell k="Çıxarış">{p.extract ?? "—"}</InfoCell>
            <InfoCell k="Sahə kv.m">{p.area} kv.m</InfoCell>
            <InfoCell k="Binanın mərtəbə sayı">{p.totalFloors ?? "—"}</InfoCell>
            <InfoCell k="Otaq sayı">{p.rooms ?? "—"}</InfoCell>
            <InfoCell k="Yaşayış kompleksi">{p.residence ? `Bəli (${p.residence})` : "Xeyr"}</InfoCell>
            <InfoCell k="Yerləşdiyi mərtəbə">{p.floor ?? "—"}</InfoCell>
          </div>

          <div className="big-tiles" style={{ marginBottom: 18 }}>
            <div className="big-tile">
              <div className="label">Süni intellektin qiyməti <Icons.Info className="info" /></div>
              <div className="big">{fmtMoney(p.fairValue)} <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 600 }}>({fmtMoney(p.pricePerM2, " ₼/kv.m")})</span></div>
              <div className="rng-label">Qiymət aralığı:</div>
              <div className="rng">{fmtMoney(p.range[0])} – {fmtMoney(p.range[1])}</div>
              {p.marketMedian ? (
                <div className="rng" style={{ marginTop: 6, fontSize: 12 }}>
                  Bazar medyanı: <strong style={{ color: "var(--text-1)" }}>{fmtMoney(p.marketMedian, " ₼/m²")}</strong>
                  {" · qaynaq: "}{p.priceBasis === "rayon" ? "rayon" : p.priceBasis === "market" ? "şəhər" : "ehtiyat"}
                </div>
              ) : null}
            </div>
            <div className="big-tile">
              <div className="label">Kirayə qiyməti <Icons.Info className="info" /></div>
              <div className="big">{fmtMoney(p.monthlyRent)} <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 600 }}>/ ay</span></div>
              <div className="rng-label">Kirayə qiymətləndirilməsi aralığı:</div>
              <div className="rng">{fmtMoney(p.rentRange[0])} – {fmtMoney(p.rentRange[1])}</div>
              <div className="rng" style={{ marginTop: 6, fontSize: 12 }}>Kirayə/gəlirlilik modellənmiş təxmindir.</div>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 18 }}>
            <div className="fl-row" style={{ gap: 16, flexWrap: "wrap" }}>
              <DonutChart value={p.score} label="Sərmayə skoru" size={84} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="card-title">Sərmayə skoru: {p.score}/100</div>
                <div className="card-sub" style={{ marginTop: 4, maxWidth: "52ch" }}>
                  Bu mənzil <strong>{portfolioName}</strong> portfelində <strong>#{rank} / {itemsCount}</strong> sırasındadır (gəlirlilik və risk üzrə).
                </div>
              </div>
              <div className="divider-y" style={{ height: 60 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, flex: 1, minWidth: 320 }}>
                <PortDelta label="Fair value vs portfel" value={fmtMoney(p.fairValue)} delta={deltaPct(p.fairValue, stats.totalValue / Math.max(stats.n, 1))} />
                <PortDelta label="Gəlirlilik vs portfel" value={fmtPercent(p.yield)} delta={deltaPct(p.yield, stats.avgYield)} />
                <PortDelta label="Likvidlik vs portfel" value={`${p.liquidity} gün`} delta={deltaPct(p.liquidity, stats.avgLiquidity)} invert />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="chart-title" style={{ marginBottom: 8 }}>Sərmayə dəyərləndirməsi</div>
            <div className="bench-row">
              {benches.map((b, i) => (
                <div key={i} className="bench">
                  <div className="k">{b.k}</div>
                  <div className="v">{b.v}</div>
                  {b.d != null && (
                    <div className="d">
                      <Delta value={b.d} invert={b.invert} />
                      {b.vsLabel && <span className="muted" style={{ marginLeft: 4 }}>{b.vsLabel}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: 14 }}>
            <div className="chart-title">Satış qiymətinin trendi</div>
            <div className="chart-sub">Qrafik son 1 ildə qiymətləndirilmiş potensial satış dəyərinin dinamikasını əks etdirir.</div>
            <LineChart data={salesTrend} labels={labels} height={220} color="#2A8B7E" />
          </div>

          <div className="card chart-card" style={{ marginBottom: 14 }}>
            <div className="chart-title">Kirayə qiymətinin trendi</div>
            <div className="chart-sub">Qrafik son 1 ildə qiymətləndirilmiş potensial kirayə qiymətinin dinamikasını əks etdirir.</div>
            <LineChart data={rentTrend} labels={labels} height={200} color="#D9531E" />
          </div>

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 6 }}>Analitik şərhi</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              Mənzilin sərmayə dəyərləndirməsi <strong>{p.score >= 78 ? "yuxarı" : p.score >= 60 ? "orta" : "aşağı"}</strong> səviyyəlidir.
              Süni intellekt əsasında qiymətləndirilmiş bazar dəyəri <strong>{fmtMoney(p.fairValue)}</strong>, aylıq kirayə dəyəri <strong>{fmtMoney(p.monthlyRent)}</strong> təyin edilmişdir.
              İllik kirayə gəlirliyi <strong>{p.yield}%</strong> (portfel ortası ilə müqayisədə <Delta value={deltaPct(p.yield, stats.avgYield)} />) və geri ödəmə müddəti <strong>{p.payback} il</strong> təxmin edilmişdir.
              Orta likvidlik müddəti <strong>{p.liquidity} gün</strong>dür.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortDelta({ label, value, delta, invert = false }: { label: string; value: string; delta: number; invert?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-1)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ marginTop: 2 }}><Delta value={delta} invert={invert} /></div>
    </div>
  );
}
