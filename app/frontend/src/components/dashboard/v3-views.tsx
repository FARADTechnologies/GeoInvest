"use client";

// Homora.ai v3 — Rayons / Listings / B2C views.
// Faithful TSX port of homora-v3 prototype. Scoped under .hm-v3 (see
// v3-views.css). These three views are mock-fed via lib/dashboard-api.ts
// (fetchRayonStats / fetchListings / fetchB2C). Overview / Map / Admin are
// NOT touched — they keep their existing implementation in dashboard-shell.

import { ArrowRight, Heart, MapPin, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import type { B2CSummary, Listing, RayonStat } from "@/types/api";
import type { RateReportData } from "@/types/valuation";
import { RateReport } from "@/components/dashboard/valuation/valuation-report";
import { valuateByLink, LinkValuationError } from "@/lib/valuation-report";
import "@/components/dashboard/v3-views.css";
import "@/components/dashboard/valuation/valuation-orange.css";

// ── helpers ─────────────────────────────────────────────────────────────
const nf = (n: number) => Math.round(n).toLocaleString("az-AZ").replace(/,/g, " ");

const SCALE = ["#fde68a", "#fcd34d", "#fb923c", "#f97316", "#e0529c", "#a855f7", "#7c3aed", "#5b21b6"];
function colorFor(t: number) {
  const x = Math.max(0, Math.min(0.999, t)) * (SCALE.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = hx(SCALE[i]);
  const b = hx(SCALE[Math.min(i + 1, SCALE.length - 1)]);
  const lerp = (p: number, q: number) => Math.round(p + (q - p) * f);
  return `rgb(${lerp(a[0], b[0])},${lerp(a[1], b[1])},${lerp(a[2], b[2])})`;
}

function heatOf(r: RayonStat) {
  return (r.median - 1300) / 3100;
}

function Trend({ v }: { v: number }) {
  const dir = v > 0.5 ? "up" : v < -0.5 ? "down" : "flat";
  const cls = dir === "up" ? "hm-up" : dir === "down" ? "hm-down" : "hm-flat";
  const a = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  return <span className={`hm-trend ${cls}`}>{a} {Math.abs(v).toFixed(1)}%</span>;
}

function Badge({ tone = "muted", children }: { tone?: string; children: ReactNode }) {
  return <span className={`hm-badge hm-badge-${tone}`}>{children}</span>;
}

function Card({
  title,
  sub,
  action,
  children
}: {
  title?: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hm-card">
      {(title || action) && (
        <div className="hm-card-head">
          <div style={{ minWidth: 0 }}>
            {title && <div className="hm-card-title">{title}</div>}
            {sub && <div className="hm-card-sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="hm-card-body">{children}</div>
    </div>
  );
}

function Sparkline({ data, h = 28, color = "var(--brand-500)" }: { data: number[]; h?: number; color?: string }) {
  const { path, area } = useMemo(() => {
    if (!data || data.length < 2) return { path: "", area: "" };
    const w = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const rng = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / rng) * (h - 4) - 2]);
    const p = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    return { path: p, area: p + ` L100 ${h} L0 ${h} Z` };
  }, [data, h]);
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block", color }}>
      <defs>
        <linearGradient id="hmv3sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hmv3sg)" />
      <path d={path} stroke="currentColor" strokeWidth="1.7" fill="none" />
    </svg>
  );
}

function Donut({
  slices,
  size = 132,
  thick = 20,
  center
}: {
  slices: { value: number; color: string }[];
  size?: number;
  thick?: number;
  center?: ReactNode;
}) {
  const r = size / 2 - thick / 2;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {slices.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thick}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-off}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      {center && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          {center}
        </div>
      )}
    </div>
  );
}

// deterministic mini sparkline series per rayon (visual only)
function miniSeries(seed: number, end: number, n = 8) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  let v = end * (0.9 + rnd() * 0.05);
  for (let i = 0; i < n; i++) {
    v += (end - v) * 0.25 + (rnd() - 0.5) * end * 0.02;
    out.push(Math.round(v));
  }
  out[n - 1] = end;
  return out;
}

// ── Rayon detail (modal body) ───────────────────────────────────────────
function RayonDetail({ t, rayon, listings, onClose }: { t: Record<string, string>; rayon: RayonStat; listings: Listing[]; onClose: () => void }) {
  const rl = listings.filter((l) => l.rayonId === rayon.id);
  const byRooms = [1, 2, 3, 4].map((rooms) => {
    const rows = rl.filter((l) => l.rooms === rooms);
    const s = rows.map((l) => l.ppm).sort((a, b) => a - b);
    return { rooms, count: rows.length, med: s[Math.floor(s.length / 2)] || 0 };
  });
  const maxRoom = Math.max(...byRooms.map((b) => b.med), 1);
  return (
    <div className="hm-detail">
      <div className="hm-detail-head">
        <div>
          <div className="hm-detail-title">
            {rayon.name} {rayon.hot && <Badge tone="hot">{t.hot ?? "Sıcak"}</Badge>}
          </div>
          <div className="hm-detail-sub">{nf(rayon.listings)} {t.rdActiveListings ?? "aktiv ilan"}</div>
        </div>
        <button className="hm-icon-btn" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </div>
      <div className="hm-detail-stats">
        <div><span>{t.rdMedian ?? "Medyan"}</span><b>{nf(rayon.median)} ₼/m²</b></div>
        <div><span>{t.kpiTrend ?? "Trend"}</span><b><Trend v={rayon.trend} /></b></div>
        <div><span>{t.rdAvgAreaLbl ?? "Ort. sahə"}</span><b>{rayon.avgArea} m²</b></div>
        <div><span>{t.rdNewBuild ?? "Yeni tikili"}</span><b>{rayon.newShare}%</b></div>
      </div>
      <div className="hm-detail-sec">{t.rdByRoomMedian ?? "Oda sayısına göre medyan ₼/m²"}</div>
      <div className="hm-roombars">
        {byRooms.map((b) => (
          <div className="hm-roombar" key={b.rooms}>
            <span className="hm-roombar-k">{b.rooms} {t.rdRoom ?? "otaq"}</span>
            <div className="hm-roombar-track"><span style={{ width: `${(b.med / maxRoom) * 100}%` }} /></div>
            <span className="hm-roombar-v">{nf(b.med)}</span>
          </div>
        ))}
      </div>
      <div className="hm-detail-sec">{t.rdRecent ?? "Son ilanlar"}</div>
      <div className="hm-detail-listings">
        {rl.slice(0, 5).map((l) => (
          <div className="hm-mini-listing" key={l.id}>
            <div style={{ minWidth: 0 }}>
              <div className="hm-ml-title">{l.title}</div>
              <div className="hm-ml-sub">{l.area} m² · {l.rooms} {t.rdRoom ?? "otaq"} · {l.cat}</div>
            </div>
            <div className="hm-ml-price">{nf(l.ppm)} ₼/m²</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BÖLGELER (Rayons) ───────────────────────────────────────────────────
export function RayonsViewV3({
  t,
  rayons,
  listings
}: {
  t: Record<string, string>;
  rayons: RayonStat[];
  listings: Listing[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"median" | "listings" | "trend">("median");
  const [sel, setSel] = useState<string | null>(null);

  const cityMed = useMemo(() => {
    const ppms = listings.map((l) => l.ppm).sort((a, b) => a - b);
    return ppms[Math.floor(ppms.length / 2)] || (rayons[0]?.median ?? 0);
  }, [listings, rayons]);

  const rows = rayons
    .filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) =>
      sort === "median" ? b.median - a.median : sort === "listings" ? b.listings - a.listings : b.trend - a.trend
    );

  const selRayon = sel ? rayons.find((r) => r.id === sel) ?? null : null;

  return (
    <div className="hm-v3 hm-rayons">
      <div className="hm-rcards">
        {rows.slice(0, 4).map((r, i) => (
          <div className="hm-rcard" key={r.id} onClick={() => setSel(r.id)}>
            <div className="hm-rcard-top">
              <span className="hm-rcard-dot" style={{ background: colorFor(heatOf(r)) }} />
              <span className="hm-rcard-name">{r.short}</span>
              {r.hot && <Badge tone="hot">{t.hot ?? "Sıcak"}</Badge>}
            </div>
            <div className="hm-rcard-val">{nf(r.median)}<small> ₼/m²</small></div>
            <div className="hm-rcard-foot"><Trend v={r.trend} /><span>{nf(r.listings)} ilan</span></div>
            <div className="hm-rcard-spark">
              <Sparkline data={miniSeries(i + 7, r.median)} h={28} color={colorFor(heatOf(r))} />
            </div>
          </div>
        ))}
      </div>

      <Card
        title={t.rayonsPageTitle ?? "Bölgeler"}
        sub={t.rayonsPageSub ?? "Medyan fiyat, ilan yoğunluğu ve trend"}
        action={
          <div className="hm-toolbar">
            <div className="hm-search-sm">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchRayonPh ?? "Bölge ara..."} />
            </div>
            <div className="hm-seg">
              <button className={sort === "median" ? "on" : ""} onClick={() => setSort("median")}>{t.byPrice ?? "Fiyat"}</button>
              <button className={sort === "listings" ? "on" : ""} onClick={() => setSort("listings")}>{t.listings ?? "İlan"}</button>
              <button className={sort === "trend" ? "on" : ""} onClick={() => setSort("trend")}>{t.kpiTrend ?? "Trend"}</button>
            </div>
          </div>
        }
      >
        <div className="hm-table-wrap">
          <table className="hm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Rayon</th>
                <th className="num">{t.listings ?? "İlan"}</th>
                <th className="num">{t.rvMedianCol ?? "Medyan ₼/m²"}</th>
                <th className="num">{t.rvCityDiff ?? "Şehir farkı"}</th>
                <th className="num">{t.rvAvgArea ?? "Ort. m²"}</th>
                <th className="num">{t.rvNewPct ?? "Yeni %"}</th>
                <th className="num">{t.kpiTrend ?? "Trend"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diff = ((r.median - cityMed) / (cityMed || 1)) * 100;
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)} className={sel === r.id ? "on" : ""}>
                    <td className="muted">{i + 1}</td>
                    <td><b>{r.short}</b> {r.hot && <Badge tone="hot">{t.hot ?? "Sıcak"}</Badge>}</td>
                    <td className="num">{nf(r.listings)}</td>
                    <td className="num"><b>{nf(r.median)}</b></td>
                    <td className="num">
                      <span className={diff >= 0 ? "hm-up" : "hm-down"}>{diff >= 0 ? "+" : ""}{diff.toFixed(0)}%</span>
                    </td>
                    <td className="num">{r.avgArea}</td>
                    <td className="num">{r.newShare}%</td>
                    <td className="num"><Trend v={r.trend} /></td>
                    <td className="num"><ArrowRight size={14} style={{ opacity: 0.5 }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selRayon && (
        <div className="hm-modal" onClick={() => setSel(null)}>
          <div className="hm-modal-card" onClick={(e) => e.stopPropagation()}>
            <RayonDetail t={t} rayon={selRayon} listings={listings} onClose={() => setSel(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── İLANLAR (Listings) ──────────────────────────────────────────────────
type SortKey = "title" | "rayon" | "rooms" | "area" | "price" | "ppm" | "date";

export function ListingsViewV3({
  t,
  listings,
  serverTotal = 0
}: {
  t: Record<string, string>;
  listings: Listing[];
  serverTotal?: number;
  rayons: RayonStat[];
}) {
  const [q, setQ] = useState("");
  const [rayon, setRayon] = useState("all");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortK, setSortK] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(0);
  const per = 12;

  // Clicking a real (DB-fed) listing opens its stored prediction via the link
  // flow (team #10). Mock rows have no sourceUrl and stay non-clickable.
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [report, setReport] = useState<RateReportData | null>(null);
  const [reportErr, setReportErr] = useState<string | null>(null);
  const openReport = async (l: Listing) => {
    if (!l.sourceUrl) return;
    setReportUrl(l.sourceUrl);
    setReport(null);
    setReportErr(null);
    try {
      const { data } = await valuateByLink(l.sourceUrl);
      setReport(data);
    } catch (e) {
      setReportErr(e instanceof LinkValuationError && e.message ? e.message : (t.listingReportFailed ?? "Saxlanmış nəticə açılmadı"));
    }
  };
  const closeReport = () => { setReportUrl(null); setReport(null); setReportErr(null); };

  // Rayon filter options derive from the listings themselves so the dropdown
  // reflects whatever data source feeds the view (real DB or mock).
  const rayonOpts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of listings) {
      if (l.rayonId && l.rayon && l.rayon !== "—") seen.set(l.rayonId, l.rayon.replace(" rayonu", ""));
    }
    return [{ id: "all", name: t.allRayons ?? "Tüm bölgeler" }, ...[...seen].map(([id, name]) => ({ id, name }))];
  }, [listings, t.allRayons]);

  const filtered = listings.filter(
    (l) =>
      (rayon === "all" || l.rayonId === rayon) &&
      (cat === "all" || l.cat === cat) &&
      (status === "all" || l.status === status) &&
      (q === "" || (l.title + l.id + l.rayon).toLowerCase().includes(q.toLowerCase()))
  );
  const rows = filtered.slice().sort((a, b) => {
    const av = a[sortK];
    const bv = b[sortK];
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
  });
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / per));
  const pageRows = rows.slice(page * per, page * per + per);

  // Header count: with no filter show the true DB total (COUNT); with a filter
  // show the filtered result count. `capped` = the DB has more than we loaded.
  const filtersActive = q !== "" || rayon !== "all" || cat !== "all" || status !== "all";
  const headerCount = filtersActive ? total : Math.max(serverTotal, listings.length);
  const capped = !filtersActive && serverTotal > listings.length;

  useEffect(() => {
    setPage(0);
  }, [q, rayon, cat, status]);

  const sortBy = (k: SortKey) => {
    if (sortK === k) setSortDir(-sortDir);
    else {
      setSortK(k);
      setSortDir(-1);
    }
  };
  const sIcon = (k: SortKey) => (sortK === k ? (sortDir === -1 ? " ↓" : " ↑") : "");
  const statusBadge: Record<Listing["status"], [string, string]> = {
    active: ["ok", t.statusActive ?? "Aktiv"],
    paused: ["warn", t.statusPaused ?? "Duraklatıldı"],
    sold: ["muted", t.statusSold ?? "Satıldı"]
  };

  return (
    <div className="hm-v3">
      <Card
        title={t.listingsPageTitle ?? "İlanlar"}
        sub={`${nf(headerCount)} ilan${capped ? ` · ən son ${nf(listings.length)} yüklənib` : ""} · ${t.listingsPageSub ?? "Filtrelenebilir ilan çalışma alanı"}`}
        action={
          <div className="hm-toolbar">
            <div className="hm-search-sm">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.lvSearchPh ?? "İlan, başlıq, ID..."} />
            </div>
            <select value={rayon} onChange={(e) => setRayon(e.target.value)} className="hm-select">
              {rayonOpts.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="hm-select">
              <option value="all">{t.allCats ?? "Hepsi"}</option>
              <option value="Yeni tikili">Yeni tikili</option>
              <option value="Köhnə tikili">Köhnə tikili</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="hm-select">
              <option value="all">{t.allStatus ?? "Tüm durum"}</option>
              <option value="active">{t.statusActive ?? "Aktiv"}</option>
              <option value="paused">{t.statusPaused ?? "Duraklatıldı"}</option>
              <option value="sold">{t.statusSold ?? "Satıldı"}</option>
            </select>
          </div>
        }
      >
        <div className="hm-table-wrap">
          <table className="hm-table">
            <thead>
              <tr>
                <th onClick={() => sortBy("title")} className="sortable">{t.lvTitle ?? "Başlık"}{sIcon("title")}</th>
                <th onClick={() => sortBy("rayon")} className="sortable">{t.lvRayon ?? "Bölge"}{sIcon("rayon")}</th>
                <th onClick={() => sortBy("rooms")} className="sortable num">{t.lvRooms ?? "Otaq"}{sIcon("rooms")}</th>
                <th onClick={() => sortBy("area")} className="sortable num">{t.lvArea ?? "m²"}{sIcon("area")}</th>
                <th onClick={() => sortBy("price")} className="sortable num">{t.lvPrice ?? "Fiyat"}{sIcon("price")}</th>
                <th onClick={() => sortBy("ppm")} className="sortable num">{t.lvPpm ?? "₼/m²"}{sIcon("ppm")}</th>
                <th>{t.lvCategory ?? "Kateqoriya"}</th>
                <th onClick={() => sortBy("date")} className="sortable num">{t.lvDate ?? "Tarix"}{sIcon("date")}</th>
                <th>{t.lvSource ?? "Mənbə"}</th>
                <th>{t.lvStatus ?? "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => (
                <tr key={l.id} onClick={() => openReport(l)} style={l.sourceUrl ? { cursor: "pointer" } : undefined} title={l.sourceUrl ? (t.listingOpenReport ?? "Saxlanmış nəticəni aç") : undefined}>
                  <td>
                    <b>{l.title}</b>
                    <div className="hm-cell-sub">{l.id} · {l.floor}. {t.lvFloor ?? "mərtəbə"}</div>
                  </td>
                  <td>{l.rayon.replace(" rayonu", "")}</td>
                  <td className="num">{l.rooms}</td>
                  <td className="num">{l.area}</td>
                  <td className="num"><b>{nf(l.price)} ₼</b></td>
                  <td className="num">{nf(l.ppm)}</td>
                  <td><span className={"hm-cat " + (l.cat === "Yeni tikili" ? "new" : "old")}>{l.cat}</span></td>
                  <td className="num muted">{l.date.slice(5)}</td>
                  <td className="muted">{l.source}</td>
                  <td><Badge tone={statusBadge[l.status][0]}>{statusBadge[l.status][1]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hm-pager">
          <span>{total === 0 ? 0 : page * per + 1}–{Math.min((page + 1) * per, total)} / {nf(total)}</span>
          <div className="hm-pager-btns">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
            <span>{page + 1} / {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      </Card>
      {reportUrl && (
        <div className="hm-val">
          {report ? (
            <RateReport data={report} onClose={closeReport} />
          ) : (
            <div className="modal-backdrop" onClick={closeReport}>
              <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-body" style={{ padding: "28px 24px", textAlign: "center" }}>
                  {reportErr ? (
                    <>
                      <div style={{ color: "var(--red)", fontWeight: 600, marginBottom: 14 }}>{reportErr}</div>
                      <button className="btn btn-secondary" onClick={closeReport}>{t.close ?? "Bağla"}</button>
                    </>
                  ) : (
                    <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{t.listingReportLoading ?? "Saxlanmış nəticə yüklənir…"}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── B2C ─────────────────────────────────────────────────────────────────
export function B2CView({
  t,
  b2c,
  rayons,
  listingsCount
}: {
  t: Record<string, string>;
  b2c: B2CSummary;
  rayons: RayonStat[];
  listingsCount: number;
}) {
  const maxRoom = Math.max(...b2c.byRooms.map((r) => r.medianPrice), 1);
  const newPct = Math.round((b2c.newVsOld.newCount / (b2c.newVsOld.newCount + b2c.newVsOld.oldCount || 1)) * 100);
  return (
    <div className="hm-v3 hm-b2c">
      <div className="hm-b2c-hero">
        <div className="hm-b2c-hero-txt">
          <Badge tone="brand">{t.b2cHeroBadge ?? "Bakı bazarı · May 2026"}</Badge>
          <h2>{t.b2cHeroLead ?? "Bakıda kvadrat metr"} <b>{nf(b2c.cityMedian)} ₼</b></h2>
          <p>
            {t.b2cHeroSubA ?? "Şəhər üzrə medyan qiymət son ayda"}{" "}
            <span className="hm-up">↑ {b2c.cityTrend}%</span>{" "}
            {t.b2cHeroSubB ?? "artdı. Aşağıda evinizin dəyərini anlamağa kömək edəcək sadə göstəricilər var."}
          </p>
        </div>
        <div className="hm-b2c-hero-card">
          <Donut
            size={132}
            thick={20}
            slices={[
              { value: b2c.newVsOld.newCount, color: "var(--brand-500)" },
              { value: b2c.newVsOld.oldCount, color: "var(--ink-300)" }
            ]}
            center={
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-500)" }}>{t.b2cNewBuild ?? "Yeni tikili"}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{newPct}%</div>
              </div>
            }
          />
          <div className="hm-b2c-hero-legend">
            <span><i style={{ background: "var(--brand-500)" }} />{t.b2cNewBuild ?? "Yeni tikili"} · {nf(b2c.newVsOld.newMed)} ₼/m²</span>
            <span><i style={{ background: "var(--ink-300)" }} />{t.b2cOldBuild ?? "Köhnə tikili"} · {nf(b2c.newVsOld.oldMed)} ₼/m²</span>
          </div>
        </div>
      </div>

      <div className="hm-b2c-tiles">
        <div className="hm-b2c-tile">
          <span className="hm-b2c-ic ok"><Heart size={16} /></span>
          <div className="hm-b2c-tk">{t.b2cCheapest ?? "Ən sərfəli bölgə"}</div>
          <div className="hm-b2c-tv">{b2c.affordableRayon.short}</div>
          <div className="hm-b2c-ts">{nf(b2c.affordableRayon.median)} ₼/m²</div>
        </div>
        <div className="hm-b2c-tile">
          <span className="hm-b2c-ic warn"><Sparkles size={16} /></span>
          <div className="hm-b2c-tk">{t.b2cPremium ?? "Ən prestijli bölgə"}</div>
          <div className="hm-b2c-tv">{b2c.premiumRayon.short}</div>
          <div className="hm-b2c-ts">{nf(b2c.premiumRayon.median)} ₼/m²</div>
        </div>
        <div className="hm-b2c-tile">
          <span className="hm-b2c-ic brand"><TrendingUp size={16} /></span>
          <div className="hm-b2c-tk">{t.b2cFastest ?? "Ən sürətli artan"}</div>
          <div className="hm-b2c-tv">{b2c.fastestRayon.short}</div>
          <div className="hm-b2c-ts"><Trend v={b2c.fastestRayon.trend} /></div>
        </div>
      </div>

      <div className="hm-grid-2b">
        <Card title={t.b2cByRoomTitle ?? "Oda sayısına göre qiymət"} sub={t.b2cByRoomSub ?? "Şəhər üzrə medyan satış qiyməti"}>
          <div className="hm-roombars" style={{ marginTop: 4 }}>
            {b2c.byRooms.map((r) => (
              <div className="hm-roombar" key={r.rooms}>
                <span className="hm-roombar-k">{r.rooms} {t.b2cRoomSuffix ?? "otaqlı"}</span>
                <div className="hm-roombar-track">
                  <span style={{ width: `${(r.medianPrice / maxRoom) * 100}%`, background: "var(--brand-500)" }} />
                </div>
                <span className="hm-roombar-v">{nf(r.medianPrice)} ₼</span>
              </div>
            ))}
          </div>
          <p className="hm-b2c-note">{t.b2cByRoomNoteA ?? "Qiymətlər"} {nf(listingsCount)} {t.b2cByRoomNoteB ?? "aktiv elandan hesablanıb."}</p>
        </Card>
        <Card title={t.b2cRankTitle ?? "Bölgələr üzrə qiymət"} sub={t.b2cRankSub ?? "Aşağıdan yuxarıya medyan ₼/m²"}>
          <div className="hm-b2c-rank">
            {rayons
              .slice()
              .sort((a, b) => a.median - b.median)
              .map((r) => {
                const heat = heatOf(r);
                return (
                  <div className="hm-b2c-rank-row" key={r.id}>
                    <span className="hm-b2c-rank-name">{r.short}</span>
                    <div className="hm-b2c-rank-track">
                      <span style={{ width: `${heat * 100}%`, background: colorFor(heat) }} />
                    </div>
                    <span className="hm-b2c-rank-v">{nf(r.median)}</span>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
