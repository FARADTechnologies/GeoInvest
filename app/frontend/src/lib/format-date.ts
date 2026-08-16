// Dates, written the way Azerbaijan writes them.
//
// The app was rendering ISO fragments straight from the API — "2026-08-06" for
// a day and "2026-08" on every chart axis. That is machine order
// (year-month-day); locally a date is written day-first, separated by dots:
// 6 avqust 2026 is 06.08.2026, and the month alone is 08.2026.
//
// Everything user-facing goes through here so the convention is in one place.
// The API keeps speaking ISO — only the rendering changes.

/** "2026-08-06" (or a Date) → "06.08.2026". Empty input renders as an em dash. */
export function formatDate(value: string | Date | null | undefined): string {
  const p = parts(value);
  return p ? `${p.dd}.${p.mm}.${p.yyyy}` : "—";
}

/** "2026-08" or "2026-08-06" → "08.2026" — for a month-granular figure. */
export function formatMonth(value: string | Date | null | undefined): string {
  const p = parts(value);
  return p ? `${p.mm}.${p.yyyy}` : "—";
}

/**
 * "2026-08" → "08.26" — the compact form for a chart axis, where a dozen
 * labels have to share the width.
 */
export function formatMonthShort(value: string | Date | null | undefined): string {
  const p = parts(value);
  return p ? `${p.mm}.${p.yyyy.slice(2)}` : "—";
}

type Parts = { dd: string; mm: string; yyyy: string };

function parts(value: string | Date | null | undefined): Parts | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      dd: pad(value.getDate()),
      mm: pad(value.getMonth() + 1),
      yyyy: String(value.getFullYear())
    };
  }

  // Read the ISO text directly rather than through Date(), which would shift
  // a date-only string by the viewer's timezone and can land on the day before.
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  return { yyyy: m[1], mm: m[2], dd: m[3] ?? "01" };
}

const pad = (n: number) => String(n).padStart(2, "0");
