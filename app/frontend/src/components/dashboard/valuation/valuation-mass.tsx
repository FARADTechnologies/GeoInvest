"use client";

// Kütləvi qiymətləndirmə — mass (portfolio) valuation.
// 1:1 port of the team's Homora B2B prototype (landing + portfolio detail +
// portfolio analysis), scoped under .hm-val, wired to /valuation/batch with a
// mock fallback. Existing dashboard views are untouched.

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-url";
import { useEffect, useMemo, useRef, useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Icons, DonutChart, HBars, Pill, SourceBadge, TypePill, fmtMoney } from "@/components/dashboard/valuation/valuation-ui";
import {
  opropFromReport,
  PropertyEntryModal,
  PropertyReport,
  statsOf,
  type OProp,
  type Stats
} from "@/components/dashboard/valuation/valuation-core";
import { COLUMNS, ColumnPicker, colClass, useVisibleCols } from "@/components/dashboard/valuation/valuation-columns";
import { RateReport } from "@/components/dashboard/valuation/valuation-report";
import { geocodeAddress } from "@/components/dashboard/valuation/valuation-maps";
import { fetchValuationMeta, newId } from "@/lib/valuation-data";
import { formatDate } from "@/lib/format-date";
import {
  buildPredictPayload,
  predictByParams,
  reportFromPredict,
  LinkValuationError
} from "@/lib/valuation-report";
import { createValuationJob, fetchValuationJob, getUser } from "@/lib/auth";
import { loadPortfolios, savePortfolios, type Portfolio } from "@/components/dashboard/valuation/valuation-store";
import type { RateReportData, ValuationInput, ValuationMeta, ValuationSource } from "@/types/valuation";


// One imported Excel row (parsed by the backend /valuation/parse-excel).
type ParsedRow = {
  type: string | null; extract: string | null; is_residence: boolean;
  residence: string | null; repair: string | null; area: number | null;
  rooms: number | null; floor: number | null; total_floors: number | null;
  address: string | null;
};

function rowToInput(r: ParsedRow): ValuationInput {
  return {
    address: r.address ?? null,
    rayon: null,
    type: r.type ?? "",
    area: r.area ?? 0,
    rooms: r.rooms ?? null,
    floor: r.floor ?? null,
    total_floors: r.total_floors ?? null,
    repair: r.repair ?? null,
    extract: r.extract ?? null,
    residence: r.is_residence ? r.residence ?? null : null
  };
}

// API-only valuation of one input: geocode the address if needed, then call the
// real predict model. Throws on failure (no DB fallback).
async function valuateInput(input: ValuationInput, id: string): Promise<{ item: OProp; report: RateReportData }> {
  let filled = input;
  if (filled.latitude == null || filled.longitude == null) {
    const geo = filled.address ? await geocodeAddress(filled.address) : null;
    if (!geo) throw new LinkValuationError(0, T("Ünvan üzrə koordinat tapılmadı"));
    filled = { ...filled, latitude: geo.lat, longitude: geo.lng };
  }
  const report = await predictByParams(filled);
  return { item: opropFromReport(id, report), report };
}

// Which server job belongs to which portfolio, so a reload (or a different
// device) can re-attach to a run that is still going on the backend.
const JOBS_KEY = "homora-valuation-jobs";

type JobMemo = { jobId: string; ids: string[] };

function readJobs(): Record<string, JobMemo> {
  try {
    return JSON.parse(window.localStorage.getItem(JOBS_KEY) || "{}") as Record<string, JobMemo>;
  } catch {
    return {};
  }
}

function rememberJob(portfolioId: string, jobId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(
      JOBS_KEY,
      JSON.stringify({ ...readJobs(), [portfolioId]: { jobId, ids } })
    );
  } catch {
    /* ignore quota errors */
  }
}

function forgetJob(portfolioId: string): void {
  try {
    const all = readJobs();
    delete all[portfolioId];
    window.localStorage.setItem(JOBS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// Unvalued draft row from an input (shown in the list until valuated).
function draftFromInput(input: ValuationInput, id: string): OProp {
  return {
    id, valued: false,
    address: input.address || input.rayon || "",
    district: input.rayon || "—",
    type: input.type,
    area: input.area,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    totalFloors: input.total_floors ?? null,
    fairValue: 0, pricePerM2: 0, monthlyRent: 0, yield: 0, payback: 0,
    liquidity: null, score: null, risk: null,
    residence: input.residence ?? null, repair: input.repair ?? null, extract: input.extract ?? null,
    range: [0, 0], rentRange: [0, 0]
  };
}

// This view used to seed three demo portfolios (36 invented apartments with
// invented owners and dates) on first load, so a new account never saw an
// empty screen. They were indistinguishable from real customer portfolios, so
// they are gone: the list starts empty and fills with what the user creates.

type Sub = { name: "list" } | { name: "portfolio"; id: string } | { name: "analysis"; id: string };

// Which portfolio is open lives in the URL, so a link can be shared and a
// reload lands back where you were. The id comes from localStorage rather than
// a server, so it can't be a path segment Next could pre-render — it rides in
// the query string instead: /bulk?p=<id> and /bulk?p=<id>&v=analysis.
function subToSearch(route: Sub): string {
  if (route.name === "list") return "";
  const q = new URLSearchParams({ p: route.id });
  if (route.name === "analysis") q.set("v", "analysis");
  return `?${q}`;
}

function subFromSearch(search: string, exists: (id: string) => boolean): Sub | null {
  const q = new URLSearchParams(search);
  const id = q.get("p");
  if (!id || !exists(id)) return null;
  return q.get("v") === "analysis" ? { name: "analysis", id } : { name: "portfolio", id };
}

export function ValuationMassView({ lang = "az" }: { lang?: Lang }) {
  setValLang(lang);
  const metaQuery = useQuery({ queryKey: ["valuation", "meta"], queryFn: fetchValuationMeta });
  const meta = metaQuery.data?.data ?? null;
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [source, setSource] = useState<ValuationSource>("db");
  const [route, setRoute] = useState<Sub>({ name: "list" });
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded) return;
    // Saved portfolios survive view switches and reloads. Nothing is created
    // on the user's behalf — an empty list means the account has no portfolios.
    const saved = loadPortfolios();
    if (saved) {
      setPortfolios(saved.portfolios);
      setSource(saved.source);
    }
    setSeeded(true);
  }, [seeded]);

  // Persist every change once the initial load/seed is done.
  useEffect(() => {
    if (seeded) savePortfolios(portfolios, source);
  }, [seeded, portfolios, source]);

  // ── URL <-> open portfolio ────────────────────────────────────────
  // Restore from the address bar once the stored portfolios are in hand; an
  // id that no longer exists simply falls back to the list.
  useEffect(() => {
    if (!seeded) return;
    const fromUrl = subFromSearch(window.location.search, (id) => portfolios.some((p) => p.id === id));
    if (fromUrl) setRoute(fromUrl);
    // Only on the first pass after seeding — later changes are driven by the
    // effect below, and re-running here would fight it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    if (!seeded) return;
    const next = window.location.pathname + subToSearch(route);
    if (next !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", next);
    }
  }, [route, seeded]);

  // Back / forward should move between portfolios, not out of the app.
  useEffect(() => {
    const onPop = () => {
      const fromUrl = subFromSearch(window.location.search, (id) => portfolios.some((p) => p.id === id));
      setRoute(fromUrl ?? { name: "list" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [portfolios]);

  const update = (pf: Portfolio) => setPortfolios((prev) => prev.map((p) => (p.id === pf.id ? pf : p)));
  const active = route.name !== "list" ? portfolios.find((p) => p.id === route.id) : undefined;

  let body;
  if (route.name === "portfolio" && active)
    body = <PortfolioDetail portfolio={active} meta={meta} source={source} setSource={setSource} onBack={() => setRoute({ name: "list" })} onAnalysis={() => setRoute({ name: "analysis", id: active.id })} update={update} />;
  else if (route.name === "analysis" && active)
    body = <PortfolioAnalysis portfolio={active} source={source} onBack={() => setRoute({ name: "portfolio", id: active.id })} />;
  else
    body = (
      <MassLanding
        portfolios={portfolios}
        source={metaQuery.data?.source ?? source}
        loading={!seeded}
        onOpen={(id) => setRoute({ name: "portfolio", id })}
        onCreate={(name) => {
          // The author is whoever is signed in — never a placeholder name.
          const pf: Portfolio = { id: newId("pf"), name: name || `Yeni portfel · ${formatDate(new Date())}`, description: "Boş portfel — mənzilləri əl ilə əlavə edin.", createdAt: new Date().toISOString().slice(0, 10), createdBy: getUser()?.name || "—", items: [] };
          setPortfolios((prev) => [pf, ...prev]);
          setRoute({ name: "portfolio", id: pf.id });
        }}
      />
    );

  return <div className="hm-val"><div className="page" style={{ padding: 0, maxWidth: "none" }}>{body}</div></div>;
}

// ── Landing ───────────────────────────────────────────────────────────

function MassLanding({ portfolios, source, loading, onOpen, onCreate }: { portfolios: Portfolio[]; source: ValuationSource; loading: boolean; onOpen: (id: string) => void; onCreate: (name: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <div className="page-header">
        <div>
          <div className="crumbs"><span>{T(`Kütləvi qiymətləndirmə`)}</span></div>
          <h1 className="page-title">{T(`Kütləvi qiymətləndirmə`)}</h1>
          <p className="page-sub">{T(`Hər portfel — bir qrup mənzilin yığını. Portfelə daxil olub mənzilləri əlavə edin və ya toplu qiymətləndirin.`)}</p>
        </div>
        <div className="page-actions">
          <SourceBadge source={source} />
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Icons.Plus size={14} /> {T(`Yeni portfel`)}</button>
        </div>
      </div>

      {!loading && portfolios.length === 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="card-title">{T(`Hələ portfeliniz yoxdur`)}</div>
          <div className="card-sub" style={{ marginTop: 4, maxWidth: "62ch" }}>
            {T(`Portfel yaradın, sonra mənzilləri əl ilə və ya Excel ilə əlavə edin. Hər mənzil Homora modelindən keçirilir və nəticələr portfel üzrə yığılır.`)}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {portfolios.map((pf) => {
          const st = pf.items.length ? statsOf(pf.items) : null;
          return (
            <div key={pf.id} className="card" style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => onOpen(pf.id)}>
              <div style={{ height: 6, background: pf.items.length ? "linear-gradient(90deg, var(--orange) 0%, var(--teal) 100%)" : "var(--border)" }} />
              <div className="card-pad">
                <div className="fl-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="card-title" style={{ fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pf.name}</div>
                    <div className="cell-muted" style={{ marginTop: 4 }}>{formatDate(pf.createdAt)} · {pf.createdBy}</div>
                  </div>
                  {st ? null : <Pill tone="amber" dot>{T(`Qaralama`)}</Pill>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 14, gap: 10 }}>
                  <CardMicro k={T(`Mənzil`)} v={String(pf.items.length)} />
                  <CardMicro k={T(`Dəyər`)} v={st ? fmtMoney(st.totalValue) : "—"} />
                  <CardMicro k="Yield" v={st ? `${st.avgYield}%` : "—"} />
                </div>
              </div>
            </div>
          );
        })}
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 180, cursor: "pointer", border: "2px dashed var(--border-strong)", background: "transparent", boxShadow: "none" }} onClick={() => setCreating(true)}>
          <div style={{ textAlign: "center" }}>
            <div className="empty-art" style={{ margin: "0 auto 8px" }}><Icons.Plus size={22} /></div>
            <div className="card-title">{T(`Yeni portfel yarat`)}</div>
            <div className="cell-muted" style={{ marginTop: 4 }}>{T(`Boş portfeli yaradıb mənzil əlavə et`)}</div>
          </div>
        </div>
      </div>
      {loading ? <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>{T(`Yüklənir…`)}</div> : null}

      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">{T(`Yeni portfel`)}</div><div className="sp" /><button className="modal-close" onClick={() => setCreating(false)}><Icons.X size={14} /></button></div>
            <div className="modal-body" style={{ padding: "20px 22px 22px" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{T(`Portfelin adı`)}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="məs. Yasamal — Q3 portfeli" autoFocus onKeyDown={(e) => e.key === "Enter" && (onCreate(name.trim()), setCreating(false))} style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text-1)", background: "var(--card)", outline: "none" }} />
              <div className="fl-row" style={{ gap: 8, marginTop: 18 }}>
                <span className="sp" />
                <button className="btn btn-ghost" onClick={() => setCreating(false)}>{T(`Ləğv et`)}</button>
                <button className="btn btn-primary" onClick={() => { onCreate(name.trim()); setCreating(false); }}><Icons.Plus size={14} /> {T(`Portfeli yarat`)}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CardMicro({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{v}</div>
    </div>
  );
}

// ── Portfolio detail ──────────────────────────────────────────────────

function PortfolioDetail({ portfolio, meta, source, setSource, onBack, onAnalysis, update }: { portfolio: Portfolio; meta: ValuationMeta | null; source: ValuationSource; setSource: (s: ValuationSource) => void; onBack: () => void; onAnalysis: () => void; update: (pf: Portfolio) => void }) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OProp | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Hamısı");
  // Reports (predict contract) per item id — drives the RateReport modal.
  const [reports, setReports] = useState<Record<string, RateReportData>>({});
  // Sequential batch progress (Excel import → predict, 1-by-1).
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = portfolio.items;
  const valued = items.filter((x) => x.valued !== false);
  const draftCount = items.length - valued.length;
  const stats = valued.length > 0 ? statsOf(items) : null;
  const { visible, toggle, reset } = useVisibleCols("hm-cols-mass");
  const shown = COLUMNS.filter((c) => visible.has(c.key));

  const filtered = useMemo(() => {
    let xs = items;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter((x) => x.address.toLowerCase().includes(q) || x.district.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
    }
    if (typeFilter !== "Hamısı") xs = xs.filter((x) => x.type === typeFilter);
    return xs;
  }, [items, query, typeFilter]);

  const openIdx = openId ? items.findIndex((x) => x.id === openId) : -1;
  const openItem = openIdx >= 0 ? items[openIdx] : null;

  const addItems = (xs: OProp[]) => update({ ...portfolio, items: [...xs, ...portfolio.items] });
  const replaceItem = (it: OProp) => update({ ...portfolio, items: portfolio.items.map((x) => (x.id === it.id ? it : x)) });
  const removeItem = (id: string) => update({ ...portfolio, items: portfolio.items.filter((x) => x.id !== id) });

  const toInput = (d: OProp): ValuationInput => ({ address: d.address || null, rayon: d.district === "—" ? null : d.district, type: d.type, area: d.area, rooms: d.rooms, floor: d.floor, total_floors: d.totalFloors, repair: d.repair, extract: d.extract, residence: d.residence });

  const importExcel = async (file: File) => {
    setImportErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl(`/valuation/parse-excel`), { method: "POST", body: fd });
      if (!res.ok) {
        let msg = "";
        try { const j = (await res.json()) as { detail?: string }; msg = j?.detail || ""; } catch { /* no body */ }
        setImportErr(msg || T("Excel faylını oxumaq mümkün olmadı"));
        return;
      }
      const j = (await res.json()) as { rows: ParsedRow[]; count: number };
      if (!j.count) { setImportErr(T("Faylda mənzil tapılmadı")); return; }
      addItems(j.rows.map((r) => draftFromInput(rowToInput(r), newId("H"))));
    } catch {
      setImportErr(T("Excel yüklənmədi, yenidən cəhd edin"));
    } finally {
      setBusy(false);
    }
  };

  // Valuate a set of rows against the real predict model.
  //
  // The per-flat loop used to run here in the browser, so leaving the page
  // cancelled the whole run. It now goes to the backend as a job (one row at a
  // time there, ~20–55 s each) and this component only submits and polls —
  // closing the tab no longer stops anything, and re-opening re-attaches.
  // Geocoding stays client-side: it needs the Maps SDK and is fast.
  const runBatch = async (targets: OProp[]) => {
    if (targets.length === 0) return;
    setImportErr(null);
    setProgress({ done: 0, total: targets.length, label: "" });

    const inputs: ValuationInput[] = [];
    const ids: string[] = [];
    for (const d of targets) {
      const base = toInput(d);
      let filled = base;
      if ((!base.latitude || !base.longitude) && base.address) {
        try {
          const geo = await geocodeAddress(base.address);
          if (geo) filled = { ...base, latitude: geo.lat, longitude: geo.lng };
        } catch {
          /* keep the row; the backend reports it as failed */
        }
      }
      inputs.push(filled);
      ids.push(d.id);
    }

    try {
      const job = await createValuationJob(
        inputs.map((i) => buildPredictPayload(i)),
        portfolio.id
      );
      rememberJob(portfolio.id, job.job_id, ids);
      await pollJob(job.job_id, inputs, ids, targets.length);
    } catch (err) {
      setProgress(null);
      setImportErr(
        err instanceof Error && err.message ? err.message : T("Qiymətləndirmə modeli cavab vermir")
      );
    }
  };

  // Poll a server job until it finishes, folding each completed row into the
  // portfolio as it lands so progress is visible (and survives a reload).
  const pollJob = async (
    jobId: string,
    inputs: ValuationInput[],
    ids: string[],
    total: number
  ) => {
    for (;;) {
      let job: Awaited<ReturnType<typeof fetchValuationJob>>;
      try {
        job = await fetchValuationJob(jobId);
      } catch {
        setProgress(null);
        return;
      }
      const gotReports: Record<string, RateReportData> = {};
      let cur = portfolio.items;
      let failed = 0;
      for (const r of job.results ?? []) {
        const id = ids[r.index];
        const input = inputs[r.index];
        if (!id || !input) continue;
        if (r.ok && r.result) {
          const report = reportFromPredict(r.result as never, input);
          gotReports[id] = report;
          cur = cur.map((x) => (x.id === id ? opropFromReport(id, report) : x));
        } else {
          failed++;
        }
      }
      if (Object.keys(gotReports).length) {
        setReports((prev) => ({ ...prev, ...gotReports }));
        update({ ...portfolio, items: cur });
      }
      setProgress({
        done: job.done,
        total: job.total || total,
        label: inputs[job.done]?.address ?? ""
      });

      if (job.status === "done" || job.status === "failed") {
        setProgress(null);
        forgetJob(portfolio.id);
        if (job.status === "failed") setImportErr(job.error || T("Qiymətləndirmə modeli cavab vermir"));
        else if (failed > 0)
          setImportErr(`${failed} mənzil qiymətləndirilə bilmədi (ünvan tapılmadı və ya model xətası).`);
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  };

  const submit = async (input: ValuationInput, doValuate: boolean, existingId?: string) => {
    if (!doValuate) {
      const draft = draftFromInput(input, existingId ?? newId("H"));
      if (existingId) replaceItem(draft); else addItems([draft]);
      setEntryOpen(false); setEditTarget(null); return;
    }
    setImportErr(null);
    setBusy(true);
    try {
      const id = existingId ?? newId("H");
      const { item, report } = await valuateInput(input, id);
      setReports((prev) => ({ ...prev, [id]: report }));
      if (existingId) replaceItem(item); else addItems([item]);
      setEntryOpen(false); setEditTarget(null);
    } catch (err) {
      setImportErr(err instanceof LinkValuationError && err.message ? err.message : T("Qiymətləndirmə modeli cavab vermir"));
    } finally {
      setBusy(false);
    }
  };

  // Only the rows that have never been valuated — the cheap, common action.
  const valuateDrafts = () => runBatch(items.filter((x) => x.valued === false));
  // Every row again, including ones that already have a value. Each row is a
  // fresh model call (~20-40 s), so on a large portfolio this is expensive and
  // is worth confirming first.
  const revaluate = () => {
    if (valued.length > 0 && !window.confirm(
      T("Bütün mənzillər yenidən qiymətləndiriləcək") +
      ` (${items.length}). ` +
      T("Mövcud nəticələr yenisi ilə əvəz olunacaq. Davam edilsin?")
    )) return;
    runBatch(items);
  };

  return (
    <>
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="crumbs"><a onClick={onBack}>{T(`Kütləvi qiymətləndirmə`)}</a><span className="sep">/</span><span style={{ color: "var(--text-2)" }}>{portfolio.name}</span></div>
          <div className="fl-row" style={{ gap: 10, alignItems: "center" }}>
            <h1 className="page-title">{portfolio.name}</h1>
            {draftCount > 0 ? <Pill tone="amber" dot>{draftCount} qaralama</Pill> : items.length > 0 ? <Pill tone="green" dot>{T(`Qiymətləndirildi`)}</Pill> : <Pill tone="gray" dot>{T(`Boş`)}</Pill>}
          </div>
          <p className="page-sub">{portfolio.description} · Yaradılıb {formatDate(portfolio.createdAt)} · {portfolio.createdBy}</p>
        </div>
        <div className="page-actions">
          <SourceBadge source={source} />
          <button className="btn btn-ghost" onClick={onAnalysis} disabled={valued.length === 0} style={{ opacity: valued.length === 0 ? 0.5 : 1 }}><Icons.TrendUp size={14} /> {T(`Portfel analizi`)}</button>
          <button className="btn btn-secondary" disabled={items.length === 0} style={{ opacity: items.length === 0 ? 0.5 : 1 }}><Icons.Download size={14} /> Excel</button>
          <button className="btn btn-secondary" disabled={valued.length === 0} style={{ opacity: valued.length === 0 ? 0.5 : 1 }}><Icons.PDF size={14} /> PDF</button>
        </div>
      </div>

      <div className="drop" style={{ padding: 18, gap: 18, marginBottom: 14 }}>
        <div className="drop-art" style={{ width: 52, height: 52 }}><Icons.FileSpreadsheet size={26} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="drop-title">{T(`Excel cədvəli ilə əlavə et`)}</div>
          <div className="drop-sub">.xlsx — hər sətir bir mənzil (ünvan, sahə, otaq…). Yükləndikdən sonra "Portfeli qiymətləndir" ilə hamısı API ilə hesablanır.</div>
        </div>
        <div className="fl-row" style={{ gap: 8, flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy || !!progress}><Icons.Upload size={13} /> {busy ? T(`Oxunur…`) : T(`Excel yüklə`)}</button>
        </div>
      </div>

      {importErr && (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 14, background: "var(--red-soft)", color: "var(--red)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600 }}>
          <Icons.Info size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{importErr}</span>
          <button className="icon-btn" style={{ width: 24, height: 24, color: "var(--red)" }} onClick={() => setImportErr(null)}><Icons.X size={12} /></button>
        </div>
      )}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, marginBottom: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <MiniStat k={T(`Qiymətləndirilmiş`)} v={String(stats.n)} />
          <MiniStat k={T(`Ümumi dəyər`)} v={fmtMoney(stats.totalValue)} accent />
          <MiniStat k={T(`Aylıq kirayə`)} v={fmtMoney(stats.totalRent)} />
          <MiniStat k={T(`Orta gəlirlilik`)} v={`${stats.avgYield}%`} />
          <MiniStat k={T(`Orta geri ödəmə`)} v={`${stats.avgPayback} il`} last />
        </div>
      )}

      <div className="table-wrap">
        <div className="table-tools">
          <input className="search" placeholder={T(`Ünvan, rayon və ya ID ilə axtar…`)} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="fl-row" style={{ gap: 4 }}>
            {["Hamısı", "Yeni tikili", "Köhnə tikili"].map((tf) => (
              <button key={tf} className={`btn btn-sm ${typeFilter === tf ? "btn-secondary" : "btn-ghost"}`} onClick={() => setTypeFilter(tf)}>{T(tf)}</button>
            ))}
          </div>
          <span className="sp" />
          <ColumnPicker visible={visible} toggle={toggle} reset={reset} />
          <button className="btn btn-primary btn-sm" onClick={() => setEntryOpen(true)}><Icons.Plus size={13} /> {T(`Yeni qiymətləndirmə`)}</button>
        </div>

        <div className="table-scroll" style={{ maxHeight: 560 }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                {shown.map((c) => (
                  <th key={c.key} className={colClass(c.align)} style={c.width ? { width: c.width } : undefined}>{T(c.label)}</th>
                ))}
                <th style={{ width: 90, textAlign: "right" }}>{T(`Əməliyyat`)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const dr = p.valued === false;
                return (
                  <tr key={p.id} className="row-click" onClick={(e) => { if ((e.target as HTMLElement).closest(".row-act")) return; if (dr) setEditTarget(p); else setOpenId(p.id); }}>
                    <td className="cell-muted mono">{p.id}</td>
                    {shown.map((c) => (
                      <td key={c.key} className={`${colClass(c.align)}${c.key === "type" ? " pill-cell" : ""}`.trim()}>{c.render(p, dr)}</td>
                    ))}
                    <td className="row-act" style={{ textAlign: "right" }}>
                      <div className="fl-row" style={{ gap: 2, justifyContent: "flex-end" }}>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} title={T(`Redaktə et`)} onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}><Icons.Edit size={13} /></button>
                        <button className="icon-btn" style={{ width: 28, height: 28, color: "var(--red)" }} title={T(`Sil`)} onClick={(e) => { e.stopPropagation(); if (confirm(`${p.address}\n\nBu mənzili portfeldən silmək istədiyinizə əminsiniz?`)) removeItem(p.id); }}><Icons.Trash size={13} /></button>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} title={dr ? "Hələ qiymətləndirilməyib" : "Hesabatı aç"} disabled={dr} onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}><Icons.Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-art">{items.length === 0 ? <Icons.Plus size={28} /> : <Icons.Search size={28} />}</div>
              <div className="empty-title">{items.length === 0 ? "Bu portfeldə hələ mənzil yoxdur" : "Nəticə tapılmadı"}</div>
              <div className="empty-sub">{items.length === 0 ? '"Nümunə yüklə" və ya "Yeni qiymətləndirmə" ilə mənzil əlavə edin.' : "Axtarış və ya filtri dəyişib yenidən cəhd edin."}</div>
              {items.length === 0 && <button className="btn btn-primary" onClick={() => setEntryOpen(true)}><Icons.Plus size={14} /> {T(`İlk mənzili əlavə et`)}</button>}
            </div>
          )}
        </div>
      </div>

      <div className="bottom-bar">
        <div className="fl-row" style={{ gap: 14, fontSize: 13 }}>
          <div className="fl-col">
            <div className="cell-muted">{T(`Portfeldə mənzil sayı`)}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{items.length} ədəd{draftCount > 0 && <span style={{ color: "var(--amber)", fontWeight: 600, marginLeft: 6, fontSize: 12 }}>({draftCount} qaralama)</span>}</div>
          </div>
          {stats && (<>
            <div className="divider-y" style={{ height: 32 }} />
            <div className="fl-col"><div className="cell-muted">{T(`Ümumi dəyər`)}</div><div style={{ fontWeight: 700, fontSize: 15 }}>{fmtMoney(stats.totalValue)}</div></div>
            <div className="divider-y" style={{ height: 32 }} />
            <div className="fl-col"><div className="cell-muted">{T(`Orta gəlirlilik`)}</div><div style={{ fontWeight: 700, fontSize: 15 }}>{stats.avgYield}%</div></div>
          </>)}
        </div>
        <span className="sp" />
        {draftCount > 0 && (
          <button className="btn btn-primary btn-lg" onClick={valuateDrafts} disabled={busy || !!progress}>{progress ? <><Icons.Refresh size={16} /> {T(`Qiymətləndirilir…`)}</> : <><Icons.Sparkle size={16} /> {T(`Yeniləri qiymətləndir`)} ({draftCount})</>}</button>
        )}
        {draftCount === 0 && stats && (
          <button className="btn btn-secondary" onClick={onAnalysis}><Icons.TrendUp size={14} /> {T(`Portfel analizi`)}</button>
        )}
        <button
          className={`btn ${draftCount > 0 ? "btn-secondary" : "btn-primary btn-lg"}`}
          onClick={revaluate}
          disabled={items.length === 0 || busy || !!progress}
          title={T(`Bütün mənzilləri modeldən yenidən keçirir`)}
          style={{ opacity: items.length === 0 ? 0.5 : 1 }}
        >
          <Icons.Refresh size={16} /> {T(`Hamısını yenidən hesabla`)} ({items.length})
        </button>
      </div>

      {progress && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,30,61,0.42)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 200 }}>
          <div style={{ background: "var(--card)", borderRadius: 18, padding: "32px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "var(--shadow-lg)", minWidth: 380, maxWidth: 460 }}>
            <div className="empty-art"><Icons.Sparkle size={28} /></div>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-1)" }}>{T(`Portfel qiymətləndirilir…`)}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{progress.done} / {progress.total} mənzil · model yavaş ola bilər (sətir başına ~20-40 san)</div>
              {progress.label ? <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 380 }}>{progress.label}</div> : null}
              <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden", marginTop: 14 }}>
                <div style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, height: "100%", background: "var(--orange)", transition: "width .3s" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {openItem && openItem.valued !== false && reports[openItem.id] ? (
        <RateReport data={reports[openItem.id]} onClose={() => setOpenId(null)} />
      ) : openItem && openItem.valued !== false && stats ? (
        <PropertyReport property={openItem} portfolioName={portfolio.name} itemsCount={valued.length} stats={stats} rank={[...valued].sort((a, b) => b.yield - a.yield).findIndex((x) => x.id === openItem.id) + 1} onClose={() => setOpenId(null)} onPrev={() => openIdx > 0 && setOpenId(items[openIdx - 1].id)} onNext={() => openIdx >= 0 && openIdx < items.length - 1 && setOpenId(items[openIdx + 1].id)} />
      ) : null}
      <PropertyEntryModal open={entryOpen} portfolioName={portfolio.name} meta={meta} busy={busy} onClose={() => setEntryOpen(false)} onSubmit={(input, v) => submit(input, v)} />
      <PropertyEntryModal open={!!editTarget} portfolioName={portfolio.name} meta={meta} initial={editTarget} busy={busy} onClose={() => setEditTarget(null)} onSubmit={(input, v) => submit(input, v, editTarget?.id)} />
    </>
  );
}

function MiniStat({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: last ? "none" : "1px solid var(--border)", position: "relative" }}>
      {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--orange)" }} />}
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{v}</div>
    </div>
  );
}

// ── Portfolio analysis ────────────────────────────────────────────────

const METRICS: Record<string, { label: string; fmt: (v: number) => string; get: (x: OProp) => number }> = {
  yield: { label: "Gəlirlilik", fmt: (v) => `${v.toFixed(1)}%`, get: (x) => x.yield },
  monthlyRent: { label: "Aylıq kirayə", fmt: (v) => fmtMoney(v), get: (x) => x.monthlyRent },
  payback: { label: "Geri ödəmə", fmt: (v) => `${v.toFixed(1)} il`, get: (x) => x.payback },
  pricePerM2: { label: "Qiymət / m²", fmt: (v) => fmtMoney(v, " ₼/m²"), get: (x) => x.pricePerM2 },
  fairValue: { label: "Fair value", fmt: (v) => fmtMoney(v), get: (x) => x.fairValue },
  area: { label: "Sahə", fmt: (v) => `${Math.round(v)} m²`, get: (x) => x.area }
};
const MK = Object.keys(METRICS);
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const agg = (a: number[], k: string) => (k === "median" ? median(a) : mean(a));
function niceBuckets(values: number[], n = 10) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const rawStep = span / n, mag = Math.pow(10, Math.floor(Math.log10(rawStep))), norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
  const edges: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) edges.push(+v.toFixed(8));
  return edges;
}

export function PortfolioAnalysis({ portfolio, source, onBack }: { portfolio: Portfolio; source: ValuationSource; onBack: () => void }) {
  const items = portfolio.items.filter((x) => x.valued !== false);
  const stats = statsOf(portfolio.items);
  const [histMetric, setHistMetric] = useState("yield");
  const [aggKind, setAggKind] = useState("mean");
  const [scatterX, setScatterX] = useState("yield");
  const [scatterY, setScatterY] = useState("payback");
  const [selBin, setSelBin] = useState<number | null>(null);
  useEffect(() => setSelBin(null), [histMetric]);
  // Clicking a listing in the selected-range list opens its property report.
  const [reportId, setReportId] = useState<string | null>(null);
  const reportIdx = reportId ? items.findIndex((x) => x.id === reportId) : -1;
  const reportItem = reportIdx >= 0 ? items[reportIdx] : null;

  const districtBars = Object.entries(stats.byDistrict).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  const sorted = [...items].sort((a, b) => b.yield - a.yield);
  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-5).reverse();

  return (
    <>
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="crumbs"><a onClick={onBack}>{portfolio.name}</a><span className="sep">/</span><span>{T(`Portfel analizi`)}</span></div>
          <h1 className="page-title">{T(`Portfel analizi`)}</h1>
          <p className="page-sub">{T(`Portfel üzrə zəngin analitika — risk profili, paylanma, top performans və müqayisə.`)}</p>
        </div>
        <div className="page-actions"><SourceBadge source={source} /><button className="btn btn-secondary"><Icons.PDF size={14} /> {T(`Analitik hesabat (PDF)`)}</button></div>
      </div>

      <div className="summary-band" style={{ marginTop: 4 }}>
        <div className="card card-pad">
          <div className="fl-row" style={{ gap: 16 }}>
            <div>
              <div className="card-title">{T(`Portfel gəlirliyi`)}</div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {agg(items.map((x) => x.yield), aggKind).toFixed(1)}%
              </div>
              <div className="card-sub" style={{ marginTop: 4, maxWidth: "36ch" }}>{stats.n} mənzilin {aggKind === "median" ? "median" : "orta"} illik kirayə gəlirliyi.</div>
            </div>
          </div>
        </div>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <AggStat accent label={T(`Ümumi dəyər`)} value={fmtMoney(stats.totalValue)} sub={`${stats.n} mənzil`} />
          <AggStat label={T(`Orta qiymət/m²`)} value={fmtMoney(stats.avgPricePerM2, "")} sub="min–max" items={items} metricKey="pricePerM2" />
          <AggStat label={T(`Orta aylıq kirayə`)} value={fmtMoney(stats.totalRent / Math.max(stats.n, 1))} items={items} metricKey="monthlyRent" />
          <AggStat label={T(`Orta gəlirlilik`)} value={`${stats.avgYield}%`} items={items} metricKey="yield" />
          <AggStat label={T(`Orta geri ödəmə`)} value={`${stats.avgPayback} il`} items={items} metricKey="payback" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="card-title">{T(`Rayon üzrə paylanma`)}</div>
          <div className="card-sub" style={{ margin: "4px 0 14px" }}>{T(`Portfeldəki mənzillərin coğrafi paylanması.`)}</div>
          <HBars items={districtBars} valueFmt={(v) => `${v} ədəd`} />
        </div>
        <div className="card card-pad">
          <div className="card-title">{T(`Növ üzrə`)}</div>
          <div className="card-sub" style={{ margin: "4px 0 14px" }}>{T(`Yeni vs köhnə tikili.`)}</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12 }}>
            <DonutChart value={Math.round((stats.newCount / Math.max(stats.n, 1)) * 100)} label={T(`Yeni tikili`)} size={84} color="#2A8B7E" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div className="fl-row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#2A8B7E" }} /><span style={{ fontSize: 13 }}>{T(`Yeni tikili`)}</span><span className="sp" /><strong style={{ fontVariantNumeric: "tabular-nums" }}>{stats.newCount}</strong></div>
              <div className="fl-row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#0F1E3D" }} /><span style={{ fontSize: 13 }}>{T(`Köhnə tikili`)}</span><span className="sp" /><strong style={{ fontVariantNumeric: "tabular-nums" }}>{stats.n - stats.newCount}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="fl-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="card-title">{T(METRICS[histMetric].label)} paylanması</div>
            <div className="card-sub" style={{ marginTop: 4 }}>Bin üzərinə klikləyib mənzilləri görün. Şaquli xətt portfel {aggKind === "median" ? "medyanı" : "ortası"}dır.</div>
          </div>
          <div className="fl-row" style={{ gap: 8, flexShrink: 0 }}>
            <ChartSelect label={T(`Metrika`)} value={histMetric} onChange={setHistMetric} options={MK.map((k) => ({ value: k, label: T(METRICS[k].label) }))} />
            <ChartSelect label={T(`Mərkəz`)} value={aggKind} onChange={setAggKind} options={[{ value: "mean", label: "Orta" }, { value: "median", label: "Median" }]} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}><BigHistogram items={items} metricKey={histMetric} aggKind={aggKind} selBin={selBin} onBin={setSelBin} /></div>
        {selBin != null && <BinPanel items={items} metricKey={histMetric} bin={selBin} onClose={() => setSelBin(null)} onOpen={setReportId} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div className="card"><div className="card-head"><div className="card-title">{T(`Top 5 — ən yüksək skor`)}</div><span className="sp" /><Icons.Star size={14} style={{ color: "var(--green)" }} /></div><RankList items={top} variant="top" /></div>
        <div className="card"><div className="card-head"><div className="card-title">{T(`Aşağı 5 — diqqət lazımdır`)}</div><span className="sp" /><Icons.TrendDown size={14} style={{ color: "var(--red)" }} /></div><RankList items={bottom} variant="bottom" /></div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="fl-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="card-title">{T(METRICS[scatterX].label)} vs. {T(METRICS[scatterY].label)}</div>
            <div className="card-sub" style={{ marginTop: 4 }}>Hər nöqtə bir mənzil. Ölçü = sahə, rəng = risk səviyyəsi.</div>
          </div>
          <div className="fl-row" style={{ gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <ChartSelect label="X oxu" value={scatterX} onChange={setScatterX} options={MK.map((k) => ({ value: k, label: T(METRICS[k].label) }))} />
            <ChartSelect label="Y oxu" value={scatterY} onChange={setScatterY} options={MK.map((k) => ({ value: k, label: T(METRICS[k].label) }))} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}><BigScatter items={items} xKey={scatterX} yKey={scatterY} /></div>
        <div className="fl-row" style={{ gap: 14, marginTop: 14, flexWrap: "wrap", fontSize: 12 }}>
          <LegendDot color="#1F8A5B" label="Aşağı risk (78+)" /><LegendDot color="#C58A1A" label="Orta risk (60-77)" /><LegendDot color="#C0392B" label="Yüksək risk (<60)" />
        </div>
      </div>

      {reportItem && (
        <PropertyReport
          property={reportItem}
          portfolioName={portfolio.name}
          itemsCount={items.length}
          stats={stats}
          rank={[...items].sort((a, b) => b.yield - a.yield).findIndex((x) => x.id === reportItem.id) + 1}
          onClose={() => setReportId(null)}
          onPrev={() => reportIdx > 0 && setReportId(items[reportIdx - 1].id)}
          onNext={() => reportIdx >= 0 && reportIdx < items.length - 1 && setReportId(items[reportIdx + 1].id)}
        />
      )}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <div className="fl-row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: color }} /><span style={{ color: "var(--text-2)" }}>{label}</span></div>;
}

function AggStat({ accent, label, value, sub, items, metricKey }: { accent?: boolean; label: string; value: string; sub?: string; items?: OProp[]; metricKey?: string }) {
  let displaySub = sub;
  if (items && metricKey) {
    const vs = items.map(METRICS[metricKey].get);
    displaySub = `${METRICS[metricKey].fmt(Math.min(...vs))} – ${METRICS[metricKey].fmt(Math.max(...vs))}`;
  }
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {displaySub && <div className="fl-row" style={{ gap: 4, marginTop: 2 }}><span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>min–max</span><span style={{ fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{displaySub}</span></div>}
    </div>
  );
}

function ChartSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 12px", background: "var(--card)", border: "1.5px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-1)", minWidth: 168, outline: "none" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function BigHistogram({ items, metricKey, aggKind, selBin, onBin }: { items: OProp[]; metricKey: string; aggKind: string; selBin: number | null; onBin: (i: number | null) => void }) {
  const meta = METRICS[metricKey];
  const values = items.map(meta.get);
  if (values.length === 0) return null;
  const aggValue = agg(values, aggKind);
  const edges = niceBuckets(values, 10);
  const bins = edges.slice(0, -1).map((e, i) => ({ from: e, to: edges[i + 1], count: 0 }));
  values.forEach((v) => { let idx = bins.findIndex((b) => v >= b.from && v < b.to); if (idx === -1) idx = bins.length - 1; bins[idx].count++; });
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const W = 1180, H = 360, padL = 60, padR = 30, padT = 24, padB = 60, innerW = W - padL - padR, innerH = H - padT - padB, barW = innerW / bins.length;
  const sx = (v: number) => padL + ((v - edges[0]) / (edges[edges.length - 1] - edges[0])) * innerW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--orange)" stopOpacity="0.95" /><stop offset="100%" stopColor="var(--orange)" stopOpacity="0.55" /></linearGradient></defs>
      {Array.from({ length: 6 }, (_, i) => { const v = Math.round((i / 5) * maxCount); const y = padT + innerH - (v / maxCount) * innerH; return <g key={i}><line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" /><text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" fontFamily="Manrope">{v}</text></g>; })}
      {bins.map((b, i) => {
        const h = (b.count / maxCount) * innerH, x = padL + i * barW + 3, isSel = selBin === i, isAgg = aggValue >= b.from && aggValue < b.to;
        return (
          <g key={i} style={{ cursor: b.count ? "pointer" : "default" }} onClick={() => b.count && onBin(isSel ? null : i)}>
            <rect x={padL + i * barW} y={padT} width={barW} height={innerH} fill="transparent" />
            <rect x={x} y={padT + innerH - h} width={barW - 6} height={h} rx="3" fill={isSel ? "var(--navy-900)" : isAgg ? "var(--orange)" : "url(#hg)"} fillOpacity={b.count === 0 ? 0.08 : 1} stroke={isSel ? "var(--orange)" : "none"} strokeWidth={isSel ? 2.5 : 0} />
            {b.count > 0 && <text x={x + (barW - 6) / 2} y={padT + innerH - h - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={isSel ? "var(--orange)" : "var(--text-1)"} fontFamily="Manrope">{b.count}</text>}
          </g>
        );
      })}
      {edges.map((e, i) => <text key={i} x={sx(e)} y={padT + innerH + 18} textAnchor="middle" fontSize="10.5" fill="var(--text-3)" fontFamily="Manrope">{meta.fmt(e)}</text>)}
      <line x1={sx(aggValue)} y1={padT - 4} x2={sx(aggValue)} y2={padT + innerH} stroke="var(--orange)" strokeWidth="2" strokeDasharray="6 4" />
      <rect x={sx(aggValue) - 70} y={padT - 22} width="140" height="22" rx="11" fill="var(--orange)" />
      <text x={sx(aggValue)} y={padT - 7} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="white" fontFamily="Manrope">{aggKind === "median" ? "Median" : "Orta"}: {meta.fmt(aggValue)}</text>
    </svg>
  );
}

function BinPanel({ items, metricKey, bin, onClose, onOpen }: { items: OProp[]; metricKey: string; bin: number; onClose: () => void; onOpen: (id: string) => void }) {
  const meta = METRICS[metricKey];
  const edges = niceBuckets(items.map(meta.get), 10);
  const from = edges[bin], to = edges[bin + 1];
  const matched = items.filter((x) => meta.get(x) >= from && meta.get(x) < to).sort((a, b) => meta.get(b) - meta.get(a));
  return (
    <div style={{ marginTop: 14, background: "var(--card-2)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--orange-tint)", color: "var(--orange)", display: "grid", placeItems: "center" }}><Icons.Filter size={14} /></div>
        <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>Seçilmiş aralıq: {meta.fmt(from)} – {meta.fmt(to)}</div><div className="cell-muted">{matched.length} mənzil bu aralıqda</div></div>
        <span className="sp" /><button className="btn btn-ghost btn-sm" onClick={onClose}><Icons.X size={13} /> {T(`Bağla`)}</button>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        <table className="data" style={{ width: "100%" }}>
          <thead><tr><th style={{ width: 70 }}>ID</th><th>{T(`Ünvan`)}</th><th className="num">{T(meta.label)}</th><th className="num">{T(`Fair value`)}</th><th className="num">{T(`Gəlirlilik`)}</th><th className="num">{T(`Geri ödəmə`)}</th></tr></thead>
          <tbody>
            {matched.map((p) => (
              <tr key={p.id} className="row-click" style={{ cursor: "pointer" }} onClick={() => onOpen(p.id)} title={T(`Hesabatı aç`)}>
                <td className="cell-muted mono">{p.id}</td>
                <td><div className="cell-primary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{p.address}</div><div className="cell-muted">{p.district}</div></td>
                <td className="num cell-strong" style={{ color: "var(--orange)" }}>{meta.fmt(meta.get(p))}</td>
                <td className="num">{fmtMoney(p.fairValue)}</td><td className="num">{p.yield}%</td><td className="num">{p.payback} il</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankList({ items, variant }: { items: OProp[]; variant: "top" | "bottom" }) {
  return (
    <div style={{ padding: "4px 0" }}>
      {items.map((x, i) => (
        <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
          <div style={{ width: 22, fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 12, color: variant === "top" ? "var(--green)" : "var(--red)" }}>#{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.address}</div><div className="cell-muted" style={{ marginTop: 1 }}>{fmtMoney(x.fairValue)} · {x.yield}%</div></div>
        </div>
      ))}
    </div>
  );
}

function BigScatter({ items, xKey, yKey }: { items: OProp[]; xKey: string; yKey: string }) {
  const mX = METRICS[xKey], mY = METRICS[yKey];
  const xs = items.map(mX.get), ys = items.map(mY.get);
  if (xs.length === 0) return null;
  const W = 1180, H = 400, padL = 70, padR = 24, padT = 20, padB = 56, innerW = W - padL - padR, innerH = H - padT - padB;
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.06 || 1, yPad = (yMax - yMin) * 0.06 || 1;
  const x0 = xMin - xPad, x1 = xMax + xPad, y0 = yMin - yPad, y1 = yMax + yPad;
  const sx = (v: number) => padL + ((v - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => padT + innerH - ((v - y0) / (y1 - y0)) * innerH;
  const aggX = mean(xs), aggY = mean(ys);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      <rect x={sx(aggX)} y={padT} width={W - padR - sx(aggX)} height={sy(aggY) - padT} fill="var(--orange-tint)" fillOpacity="0.35" />
      {Array.from({ length: 6 }, (_, i) => { const v = y0 + (i / 5) * (y1 - y0); return <g key={i}><line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="var(--border)" strokeDasharray="3 3" /><text x={padL - 10} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" fontFamily="Manrope">{mY.fmt(v)}</text></g>; })}
      {Array.from({ length: 7 }, (_, i) => { const v = x0 + (i / 6) * (x1 - x0); return <text key={i} x={sx(v)} y={padT + innerH + 18} textAnchor="middle" fontSize="10.5" fill="var(--text-3)" fontFamily="Manrope">{mX.fmt(v)}</text>; })}
      <line x1={sx(aggX)} y1={padT} x2={sx(aggX)} y2={padT + innerH} stroke="var(--orange)" strokeWidth="2" strokeDasharray="6 4" />
      <line x1={padL} y1={sy(aggY)} x2={W - padR} y2={sy(aggY)} stroke="var(--orange)" strokeWidth="2" strokeDasharray="6 4" />
      {items.map((p, i) => { const avgY = mean(items.map((x) => x.yield)); const c = p.yield >= avgY * 1.1 ? "#1F8A5B" : p.yield >= avgY * 0.9 ? "#C58A1A" : "#C0392B"; const r = Math.max(5, Math.min(13, (p.area || 70) / 16)); return <circle key={i} cx={sx(mX.get(p))} cy={sy(mY.get(p))} r={r} fill={c} fillOpacity="0.5" stroke={c} strokeWidth="1.6"><title>{`${p.address}\n${mX.label}: ${mX.fmt(mX.get(p))}\n${mY.label}: ${mY.fmt(mY.get(p))}\nSahə: ${p.area} m²`}</title></circle>; })}
    </svg>
  );
}
