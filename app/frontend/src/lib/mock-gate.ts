// Central gate for mock / snapshot fallback data.
//
// The dashboard falls back to snapshot-or-mock numbers whenever the backend is
// unreachable. That's useful while developing, but on production a customer
// must never be shown invented figures believing they're real — so there the
// fallback is restricted to super admins (who use it to sanity-check a deploy).
// Everyone else gets the explicit error/empty state instead.

import { getUser } from "@/lib/auth";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "";
const IS_PROD = APP_ENV === "production" || APP_ENV === "prod";

// Master switch. OFF by decision: when the backend or the DB is unreachable the
// app must show nothing rather than stale snapshot/invented figures — a wrong
// number is worse than a visible gap. The fallback code paths are all still in
// place; set this to true to bring them back (the per-environment / super-admin
// rules below then apply again).
const MOCK_ENABLED = false;

/** True when this session may render mock/snapshot data. */
export function mockAllowed(): boolean {
  if (!MOCK_ENABLED) return false;
  if (!IS_PROD) return true; // dev / staging — always fine
  return getUser()?.role === "super_admin";
}

/** True when a visible "MOCK" badge should be rendered alongside the data. */
export const IS_PRODUCTION = IS_PROD;
