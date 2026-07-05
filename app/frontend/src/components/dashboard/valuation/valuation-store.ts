// Persistent portfolio store for the valuation module.
// Portfolios live in localStorage so they survive view switches and page
// reloads (the prototype keeps them in app-level state; we go one better).

import type { OProp } from "@/components/dashboard/valuation/valuation-core";
import type { RateReportData, ValuationSource } from "@/types/valuation";

export type Portfolio = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  items: OProp[];
};

const KEY = "homora-valuation-portfolios-v1";

type Stored = { portfolios: Portfolio[]; source: ValuationSource };

export function loadPortfolios(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!Array.isArray(parsed.portfolios)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePortfolios(portfolios: Portfolio[], source: ValuationSource): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ portfolios, source }));
  } catch {
    /* quota/SSR — ignore */
  }
}

// ── Tək qiymətləndirmə history ─────────────────────────────────────────
// The single-valuation history (evaluated rows + their report payloads) is
// persisted so it survives reloads and view switches. Nothing auto-expires;
// only the user's explicit delete removes a row.

const SINGLE_KEY = "homora-valuation-single-v1";

type SingleStored = {
  items: OProp[];
  reports: Record<string, RateReportData>;
  source: ValuationSource;
};

export function loadSingleHistory(): SingleStored | null {
  try {
    const raw = window.localStorage.getItem(SINGLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SingleStored;
    if (!Array.isArray(parsed.items)) return null;
    return { items: parsed.items, reports: parsed.reports ?? {}, source: parsed.source ?? "db" };
  } catch {
    return null;
  }
}

export function saveSingleHistory(
  items: OProp[],
  reports: Record<string, RateReportData>,
  source: ValuationSource
): void {
  try {
    window.localStorage.setItem(SINGLE_KEY, JSON.stringify({ items, reports, source }));
  } catch {
    /* quota/SSR — ignore */
  }
}
