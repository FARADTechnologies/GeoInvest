"use client";

// Tək qiymətləndirmə — single-property valuation.
// Entry form → DB-backed valuation → history table → detail report.
// Mirrors the reference prototype's flow; values come from /valuation/single
// with a local mock fallback.

import { useQuery } from "@tanstack/react-query";
import { Eye, FileDown, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  fetchValuationMeta,
  fmtMoney,
  newId,
  portfolioStats,
  valuateSingle
} from "@/lib/valuation-data";
import type { ValuationInput, ValuationItem, ValuationSource } from "@/types/valuation";

import {
  PropertyEntryModal,
  PropertyReport,
  SourceBadge,
  TypePill
} from "@/components/dashboard/valuation/valuation-shared";

export function ValuationSingleView({ t }: { t: Record<string, string> }) {
  const metaQuery = useQuery({ queryKey: ["valuation", "meta"], queryFn: fetchValuationMeta });
  const meta = metaQuery.data?.data ?? null;

  const [items, setItems] = useState<ValuationItem[]>([]);
  const [source, setSource] = useState<ValuationSource>("db");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ValuationItem | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valued = items.filter((x) => x.valued !== false);
  const stats = valued.length > 0 ? portfolioStats(items) : null;

  const openIdx = openId ? items.findIndex((x) => x.id === openId) : -1;
  const openItem = openIdx >= 0 ? items[openIdx] : null;

  const submit = async (input: ValuationInput, doValuate: boolean, existingId?: string) => {
    if (!doValuate) {
      // Draft — store inputs, no computed values yet.
      const draft: ValuationItem = {
        ...input,
        rayon: input.rayon || "—",
        fair_value: 0, price_per_m2: 0, price_range: [0, 0],
        monthly_rent: 0, rent_range: [0, 0], yield_pct: 0, payback_years: 0,
        liquidity_days: 0, score: 0, risk: "Orta", price_basis: "fallback",
        id: existingId ?? newId(), valued: false
      };
      setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? draft : x)) : [draft, ...prev]));
      setEntryOpen(false);
      setEditTarget(null);
      return;
    }
    setBusy(true);
    const { data, source: src } = await valuateSingle(input);
    setSource(src);
    const item: ValuationItem = { ...data, id: existingId ?? newId(), valued: true };
    setItems((prev) => (existingId ? prev.map((x) => (x.id === existingId ? item : x)) : [item, ...prev]));
    setBusy(false);
    setEntryOpen(false);
    setEditTarget(null);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        crumb="Tək qiymətləndirmə"
        title="Tək qiymətləndirmə"
        sub="Bir mənzili anında qiymətləndirin. Nəticələr aşağıdakı tarixçədə saxlanılır."
        right={
          <div className="flex items-center gap-2">
            {metaQuery.data ? <SourceBadge source={metaQuery.data.source} /> : null}
            <button
              onClick={() => setEntryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Yeni qiymətləndirmə
            </button>
          </div>
        }
      />

      {stats ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-4">
          <MiniStat k="Qiymətləndirilmiş" v={String(stats.n)} />
          <MiniStat k="Orta fair value" v={fmtMoney(Math.round(stats.totalValue / stats.n))} accent />
          <MiniStat k="Orta gəlirlilik" v={`${stats.avgYield}%`} />
          <MiniStat k="Orta skor" v={`${stats.avgScore}/100`} last />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="text-[13px] font-semibold">Qiymətləndirmə tarixçəsi</div>
          {source ? <SourceBadge source={source} /> : null}
          <span className="flex-1" />
          <button
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            title="(prototip)"
          >
            <FileDown className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={() => setEntryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Yeni
          </button>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Növ</th>
                <th className="px-3 py-2.5">Ünvan / Rayon</th>
                <th className="px-3 py-2.5 text-right">Sahə</th>
                <th className="px-3 py-2.5 text-center">Otaq</th>
                <th className="px-3 py-2.5 text-right">Fair value</th>
                <th className="px-3 py-2.5 text-right">Qiymət/m²</th>
                <th className="px-3 py-2.5 text-right">Aylıq kirayə</th>
                <th className="px-3 py-2.5 text-right">Gəlirlilik</th>
                <th className="px-3 py-2.5 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const draft = p.valued === false;
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-t hover:bg-muted/40"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".row-act")) return;
                      if (draft) setEditTarget(p);
                      else setOpenId(p.id);
                    }}
                  >
                    <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground">{p.id}</td>
                    <td className="px-3 py-2.5">
                      <TypePill type={p.type} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[260px] truncate font-semibold">{p.address || p.rayon}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {p.rayon}
                        {p.floor ? ` · ${p.floor}/${p.total_floors ?? "—"} mərt.` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.area} m²</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.rooms ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{draft ? "—" : fmtMoney(p.fair_value)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{draft ? "—" : fmtMoney(p.price_per_m2, "")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{draft ? "—" : fmtMoney(p.monthly_rent)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{draft ? "—" : `${p.yield_pct}%`}</td>
                    <td className="row-act px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary"
                          title="Redaktə et"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(p);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-red-500/10"
                          title="Sil"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`${p.address || p.rayon}\n\nBu qiymətləndirməni silmək istədiyinizə əminsiniz?`)) remove(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary disabled:opacity-40"
                          title={draft ? "Hələ qiymətləndirilməyib" : "Hesabatı aç"}
                          disabled={draft}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(p.id);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="text-[16px] font-bold">Hələ qiymətləndirmə yoxdur</div>
              <div className="mt-1.5 max-w-[44ch] text-[13px] text-muted-foreground">
                "Yeni qiymətləndirmə" düyməsi ilə ilk mənzili qiymətləndirin — nəticə burada görünəcək.
              </div>
              <button
                onClick={() => setEntryOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Yeni qiymətləndirmə
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {openItem && openItem.valued !== false && stats ? (
        <PropertyReport
          item={openItem}
          stats={stats}
          source={source}
          total={valued.length}
          rank={[...valued].sort((a, b) => b.score - a.score).findIndex((x) => x.id === openItem.id) + 1}
          onClose={() => setOpenId(null)}
          onPrev={() => openIdx > 0 && setOpenId(items[openIdx - 1].id)}
          onNext={() => openIdx >= 0 && openIdx < items.length - 1 && setOpenId(items[openIdx + 1].id)}
        />
      ) : null}

      <PropertyEntryModal
        open={entryOpen}
        portfolioName="Tək qiymətləndirmə"
        meta={meta}
        busy={busy}
        onClose={() => setEntryOpen(false)}
        onSubmit={(input, doValuate) => submit(input, doValuate)}
      />
      <PropertyEntryModal
        open={!!editTarget}
        portfolioName="Tək qiymətləndirmə"
        meta={meta}
        initial={editTarget}
        busy={busy}
        onClose={() => setEditTarget(null)}
        onSubmit={(input, doValuate) => submit(input, doValuate, editTarget?.id)}
      />
    </div>
  );
}

export function PageHeader({
  crumb,
  title,
  sub,
  right
}: {
  crumb: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1 text-[12px] text-muted-foreground">{crumb}</div>
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {sub ? <p className="mt-1 max-w-[60ch] text-[13px] text-muted-foreground">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function MiniStat({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div className={cn("relative px-4 py-3.5", !last && "border-r")}>
      {accent ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--brand-600)]" /> : null}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-1 text-[18px] font-bold tabular-nums">{v}</div>
    </div>
  );
}
