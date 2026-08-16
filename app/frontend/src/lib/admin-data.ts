import type { AccountRequest } from "@/types/admin";

const REQUESTS_KEY = "homora-account-requests";

// Two seeded account requests and three fabricated customer companies (with
// invented staff, VÖEN numbers and audit trails) used to live here, plus a
// getAccountRequests() that merged them into the real list. Nothing consumed
// them except the admin console, which now reads /auth/pending and /auth/users
// directly, so they are gone.

export function submitAccountRequest(
  request: Omit<AccountRequest, "id" | "status" | "createdAt">
): AccountRequest {
  const next: AccountRequest = {
    ...request,
    id: `req-${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(REQUESTS_KEY);
      const current = raw ? (JSON.parse(raw) as AccountRequest[]) : [];
      window.localStorage.setItem(REQUESTS_KEY, JSON.stringify([next, ...current]));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}
