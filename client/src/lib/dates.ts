// Calendar dates are always the user's local date, computed on the device
// and sent to the server (amendment B6). Never new Date().toISOString().slice(0, 10):
// that is the UTC date, wrong for anyone west of UTC in the evening.

/** Today as "YYYY-MM-DD" in the device's time zone. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The device's IANA time zone, e.g. "America/New_York". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function atNoon(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(date: string, n: number): string {
  const d = atNoon(date);
  d.setDate(d.getDate() + n);
  return localToday(d);
}

/** "FRI · SEP 25" */
export function fmtHeaderDate(date: string): string {
  const d = atNoon(date);
  const wd = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  return `${wd} · ${md}`;
}

/** "Thu" */
export function fmtWeekday(date: string): string {
  return atNoon(date).toLocaleDateString("en-US", { weekday: "short" });
}

/** "Sep 24" */
export function fmtMonthDay(date: string): string {
  return atNoon(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "July" */
export function fmtMonth(date: string): string {
  return atNoon(date).toLocaleDateString("en-US", { month: "long" });
}

/** Local ISO instant with offset, e.g. "2026-09-25T06:52:00-04:00". */
export function localIsoNow(now = new Date()): string {
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${localToday(now)}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}${sign}${hh}:${mm}`;
}
