/**
 * KEWT Date Utilities — device-local timezone throughout.
 *
 * Never use new Date().toISOString().slice(0,10) — that returns UTC date
 * which is wrong for users east of UTC after 8 PM, or west of UTC before midnight.
 *
 * All functions here use the device's local timezone automatically.
 */

/** Returns today's date as "YYYY-MM-DD" in the device's local timezone. */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converts a "YYYY-MM-DD" string to a Date at local noon (avoids UTC midnight rollover). */
export function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Formats a "YYYY-MM-DD" string using the device's local timezone. */
export function fmtLocalDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }
): string {
  return localDate(iso).toLocaleDateString("en-US", opts);
}

/** Returns true if a "YYYY-MM-DD" string matches today in local time. */
export function isToday(iso: string): boolean {
  return iso === localToday();
}

/** Returns true if a "YYYY-MM-DD" string matches yesterday in local time. */
export function isYesterday(iso: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return iso === `${y}-${m}-${day}`;
}

/** Days between two "YYYY-MM-DD" strings (positive = future). */
export function daysUntil(iso: string): number {
  const target = localDate(iso).setHours(0, 0, 0, 0);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}
