"use client";

// Tək qiymətləndirmə — single-property valuation.
// 1:1 port of the team's Homora B2B prototype page, scoped under .hm-val,
// wired to our /valuation/single endpoint (real market medians) with a
// local mock fallback. Existing dashboard views are untouched.

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import "@/components/dashboard/valuation/valuation-orange.css";
import { Icons, DonutChart, SourceBadge, TypePill, fmtMoney } from "@/components/dashboard/valuation/valuation-ui";
import {
  PropertyEntryModal,
  PropertyReport,
  statsOf,
  toOProp,
  type OProp
} from "@/components/dashboard/valuation/valuation-core";
import { fetchValuationMeta, newId, valuateSingle } from "@/lib/valuation-data";
import type { DashboardView } from "@/components/dashboard/nav-sidebar";
import type { ValuationInput, ValuationSource } from "@/types/valuation";

export function ValuationSingleView({ onNavigate }: { onNavigate?: (v: DashboardView) => void }) {
  const metaQuery = useQuery({ queryKey: ["valuation", "meta"], queryFn: fetchValuationMeta });
  const meta = metaQuery.data?.data ?? null;

  const [items, setItems] = useState<OProp[]>([]);
  const [source, setSource] = useState<ValuationSource>("db");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OProp | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valued = items.filter((x) => x.valued !== false);
  const stats = valued.length > 0 ? statsOf(items) : null;

  const openIdx = openId ? items.findIndex((x) => x.id === openId) : -1;
  const openItem = openIdx >= 0 ? items[openIdx] : null;

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
    setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? item : x)) : [item, ...prev]));
    setBusy(false);
    setEntryOpen(false);
    setEditTarget(null);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        <div className="page-header">
          <div>
            <div className="crumbs"><span>Tək qiymətləndirmə</span></div>
            <h1 className="page-title">Tək qiymətləndirmə</h1>
            <p className="page-sub">Bir mənzili anında qiymətləndirin. Qiymətləndirilmiş mənzillər aşağıdakı siyahıda yadda saxlanılır.</p>
          </div>
          <div className="page-actions">
            {metaQuery.data ? <SourceBadge source={metaQuery.data.source} /> : null}
            <button className="btn btn-secondary" onClick={() => onNavigate?.("valuation-mass")}>
              <Icons.ValueMass size={14} /> Kütləvi qiymətləndirməyə keç
            </button>
            <button className="btn btn-primary" onClick={() => setEntryOpen(true)}>
              <Icons.Plus size={14} /> Yeni qiymətləndirmə
            </button>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="fl-row" style={{ gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: "var(--orange)", color: "var(--orange)" }} onClick={() => setEntryOpen(true)}>
              <Icons.Sort size={14} /> Parametrlə qiymətləndir
            </button>
            <button className="btn btn-ghost btn-sm">
              <Icons.Layers size={14} /> Elan linki ilə qiymətləndir
            </button>
            <span className="sp" />
            {items.length > 0 && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                <Icons.File size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                <strong style={{ color: "var(--text-1)" }}>{items.length}</strong> qiymətləndirmə tarixçədə
              </span>
            )}
          </div>
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            <SingleStat k="Qiymətləndirilmiş" v={String(stats.n)} />
            <SingleStat k="Orta fair value" v={fmtMoney(Math.round(stats.totalValue / stats.n))} accent />
            <SingleStat k="Orta gəlirlilik" v={`${stats.avgYield}%`} />
            <SingleStat k="Orta skor" v={`${stats.avgScore}/100`} last />
          </div>
        )}

        <div className="table-wrap">
          <div className="table-tools">
            <div className="card-title">Qiymətləndirmə tarixçəsi</div>
            {source ? <SourceBadge source={source} /> : null}
            <span className="sp" />
            <button className="btn btn-secondary btn-sm" disabled={items.length === 0} style={{ opacity: items.length === 0 ? 0.5 : 1 }}>
              <Icons.Download size={13} /> Excel ixrac
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEntryOpen(true)}>
              <Icons.Plus size={13} /> Yeni qiymətləndirmə
            </button>
          </div>

          <div className="table-scroll" style={{ maxHeight: 540 }}>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th style={{ width: 110 }}>Növ</th>
                  <th style={{ width: 280 }}>Ünvan</th>
                  <th className="num" style={{ width: 70 }}>Sahə</th>
                  <th className="center" style={{ width: 60 }}>Otaq</th>
                  <th className="num" style={{ width: 130 }}>Fair value</th>
                  <th className="num" style={{ width: 110 }}>Qiymət/m²</th>
                  <th className="num" style={{ width: 110 }}>Aylıq kirayə</th>
                  <th className="num" style={{ width: 95 }}>Gəlirlilik</th>
                  <th className="num" style={{ width: 110 }}>Geri ödəmə</th>
                  <th style={{ width: 90, textAlign: "right" }}>Əməliyyat</th>
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
                          <button className="icon-btn" style={{ width: 28, height: 28 }} title="Redaktə et" onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}>
                            <Icons.Edit size={13} />
                          </button>
                          <button className="icon-btn" style={{ width: 28, height: 28, color: "var(--red)" }} title="Sil" onClick={(e) => {
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
                <div className="empty-title">Hələ qiymətləndirmə yoxdur</div>
                <div className="empty-sub">"Yeni qiymətləndirmə" düyməsi ilə ilk mənzili qiymətləndirin — nəticə burada görünəcək.</div>
                <button className="btn btn-primary" onClick={() => setEntryOpen(true)}>
                  <Icons.Plus size={14} /> Yeni qiymətləndirmə
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }} className="card card-pad">
          <div className="fl-row" style={{ gap: 12 }}>
            <div className="empty-art" style={{ margin: 0 }}><Icons.Sparkle size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="card-title">Çoxlu mənzil qiymətləndirməyiniz lazımdır?</div>
              <div className="card-sub" style={{ marginTop: 4 }}>Excel cədvəlini yükləyin və ya 5-500 mənzili eyni anda qiymətləndirin.</div>
            </div>
            <button className="btn btn-secondary" onClick={() => onNavigate?.("valuation-mass")}>
              <Icons.ValueMass size={14} /> Kütləvi qiymətləndirməyə keç
            </button>
          </div>
        </div>
      </div>

      {openItem && openItem.valued !== false && stats && (
        <PropertyReport
          property={openItem}
          portfolioName="Tək qiymətləndirmə tarixçəsi"
          itemsCount={valued.length}
          stats={stats}
          rank={[...valued].sort((a, b) => b.score - a.score).findIndex((x) => x.id === openItem.id) + 1}
          onClose={() => setOpenId(null)}
          onPrev={() => openIdx > 0 && setOpenId(items[openIdx - 1].id)}
          onNext={() => openIdx >= 0 && openIdx < items.length - 1 && setOpenId(items[openIdx + 1].id)}
        />
      )}

      <PropertyEntryModal open={entryOpen} portfolioName="Tək qiymətləndirmə" meta={meta} busy={busy} onClose={() => setEntryOpen(false)} onSubmit={(input, v) => submit(input, v)} />
      <PropertyEntryModal open={!!editTarget} portfolioName="Tək qiymətləndirmə" meta={meta} initial={editTarget} busy={busy} onClose={() => setEditTarget(null)} onSubmit={(input, v) => submit(input, v, editTarget?.id)} />
    </div>
  );
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
