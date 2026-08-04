// Single place where the backend URL is assembled.
//
// The two env vars can overlap. Production is deployed with
//   NEXT_PUBLIC_API_BASE_URL = https://analytics.homora.ai/api
//   NEXT_PUBLIC_API_PREFIX   = /api/v1
// which naively concatenates to ".../api/api/v1" — every call 404s, the app
// silently falls back to snapshot/mock data, and the whole product looks
// broken (stale periods, "not found" on valuation). Rather than depend on the
// deployment getting the split exactly right, the overlap is collapsed here.

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const RAW_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

/** Strip trailing slashes so joins never produce "//". */
function trimEnd(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Join base + prefix, removing any duplicated path segments where they meet.
 * e.g. base ".../api" + prefix "/api/v1" → ".../api/v1" (not ".../api/api/v1").
 */
function joinBaseAndPrefix(base: string, prefix: string): string {
  const cleanBase = trimEnd(base);
  const cleanPrefix = trimEnd(prefix);
  if (!cleanPrefix) return cleanBase;

  const prefixParts = cleanPrefix.split("/").filter(Boolean);
  // Try the longest possible overlap first: if the base already ends with the
  // first N segments of the prefix, only append what's left.
  for (let take = prefixParts.length; take > 0; take--) {
    const candidate = "/" + prefixParts.slice(0, take).join("/");
    if (cleanBase.endsWith(candidate)) {
      const rest = prefixParts.slice(take);
      return rest.length ? `${cleanBase}/${rest.join("/")}` : cleanBase;
    }
  }
  return `${cleanBase}${cleanPrefix}`;
}

/** Backend root including the version prefix, with no trailing slash. */
export const API_ROOT = joinBaseAndPrefix(RAW_BASE, RAW_PREFIX);

/** Absolute URL for an API path, e.g. apiUrl("/auth/login"). */
export function apiUrl(path: string): string {
  return `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}
