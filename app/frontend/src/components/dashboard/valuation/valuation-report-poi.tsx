"use client";

// Əlçatanlıq indeksləri (accessibility / POI) section of the valuation report —
// pages 4–6 of the official PDF. The data (category scores + nearby POIs +
// distances + map) comes from the team's report API (task #9). Until that
// arrives this renders a clear placeholder; once the API is wired, pass `data`
// and the same layout fills in.

import { Icons } from "@/components/dashboard/valuation/valuation-ui";
import { T } from "@/components/dashboard/valuation/valuation-i18n";

export type PoiItem = { name: string; distance_m: number };
export type PoiCategory = { key: string; label: string; score: number; items: PoiItem[] };
// Future API shape (task #9): { categories: PoiCategory[], lat, lng }
export type ReportPoiData = { categories: PoiCategory[]; lat?: number; lng?: number } | null;

// The six categories shown in the official report.
const CATEGORY_LABELS: Record<string, string> = {
  education: "Təhsil",
  restaurant: "Restoran",
  entertainment: "Əyləncə",
  transport: "Nəqliyyat",
  travel: "Səyahət",
  walk: "Gəzinti"
};

export function ReportPoiSection({ data }: { data?: ReportPoiData }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="chart-title" style={{ marginBottom: 8 }}>{T(`Əlçatanlıq indeksləri`)}</div>

      {data && data.categories.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {data.categories.map((c) => (
            <div key={c.key} className="card card-pad">
              <div className="fl-row" style={{ gap: 8, marginBottom: 10 }}>
                <div className="card-title">{T(CATEGORY_LABELS[c.key] ?? c.label)}</div>
                <span className="sp" />
                <span className="pill pill-teal">{c.score} / 10</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {c.items.slice(0, 8).map((it, i) => (
                  <div key={i} className="fl-row" style={{ gap: 8, fontSize: 13 }}>
                    <Icons.MapPin size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{it.distance_m} m</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Placeholder until the report POI/map API (task #9) is delivered.
        <div className="card card-pad" style={{ textAlign: "center", padding: "32px 24px" }}>
          <div className="empty-art" style={{ margin: "0 auto 12px" }}><Icons.MapPin size={26} /></div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{T(`Əlçatanlıq məlumatları hazırlanır`)}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }}>
            {T(`Təhsil, restoran, əyləncə, nəqliyyat, səyahət və gəzinti indeksləri API inteqrasiyasından sonra burada görünəcək.`)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 }}>
            {Object.values(CATEGORY_LABELS).map((l) => (
              <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{T(l)}</span>
                <span className="sp" />
                <span className="muted" style={{ fontSize: 12 }}>— / 10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
