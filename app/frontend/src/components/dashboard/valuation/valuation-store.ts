// Persistent portfolio store for the valuation module.
// Portfolios live in localStorage so they survive view switches and page
// reloads (the prototype keeps them in app-level state; we go one better).

import type { OProp } from "@/components/dashboard/valuation/valuation-core";
import type { ValuationSource } from "@/types/valuation";

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
