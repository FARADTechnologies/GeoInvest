"use client";

// Tək qiymətləndirmə — single-property valuation.
// 1:1 port of the team's Homora B2B prototype page, scoped under .hm-val,
// wired to our /valuation/single endpoint (real market medians) with a
// local mock fallback. Existing dashboard views are untouched.

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import { loadSingleHistory, saveSingleHistory } from "@/components/dashboard/valuation/valuation-store";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Icons, DonutChart, SourceBadge, TypePill, fmtMoney } from "@/components/dashboard/valuation/valuation-ui";
import {
  opropFromReport,
  PropertyEntryModal,
  statsOf,
  type OProp
} from "@/components/dashboard/valuation/valuation-core";
import { RateReport } from "@/components/dashboard/valuation/valuation-report";
import { COLUMNS, ColumnPicker, colClass, useVisibleCols } from "@/components/dashboard/valuation/valuation-columns";
import { geocodeAddress } from "@/components/dashboard/valuation/valuation-maps";
import { fetchValuationMeta, newId } from "@/lib/valuation-data";
import { predictByParams, valuateByLink, LinkValuationError } from "@/lib/valuation-report";
import type { DashboardView } from "@/components/dashboard/nav-sidebar";
import type { RateReportData, ValuationInput, ValuationSource } from "@/types/valuation";

export function ValuationSingleView({ lang = "az", onNavigate }: { lang?: Lang; onNavigate?: (v: DashboardView) => void }) {
  setValLang(lang);
  const metaQuery = useQuery({ queryKey: ["valuation", "meta"], queryFn: fetchValuationMeta });
  const meta = metaQuery.data?.data ?? null;

  const [items, setItems] = useState<OProp[]>([]);
  // Report payloads (predict contract) keyed by item id. The new RateReport
  // renders from these; drafts have none until valued.
  const [reports, setReports] = useState<Record<string, RateReportData>>({});
  const [source, setSource] = useState<ValuationSource>("db");
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"form" | "link">("form");
  const [editTarget, setEditTarget] = useState<OProp | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { visible, toggle, reset } = useVisibleCols("hm-cols-single");

  // Hydrate the persisted history once on mount (client only — avoids an SSR
  // mismatch), then mirror every change back to localStorage so the history
  // survives reloads and view switches. Only the user's delete removes a row.
  useEffect(() => {
    const s = loadSingleHistory();
    if (s) {
      setItems(s.items);
      setReports(s.reports);
      setSource(s.source);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSingleHistory(items, reports, source);
  }, [hydrated, items, reports, source]);
  const shown = COLUMNS.filter((c) => visible.has(c.key));

  const valued = items.filter((x) => x.valued !== false);
  const stats = valued.length > 0 ? statsOf(items) : null;

  const submit = async (input: ValuationInput, doValuate: boolean, existingId?: string) => {
    if (!doValuate) {
      const draft: OProp = {
        id: existingId ?? newId("H"),
        valued: false,
        address: input.address || input.rayon || "",
        district: input.rayon || "—",
        type: input.type,
        area: input.area,
        rooms: input.rooms ?? null,
        floor: input.floor ?? null,
        totalFloors: input.total_floors ?? null,
        fairValue: 0, pricePerM2: 0, monthlyRent: 0, yield: 0, payback: 0, liquidity: 0,
        score: 0, risk: "Orta", residence: input.residence ?? null, repair: input.repair ?? null,
        extract: input.extract ?? null, range: [0, 0], rentRange: [0, 0]
      };
      setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? draft : x)) : [draft, ...prev]));
      setEntryOpen(false);
      setEditTarget(null);
      return;
    }
    // API-only flow (team decision): always call the real predict model — no
    // DB-median fallback. The model needs coordinates, so if the form carries
    // none (address typed, not picked from suggestions / no map pin) we geocode
    // the address first. If the model can't be reached, surface an error and
    // never fabricate a value.
    setLinkError(null);
    setBusy(true);
    try {
      let filled = input;
      if (filled.latitude == null || filled.longitude == null) {
        const geo = filled.address ? await geocodeAddress(filled.address) : null;
        if (!geo) {
          setLinkError(
            T("Ünvan üzrə koordinat tapılmadı. Ünvanı siyahıdan seçin və ya xəritədən nöqtə göstərin.")
          );
          setBusy(false);
          return;
        }
        filled = { ...filled, latitude: geo.lat, longitude: geo.lng };
      }
      const report = await predictByParams(filled);
      setSource("db");
      const id = existingId ?? newId("H");
      const item = opropFromReport(id, report);
      setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? item : x)) : [item, ...prev]));
      setReports((prev) => ({ ...prev, [id]: report }));
      setEntryOpen(false);
      setEditTarget(null);
    } catch (err) {
      setLinkError(
        err instanceof LinkValuationError && err.message
          ? err.message
          : T("Qiymətləndirmə modeli cavab vermir, yenidən cəhd edin.")
      );
    } finally {
      setBusy(false);
    }
  };

  // Elan linki flow. Sends URL-only (valuateByLink), never form state. Any
  // stale open report is cleared before the request so a previous form report
  // can't flash on the first link submit (BA §15). On error the report does
  // NOT open; the reason is surfaced in a banner (BA §17).
  const submitLink = async (url: string) => {
    setLinkError(null);
    setOpenId(null);
    setEntryOpen(false);
    setBusy(true);
    try {
      const { data, source: src } = await valuateByLink(url);
      setSource(src);
      const id = newId("L");
      setReports((prev) => ({ ...prev, [id]: data }));
      setItems((prev) => [opropFromReport(id, data), ...prev]);
      setOpenId(id);
    } catch (err) {
      setLinkError(linkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) =>
    setItems((prev) => {
      setReports((r) => {
        const { [id]: _drop, ...rest } = r;
        return rest;
      });
      return prev.filter((x) => x.id !== id);
    });

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        <div className="page-header">
          <div>
            <div className="crumbs"><span>{T(`Tək qiymətləndirmə`)}</span></div>
            <h1 className="page-title">{T(`Tək qiymətləndirmə`)}</h1>
            <p className="page-sub">{T(`Bir mənzili anında qiymətləndirin. Qiymətləndirilmiş mənzillər aşağıdakı siyahıda yadda saxlanılır.`)}</p>
          </div>
          <div className="page-actions">
            {metaQuery.data ? <SourceBadge source={metaQuery.data.source} /> : null}
            <button className="btn btn-secondary" onClick={() => onNavigate?.("valuation-mass")}>
              <Icons.ValueMass size={14} /> {T(`Kütləvi qiymətləndirməyə keç`)}
            </button>
            <button className="btn btn-primary" onClick={() => { setEntryMode("form"); setEntryOpen(true); }}>
              <Icons.Plus size={14} /> {T(`Yeni qiymətləndirmə`)}
            </button>
          </div>
        </div>

        {linkError && (
          <div className="card" style={{ padding: "12px 16px", marginBottom: 14, background: "var(--red-soft)", color: "var(--red)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600 }}>
            <Icons.Info size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{linkError}</span>
            <button className="icon-btn" style={{ width: 26, height: 26, color: "var(--red)" }} onClick={() => setLinkError(null)} title={T(`Bağla`)}>
              <Icons.X size={13} />
            </button>
          </div>
        )}

        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="fl-row" style={{ gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: "var(--orange)", color: "var(--orange)" }} onClick={() => { setEntryMode("form"); setEntryOpen(true); }}>
              <Icons.Sort size={14} /> {T(`Parametrlə qiymətləndir`)}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEntryMode("link"); setEntryOpen(true); }}>
              <Icons.Layers size={14} /> {T(`Elan linki ilə qiymətləndir`)}
            </button>
            <span className="sp" />
            {items.length > 0 && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                <Icons.File size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                <strong style={{ color: "var(--text-1)" }}>{items.length}</strong> {T(`qiymətləndirmə tarixçədə`)}
              </span>
            )}
          </div>
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            <SingleStat k={T(`Qiymətləndirilmiş`)} v={String(stats.n)} />
            <SingleStat k={T(`Orta fair value`)} v={fmtMoney(Math.round(stats.totalValue / stats.n))} accent />
            <SingleStat k={T(`Orta gəlirlilik`)} v={`${stats.avgYield}%`} />
            <SingleStat k={T(`Orta geri ödəmə`)} v={`${stats.avgPayback} il`} last />
          </div>
        )}

        <div className="table-wrap">
          <div className="table-tools">
            <div className="card-title">{T(`Qiymətləndirmə tarixçəsi`)}</div>
            {source ? <SourceBadge source={source} /> : null}
            <span className="sp" />
            <ColumnPicker visible={visible} toggle={toggle} reset={reset} />
            <button className="btn btn-secondary btn-sm" disabled={items.length === 0} style={{ opacity: items.length === 0 ? 0.5 : 1 }}>
              <Icons.Download size={13} /> {T(`Excel ixrac`)}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { setEntryMode("form"); setEntryOpen(true); }}>
              <Icons.Plus size={13} /> {T(`Yeni qiymətləndirmə`)}
            </button>
          </div>

          <div className="table-scroll" style={{ maxHeight: 540 }}>
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
                {items.map((p) => {
                  const dr = p.valued === false;
                  return (
                    <tr key={p.id} className="row-click" onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".row-act")) return;
                      if (dr) setEditTarget(p);
                      else setOpenId(p.id);
                    }}>
                      <td className="cell-muted mono">{p.id}</td>
                      {shown.map((c) => (
                        <td key={c.key} className={`${colClass(c.align)}${c.key === "type" ? " pill-cell" : ""}`.trim()}>{c.render(p, dr)}</td>
                      ))}
                      <td className="row-act" style={{ textAlign: "right" }}>
                        <div className="fl-row" style={{ gap: 2, justifyContent: "flex-end" }}>
                          <button className="icon-btn" style={{ width: 28, height: 28 }} title={T(`Redaktə et`)} onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}>
                            <Icons.Edit size={13} />
                          </button>
                          <button className="icon-btn" style={{ width: 28, height: 28, color: "var(--red)" }} title={T(`Sil`)} onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`${p.address}\n\nBu qiymətləndirməni tarixçədən silmək istədiyinizə əminsiniz?`)) remove(p.id);
                          }}>
                            <Icons.Trash size={13} />
                          </button>
                          <button className="icon-btn" style={{ width: 28, height: 28 }} title={dr ? "Hələ qiymətləndirilməyib" : "Hesabatı aç"} disabled={dr} onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}>
                            <Icons.Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="empty">
                <div className="empty-art"><Icons.ValueSingle size={28} /></div>
                <div className="empty-title">{T(`Hələ qiymətləndirmə yoxdur`)}</div>
                <div className="empty-sub">{T(`"Yeni qiymətləndirmə" düyməsi ilə ilk mənzili qiymətləndirin — nəticə burada görünəcək.`)}</div>
                <button className="btn btn-primary" onClick={() => { setEntryMode("form"); setEntryOpen(true); }}>
                  <Icons.Plus size={14} /> {T(`Yeni qiymətləndirmə`)}
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }} className="card card-pad">
          <div className="fl-row" style={{ gap: 12 }}>
            <div className="empty-art" style={{ margin: 0 }}><Icons.Sparkle size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="card-title">{T(`Çoxlu mənzil qiymətləndirməyiniz lazımdır?`)}</div>
              <div className="card-sub" style={{ marginTop: 4 }}>{T(`Excel cədvəlini yükləyin və ya 5-500 mənzili eyni anda qiymətləndirin.`)}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => onNavigate?.("valuation-mass")}>
              <Icons.ValueMass size={14} /> {T(`Kütləvi qiymətləndirməyə keç`)}
            </button>
          </div>
        </div>
      </div>

      {openId && reports[openId] && (
        <RateReport data={reports[openId]} onClose={() => setOpenId(null)} />
      )}

      <PropertyEntryModal open={entryOpen} allowLink initialMode={entryMode} portfolioName="Tək qiymətləndirmə" meta={meta} busy={busy} onClose={() => setEntryOpen(false)} onSubmit={(input, v) => submit(input, v)} onSubmitLink={submitLink} />
      <PropertyEntryModal open={!!editTarget} portfolioName="Tək qiymətləndirmə" meta={meta} initial={editTarget} busy={busy} onClose={() => setEditTarget(null)} onSubmit={(input, v) => submit(input, v, editTarget?.id)} />
    </div>
  );
}

// BA §17 — map predict-link HTTP failures to user-facing copy.
function linkErrorMessage(err: unknown): string {
  if (err instanceof LinkValuationError) {
    const msg = (err.message || "").trim();
    if (err.status === 400) return msg ? `${T("Link formatı düzgün deyil")}: ${msg}` : T("Link formatı düzgün deyil");
    if (err.status === 404) {
      if (/qiymət|valuation|estimate/i.test(msg)) return T("Qiymətləndirmə məlumatı yoxdur");
      return msg || T("Elan bazamızda tapılmadı");
    }
    if (err.status === 401) return T("Giriş tələb olunur. Zəhmət olmasa yenidən daxil olun");
    return msg || T("Link üzrə qiymətləndirmə alınmadı");
  }
  return T("Link üzrə qiymətləndirmə alınmadı");
}

function SingleStat({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: last ? "none" : "1px solid var(--border)", position: "relative" }}>
      {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--orange)" }} />}
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{v}</div>
    </div>
  );
}
