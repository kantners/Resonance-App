// Evening annotations: last-meal-to-sleep gap, late-meal and long-fast markers.
// DISPLAY ONLY. Nothing here feeds computeBrief, baselines or labels, so it needs no RULE_VERSION bump
// (RULE_VERSION keys stored daily_status rows; bumping it would orphan the prior labels).
// The thresholds are rules of thumb, not clinical cut-offs; the UI says so.
export const LATE_MEAL_MAX_GAP_H = 3;
export const LONG_FAST_MIN_H = 20;
export const MAX_SLEEP_SPAN_H = 20;

export interface FastLike { startedAt: string; endedAt: string | null }

export interface EveningAnnotation {
  /** Start of the fast that spans sleep onset = the last meal. Null when no fast spans onset. */
  lastMealAt: string | null;
  /** Hours from last meal to sleep onset (1 dp). */
  gapHours: number | null;
  /** Gap shorter than LATE_MEAL_MAX_GAP_H. Derived, never stored, never a baseline input. */
  lateMeal: boolean;
  /** Length of the spanning fast (to its end, or to `now` while active), 1 dp. */
  fastHours: number | null;
  longFast: boolean;
}

const H = 3_600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function eveningAnnotation(onset: string | null, fasts: FastLike[], now: Date): EveningAnnotation {
  const none: EveningAnnotation = { lastMealAt: null, gapHours: null, lateMeal: false, fastHours: null, longFast: false };
  const o = onset ? Date.parse(onset) : NaN;
  if (!Number.isFinite(o)) return none;
  // The fast spanning onset: started at or before it and not ended before it. Latest start wins.
  const spanning = fasts
    .filter(f => Date.parse(f.startedAt) <= o && (f.endedAt == null || Date.parse(f.endedAt) > o))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (!spanning) return none;
  const start = Date.parse(spanning.startedAt);
  const end = spanning.endedAt ? Date.parse(spanning.endedAt) : now.getTime();
  const gap = round1((o - start) / H);
  const fastHours = round1((end - start) / H);
  return {
    lastMealAt: spanning.startedAt, gapHours: gap, lateMeal: gap < LATE_MEAL_MAX_GAP_H,
    fastHours, longFast: fastHours >= LONG_FAST_MIN_H,
  };
}

/** Both or neither; onset before wake; at most MAX_SLEEP_SPAN_H apart. Returns an error message or null. */
export function sleepWindowError(onset: string | null | undefined, wake: string | null | undefined): string | null {
  if (onset == null && wake == null) return null;
  if (onset == null || wake == null) return null; // a single end is allowed
  const o = Date.parse(onset), w = Date.parse(wake);
  if (!(o < w)) return "Fell asleep must be before wake time.";
  if ((w - o) / H > MAX_SLEEP_SPAN_H) return `Fell asleep and wake time are more than ${MAX_SLEEP_SPAN_H} hours apart.`;
  return null;
}
