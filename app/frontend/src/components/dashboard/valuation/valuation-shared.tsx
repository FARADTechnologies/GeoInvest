"use client";

// Shared presentational pieces for the Tək / Kütləvi valuation views:
// source badge, score donut, risk / type pills, the property entry form
// modal, and the property detail report modal. Styled with the app's
// Tailwind + design tokens (--brand-600 accent), behaviour ported from the
// reference prototype.

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Info,
  MapPin,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/valuation-data";
import type {
  PortfolioStats
} from "@/lib/valuation-data";
import type {
  ValuationInput,
  ValuationItem,
  ValuationMeta,
  ValuationResult,
  ValuationSource
} from "@/types/valuation";

// ── Small badges ──────────────────────────────────────────────────────

export function SourceBadge({ source }: { source: ValuationSource }) {
  const db = source === "db";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        db ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"
      )}
      title={db ? "Gerçek DB verisi" : "Mock veri (backend erişilemiyor)"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", db ? "bg-emerald-500" : "bg-amber-500")} />
      {db ? "DB" : "MOCK"}
    </span>
  );
}

export function scoreColor(v: number) {
  return v >= 78 ? "#1F8A5B" : v >= 60 ? "#C58A1A" : "#C0392B";
}

export function DonutScore({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const color = scoreColor(value);
  const sw = Math.max(4, size / 12);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (c * value) / 100;
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={sw} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[13px] font-bold tabular-nums" style={{ color, fontSize: size / 3.6 }}>
          {value}
        </span>
      </div>
      {label ? <span className="text-[10px] font-medium text-muted-foreground">{label}</span> : null}
    </div>
  );
}

export function RiskPill({ risk }: { risk: string }) {
  const tone =
    risk === "Aşağı"
      ? "bg-emerald-500/12 text-emerald-600"
      : risk === "Orta"
      ? "bg-amber-500/12 text-amber-600"
      : "bg-red-500/12 text-red-600";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {risk} risk
    </span>
  );
}

export function TypePill({ type }: { type: string }) {
  const isNew = (type || "").toLowerCase().includes("yeni");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        isNew ? "bg-teal-500/12 text-teal-600" : "bg-slate-500/12 text-slate-600"
      )}
    >
      {type}
    </span>
  );
}

export function Delta({ value, invert = false, suffix = "%" }: { value: number; invert?: boolean; suffix?: string }) {
  if (value == null || Number.isNaN(value)) return <span className="text-muted-foreground">—</span>;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good = invert ? dir === "down" : dir === "up";
  const color = dir === "flat" ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "–";
  return (
    <span className={cn("text-[12px] font-semibold tabular-nums", color)}>
      {arrow} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 1080
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/45 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl"
        style={{ maxWidth, maxHeight: "calc(100vh - 72px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Property entry form modal ─────────────────────────────────────────

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

function emptyForm(): FormState {
  return {
    address: "",
    rayon: "",
    type: "",
    repair: "",
    extract: "",
    isResidence: "",
    residence: "",
    area: "",
    totalFloors: "",
    floor: "",
    rooms: ""
  };
}

function fromItem(p: ValuationItem | ValuationResult): FormState {
  return {
    address: p.address ?? "",
    rayon: p.rayon ?? "",
    type: p.type ?? "",
    repair: p.repair ?? "",
    extract: p.extract ?? "",
    isResidence: p.residence ? "Bəli" : "",
    residence: p.residence ?? "",
    area: p.area != null ? String(p.area) : "",
    totalFloors: p.total_floors != null ? String(p.total_floors) : "",
    floor: p.floor != null ? String(p.floor) : "",
    rooms: p.rooms != null ? String(p.rooms) : ""
  };
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
      {children}
      {optional ? <span className="ml-1.5 font-medium text-muted-foreground">(opsional)</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-600)] focus:ring-2 focus:ring-[var(--brand-600)]/20";

function FInput({
  value,
  onChange,
  placeholder,
  numeric,
  suffix
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : "text"}
        className={cn(inputCls, suffix && "pr-12")}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function FSelect({
  value,
  onChange,
  options,
  placeholder = "Seçin"
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

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
  initial?: ValuationItem | null;
  busy?: boolean;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormState>(() => (initial ? fromItem(initial) : emptyForm()));
  const upd = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(initial ? fromItem(initial) : emptyForm());
  }, [open, initial]);

  const rayonOptions = useMemo(
    () => (meta?.rayons ?? []).map((r) => r.rayon),
    [meta]
  );

  const valid = !!form.type && !!form.area && !!form.rooms && (!!form.rayon || !!form.address);

  const build = (): ValuationInput => ({
    address: form.address.trim() || null,
    rayon: form.rayon || null,
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
    <Modal open={open} onClose={onClose} maxWidth={1080}>
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>{portfolioName}</span>
            <span className="opacity-40">/</span>
            <span>{isEdit ? "Mənzili redaktə et" : "Yeni qiymətləndirmə"}</span>
          </div>
          <div className="text-[17px] font-bold tracking-tight">Mənzil haqqında məlumat</div>
        </div>
        <div className="flex-1" />
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground hover:bg-secondary"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 overflow-y-auto p-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <FieldLabel>Ünvan</FieldLabel>
          <div className="relative">
            <FInput value={form.address} onChange={(v) => upd("address", v)} placeholder="məs. Mir Cəlal küç. 89, Yasamal" />
            <button
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-[var(--brand-600)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--brand-600)]"
              type="button"
              title="(prototip)"
            >
              <MapPin className="h-3.5 w-3.5" /> Xəritədən seç
            </button>
          </div>
          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>Dəqiq qiymətləndirmə üçün rayonu seçin və ya tam ünvanı daxil edin.</span>
          </div>
        </div>
        <div>
          <FieldLabel>Rayon</FieldLabel>
          <FSelect value={form.rayon} onChange={(v) => upd("rayon", v)} options={rayonOptions} placeholder="Rayon seçin" />
        </div>

        <div>
          <FieldLabel>Mənzil növü</FieldLabel>
          <FSelect value={form.type} onChange={(v) => upd("type", v)} options={TYPE_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Təmir vəziyyəti</FieldLabel>
          <FSelect value={form.repair} onChange={(v) => upd("repair", v)} options={REPAIR_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Çıxarış</FieldLabel>
          <FSelect value={form.extract} onChange={(v) => upd("extract", v)} options={EXTRACT_OPTIONS} />
        </div>

        <div>
          <FieldLabel>Yaşayış kompleksi?</FieldLabel>
          <FSelect value={form.isResidence} onChange={(v) => upd("isResidence", v)} options={RESIDENCE_YN} />
        </div>
        <div>
          <FieldLabel optional>Kompleks adı</FieldLabel>
          <FInput value={form.residence} onChange={(v) => upd("residence", v)} placeholder="(opsional)" />
        </div>
        <div>
          <FieldLabel>Sahə</FieldLabel>
          <FInput value={form.area} onChange={(v) => upd("area", v)} placeholder="Sahə" numeric suffix="m²" />
        </div>

        <div>
          <FieldLabel>Binanın mərtəbə sayı</FieldLabel>
          <FInput value={form.totalFloors} onChange={(v) => upd("totalFloors", v)} placeholder="məs. 12" numeric />
        </div>
        <div>
          <FieldLabel>Yerləşdiyi mərtəbə</FieldLabel>
          <FInput value={form.floor} onChange={(v) => upd("floor", v)} placeholder="məs. 5" numeric />
        </div>
        <div>
          <FieldLabel>Otaq sayı</FieldLabel>
          <FInput value={form.rooms} onChange={(v) => upd("rooms", v)} placeholder="məs. 3" numeric />
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t bg-muted/30 px-6 py-3.5">
        <span className="text-[12px] text-muted-foreground">
          <strong className="text-foreground">Yadda saxla</strong> — qaralama;{" "}
          <strong className="text-foreground">Qiymətləndir</strong> — dərhal hesabla.
        </span>
        <span className="flex-1" />
        <button className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary" onClick={onClose}>
          Ləğv et
        </button>
        <button
          disabled={!valid || busy}
          onClick={() => onSubmit(build(), false)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <Bookmark className="h-3.5 w-3.5" /> Yadda saxla
        </button>
        <button
          disabled={!valid || busy}
          onClick={() => onSubmit(build(), true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> {busy ? "Hesablanır…" : "Qiymətləndir"}
        </button>
      </div>
    </Modal>
  );
}

// ── Property detail report modal ──────────────────────────────────────

function InfoCell({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-r bg-muted/30 px-3.5 py-3 last:border-r-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-semibold text-foreground">{children}</div>
    </div>
  );
}

export function PropertyReport({
  item,
  stats,
  rank,
  total,
  source,
  onClose,
  onPrev,
  onNext
}: {
  item: ValuationItem;
  stats: PortfolioStats;
  rank: number;
  total: number;
  source: ValuationSource;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const p = item;
  const deltaPct = (v: number, avg: number) => (avg ? +(((v - avg) / avg) * 100).toFixed(1) : 0);
  const range = (p.price_range as number[]) ?? [p.fair_value, p.fair_value];
  const rentRange = (p.rent_range as number[]) ?? [p.monthly_rent, p.monthly_rent];

  return (
    <Modal open onClose={onClose} maxWidth={920}>
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="truncate">{p.rayon}</span>
            <span className="opacity-40">/</span>
            <span>{p.id}</span>
            <SourceBadge source={source} />
          </div>
          <div className="truncate text-[17px] font-bold tracking-tight">Nəticə · {p.address || p.rayon}</div>
        </div>
        <div className="flex-1" />
        <button className="rounded-md border px-2.5 py-2 text-muted-foreground hover:bg-secondary" onClick={onPrev} title="Əvvəlki">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="rounded-md border px-2.5 py-2 text-muted-foreground hover:bg-secondary" onClick={onNext} title="Növbəti">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button className="ml-1 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary" title="(prototip)">
          <FileDown className="h-4 w-4" /> PDF
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground hover:bg-secondary" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto p-6">
        <div className="mb-4 rounded-lg border px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ünvan</div>
          <div className="mt-0.5 text-[15px] font-bold">{p.address || p.rayon}</div>
        </div>

        <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4">
          <InfoCell k="Mənzil növü">{p.type}</InfoCell>
          <InfoCell k="Təmir">{p.repair ?? "—"}</InfoCell>
          <InfoCell k="Çıxarış">{p.extract ?? "—"}</InfoCell>
          <InfoCell k="Sahə">{p.area} m²</InfoCell>
          <InfoCell k="Mərtəbə (cəmi)">{p.total_floors ?? "—"}</InfoCell>
          <InfoCell k="Otaq">{p.rooms ?? "—"}</InfoCell>
          <InfoCell k="Yaşayış kompleksi">{p.residence ? `Bəli (${p.residence})` : "Xeyr"}</InfoCell>
          <InfoCell k="Yerləşdiyi mərtəbə">{p.floor ?? "—"}</InfoCell>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold">
              Süni intellektin qiyməti <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 text-[28px] font-bold tabular-nums text-[var(--brand-600)]">
              {fmtMoney(p.fair_value)}{" "}
              <span className="text-base font-semibold text-muted-foreground">({fmtMoney(p.price_per_m2, " ₼/m²")})</span>
            </div>
            <div className="mt-3 text-[13px] font-semibold">Qiymət aralığı:</div>
            <div className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
              {fmtMoney(range[0])} – {fmtMoney(range[1])}
            </div>
            {p.market_median_kvm ? (
              <div className="mt-2 text-[11.5px] text-muted-foreground">
                Bazar medyanı: <strong className="text-foreground">{fmtMoney(p.market_median_kvm, " ₼/m²")}</strong> ·{" "}
                qaynaq: {p.price_basis === "rayon" ? "rayon" : p.price_basis === "market" ? "şəhər" : "ehtiyat"}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold">
              Kirayə qiyməti <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 text-[28px] font-bold tabular-nums text-[var(--brand-600)]">
              {fmtMoney(p.monthly_rent)} <span className="text-base font-semibold text-muted-foreground">/ ay</span>
            </div>
            <div className="mt-3 text-[13px] font-semibold">Kirayə aralığı:</div>
            <div className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
              {fmtMoney(rentRange[0])} – {fmtMoney(rentRange[1])}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">Kirayə/gəlirlilik modellənmiş təxmindir.</div>
          </div>
        </div>

        <div className="mb-5 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-4">
            <DonutScore value={p.score} size={84} label="Sərmayə skoru" />
            <div className="min-w-[220px] flex-1">
              <div className="text-[14px] font-bold">Sərmayə skoru: {p.score}/100</div>
              <div className="mt-1 max-w-[52ch] text-[12.5px] text-muted-foreground">
                Bu mənzil portfeldə <strong>#{rank} / {total}</strong> sırasındadır (gəlirlilik və risk üzrə).
              </div>
              <div className="mt-2">
                <RiskPill risk={p.risk} />
              </div>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-3" style={{ minWidth: 300 }}>
              <PortDelta label="Fair value" value={fmtMoney(p.fair_value)} delta={deltaPct(p.fair_value, stats.totalValue / Math.max(stats.n, 1))} />
              <PortDelta label="Gəlirlilik" value={`${p.yield_pct}%`} delta={deltaPct(p.yield_pct, stats.avgYield)} />
              <PortDelta label="Likvidlik" value={`${p.liquidity_days} gün`} delta={deltaPct(p.liquidity_days, stats.avgLiquidity)} invert />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-1.5 text-[14px] font-bold">Analitik şərhi</div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Mənzilin sərmayə dəyərləndirməsi{" "}
            <strong className="text-foreground">{p.score >= 78 ? "yuxarı" : p.score >= 60 ? "orta" : "aşağı"}</strong>{" "}
            səviyyəlidir. Bazar dəyəri <strong className="text-foreground">{fmtMoney(p.fair_value)}</strong>, aylıq kirayə{" "}
            <strong className="text-foreground">{fmtMoney(p.monthly_rent)}</strong> təyin edilmişdir. İllik gəlirlilik{" "}
            <strong className="text-foreground">{p.yield_pct}%</strong> (portfel ortası ilə müqayisədə{" "}
            <Delta value={deltaPct(p.yield_pct, stats.avgYield)} />
            ), geri ödəmə müddəti <strong className="text-foreground">{p.payback_years} il</strong>, orta likvidlik{" "}
            <strong className="text-foreground">{p.liquidity_days} gün</strong>dür.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function PortDelta({ label, value, delta, invert = false }: { label: string; value: string; delta: number; invert?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums">{value}</div>
      <div className="mt-0.5">
        <Delta value={delta} invert={invert} />
      </div>
    </div>
  );
}
