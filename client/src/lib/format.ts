/** 347 → "5h 47m"; 45 → "45m"; 120 → "2h 00m" */
export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** 6.8 → "6h 48m" */
export function fmtHours(h: number | null | undefined): string {
  return h == null ? "—" : fmtMinutes(h * 60);
}

/** One decimal: 48.571 → "48.6" */
export function fmt1(x: number | null | undefined): string {
  return x == null ? "—" : (Math.round(x * 10) / 10).toFixed(1);
}

/** Whole number: 47.6 → "48" */
export function fmt0(x: number | null | undefined): string {
  return x == null ? "—" : String(Math.round(x));
}

/** Signed with a true minus: +6, −4 */
export function fmtSigned(x: number, digits = 0): string {
  const v = digits ? Math.abs(x).toFixed(digits) : String(Math.round(Math.abs(x)));
  return `${x < 0 ? "−" : "+"}${v}`;
}

/** Position of x on a 0–100% scale spanning [lo, hi], clamped. */
export function pct(x: number, lo: number, hi: number): number {
  if (hi <= lo) return 50;
  return Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
}
