"use client";

// Core shared pieces for the valuation views, ported 1:1 from the team's
// Homora B2B prototype: the property shape used by the UI, the entry-form
// modal, and the detail report modal. Data is fed from our /valuation/* API
// (mapped from snake_case to the prototype's camelCase shape).

import { useEffect, useMemo, useState } from "react";
import { T } from "@/components/dashboard/valuation/valuation-i18n";
import { usePlacesAutocomplete } from "@/components/dashboard/valuation/valuation-maps";
import { MapPicker } from "@/components/dashboard/valuation/valuation-map-picker";

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

// Repair is now a 2-option field (team task #4), per the rate-my-apartment form.
const REPAIR_OPTIONS = ["Təmirli", "Təmirsiz"];
const EXTRACT_OPTIONS = ["Var", "Yoxdur"];
const TYPE_OPTIONS = ["Yeni tikili", "Köhnə tikili"];
const RESIDENCE_YN = ["Bəli", "Xeyr"];
const isOldBuild = (type: string) => (type || "").toLowerCase().includes("köhn") || (type || "").toLowerCase().includes("kohn");

// Numeric validation ranges (BA prompt #11).
const RANGES = {
  area: [20, 400],
  rooms: [1, 10],
  totalFloors: [1, 35],
  floor: [1, 35]
} as const;

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

// Residence / yaşayış kompleksi list (team #7 — official list).
const RESIDENCES = [
  "Digər", "28 Residence", "4You Baku", "Akhundov Residence", "Ark Azure",
  "Avant Vista", "Avenue 8", "Bahar Residence", "Baki Müasir Yaşayış Kompleksi",
  "Baku City Residence", "Bakı Ağ Şəhər - Majestic Palace", "Bakı Bağları",
  "Bakı Müasir Yaşayış Kompleksi", "Bağça Şəhər", "Belvedere", "Boulevard Palace",
  "Central Towers", "Delmar Residense", "East Park", "Eleven Park", "Firavan Park",
  "Galaxy-Park", "Grand Plaza", "Green Palace", "Greenville Residence",
  "Inci Residence Günəşli", "Jasmin Park", "Kempinski Residences Bayıl Bay",
  "Knightsbridge Residence", "Koroğlu Residence", "Kristal Abşeron", "Lake City",
  "Lux Residence", "Luxe Home", "Malibo Residence", "Mardi Mekan Estate",
  "Mayak Residence", "Mehli Yaşayış Kompleksi", "Melissa Group",
  "Mida Yaşayış Kompleksi", "Mirvari Park", "Nizami City", "Park Academy",
  "Park Nərimanov", "Park Çinar", "Qaya Qala Residence", "Qurtuluş 93",
  "Renessans Palace", "Riva Residence", "Sea Breeze Arabian Ranches",
  "Sea Breeze Blue Waters", "Sea Breeze Gardens Residences",
  "Sea Breeze Lighthouse 2", "Sea Breeze Marina Village",
  "Sea Breeze Miami Residence", "Sea Breeze Palazzo Del Mare",
  "Sea Breeze Palm Beach", "Sea Breeze Park Lane", "Sea Breeze Park Residences",
  "Sea Breeze Polo Residences", "Sea Breeze Prime Residence", "Sea Breeze Sky Park",
  "Sea Breeze Swissôtel & Raffle Residences", "Triumf Palace", "West Town",
  "White Garden", "Xətai Park", "Yacht Club Residences",
  "Yaşamal By Azadlıq Residence", "Zirvə Park", "Zümrüd Residence", "Çinarlı Park"
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
  isResidence: p.residence ? "Bəli" : isOldBuild(p.type) ? "Xeyr" : "",
  residence: p.residence || "",
  area: p.area != null ? String(p.area) : "",
  totalFloors: p.totalFloors != null ? String(p.totalFloors) : "",
  floor: p.floor != null ? String(p.floor) : "",
  rooms: p.rooms != null ? String(p.rooms) : ""
});

// ── Validation (BA prompt #11). Returns field→message map (AZ source). ──
type FormErrors = Partial<Record<keyof FormState, string>>;
function validateForm(f: FormState): FormErrors {
  const e: FormErrors = {};
  const req = "Bu sahə tələb olunur!";
  if (!f.address.trim()) e.address = req;
  if (!f.type) e.type = req;
  if (!f.repair) e.repair = req;
  if (!f.extract) e.extract = req;
  if (!f.isResidence) e.isResidence = req;
  // Residence name only required when "Bəli" (and not an old build).
  if (f.isResidence === "Bəli" && !isOldBuild(f.type) && !f.residence) e.residence = req;

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const checks: [keyof FormState, readonly [number, number], string][] = [
    ["area", RANGES.area, "Sahə 20 ilə 400 arası olmalıdır!"],
    ["rooms", RANGES.rooms, "Otaq sayı 1 ilə 10 arası olmalıdır!"],
    ["totalFloors", RANGES.totalFloors, "Binanın mərtəbə sayı 1 ilə 35 arası olmalıdır!"],
    ["floor", RANGES.floor, "Yerləşdiyi mərtəbə 1 ilə 35 arası olmalıdır!"]
  ];
  for (const [key, [lo, hi], msg] of checks) {
    const v = num(f[key]);
    if (v == null) e[key] = req;
    else if (Number.isNaN(v) || v < lo || v > hi) e[key] = msg;
  }
  // Cross-field: floor cannot exceed building floors.
  const fl = num(f.floor), tf = num(f.totalFloors);
  if (fl != null && tf != null && !Number.isNaN(fl) && !Number.isNaN(tf) && fl > tf) {
    e.floor = "Yerləşdiyi mərtəbə binanın mərtəbəsindən çox ola bilməz!";
  }
  return e;
}

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
const errBorder = (hasErr?: boolean): React.CSSProperties =>
  hasErr ? { borderColor: "var(--red)", boxShadow: "0 0 0 3px var(--red-soft)" } : {};
function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--red)", fontWeight: 600 }}>{T(msg)}</div>;
}

export function PropertyEntryModal({
  open,
  onClose,
  onSubmit,
  onSubmitLink,
  allowLink = false,
  initialMode = "form",
  portfolioName,
  meta,
  initial,
  busy
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ValuationInput, valued: boolean) => void;
  // Elan linki flow (single view only). When provided + allowLink, a link tab
  // is offered; submitting sends ONLY the URL (BA §2.2).
  onSubmitLink?: (url: string) => void;
  allowLink?: boolean;
  initialMode?: "form" | "link";
  portfolioName: string;
  meta?: ValuationMeta | null;
  initial?: OProp | null;
  busy?: boolean;
}) {
  const isEdit = !!initial;
  const [mode, setMode] = useState<"form" | "link">("form");
  const [link, setLink] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => (initial ? fromOProp(initial) : emptyForm()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<string | null>(null);
  const upd = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Coordinates from the Google address picker (#1/#2). Present only when the
  // user selects an autocomplete suggestion; cleared on manual typing. Drive
  // the real predict model — when absent the form falls back to DB-median.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addrFocus, setAddrFocus] = useState(false);
  const addrAc = usePlacesAutocomplete();

  // Address typing → fetch suggestions + invalidate any previous coordinates.
  const onAddressChange = (v: string) => {
    upd("address", v);
    setCoords(null);
    addrAc.search(v);
  };
  // Picking a suggestion fills the address + locks in its coordinates.
  const onPickAddress = async (id: string) => {
    const r = await addrAc.pick(id);
    if (!r) return;
    setForm((f) => ({ ...f, address: r.address }));
    setCoords({ lat: r.lat, lng: r.lng });
    setAddrFocus(false);
  };

  // "Xəritədən seç" — pick a point on the map; same effect as an autocomplete
  // pick (address + coordinates). Falls back to the coordinates as the address
  // text when reverse-geocoding isn't available.
  const [pickerOpen, setPickerOpen] = useState(false);
  const onMapPick = (lat: number, lng: number, address: string) => {
    const a = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setForm((f) => ({ ...f, address: a }));
    setCoords({ lat, lng });
    setAddrFocus(false);
    addrAc.clear();
    setPickerOpen(false);
  };

  useEffect(() => {
    if (open) {
      setForm(initial ? fromOProp(initial) : emptyForm());
      setCoords(null);
      setAddrFocus(false);
      setPickerOpen(false);
      addrAc.clear();
      setErrors({});
      setToast(null);
      // Edit always opens the form; new entries honour the requested tab.
      setMode(initial ? "form" : allowLink ? initialMode : "form");
      setLink("");
      setLinkErr(null);
    }
  }, [open, initial]);

  // Validate + submit a listing link. Only bina.az / emlak.az are accepted;
  // the payload is URL-only — no form state ever leaks into the link flow.
  const trySubmitLink = () => {
    const raw = link.trim();
    if (!raw) {
      setLinkErr("Elan linkini daxil edin (bina.az və ya emlak.az)");
      return;
    }
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let host = "";
    try {
      host = new URL(href).hostname.toLowerCase();
    } catch {
      setLinkErr("Link formatı düzgün deyil");
      return;
    }
    if (!/(^|\.)(bina\.az|emlak\.az)$/.test(host)) {
      setLinkErr("Yalnız bina.az və ya emlak.az linki daxil edin");
      return;
    }
    setLinkErr(null);
    onSubmitLink?.(href);
  };

  // Residence gating (#6 + validation rule): "Köhnə tikili" forces
  // "Yaşayış kompleksi = Xeyr" and clears the complex name.
  useEffect(() => {
    if (isOldBuild(form.type) && (form.isResidence !== "Xeyr" || form.residence)) {
      setForm((f) => ({ ...f, isResidence: "Xeyr", residence: "" }));
    }
  }, [form.type, form.isResidence, form.residence]);

  const oldBuild = isOldBuild(form.type);
  const rayonOptions = useMemo(() => (meta?.rayons ?? []).map((r: RayonPrice) => r.rayon), [meta]);

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
    residence: form.isResidence === "Bəli" ? form.residence || null : null,
    // Coordinates from the Google address picker (#1/#2); null when the user
    // typed the address by hand (→ DB-median fallback rather than predict).
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null
  });

  // Validate before submit; on "Qiymətləndir" the full rule-set runs and no
  // API request is sent when invalid. "Yadda saxla" (draft) only needs the
  // basics so a partial entry can be stored.
  const trySubmit = (valued: boolean) => {
    let e: FormErrors;
    if (valued) {
      e = validateForm(form);
    } else {
      e = {};
      if (!form.address.trim()) e.address = "Bu sahə tələb olunur!";
      if (!form.type) e.type = "Bu sahə tələb olunur!";
    }
    setErrors(e);
    const firstKey = Object.keys(e)[0] as keyof FormState | undefined;
    if (firstKey) {
      setToast(e[firstKey] ?? "Bu sahə tələb olunur!");
      return;
    }
    setToast(null);
    onSubmit(build(), valued);
  };

  if (!open) return null;

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="crumbs" style={{ marginBottom: 4 }}>
              <span>{portfolioName}</span>
              <span className="sep">/</span>
              <span>{isEdit ? "Mənzili redaktə et" : "Yeni qiymətləndirmə"}</span>
            </div>
            <div className="modal-title">{T(`Mənzil haqqında məlumat`)}</div>
          </div>
          <div className="sp" />
          {allowLink && !isEdit && (
            <div className="fl-row" style={{ gap: 6 }}>
              <button
                className={`btn btn-sm ${mode === "form" ? "btn-secondary" : "btn-ghost"}`}
                style={{ borderRadius: 99, padding: "6px 14px", ...(mode === "form" ? { borderColor: "var(--orange)", color: "var(--orange)" } : {}) }}
                onClick={() => setMode("form")}
              >
                <Icons.Sort size={14} /> {T(`Parametrlə qiymətləndir`)}
              </button>
              <button
                className={`btn btn-sm ${mode === "link" ? "btn-secondary" : "btn-ghost"}`}
                style={{ borderRadius: 99, padding: "6px 14px", ...(mode === "link" ? { borderColor: "var(--orange)", color: "var(--orange)" } : {}) }}
                onClick={() => setMode("link")}
              >
                <Icons.Layers size={14} /> {T(`Elan linki ilə qiymətləndir`)}
              </button>
            </div>
          )}
          <button className="modal-close" onClick={onClose}>
            <Icons.X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "24px 28px 24px" }}>
          {toast && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--red-soft)", color: "var(--red)", borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.Info size={14} /> {T(toast)}
            </div>
          )}
          {mode === "link" && (
            <div>
              <FieldLabel>{T(`Elan linki ilə qiymətləndir`)}</FieldLabel>
              <input
                value={link}
                onChange={(e) => { setLink(e.target.value); if (linkErr) setLinkErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") trySubmitLink(); }}
                placeholder="https://bina.az/items/..."
                style={{ ...fieldStyle, ...errBorder(!!linkErr) }}
              />
              <FieldErr msg={linkErr ?? undefined} />
              <HintRow>{T(`Elan linkini daxil edin (bina.az və ya emlak.az)`)}</HintRow>
            </div>
          )}
          {mode === "form" && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "22px 24px" }}>
            {/* Row 1 — Ünvan (span 2) | Mənzil növü */}
            <div style={{ gridColumn: "span 2" }}>
              <FieldLabel>{T(`Ünvan`)}</FieldLabel>
              <div style={{ position: "relative" }}>
                <input value={form.address} onChange={(e) => onAddressChange(e.target.value)} onFocus={() => setAddrFocus(true)} onBlur={() => setTimeout(() => setAddrFocus(false), 150)} placeholder={T(`Ünvan`)} autoComplete="off" style={{ ...fieldStyle, ...errBorder(!!errors.address) }} />
                <button type="button" onClick={() => setPickerOpen(true)} className="btn btn-sm" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", borderRadius: 99, border: "1.5px solid var(--orange)", color: "var(--orange)", background: "var(--card)", padding: "6px 14px", fontWeight: 600 }}>
                  <Icons.MapPin size={13} /> {T(`Xəritədən seç`)}
                </button>
                {addrFocus && addrAc.suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: 264, overflowY: "auto" }}>
                    {addrAc.suggestions.map((s) => (
                      <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPickAddress(s.id)} style={{ display: "flex", gap: 9, alignItems: "center", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 14, color: "inherit", lineHeight: 1.3 }}>
                        <Icons.MapPin size={14} /> <span>{s.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <FieldErr msg={errors.address} />
              <HintRow>{T(`Dəqiq qiymətləndirmə üçün tam ünvanı daxil edin (məs. Mir Cəlal küç. 89) və ya xəritədən mənzilin yerləşdiyi binanı seçin.`)}</HintRow>
            </div>
            <div>
              <FieldLabel>{T(`Mənzil növü`)}</FieldLabel>
              <Select value={form.type} onChange={(v) => upd("type", v)} options={TYPE_OPTIONS} error={!!errors.type} />
              <FieldErr msg={errors.type} />
            </div>

            {/* Row 2 — Təmir | Çıxarış | Rezidens */}
            <div>
              <FieldLabel>{T(`Təmir vəziyyəti`)}</FieldLabel>
              <Select value={form.repair} onChange={(v) => upd("repair", v)} options={REPAIR_OPTIONS} error={!!errors.repair} />
              <FieldErr msg={errors.repair} />
            </div>
            <div>
              <FieldLabel>{T(`Çıxarış`)}</FieldLabel>
              <Select value={form.extract} onChange={(v) => upd("extract", v)} options={EXTRACT_OPTIONS} error={!!errors.extract} />
              <FieldErr msg={errors.extract} />
            </div>
            <div>
              <FieldLabel>{T(`Yaşayış kompleksi (rezidens)`)}</FieldLabel>
              <Select value={form.isResidence} onChange={(v) => upd("isResidence", v)} options={RESIDENCE_YN} error={!!errors.isResidence} disabled={oldBuild} />
              <FieldErr msg={errors.isResidence} />
              <HintRow>{oldBuild ? T(`Köhnə tikili üçün yaşayış kompleksi seçimi tələb olunmur.`) : T(`Rezidensiya və ya kompleksdirsə — Bəli. Adi binalar bu kateqoriyaya aid deyil.`)}</HintRow>
            </div>

            {/* Row 3 — Kompleks adı | Sahə | Binanın mərtəbə sayı */}
            <div>
              <FieldLabel>{T(`Yaşayış kompleksi adı`)}</FieldLabel>
              <Select value={form.residence} onChange={(v) => upd("residence", v)} options={RESIDENCES} error={!!errors.residence} disabled={form.isResidence !== "Bəli"} />
              <FieldErr msg={errors.residence} />
            </div>
            <div>
              <FieldLabel>{T(`Sahə kv.m`)}</FieldLabel>
              <div style={{ position: "relative" }}>
                <input value={form.area} onChange={(e) => upd("area", e.target.value)} placeholder={T(`Sahə kv.m`)} inputMode="numeric" style={{ ...fieldStyle, ...errBorder(!!errors.area), paddingRight: 48 }} />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 12, fontWeight: 500, pointerEvents: "none" }}>m²</span>
              </div>
              <FieldErr msg={errors.area} />
            </div>
            <div>
              <FieldLabel>{T(`Binanın mərtəbə sayı`)}</FieldLabel>
              <input value={form.totalFloors} onChange={(e) => upd("totalFloors", e.target.value)} placeholder={T(`Binanın mərtəbə sayı`)} inputMode="numeric" style={{ ...fieldStyle, ...errBorder(!!errors.totalFloors) }} />
              <FieldErr msg={errors.totalFloors} />
            </div>

            {/* Row 4 — Yerləşdiyi mərtəbə | Otaq sayı | Qiymətləndirmə tarixi */}
            <div>
              <FieldLabel>{T(`Yerləşdiyi mərtəbə`)}</FieldLabel>
              <input value={form.floor} onChange={(e) => upd("floor", e.target.value)} placeholder={T(`Yerləşdiyi mərtəbə`)} inputMode="numeric" style={{ ...fieldStyle, ...errBorder(!!errors.floor) }} />
              <FieldErr msg={errors.floor} />
            </div>
            <div>
              <FieldLabel>{T(`Otaq sayı`)}</FieldLabel>
              <input value={form.rooms} onChange={(e) => upd("rooms", e.target.value)} placeholder={T(`Otaq sayı`)} inputMode="numeric" style={{ ...fieldStyle, ...errBorder(!!errors.rooms) }} />
              <FieldErr msg={errors.rooms} />
            </div>
            <div />
          </div>

          <div style={{ marginTop: 22, padding: "12px 14px", background: "var(--orange-tint)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-2)" }}>
            <Icons.Sparkle size={14} style={{ color: "var(--orange)", flexShrink: 0 }} />
            <span>
              <strong style={{ color: "var(--text-1)" }}>{T(`Yadda saxla`)}</strong> — mənzili portfelə əlavə et, qaralama olaraq saxla.
              <strong style={{ color: "var(--text-1)", marginLeft: 6 }}>{T(`Qiymətləndir`)}</strong> — dərhal fair value, kirayə və skoru hesabla.
            </span>
          </div>
          </>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", background: "var(--card-2)", display: "flex", gap: 10, alignItems: "center" }}>
          {isEdit && (
            <span className="muted" style={{ fontSize: 12 }}>
              <Icons.File size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              ID: <strong style={{ color: "var(--text-1)" }}>{initial!.id}</strong>
            </span>
          )}
          <span className="sp" />
          <button className="btn btn-ghost" onClick={onClose}>{T(`Ləğv et`)}</button>
          {mode === "link" ? (
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={trySubmitLink}>
              <Icons.Sparkle size={16} /> {busy ? T(`Hesablanır…`) : T(`Qiymətləndir`)}
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => trySubmit(false)}>
                <Icons.Bookmark size={14} /> {T(`Yadda saxla`)}
              </button>
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => trySubmit(true)}>
                <Icons.Sparkle size={16} /> {busy ? T(`Hesablanır…`) : T(`Qiymətləndir`)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    {pickerOpen && (
      <MapPicker initial={coords} onClose={() => setPickerOpen(false)} onConfirm={onMapPick} />
    )}
    </>
  );
}

function Select({ value, onChange, options, placeholder = "Seçin", error, disabled }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; error?: boolean; disabled?: boolean }) {
  return (
    <div style={{ position: "relative", opacity: disabled ? 0.55 : 1 }}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, ...errBorder(error), appearance: "none", cursor: disabled ? "not-allowed" : "pointer", paddingRight: 36, color: value ? "var(--text-1)" : "var(--text-3)" }}>
        <option value="">{T(placeholder)}</option>
        {options.map((o) => (
          <option key={o} value={o}>{T(o)}</option>
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
  // "PDF yüklə" — print the report (browser → Save as PDF). Dependency-free;
  // the @media print rules in valuation-orange.css isolate the report modal.
  const downloadPdf = () => {
    document.body.classList.add("val-printing");
    const cleanup = () => {
      document.body.classList.remove("val-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 60);
  };
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
          <button className="btn btn-secondary btn-sm" onClick={downloadPdf}><Icons.PDF size={14} /> {T(`PDF yüklə`)}</button>
          <button className="modal-close" onClick={onClose}><Icons.X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
            <div className="cell-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{T(`Ünvan`)}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{p.address}</div>
          </div>

          <div className="info-grid" style={{ marginBottom: 16 }}>
            <InfoCell k={T(`Mənzil növü`)}>{p.type}</InfoCell>
            <InfoCell k={T(`Təmir vəziyyəti`)}>{p.repair ?? "—"}</InfoCell>
            <InfoCell k={T(`Çıxarış`)}>{p.extract ?? "—"}</InfoCell>
            <InfoCell k={T(`Sahə kv.m`)}>{p.area} kv.m</InfoCell>
            <InfoCell k={T(`Binanın mərtəbə sayı`)}>{p.totalFloors ?? "—"}</InfoCell>
            <InfoCell k={T(`Otaq sayı`)}>{p.rooms ?? "—"}</InfoCell>
            <InfoCell k="Yaşayış kompleksi">{p.residence ? `Bəli (${p.residence})` : "Xeyr"}</InfoCell>
            <InfoCell k={T(`Yerləşdiyi mərtəbə`)}>{p.floor ?? "—"}</InfoCell>
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
              <DonutChart value={p.score} label={T(`Sərmayə skoru`)} size={84} />
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
