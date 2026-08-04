// URL slug ↔ dashboard view.
//
// The dashboard used to be one page holding the current screen in React state,
// so every screen shared the URL "/" — links couldn't be shared, a reload threw
// you back to the first screen, and the browser's back button left the app.
// Each view now has its own path.

import type { DashboardView } from "@/components/dashboard/nav-sidebar";

/** The view shown at "/" and after an unknown slug. */
export const DEFAULT_VIEW: DashboardView = "valuation-single";

export const VIEW_SLUGS: Record<DashboardView, string> = {
  "valuation-single": "valuation",
  "valuation-mass": "bulk",
  "valuation-analysis": "portfolio",
  "valuation-market": "market",
  "valuation-hexmap": "map",
  listings: "ads",
  admin: "admin",
  settings: "settings",
  account: "account",
  // Legacy "Homora V1" screens — hidden from the menu but still reachable by
  // URL so nothing that was linked before breaks.
  overview: "overview",
  map: "heatmap",
  rayons: "rayons",
  trends: "trends",
  b2c: "b2c",
  reports: "reports",
  alerts: "alerts",
  "valuation-map": "secondary"
};

const SLUG_TO_VIEW: Record<string, DashboardView> = Object.fromEntries(
  Object.entries(VIEW_SLUGS).map(([view, slug]) => [slug, view as DashboardView])
);

/** Path for a view, e.g. "listings" → "/ads". */
export function pathForView(view: DashboardView): string {
  return view === DEFAULT_VIEW ? "/" : `/${VIEW_SLUGS[view]}`;
}

/** View for a slug, or null when the slug isn't a dashboard screen. */
export function viewForSlug(slug: string | undefined): DashboardView | null {
  if (!slug) return DEFAULT_VIEW;
  return SLUG_TO_VIEW[slug] ?? null;
}

/** Every slug, for generateStaticParams. */
export const ALL_SLUGS = Object.values(VIEW_SLUGS);
