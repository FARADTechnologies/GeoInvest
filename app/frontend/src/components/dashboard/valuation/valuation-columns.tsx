"use client";

// Shared column show/hide system for the Tək + Kütləvi valuation tables
// (team task — ported from the orange prototype's "Sütunlar" control).
//
// One column definition list drives both tables: the header, the cell render,
// and the "Sütunlar" dropdown. The visible set is persisted in localStorage so
// each table remembers the user's choice. ID and the actions column are always
// shown and are rendered by the table itself (not part of this list).

import { useEffect, useRef, useState } from "react";
import { T } from "@/components/dashboard/valuation/valuation-i18n";
import { Icons, TypePill, fmtMoney } from "@/components/dashboard/valuation/valuation-ui";
import type { OProp } from "@/components/dashboard/valuation/valuation-core";

export type ColKey =
  | "type" | "address" | "area" | "rooms" | "district" | "totalFloors"
  | "fairValue" | "pricePerM2" | "monthlyRent" | "yield" | "payback"
  | "liquidity" | "score" | "risk";

export type ColAlign = "num" | "center" | "left";

export type ColDef = {
  key: ColKey;
  label: string;
  group: "basic" | "valuation";
  align: ColAlign;
  width?: number;
  defaultOn: boolean;
  // `dr` = draft (not yet valued) → valuation cells show a dash.
  render: (p: OProp, dr: boolean) => React.ReactNode;
};

const dash = <span className="muted">—</span>;

export const COLUMNS: ColDef[] = [
  // ── Əsas məlumat ──
  { key: "type", label: "Növ", group: "basic", align: "left", width: 110, defaultOn: true, render: (p) => <TypePill type={p.type} /> },
  { key: "address", label: "Ünvan", group: "basic", align: "left", width: 280, defaultOn: true, render: (p) => (
      <div>
        <div className="cell-primary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{p.address || "—"}</div>
        {p.district && p.district !== "—" && <div className="cell-muted">{p.district}</div>}
      </div>
    ) },
  { key: "area", label: "Sahə", group: "basic", align: "num", width: 80, defaultOn: true, render: (p) => `${p.area} m²` },
  { key: "rooms", label: "Otaq", group: "basic", align: "center", width: 60, defaultOn: true, render: (p) => p.rooms ?? "—" },
  { key: "district", label: "Rayon", group: "basic", align: "left", width: 140, defaultOn: false, render: (p) => p.district || "—" },
  { key: "totalFloors", label: "Mərt. (cəmi)", group: "basic", align: "center", width: 100, defaultOn: false, render: (p) => p.totalFloors ?? "—" },
  // ── Qiymətləndirmə ──
  { key: "fairValue", label: "Fair value", group: "valuation", align: "num", width: 130, defaultOn: true, render: (p, dr) => (dr ? dash : <span className="cell-strong">{fmtMoney(p.fairValue)}</span>) },
  { key: "pricePerM2", label: "Qiymət/m²", group: "valuation", align: "num", width: 110, defaultOn: true, render: (p, dr) => (dr ? dash : fmtMoney(p.pricePerM2, "")) },
  { key: "monthlyRent", label: "Aylıq kirayə", group: "valuation", align: "num", width: 110, defaultOn: true, render: (p, dr) => (dr ? dash : fmtMoney(p.monthlyRent)) },
  { key: "yield", label: "Gəlirlilik", group: "valuation", align: "num", width: 95, defaultOn: true, render: (p, dr) => (dr ? dash : `${p.yield}%`) },
  { key: "payback", label: "Geri ödəmə", group: "valuation", align: "num", width: 110, defaultOn: true, render: (p, dr) => (dr ? dash : `${p.payback} il`) },
  { key: "liquidity", label: "Likvidlik", group: "valuation", align: "num", width: 95, defaultOn: false, render: (p, dr) => (dr ? dash : `${p.liquidity} gün`) },
  { key: "score", label: "Skor", group: "valuation", align: "center", width: 70, defaultOn: false, render: (p, dr) => (dr ? dash : p.score) },
  { key: "risk", label: "Risk", group: "valuation", align: "center", width: 90, defaultOn: false, render: (p, dr) => (dr ? dash : p.risk) }
];

const DEFAULT_ON: ColKey[] = COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);
export const colClass = (a: ColAlign): string => (a === "num" ? "num" : a === "center" ? "center" : "");

// Visible-column set, persisted per table (storageKey).
export function useVisibleCols(storageKey: string) {
  const [visible, setVisible] = useState<Set<ColKey>>(() => new Set(DEFAULT_ON));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const keys = (JSON.parse(raw) as ColKey[]).filter((k) => COLUMNS.some((c) => c.key === k));
        setVisible(new Set(keys));
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  const persist = (s: Set<ColKey>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
  };
  const toggle = (k: ColKey) =>
    setVisible((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      persist(n);
      return n;
    });
  const reset = () => {
    const n = new Set(DEFAULT_ON);
    setVisible(n);
    persist(n);
  };
  return { visible, toggle, reset };
}

// "Sütunlar" dropdown button. Place it in the table toolbar.
export function ColumnPicker({
  visible,
  toggle,
  reset
}: {
  visible: Set<ColKey>;
  toggle: (k: ColKey) => void;
  reset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const groups: { label: string; group: ColDef["group"] }[] = [
    { label: "Əsas məlumat", group: "basic" },
    { label: "Qiymətləndirmə", group: "valuation" }
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        <Icons.Filter size={14} /> {T(`Sütunlar`)}
        <span style={{ marginLeft: 6, background: "var(--orange-tint)", color: "var(--orange)", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{visible.size}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 60, width: 264, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 14px 34px rgba(0,0,0,0.18)", padding: "12px 0 8px", maxHeight: 400, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 8px" }}>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>{T(`Sütunları göstər`)}</span>
            <button onClick={reset} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>{T(`Sıfırla`)}</button>
          </div>
          {groups.map((g) => (
            <div key={g.group}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 2px" }}>{T(g.label)}</div>
              {COLUMNS.filter((c) => c.group === g.group).map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", cursor: "pointer", fontSize: 13.5 }}>
                  <input type="checkbox" checked={visible.has(c.key)} onChange={() => toggle(c.key)} style={{ accentColor: "var(--orange)", width: 15, height: 15 }} />
                  {T(c.label)}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
