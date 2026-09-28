// Calendar arithmetic on "YYYY-MM-DD" strings. These are the user's local
// dates as sent by the client; the arithmetic is done in UTC only so that DST
// never shifts a day. The server clock is never consulted.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`invalid date "${date}" (expected YYYY-MM-DD)`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  return fromUtcMs(toUtcMs(date)) === date; // rejects 2026-02-30
}

export function addDays(date: string, n: number): string {
  return fromUtcMs(toUtcMs(date) + n * 86_400_000);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/**
 * The user's local calendar date for an instant, in an IANA time zone.
 * Used when the client sends an instant and a zone rather than a date, and in
 * tests (a 21:30 entry in New York is 01:30 UTC the next day).
 */
export function localDateOf(instant: string | Date, timeZone: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new Error(`invalid instant "${String(instant)}"`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes since local midnight for an instant in an IANA time zone. */
export function localMinuteOfDay(instant: string | Date, timeZone: string): number {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find(p => p.type === "hour")!.value);
  const m = Number(parts.find(p => p.type === "minute")!.value);
  return h * 60 + m;
}
