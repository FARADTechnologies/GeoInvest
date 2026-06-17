"use client";

// Tək qiymətləndirmə — single-property valuation.
// 1:1 port of the team's Homora B2B prototype page, scoped under .hm-val,
// wired to our /valuation/single endpoint (real market medians) with a
// local mock fallback. Existing dashboard views are untouched.

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Icons, DonutChart, SourceBadge, TypePill, fmtMoney } from "@/components/dashboard/valuation/valuation-ui";
import {
  PropertyEntryModal,
  statsOf,
  toOProp,
  type OProp
} from "@/components/dashboard/valuation/valuation-core";
import { RateReport } from "@/components/dashboard/valuation/valuation-report";
import { fetchValuationMeta, newId, valuateSingle } from "@/lib/valuation-data";
import { reportFromResult, predictByParams, valuateByLink, LinkValuationError } from "@/lib/valuation-report";
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
    setBusy(true);
    const { data, source: src } = await valuateSingle(input);
    setSource(src);
    const item = toOProp(data, existingId ?? newId("H"), true);
    // Report source: prefer the real predict model when the form carries
    // coordinates (Maps autocomplete, #1/#2); otherwise (or if the model is
    // unreachable) fall back to the DB-median synthesis. The list row stays
    // DB-derived as a quick summary; the report modal shows the richer model.
    let report: RateReportData;
    try {
      report =
        input.latitude != null && input.longitude != null
          ? await predictByParams(input)
          : reportFromResult(data, input);
    } catch {
      report = reportFromResult(data, input);
    }
    setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? item : x)) : [item, ...prev]));
    setReports((prev) => ({ ...prev, [item.id]: report }));
    setBusy(false);
    setEntryOpen(false);
    setEditTarget(null);
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
            <SingleStat k={T(`Orta skor`)} v={`${stats.avgScore}/100`} last />
          </div>
        )}

        <div className="table-wrap">
          <div className="table-tools">
            <div className="card-title">{T(`Qiymətləndirmə tarixçəsi`)}</div>
            {source ? <SourceBadge source={source} /> : null}
            <span className="sp" />
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
                  <th style={{ width: 110 }}>{T(`Növ`)}</th>
                  <th style={{ width: 280 }}>{T(`Ünvan`)}</th>
                  <th className="num" style={{ width: 70 }}>{T(`Sahə`)}</th>
                  <th className="center" style={{ width: 60 }}>{T(`Otaq`)}</th>
                  <th className="num" style={{ width: 130 }}>{T(`Fair value`)}</th>
                  <th className="num" style={{ width: 110 }}>{T(`Qiymət/m²`)}</th>
                  <th className="num" style={{ width: 110 }}>{T(`Aylıq kirayə`)}</th>
                  <th className="num" style={{ width: 95 }}>{T(`Gəlirlilik`)}</th>
                  <th className="num" style={{ width: 110 }}>{T(`Geri ödəmə`)}</th>
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
                      <td className="pill-cell"><TypePill type={p.type} /></td>
                      <td>
                        <div className="cell-primary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{p.address}</div>
                        <div className="cell-muted">{p.district}{p.floor ? ` · ${p.floor}/${p.totalFloors ?? "—"} mərt.` : ""}</div>
                      </td>
                      <td className="num">{p.area} m²</td>
                      <td className="center">{p.rooms ?? "—"}</td>
                      <td className="num cell-strong">{dr ? <span className="muted">—</span> : fmtMoney(p.fairValue)}</td>
                      <td className="num">{dr ? <span className="muted">—</span> : fmtMoney(p.pricePerM2, "")}</td>
                      <td className="num">{dr ? <span className="muted">—</span> : fmtMoney(p.monthlyRent)}</td>
                      <td className="num">{dr ? <span className="muted">—</span> : `${p.yield}%`}</td>
                      <td className="num">{dr ? <span className="muted">—</span> : `${p.payback} il`}</td>
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

// Minimal history-row projection of a link report (the link flow has no form
// features). Drives the table row; the full report lives in `reports[id]`.
function opropFromReport(id: string, data: RateReportData): OProp {
  const sale = data.ai_data.sale_estimate.current_valuation;
  const rentv = data.ai_data.rent_estimate.current_valuation;
  const inv = data.ai_data.investment_metrics;
  const f = data.features;
  let label = f?.address ?? "";
  if (!label && data.source.kind === "link") {
    try {
      label = new URL(data.source.url).hostname.replace(/^www\./, "");
    } catch {
      label = data.source.url;
    }
  }
  return {
    id,
    valued: true,
    address: label || "Elan linki",
    district: "—",
    type: f?.type || "—",
    area: f?.area ?? 0,
    rooms: f?.rooms ?? null,
    floor: f?.floor ?? null,
    totalFloors: f?.total_floors ?? null,
    fairValue: sale.point_estimate,
    pricePerM2: inv.price_per_sqm,
    monthlyRent: rentv.point_estimate,
    yield: inv.rent_yield_percent,
    payback: inv.payback_period_years,
    liquidity: 0,
    score: 0,
    risk: "Orta",
    residence: f?.residence_owner ?? null,
    repair: f?.repair ?? null,
    extract: f?.extract ?? null,
    range: [sale.lower_bound, sale.upper_bound],
    rentRange: [rentv.lower_bound, rentv.upper_bound]
  };
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
