"use client";

// Standalone "Portfel analizi" view (own sidebar entry, like the prototype).
// Reads the persisted portfolios and renders the same PortfolioAnalysis page
// with a portfolio picker on top.

import { useEffect, useState } from "react";
import { setValLang, T } from "@/components/dashboard/valuation/valuation-i18n";
import type { Lang } from "@/lib/i18n";


import "@/components/dashboard/valuation/valuation-orange.css";
import { Icons } from "@/components/dashboard/valuation/valuation-ui";
import { PortfolioAnalysis } from "@/components/dashboard/valuation/valuation-mass";
import { loadPortfolios, type Portfolio } from "@/components/dashboard/valuation/valuation-store";
import type { DashboardView } from "@/components/dashboard/nav-sidebar";
import type { ValuationSource } from "@/types/valuation";

export function ValuationAnalysisView({ lang = "az", onNavigate }: { lang?: Lang; onNavigate?: (v: DashboardView) => void }) {
  setValLang(lang);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [source, setSource] = useState<ValuationSource>("mock");
  const [pfId, setPfId] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPortfolios();
    if (saved) {
      const filled = saved.portfolios.filter((p) => p.items.length > 0);
      setPortfolios(filled);
      setSource(saved.source);
      if (filled[0]) setPfId(filled[0].id);
    }
  }, []);

  const portfolio = portfolios.find((p) => p.id === pfId);

  if (!portfolio) {
    return (
      <div className="hm-val">
        <div className="page" style={{ padding: 0, maxWidth: "none" }}>
          <div className="empty">
            <div className="empty-art"><Icons.Folder size={28} /></div>
            <div className="empty-title">{T(`Analiz üçün portfel tapılmadı`)}</div>
            <div className="empty-sub">{T(`Əvvəlcə Kütləvi qiymətləndirmə bölməsində portfel yaradın və mənzil əlavə edin.`)}</div>
            <button className="btn btn-primary" onClick={() => onNavigate?.("valuation-mass")}>
              <Icons.ValueMass size={14} /> {T(`Kütləvi qiymətləndirməyə keç`)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hm-val">
      <div className="page" style={{ padding: 0, maxWidth: "none" }}>
        {/* Portfolio picker (prototype's analysis page has the same control) */}
        <div className="card card-pad" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Icons.Folder size={16} className="muted" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{T(`Portfel:`)}</span>
          <select
            value={pfId ?? ""}
            onChange={(e) => setPfId(e.target.value)}
            style={{
              padding: "9px 14px", background: "var(--card)", border: "1.5px solid var(--border-strong)",
              borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-1)",
              minWidth: 320, outline: "none"
            }}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.items.length} mənzil)</option>
            ))}
          </select>
          <span className="sp" />
          <button className="btn btn-ghost" onClick={() => onNavigate?.("valuation-mass")}>
            <Icons.Eye size={14} /> {T(`Mənzillər siyahısı`)}
          </button>
        </div>

        <PortfolioAnalysis portfolio={portfolio} source={source} onBack={() => onNavigate?.("valuation-mass")} />
      </div>
    </div>
  );
}
