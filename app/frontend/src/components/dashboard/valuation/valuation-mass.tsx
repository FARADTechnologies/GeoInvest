"use client";

// Kütləvi qiymətləndirmə — mass (portfolio) valuation.
// Landing (portfolio cards) → portfolio detail (table + Excel sim + batch
// valuate) → portfolio analysis (histogram / scatter / per-rayon / top-bottom).
// Batch valuation is DB-backed via /valuation/batch with a mock fallback.

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  fetchValuationMeta,
  fmtMoney,
  mockValuate,
  newId,
  portfolioStats,
  valuateBatch,
  type Sourced
} from "@/lib/valuation-data";
import type {
  Portfolio,
  ValuationInput,
  ValuationItem,
  ValuationMeta,
  ValuationResult,
  ValuationSource
} from "@/types/valuation";

import { MiniStat, PageHeader } from "@/components/dashboard/valuation/valuation-single";
import {
  DonutScore,
  PropertyEntryModal,
  PropertyReport,
  RiskPill,
  SourceBadge,
  TypePill
} from "@/components/dashboard/valuation/valuation-shared";

// ── Sample portfolio seeds (inputs only — valued on demand against the API)

const SEED_RAYONS = ["Yasamal", "Səbail", "Nərimanov", "Xətai", "Nəsimi", "Binəqədi", "Nizami", "Sabunçu"];

function seedInputs(n: number, salt: number): ValuationInput[] {
  const out: ValuationInput[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 1) * 9301 + salt * 49297;
    const rnd = (k: number) => (((s * (k + 3)) % 233280) / 233280);
    const isNew = rnd(1) > 0.45;
    const area = Math.round(45 + rnd(2) * 120);
    const totalFloors = Math.max(5, Math.round(rnd(4) * 22));
    out.push({
      address: null,
      rayon: `${SEED_RAYONS[Math.floor(rnd(5) * SEED_RAYONS.length)]} rayonu`,
      type: isNew ? "Yeni tikili" : "Köhnə tikili",
      area,
      rooms: Math.max(1, Math.min(5, Math.round(area / 32))),
      floor: Math.max(1, Math.round(rnd(3) * totalFloors)),
      total_floors: totalFloors,
      repair: ["Əla", "Var", "Orta", "Yox"][Math.floor(rnd(6) * 4)],
      extract: rnd(7) > 0.5 ? "Var" : "Yox",
      residence: null
    });
  }
  return out;
}

const SEED_PORTFOLIOS: { id: string; name: string; description: string; createdAt: string; createdBy: string; inputs: ValuationInput[] }[] = [
  {
    id: "pf-yasamal",
    name: "Yasamal — Q2 portfeli",
    description: "Yasamal və Səbail rayonlarında mənzillərin qiymətləndirilməsi.",
    createdAt: "2026-05-28",
    createdBy: "Əvəz Yusibov",
    inputs: seedInputs(16, 1)
  },
  {
    id: "pf-kollateral",
    name: "Bank kollateral dəyərləndirilməsi",
    description: "Kredit təminatı üçün mənzillər.",
    createdAt: "2026-05-14",
    createdBy: "Səbinə Məmmədova",
    inputs: seedInputs(10, 7)
  }
];

type SubRoute = { name: "list" } | { name: "portfolio"; id: string; openId?: string } | { name: "analysis"; id: string };

export function ValuationMassView({ t }: { t: Record<string, string> }) {
  const metaQuery = useQuery({ queryKey: ["valuation", "meta"], queryFn: fetchValuationMeta });
  const meta = metaQuery.data?.data ?? null;

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [source, setSource] = useState<ValuationSource>("db");
  const [route, setRoute] = useState<SubRoute>({ name: "list" });
  const [seeded, setSeeded] = useState(false);

  // Valuate the seed portfolios once (DB-backed; mock fallback).
  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    (async () => {
      const built: Portfolio[] = [];
      let src: ValuationSource = "db";
      for (const seed of SEED_PORTFOLIOS) {
        const res: Sourced<ValuationResult[]> = await valuateBatch(seed.inputs);
        src = res.source;
        built.push({
          id: seed.id,
          name: seed.name,
          description: seed.description,
          createdAt: seed.createdAt,
          createdBy: seed.createdBy,
          items: res.data.map((r) => ({ ...r, id: newId(), valued: true }))
        });
      }
      if (!cancelled) {
        setPortfolios(built);
        setSource(src);
        setSeeded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seeded]);

  const updatePortfolio = (pf: Portfolio) => setPortfolios((prev) => prev.map((p) => (p.id === pf.id ? pf : p)));
  const addPortfolio = (pf: Portfolio) => setPortfolios((prev) => [pf, ...prev]);

  const active = route.name !== "list" ? portfolios.find((p) => p.id === route.id) : undefined;

  if (route.name === "portfolio" && active) {
    return (
      <PortfolioDetail
        t={t}
        portfolio={active}
        meta={meta}
        source={source}
        setSource={setSource}
        onBack={() => setRoute({ name: "list" })}
        onAnalysis={() => setRoute({ name: "analysis", id: active.id })}
        update={updatePortfolio}
        openId={route.openId}
      />
    );
  }
  if (route.name === "analysis" && active) {
    return <PortfolioAnalysis t={t} portfolio={active} source={source} onBack={() => setRoute({ name: "portfolio", id: active.id })} />;
  }

  return (
    <MassLanding
      t={t}
      portfolios={portfolios}
      source={metaQuery.data?.source ?? source}
      loading={!seeded}
      onOpen={(id) => setRoute({ name: "portfolio", id })}
      onCreate={(name) => {
        const pf: Portfolio = {
          id: newId("pf"),
          name: name || `Yeni portfel · ${new Date().toLocaleDateString("az-AZ")}`,
          description: "Boş portfel — mənzilləri əl ilə əlavə edin.",
          createdAt: new Date().toISOString().slice(0, 10),
          createdBy: "Əvəz Yusibov",
          items: []
        };
        addPortfolio(pf);
        setRoute({ name: "portfolio", id: pf.id });
      }}
    />
  );
}

// ── Landing ───────────────────────────────────────────────────────────

function MassLanding({
  t,
  portfolios,
  source,
  loading,
  onOpen,
  onCreate
}: {
  t: Record<string, string>;
  portfolios: Portfolio[];
  source: ValuationSource;
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        crumb="Kütləvi qiymətləndirmə"
        title="Kütləvi qiymətləndirmə"
        sub="Hər portfel — bir qrup mənzilin yığını. Portfelə daxil olub mənzilləri əlavə edin və ya toplu qiymətləndirin."
        right={
          <div className="flex items-center gap-2">
            <SourceBadge source={source} />
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Yeni portfel
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portfolios.map((pf) => {
          const st = pf.items.length ? portfolioStats(pf.items) : null;
          return (
            <button
              key={pf.id}
              onClick={() => onOpen(pf.id)}
              className="overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-1.5 w-full" style={{ background: pf.items.length ? "var(--brand-600)" : "var(--border)" }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-semibold">{pf.name}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {pf.createdAt} · {pf.createdBy}
                    </div>
                  </div>
                  {st ? <DonutScore value={st.avgScore} size={52} label="skor" /> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <CardMicro k="Mənzil" v={String(pf.items.length)} />
                  <CardMicro k="Dəyər" v={st ? fmtMoney(st.totalValue) : "—"} />
                  <CardMicro k="Yield" v={st ? `${st.avgYield}%` : "—"} />
                </div>
              </div>
            </button>
          );
        })}

        <button
          onClick={() => setCreating(true)}
          className="grid min-h-[180px] place-items-center rounded-xl border-2 border-dashed text-center hover:border-[var(--brand-600)]"
        >
          <div>
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
              <Plus className="h-5 w-5" />
            </div>
            <div className="text-[14px] font-semibold">Yeni portfel yarat</div>
            <div className="mt-1 text-[12px] text-muted-foreground">Boş portfel yaradıb mənzil əlavə et</div>
          </div>
        </button>
      </div>

      {loading ? <div className="text-[12px] text-muted-foreground">Portfellər qiymətləndirilir…</div> : null}

      {creating ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-6 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="w-full max-w-[460px] rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[17px] font-bold">Yeni portfel</div>
            <label className="mb-1.5 mt-4 block text-[13px] font-semibold">Portfelin adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="məs. Yasamal — Q3 portfeli"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && (onCreate(name.trim()), setCreating(false), setName(""))}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-600)]"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary" onClick={() => setCreating(false)}>
                Ləğv et
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                onClick={() => {
                  onCreate(name.trim());
                  setCreating(false);
                  setName("");
                }}
              >
                <Plus className="h-4 w-4" /> Portfeli yarat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CardMicro({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-[13px] font-bold tabular-nums">{v}</div>
    </div>
  );
}

// ── Portfolio detail ──────────────────────────────────────────────────

function PortfolioDetail({
  t,
  portfolio,
  meta,
  source,
  setSource,
  onBack,
  onAnalysis,
  update,
  openId: initialOpenId
}: {
  t: Record<string, string>;
  portfolio: Portfolio;
  meta: ValuationMeta | null;
  source: ValuationSource;
  setSource: (s: ValuationSource) => void;
  onBack: () => void;
  onAnalysis: () => void;
  update: (pf: Portfolio) => void;
  openId?: string;
}) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ValuationItem | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Hamısı");

  const items = portfolio.items;
  const valued = items.filter((x) => x.valued !== false);
  const draftCount = items.length - valued.length;
  const stats = valued.length > 0 ? portfolioStats(items) : null;

  const filtered = useMemo(() => {
    let xs = items;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter((x) => (x.address || "").toLowerCase().includes(q) || x.rayon.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
    }
    if (typeFilter !== "Hamısı") xs = xs.filter((x) => x.type === typeFilter);
    return xs;
  }, [items, query, typeFilter]);

  const openIdx = openId ? items.findIndex((x) => x.id === openId) : -1;
  const openItem = openIdx >= 0 ? items[openIdx] : null;

  const addItems = (newItems: ValuationItem[]) => update({ ...portfolio, items: [...newItems, ...portfolio.items] });
  const replaceItem = (item: ValuationItem) => update({ ...portfolio, items: portfolio.items.map((x) => (x.id === item.id ? item : x)) });
  const removeItem = (id: string) => update({ ...portfolio, items: portfolio.items.filter((x) => x.id !== id) });

  // Excel simulation — generate sample inputs and value them (DB-backed).
  const simulateUpload = async (count = 12) => {
    setBusy(true);
    const res = await valuateBatch(seedInputs(count, Math.floor(Math.random() * 999)));
    setSource(res.source);
    addItems(res.data.map((r) => ({ ...r, id: newId(), valued: true })));
    setBusy(false);
  };

  const submit = async (input: ValuationInput, doValuate: boolean, existingId?: string) => {
    if (!doValuate) {
      const draft: ValuationItem = {
        ...input, rayon: input.rayon || "—",
        fair_value: 0, price_per_m2: 0, price_range: [0, 0], monthly_rent: 0, rent_range: [0, 0],
        yield_pct: 0, payback_years: 0, liquidity_days: 0, score: 0, risk: "Orta", price_basis: "fallback",
        id: existingId ?? newId(), valued: false
      };
      if (existingId) replaceItem(draft);
      else addItems([draft]);
      setEntryOpen(false);
      setEditTarget(null);
      return;
    }
    setBusy(true);
    const res = await valuateBatch([input]);
    setSource(res.source);
    const item: ValuationItem = { ...res.data[0], id: existingId ?? newId(), valued: true };
    if (existingId) replaceItem(item);
    else addItems([item]);
    setBusy(false);
    setEntryOpen(false);
    setEditTarget(null);
  };

  const valuateDrafts = async () => {
    const drafts = items.filter((x) => x.valued === false);
    if (drafts.length === 0) return;
    setBusy(true);
    const res = await valuateBatch(drafts.map((d) => ({
      address: d.address, rayon: d.rayon === "—" ? null : d.rayon, type: d.type, area: d.area,
      rooms: d.rooms, floor: d.floor, total_floors: d.total_floors, repair: d.repair, extract: d.extract, residence: d.residence
    })));
    setSource(res.source);
    const valuedById = drafts.map((d, i) => ({ ...res.data[i], id: d.id, valued: true }));
    update({ ...portfolio, items: portfolio.items.map((x) => valuedById.find((v) => v.id === x.id) ?? x) });
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        crumb={
          <button onClick={onBack} className="inline-flex items-center gap-1 hover:text-[var(--brand-600)]">
            <ArrowLeft className="h-3 w-3" /> Kütləvi qiymətləndirmə
          </button>
        }
        title={portfolio.name}
        sub={`${portfolio.description} · ${portfolio.createdAt} · ${portfolio.createdBy}`}
        right={
          <div className="flex items-center gap-2">
            <SourceBadge source={source} />
            <button
              onClick={onAnalysis}
              disabled={valued.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4" /> Portfel analizi
            </button>
          </div>
        }
      />

      {/* Excel drop (simulated) */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">Excel cədvəli ilə əlavə et</div>
          <div className="text-[12.5px] text-muted-foreground">.xlsx / .csv — hər sətir bir mənzil. (prototip: nümunə sətirlər)</div>
        </div>
        <button
          onClick={() => simulateUpload(12)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> {busy ? "Oxunur…" : "Nümunə yüklə"}
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-5">
          <MiniStat k="Qiymətləndirilmiş" v={String(stats.n)} />
          <MiniStat k="Ümumi dəyər" v={fmtMoney(stats.totalValue)} accent />
          <MiniStat k="Aylıq kirayə" v={fmtMoney(stats.totalRent)} />
          <MiniStat k="Orta gəlirlilik" v={`${stats.avgYield}%`} />
          <MiniStat k="Orta skor" v={`${stats.avgScore}/100`} last />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <input
            className="w-full max-w-[280px] rounded-md border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-600)]"
            placeholder="Ünvan, rayon və ya ID ilə axtar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-1">
            {["Hamısı", "Yeni tikili", "Köhnə tikili"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTypeFilter(tf)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12px] font-medium",
                  typeFilter === tf ? "border bg-secondary" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <button
            onClick={() => setEntryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Yeni qiymətləndirmə
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
                <th className="px-3 py-2.5 text-right">Fair value</th>
                <th className="px-3 py-2.5 text-right">Qiymət/m²</th>
                <th className="px-3 py-2.5 text-right">Gəlirlilik</th>
                <th className="px-3 py-2.5 text-center">Skor</th>
                <th className="px-3 py-2.5 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
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
                    <td className="px-3 py-2.5"><TypePill type={p.type} /></td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[240px] truncate font-semibold">{p.address || p.rayon}</div>
                      <div className="text-[12px] text-muted-foreground">{p.rayon}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.area} m²</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{draft ? "—" : fmtMoney(p.fair_value)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{draft ? "—" : fmtMoney(p.price_per_m2, "")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{draft ? "—" : `${p.yield_pct}%`}</td>
                    <td className="px-3 py-2.5 text-center">{draft ? "—" : <DonutScore value={p.score} size={34} />}</td>
                    <td className="row-act px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-red-500/10"
                          title="Sil"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`${p.address || p.rayon}\n\nBu mənzili portfeldən silmək istədiyinizə əminsiniz?`)) removeItem(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary disabled:opacity-40"
                          disabled={draft}
                          title={draft ? "Hələ qiymətləndirilməyib" : "Hesabatı aç"}
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
          {filtered.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
                <Plus className="h-7 w-7" />
              </div>
              <div className="text-[16px] font-bold">{items.length === 0 ? "Bu portfeldə hələ mənzil yoxdur" : "Nəticə tapılmadı"}</div>
              <div className="mt-1.5 max-w-[44ch] text-[13px] text-muted-foreground">
                {items.length === 0 ? '"Nümunə yüklə" və ya "Yeni qiymətləndirmə" ilə mənzil əlavə edin.' : "Axtarış və ya filtri dəyişin."}
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom action bar */}
        <div className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3">
          <div className="text-[13px]">
            <span className="text-muted-foreground">Mənzil sayı: </span>
            <strong>{items.length}</strong>
            {draftCount > 0 ? <span className="ml-1.5 text-[12px] font-semibold text-amber-600">({draftCount} qaralama)</span> : null}
          </div>
          <span className="flex-1" />
          {draftCount > 0 ? (
            <button
              onClick={valuateDrafts}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" /> {busy ? "Qiymətləndirilir…" : `Portfolionu qiymətləndir (${draftCount})`}
            </button>
          ) : (
            <button
              onClick={onAnalysis}
              disabled={valued.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4" /> Portfel analizi
            </button>
          )}
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
        portfolioName={portfolio.name}
        meta={meta}
        busy={busy}
        onClose={() => setEntryOpen(false)}
        onSubmit={(input, v) => submit(input, v)}
      />
      <PropertyEntryModal
        open={!!editTarget}
        portfolioName={portfolio.name}
        meta={meta}
        initial={editTarget}
        busy={busy}
        onClose={() => setEditTarget(null)}
        onSubmit={(input, v) => submit(input, v, editTarget?.id)}
      />
    </div>
  );
}

// ── Portfolio analysis ────────────────────────────────────────────────

const METRICS: Record<string, { label: string; fmt: (v: number) => string; get: (x: ValuationItem) => number }> = {
  yield_pct: { label: "Gəlirlilik", fmt: (v) => `${v.toFixed(1)}%`, get: (x) => x.yield_pct },
  price_per_m2: { label: "Qiymət/m²", fmt: (v) => fmtMoney(v, " ₼/m²"), get: (x) => x.price_per_m2 },
  fair_value: { label: "Fair value", fmt: (v) => fmtMoney(v), get: (x) => x.fair_value },
  monthly_rent: { label: "Aylıq kirayə", fmt: (v) => fmtMoney(v), get: (x) => x.monthly_rent },
  payback_years: { label: "Geri ödəmə", fmt: (v) => `${v.toFixed(1)} il`, get: (x) => x.payback_years },
  liquidity_days: { label: "Likvidlik", fmt: (v) => `${Math.round(v)} gün`, get: (x) => x.liquidity_days },
  area: { label: "Sahə", fmt: (v) => `${Math.round(v)} m²`, get: (x) => x.area },
  score: { label: "Sərmayə skoru", fmt: (v) => Math.round(v).toString(), get: (x) => x.score }
};
const METRIC_KEYS = Object.keys(METRICS);

function mean(a: number[]) {
  return a.reduce((s, x) => s + x, 0) / (a.length || 1);
}
function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const agg = (a: number[], k: string) => (k === "median" ? median(a) : mean(a));

function PortfolioAnalysis({
  t,
  portfolio,
  source,
  onBack
}: {
  t: Record<string, string>;
  portfolio: Portfolio;
  source: ValuationSource;
  onBack: () => void;
}) {
  const items = portfolio.items.filter((x) => x.valued !== false);
  const stats = portfolioStats(portfolio.items);
  const [histMetric, setHistMetric] = useState("yield_pct");
  const [aggKind, setAggKind] = useState("mean");
  const [scatterX, setScatterX] = useState("yield_pct");
  const [scatterY, setScatterY] = useState("payback_years");
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const lowRisk = items.filter((x) => x.score >= 78).length;
  const medRisk = items.filter((x) => x.score >= 60 && x.score < 78).length;
  const highRisk = items.filter((x) => x.score < 60).length;

  const byRayon = Object.entries(stats.byRayon).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxRayon = Math.max(...byRayon.map(([, v]) => v), 1);

  const sorted = [...items].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-5).reverse();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        crumb={
          <button onClick={onBack} className="inline-flex items-center gap-1 hover:text-[var(--brand-600)]">
            <ArrowLeft className="h-3 w-3" /> {portfolio.name}
          </button>
        }
        title="Portfel analizi"
        sub="Risk profili, paylanma, top performans və müqayisə."
        right={<SourceBadge source={source} />}
      />

      {/* Summary band */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <DonutScore value={Math.round(agg(items.map((x) => x.score), aggKind))} size={92} label={aggKind === "median" ? "median" : "orta"} />
            <div>
              <div className="text-[13px] font-semibold">Portfel skoru</div>
              <div className="mt-1 max-w-[32ch] text-[12px] text-muted-foreground">{stats.n} mənzilin sərmayə skoru. 78+ aşağı, 60-77 orta risk.</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <RiskMini tone="emerald" n={lowRisk} label="aşağı" />
                <RiskMini tone="amber" n={medRisk} label="orta" />
                <RiskMini tone="red" n={highRisk} label="yüksək" />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Ümumi dəyər" value={fmtMoney(stats.totalValue)} sub={`${stats.n} mənzil`} accent />
          <StatTile label="Orta qiymət/m²" value={fmtMoney(stats.avgPricePerM2, "")} />
          <StatTile label="Orta gəlirlilik" value={`${stats.avgYield}%`} />
          <StatTile label="Orta likvidlik" value={`${stats.avgLiquidity} gün`} />
        </div>
      </div>

      {/* District + type */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="text-[13px] font-semibold">Rayon üzrə paylanma</div>
          <div className="mt-4 flex flex-col gap-2.5">
            {byRayon.map(([name, v]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-28 truncate text-[12.5px]">{name}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded bg-[var(--brand-600)]" style={{ width: `${(v / maxRayon) * 100}%` }} />
                </div>
                <div className="w-14 text-right text-[12px] tabular-nums text-muted-foreground">{v} ədəd</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="text-[13px] font-semibold">Növ üzrə</div>
          <div className="mt-4 flex items-center gap-4">
            <DonutScore value={Math.round((stats.newCount / Math.max(stats.n, 1)) * 100)} size={84} label="Yeni %" />
            <div className="flex flex-1 flex-col gap-2 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded bg-teal-500" /> Yeni tikili <span className="flex-1" />
                <strong className="tabular-nums">{stats.newCount}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded bg-slate-500" /> Köhnə tikili <span className="flex-1" />
                <strong className="tabular-nums">{stats.n - stats.newCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="text-[13px] font-semibold">{METRICS[histMetric].label} paylanması</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Bin üzərinə klikləyib mənzilləri görün. Şaquli xətt portfel {aggKind === "median" ? "medyanı" : "ortası"}dır.
            </div>
          </div>
          <div className="flex gap-2">
            <ChartSelect value={histMetric} onChange={(v) => { setHistMetric(v); setSelectedBin(null); }} options={METRIC_KEYS.map((k) => ({ value: k, label: METRICS[k].label }))} />
            <ChartSelect value={aggKind} onChange={setAggKind} options={[{ value: "mean", label: "Orta" }, { value: "median", label: "Median" }]} />
          </div>
        </div>
        <Histogram items={items} metricKey={histMetric} aggKind={aggKind} selectedBin={selectedBin} onBin={setSelectedBin} />
        {selectedBin != null ? <BinPanel items={items} metricKey={histMetric} bin={selectedBin} onClose={() => setSelectedBin(null)} /> : null}
      </div>

      {/* Top / bottom */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankCard title="Top 5 — ən yüksək skor" items={top} variant="top" />
        <RankCard title="Aşağı 5 — diqqət lazımdır" items={bottom} variant="bottom" />
      </div>

      {/* Scatter */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="text-[13px] font-semibold">{METRICS[scatterX].label} vs. {METRICS[scatterY].label}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">Hər nöqtə bir mənzil. Ölçü = sahə, rəng = risk.</div>
          </div>
          <div className="flex gap-2">
            <ChartSelect value={scatterX} onChange={setScatterX} options={METRIC_KEYS.map((k) => ({ value: k, label: METRICS[k].label }))} />
            <ChartSelect value={scatterY} onChange={setScatterY} options={METRIC_KEYS.map((k) => ({ value: k, label: METRICS[k].label }))} />
          </div>
        </div>
        <Scatter items={items} xKey={scatterX} yKey={scatterY} />
      </div>
    </div>
  );
}

function RiskMini({ tone, n, label }: { tone: "emerald" | "amber" | "red"; n: number; label: string }) {
  const cls = tone === "emerald" ? "bg-emerald-500/12 text-emerald-600" : tone === "amber" ? "bg-amber-500/12 text-amber-600" : "bg-red-500/12 text-red-600";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{n} {label}</span>;
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm", accent && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--brand-600)]")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-bold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function ChartSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer rounded-md border bg-background px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--brand-600)]">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function niceBuckets(values: number[], n = 10) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const rawStep = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const edges: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) edges.push(+v.toFixed(8));
  return edges;
}

function Histogram({ items, metricKey, aggKind, selectedBin, onBin }: { items: ValuationItem[]; metricKey: string; aggKind: string; selectedBin: number | null; onBin: (i: number | null) => void }) {
  const meta = METRICS[metricKey];
  const values = items.map(meta.get).filter((v) => v != null);
  if (values.length === 0) return null;
  const aggValue = agg(values, aggKind);
  const edges = niceBuckets(values, 10);
  const bins = edges.slice(0, -1).map((e, i) => ({ from: e, to: edges[i + 1], count: 0 }));
  values.forEach((v) => {
    let idx = bins.findIndex((b) => v >= b.from && v < b.to);
    if (idx === -1) idx = bins.length - 1;
    bins[idx].count++;
  });
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const W = 1180, H = 320, padL = 50, padR = 24, padT = 24, padB = 52;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const barW = innerW / bins.length;
  const sx = (v: number) => padL + ((v - edges[0]) / (edges[edges.length - 1] - edges[0])) * innerW;

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {Array.from({ length: 6 }, (_, i) => {
          const v = Math.round((i / 5) * maxCount);
          const y = padT + innerH - (v / maxCount) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground, #888)">{v}</text>
            </g>
          );
        })}
        {bins.map((b, i) => {
          const h = (b.count / maxCount) * innerH;
          const x = padL + i * barW + 3;
          const isSel = selectedBin === i;
          const isAgg = aggValue >= b.from && aggValue < b.to;
          return (
            <g key={i} style={{ cursor: b.count ? "pointer" : "default" }} onClick={() => b.count && onBin(isSel ? null : i)}>
              <rect x={padL + i * barW} y={padT} width={barW} height={innerH} fill="transparent" />
              <rect x={x} y={padT + innerH - h} width={barW - 6} height={h} rx="3" fill={isSel ? "#0F1E3D" : isAgg ? "#C58A1A" : "var(--brand-600)"} fillOpacity={b.count === 0 ? 0.08 : 1} />
              {b.count > 0 ? <text x={x + (barW - 6) / 2} y={padT + innerH - h - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{b.count}</text> : null}
            </g>
          );
        })}
        {edges.map((e, i) => (
          <text key={i} x={sx(e)} y={padT + innerH + 18} textAnchor="middle" fontSize="10" fill="var(--muted-foreground, #888)">{meta.fmt(e)}</text>
        ))}
        <line x1={sx(aggValue)} y1={padT - 4} x2={sx(aggValue)} y2={padT + innerH} stroke="var(--brand-600)" strokeWidth="2" strokeDasharray="6 4" />
        <text x={sx(aggValue)} y={padT - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--brand-600)">
          {aggKind === "median" ? "Median" : "Orta"}: {meta.fmt(aggValue)}
        </text>
      </svg>
    </div>
  );
}

function BinPanel({ items, metricKey, bin, onClose }: { items: ValuationItem[]; metricKey: string; bin: number; onClose: () => void }) {
  const meta = METRICS[metricKey];
  const values = items.map(meta.get);
  const edges = niceBuckets(values, 10);
  const from = edges[bin], to = edges[bin + 1];
  const matched = items.filter((x) => meta.get(x) >= from && meta.get(x) < to).sort((a, b) => meta.get(b) - meta.get(a));
  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="text-[13px] font-semibold">Seçilmiş aralıq: {meta.fmt(from)} – {meta.fmt(to)}</div>
        <span className="text-[12px] text-muted-foreground">· {matched.length} mənzil</span>
        <span className="flex-1" />
        <button className="rounded-md px-2.5 py-1 text-[12px] font-medium hover:bg-secondary" onClick={onClose}>Bağla</button>
      </div>
      <div className="max-h-[280px] overflow-auto">
        <table className="w-full text-[13px]">
          <tbody>
            {matched.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-mono text-[12px] text-muted-foreground">{p.id}</td>
                <td className="px-2 py-2">
                  <div className="max-w-[260px] truncate">{p.address || p.rayon}</div>
                  <div className="text-[11.5px] text-muted-foreground">{p.rayon}</div>
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-[var(--brand-600)]">{meta.fmt(meta.get(p))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(p.fair_value)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankCard({ title, items, variant }: { title: string; items: ValuationItem[]; variant: "top" | "bottom" }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3 text-[13px] font-semibold">{title}</div>
      <div>
        {items.map((x, i) => (
          <div key={x.id} className="flex items-center gap-3 border-t px-4 py-2.5 first:border-t-0">
            <div className={cn("w-6 text-[12px] font-bold tabular-nums", variant === "top" ? "text-emerald-600" : "text-red-600")}>#{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{x.address || x.rayon}</div>
              <div className="text-[12px] text-muted-foreground">{fmtMoney(x.fair_value)} · {x.yield_pct}%</div>
            </div>
            <DonutScore value={x.score} size={34} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Scatter({ items, xKey, yKey }: { items: ValuationItem[]; xKey: string; yKey: string }) {
  const mX = METRICS[xKey], mY = METRICS[yKey];
  const xs = items.map(mX.get), ys = items.map(mY.get);
  if (xs.length === 0) return null;
  const W = 1180, H = 380, padL = 64, padR = 20, padT = 16, padB = 48;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.06 || 1, yPad = (yMax - yMin) * 0.06 || 1;
  const x0 = xMin - xPad, x1 = xMax + xPad, y0 = yMin - yPad, y1 = yMax + yPad;
  const sx = (v: number) => padL + ((v - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => padT + innerH - ((v - y0) / (y1 - y0)) * innerH;
  const aggX = mean(xs), aggY = mean(ys);
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {Array.from({ length: 6 }, (_, i) => {
          const v = y0 + (i / 5) * (y1 - y0);
          return (
            <g key={i}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={padL - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground, #888)">{mY.fmt(v)}</text>
            </g>
          );
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const v = x0 + (i / 6) * (x1 - x0);
          return <text key={i} x={sx(v)} y={padT + innerH + 18} textAnchor="middle" fontSize="10" fill="var(--muted-foreground, #888)">{mX.fmt(v)}</text>;
        })}
        <line x1={sx(aggX)} y1={padT} x2={sx(aggX)} y2={padT + innerH} stroke="var(--brand-600)" strokeWidth="1.5" strokeDasharray="6 4" />
        <line x1={padL} y1={sy(aggY)} x2={W - padR} y2={sy(aggY)} stroke="var(--brand-600)" strokeWidth="1.5" strokeDasharray="6 4" />
        {items.map((p, i) => {
          const c = p.score >= 78 ? "#1F8A5B" : p.score >= 60 ? "#C58A1A" : "#C0392B";
          const r = Math.max(5, Math.min(13, (p.area || 70) / 16));
          return (
            <circle key={i} cx={sx(mX.get(p))} cy={sy(mY.get(p))} r={r} fill={c} fillOpacity="0.5" stroke={c} strokeWidth="1.5">
              <title>{`${p.address || p.rayon}\n${mX.label}: ${mX.fmt(mX.get(p))}\n${mY.label}: ${mY.fmt(mY.get(p))}\nSahə: ${p.area} m² · Skor: ${p.score}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
        <Legend c="#1F8A5B" label="Aşağı risk (78+)" />
        <Legend c="#C58A1A" label="Orta risk (60-77)" />
        <Legend c="#C0392B" label="Yüksək risk (<60)" />
      </div>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {label}
    </span>
  );
}
