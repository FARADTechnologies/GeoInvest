"use client";

// "Mənzili qiymətləndir" result report — implements the team's BA document.
// Renders strictly against the predict-server report contract
// (types/valuation.ts → RateReportData); the Parametrlə flow feeds it via the
// adapter (lib/valuation-report.ts), the Elan linki flow via valuateByLink.
//
// Distinct from the B2B portfolio report (valuation-core → PropertyReport,
// still used by Kütləvi): no portfolio ranking, no synthetic benchmarks.

import { useEffect, useMemo, useState } from "react";
import { T } from "@/components/dashboard/valuation/valuation-i18n";
import { Icons, LineChart, fmtMoney, fmtNumber } from "@/components/dashboard/valuation/valuation-ui";
import { fetchNearby, type NearbyCategory } from "@/lib/valuation-report";
import type { RateReportData, TrendPoint } from "@/types/valuation";

const rent = (n: number | null | undefined) => (n == null ? "—" : `${fmtMoney(n)} / ${T("ay")}`);
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 2).replace(/\.?0+$/, "")}%`);
const dash = (v: React.ReactNode) => (v === null || v === undefined || v === "" ? "—" : v);

export function RateReport({ data, onClose }: { data: RateReportData; onClose: () => void }) {
  const { ai_data, features, source } = data;
  const sale = ai_data.sale_estimate.current_valuation;
  const rentEst = ai_data.rent_estimate.current_valuation;
  const inv = ai_data.investment_metrics;
  const saleTrend = ai_data.sale_estimate.price_trend ?? [];
  const rentTrend = ai_data.rent_estimate.price_trend ?? [];

  // §9/§12 nearby objects — loaded when coordinates are present (both flows).
  const [nearby, setNearby] = useState<NearbyCategory[]>([]);
  const lat = data.latitude;
  const lon = data.longitude;
  useEffect(() => {
    if (lat == null || lon == null) {
      setNearby([]);
      return;
    }
    let alive = true;
    fetchNearby(lat, lon).then((c) => {
      if (alive) setNearby(c);
    });
    return () => {
      alive = false;
    };
  }, [lat, lon]);

  // "PDF yüklə" → browser print (Save as PDF). val-printing isolates the
  // report modal; the @media print rules surface the print-only logo.
  const downloadPdf = () => {
    document.body.classList.add("val-printing");
    const cleanup = () => {
      document.body.classList.remove("val-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 60);
  };

  // Mortgage is eligible when we have a sale price (always true for our flows).
  const mortgagePrice = data.listing_price ?? sale.point_estimate;
  const mortgagePredicted = data.listing_price == null;

  // BA §5: static backdrop — clicking outside must NOT close the modal; only
  // the explicit close button does. So the backdrop carries no onClick.
  return (
    <div className="modal-backdrop">
      <div className="modal rate-report" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="crumbs" style={{ marginBottom: 4 }}>
              <span>{T("Tək qiymətləndirmə")}</span>
              <span className="sep">/</span>
              <span>{T("Nəticə")}</span>
            </div>
            <div className="modal-title">{T("Nəticə")}</div>
          </div>
          <div className="sp" />
          <button className="btn btn-secondary btn-sm" onClick={downloadPdf}>
            <Icons.PDF size={14} /> {T("PDF yüklə")}
          </button>
          <button className="modal-close" onClick={onClose} title={T("Bağla")}>
            <Icons.X size={14} />
          </button>
        </div>

        <div className="modal-body">
          {/* Print-only header logo (BA §19). */}
          <div className="print-only rate-report-print-logo">Homora</div>

          {/* ── §6 Mənzil xüsusiyyətləri — form flow only ───────────────── */}
          {features && (
            <div className="print-avoid-break" style={{ marginBottom: 16 }}>
              <div className="card" style={{ padding: "12px 16px", marginBottom: 12 }}>
                <div className="cell-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{T("Ünvan")}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{dash(features.address)}</div>
              </div>
              <div className="info-grid">
                <InfoCell k={T("Rayon")}>{data.rayon ?? "—"}</InfoCell>
                <InfoCell k={T("Mənzil növü")}>{dash(features.type)}</InfoCell>
                <InfoCell k={T("Təmir vəziyyəti")}>{dash(features.repair)}</InfoCell>
                <InfoCell k={T("Çıxarış")}>{dash(features.extract)}</InfoCell>
                <InfoCell k={T("Sahə kv.m")}>{features.area != null ? `${features.area} kv.m` : "—"}</InfoCell>
                <InfoCell k={T("Binanın mərtəbə sayı")}>{dash(features.total_floors)}</InfoCell>
                <InfoCell k={T("Otaq sayı")}>{dash(features.rooms)}</InfoCell>
                <InfoCell k={T("Yaşayış kompleksi")}>{residenceLabel(features.residential_complex, features.residence_owner)}</InfoCell>
                <InfoCell k={T("Yerləşdiyi mərtəbə")}>{dash(features.floor)}</InfoCell>
              </div>
            </div>
          )}

          {/* ── §7 Mənbə linki — link flow only ─────────────────────────── */}
          {source.kind === "link" && <SourceLink url={source.url} />}

          {/* ── §8 Qiymətləndirmə nəticəsi ──────────────────────────────── */}
          <div className="big-tiles print-avoid-break" style={{ marginBottom: 18 }}>
            <div className="big-tile">
              <div className="label">{T("Satış qiyməti")} <Icons.Info className="info" /></div>
              <div className="big">{fmtMoney(sale.point_estimate)}</div>
              <div className="rng-label">{T("Qiymət aralığı")}:</div>
              <div className="rng">{fmtMoney(sale.lower_bound)} – {fmtMoney(sale.upper_bound)}</div>
              <div className="rng" style={{ marginTop: 6, fontSize: 12 }}>{T("Mənzilin süni intellekt modeli ilə dəyərləndirilmiş satış qiyməti")}</div>
            </div>
            <div className="big-tile">
              <div className="label">{T("Kirayə qiyməti")} <Icons.Info className="info" /></div>
              <div className="big">{rent(rentEst.point_estimate)}</div>
              <div className="rng-label">{T("Kirayə aralığı")}:</div>
              <div className="rng">{rent(rentEst.lower_bound)} – {rent(rentEst.upper_bound)}</div>
              <div className="rng" style={{ marginTop: 6, fontSize: 12 }}>{T("Mənzilin süni intellekt modeli ilə dəyərləndirilmiş kirayə qiyməti")}</div>
            </div>
          </div>

          {/* ── §9 Sərmayə dəyərləndirməsi ──────────────────────────────── */}
          <div className="print-avoid-break" style={{ marginBottom: 18 }}>
            <div className="chart-title" style={{ marginBottom: 8 }}>{T("Sərmayə dəyərləndirməsi")}</div>
            <div className="info-grid">
              <InfoCell k={T("İllik kirayə gəliri")}>{fmtMoney(inv.annual_rent)}</InfoCell>
              <InfoCell k={T("Kirayə gəlirliliyi")}>{pct(inv.rent_yield_percent)}</InfoCell>
              <InfoCell k={T("Geri ödəmə müddəti")}>{inv.payback_period_years != null ? `${inv.payback_period_years} ${T("il")}` : "—"}</InfoCell>
              <InfoCell k={T("1 m² qiyməti")}>{fmtMoney(inv.price_per_sqm, " ₼")}</InfoCell>
            </div>
          </div>

          {/* ── §10 Satış qiymət trendi ─────────────────────────────────── */}
          {saleTrend.length > 0 && (
            <div className="card chart-card print-avoid-break" style={{ marginBottom: 14 }}>
              <div className="chart-title">{T("Satış qiymətinin trendi")}</div>
              <div className="chart-sub">{T("Qrafik son 1 ildə qiymətləndirilmiş potensial satış dəyərinin dinamikasını əks etdirir.")}</div>
              <LineChart data={trendSeries(saleTrend)} labels={trendLabels(saleTrend)} height={220} color="#2A8B7E" />
            </div>
          )}

          {/* ── §11 Kirayə qiymət trendi ────────────────────────────────── */}
          {rentTrend.length > 0 && (
            <div className="card chart-card print-avoid-break" style={{ marginBottom: 14 }}>
              <div className="chart-title">{T("Kirayə qiymətinin trendi")}</div>
              <div className="chart-sub">{T("Qrafik son 1 ildə qiymətləndirilmiş potensial kirayə qiymətinin dinamikasını əks etdirir.")}</div>
              <LineChart data={trendSeries(rentTrend)} labels={trendLabels(rentTrend)} height={200} color="#D9531E" />
            </div>
          )}

          {/* ── §12 Xəritə / lokasiya — only when coordinates exist ──────── */}
          {data.latitude != null && data.longitude != null && (
            <LocationSection lat={data.latitude} lon={data.longitude} nearby={nearby} />
          )}

          {/* ── §14 İpoteka kalkulyatoru ────────────────────────────────── */}
          <MortgageCalculator price={mortgagePrice} predicted={mortgagePredicted} />

          {/* ── §13 Disclaimer ──────────────────────────────────────────── */}
          <div className="card card-pad print-avoid-break" style={{ marginTop: 16, background: "var(--card-2)" }}>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6, display: "flex", gap: 8 }}>
              <Icons.Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{T("Bu əmlak üzrə qiymətləndirmə hesabatı Homora süni intellekt modeli əsasında hazırlanmışdır.")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function residenceLabel(rc: 0 | 1, owner: string | null): string {
  if (rc !== 1) return T("Xeyr");
  return owner ? `${T("Bəli")} (${owner})` : T("Bəli");
}

function trendSeries(t: TrendPoint[]): number[] {
  return t.map((p) => p.point_estimate);
}
function trendLabels(t: TrendPoint[]): string[] {
  // ISO month-end → "YYYY-MM" label.
  return t.map((p) => (p.date || "").slice(0, 7));
}

function InfoCell({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="info-cell">
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  );
}

// ── §7 Mənbə linki ───────────────────────────────────────────────────────

function SourceLink({ url }: { url: string }) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
      <Icons.Layers size={15} style={{ color: "var(--orange)", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600, flexShrink: 0 }}>{T("Mənbə")} :</span>
      <a href={href} target="_blank" rel="noreferrer noopener"
        style={{ fontSize: 13, color: "var(--orange)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {url}
      </a>
    </div>
  );
}

// ── §12 Xəritə / lokasiya ────────────────────────────────────────────────
// Static OpenStreetMap tile mosaic (no token). Built from <img> tiles rather
// than an <iframe> embed so it survives print/PDF export — browsers don't
// render iframe content when printing, which previously dropped the map from
// the PDF. Renders only when coordinates are present.

function StaticOsmMap({ lat, lon, zoom = 15, width = 560, height = 280 }: {
  lat: number; lon: number; zoom?: number; width?: number; height?: number;
}) {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const xf = ((lon + 180) / 360) * n;
  const yf = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  const left = xf * 256 - width / 2;
  const top = yf * 256 - height / 2;
  const tiles: React.ReactElement[] = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y++) {
      if (y < 0 || y >= n) continue;
      const tx = ((x % n) + n) % n;
      tiles.push(
        <img
          key={`${x}_${y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${tx}/${y}.png`}
          alt=""
          width={256}
          height={256}
          style={{ position: "absolute", left: x * 256 - left, top: y * 256 - top, maxWidth: "none" }}
        />
      );
    }
  }
  return (
    <div style={{ position: "relative", height, marginTop: 8, overflow: "hidden", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width, height }}>
        {tiles}
        <svg width={26} height={34} viewBox="0 0 26 34" style={{ position: "absolute", left: width / 2 - 13, top: height / 2 - 34 }}>
          <path d="M13 0C6 0 0 5.6 0 12.6 0 22 13 34 13 34s13-12 13-21.4C26 5.6 20 0 13 0z" fill="#D9531E" />
          <circle cx="13" cy="12.5" r="5" fill="#fff" />
        </svg>
      </div>
      <div style={{ position: "absolute", right: 4, bottom: 2, fontSize: 9, color: "#333", background: "rgba(255,255,255,0.72)", padding: "0 4px", borderRadius: 3 }}>
        © OpenStreetMap
      </div>
    </div>
  );
}

const CAT_LABEL: Record<string, string> = {
  "yemək": "Yemək", "Yemək": "Yemək",
  "Təhsil indeksi": "Təhsil", "Təhsil": "Təhsil",
  "Nəqliyyat": "Nəqliyyat", "Əyləncə": "Əyləncə",
  "Recreation": "İstirahət", "Turizm": "Turizm",
  "Unknown": "Digər", "Digər": "Digər"
};
const catLabel = (c: string) => CAT_LABEL[c] ?? c;
const fmtDist = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`);

function LocationSection({ lat, lon, nearby }: { lat: number; lon: number; nearby: NearbyCategory[] }) {
  return (
    <div className="card chart-card print-avoid-break" style={{ marginBottom: 14 }}>
      <div className="chart-title">{T("Lokasiya")}</div>
      <div className="chart-sub">{T("Mənzilin xəritə üzrə yerləşməsi və ətraf kontekst.")}</div>
      <StaticOsmMap lat={lat} lon={lon} />
      {nearby.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="chart-sub" style={{ marginBottom: 8, fontWeight: 600 }}>{T("Yaxın obyektlər")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {nearby.map((cat) => (
              <div key={cat.category} className="print-avoid-break" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {catLabel(cat.category)} <span style={{ opacity: 0.45, fontWeight: 500 }}>· {cat.items.length}</span>
                </div>
                {cat.items.slice(0, 5).map((o, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                    <span style={{ opacity: 0.6, flexShrink: 0 }}>{fmtDist(o.distance)}</span>
                  </div>
                ))}
                {cat.items.length > 5 && (
                  <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 4 }}>+{cat.items.length - 5} {T("daha")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── §14 İpoteka kalkulyatoru ─────────────────────────────────────────────
// Pure client calculation off the existing result — never re-triggers a
// valuation request and is independent of auth state (BA §14).

function MortgageCalculator({ price, predicted }: { price: number; predicted: boolean }) {
  const [downPct, setDownPct] = useState(25);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(8);

  const calc = useMemo(() => {
    const down = Math.round((price * downPct) / 100);
    const loan = Math.max(price - down, 0);
    const r = rate / 100 / 12;
    const n = Math.max(years * 12, 1);
    const monthly = r > 0 ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
    const totalLoanPaid = monthly * n;
    const totalInterest = totalLoanPaid - loan;
    const totalPayment = down + totalLoanPaid;
    const minIncome = monthly / 0.5; // monthly payment ≤ 50% of income
    return { down, loan, monthly, totalInterest, totalPayment, minIncome };
  }, [price, downPct, years, rate]);

  return (
    <div className="card card-pad print-avoid-break" style={{ marginTop: 18 }}>
      <div className="fl-row" style={{ gap: 10, marginBottom: 4 }}>
        <Icons.Coin size={16} style={{ color: "var(--orange)" }} />
        <div className="chart-title" style={{ margin: 0 }}>{T("İpoteka kalkulyatoru")}</div>
      </div>
      {predicted && (
        <div className="chart-sub" style={{ marginBottom: 10 }}>{T("Homora qiymətləndirməsinə əsasən")}</div>
      )}

      <div className="mortgage-inputs">
        <Slider label={T("İlkin ödəniş")} value={downPct} min={10} max={70} step={5} suffix="%" onChange={setDownPct} />
        <Slider label={T("Kredit müddəti")} value={years} min={3} max={30} step={1} suffix={` ${T("il")}`} onChange={setYears} />
        <Slider label={T("Faiz dərəcəsi")} value={rate} min={3} max={20} step={0.5} suffix="%" onChange={setRate} />
      </div>

      <div className="info-grid" style={{ marginTop: 14 }}>
        <InfoCell k={T("Mənzilin qiyməti")}>{fmtMoney(price)}</InfoCell>
        <InfoCell k={T("İlkin ödəniş")}>{fmtMoney(calc.down)}</InfoCell>
        <InfoCell k={T("Kredit məbləği")}>{fmtMoney(calc.loan)}</InfoCell>
        <InfoCell k={T("Aylıq ödəniş")}>
          <strong style={{ color: "var(--orange)" }}>{fmtMoney(Math.round(calc.monthly))}</strong>
        </InfoCell>
        <InfoCell k={T("Ümumi faiz")}>{fmtMoney(Math.round(calc.totalInterest))}</InfoCell>
        <InfoCell k={T("Ümumi ödəniş")}>{fmtMoney(Math.round(calc.totalPayment))}</InfoCell>
        <InfoCell k={T("Tələb olunan minimum aylıq gəlir")}>{fmtMoney(Math.round(calc.minIncome))}</InfoCell>
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, suffix, onChange
}: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="fl-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {fmtNumber(value)}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--orange)" }} />
    </div>
  );
}
