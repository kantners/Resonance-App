// Pattern callout ("Pattern noted") and Trends association (HANDOFF §3.6).
// Always an association, never a cause.
import { addDays } from "./dates";
import { type NightInput, computeBaseline } from "./baseline";
import { mean, pearson, sampleSd } from "./stats";

export interface ExposureDay {
  date: string;       // the day the phone was used
  totalMin: number;
}

export const PATTERN_WINDOW_DAYS = 28;
export const MIN_EXPOSURE_DAYS = 7;          // below this, "mean + 1 SD" isn't meaningful
export const ASSOCIATION_MIN_NIGHTS = 21;
export const PATTERN_CAVEAT = "An association, not a diagnosis.";

export interface ExposureThreshold {
  windowStart: string;
  windowEnd: string;
  meanMin: number;
  sdMin: number;
  thresholdMin: number;   // mean + 1 SD
}

/** Threshold over the user's last 28 days of exposure, ending the day before `date`. */
export function exposureThreshold(days: readonly ExposureDay[], date: string): ExposureThreshold | null {
  const windowEnd = addDays(date, -1);
  const windowStart = addDays(date, -PATTERN_WINDOW_DAYS);
  const inWindow = days.filter(d => d.date >= windowStart && d.date <= windowEnd).map(d => d.totalMin);
  if (inWindow.length < MIN_EXPOSURE_DAYS) return null;
  const m = mean(inWindow);
  const sd = sampleSd(inWindow);
  return { windowStart, windowEnd, meanMin: m, sdMin: sd, thresholdMin: m + sd };
}

export function isHighExposure(day: ExposureDay | undefined, t: ExposureThreshold | null): boolean {
  return !!day && !!t && day.totalMin >= t.thresholdMin;
}

/** Is the HRV of the night dated `date` below the range as it stood that morning? */
function hrvBelowRangeOn(nights: readonly NightInput[], date: string, hrvLogScale: boolean): boolean {
  const b = computeBaseline(nights, date, hrvLogScale);
  const night = b.week.find(n => n.date === date);
  return !!night && !!b.hrv && night.hrv < b.hrv.low;
}

export interface PatternCallout {
  triggered: boolean;
  yesterdayMin: number | null;
  averageMin: number | null;
  hrvDiffFromBaselineMs: number | null;  // last night's HRV minus the baseline mean
  seenAfter: number;                      // k: high-exposure days followed by below-range HRV
  highExposureDays: number;               // m: high-exposure days in the last 28
  caveat: string;
}

export function patternCallout(
  days: readonly ExposureDay[],
  nights: readonly NightInput[],
  date: string,
  hrvLogScale: boolean,
): PatternCallout {
  const t = exposureThreshold(days, date);
  const byDate = new Map(days.map(d => [d.date, d]));
  const yesterday = byDate.get(addDays(date, -1));

  let m = 0, k = 0;
  if (t) {
    for (const d of days) {
      if (d.date < t.windowStart || d.date > t.windowEnd || !isHighExposure(d, t)) continue;
      m++;
      if (hrvBelowRangeOn(nights, addDays(d.date, 1), hrvLogScale)) k++;
    }
  }

  const b = computeBaseline(nights, date, hrvLogScale);
  const lastNight = b.week.find(n => n.date === date);
  const belowToday = hrvBelowRangeOn(nights, date, hrvLogScale);

  return {
    triggered: isHighExposure(yesterday, t) && belowToday,
    yesterdayMin: yesterday?.totalMin ?? null,
    averageMin: t?.meanMin ?? null,
    hrvDiffFromBaselineMs: lastNight && b.hrv ? lastNight.hrv - b.hrv.mean : null,
    seenAfter: k,
    highExposureDays: m,
    caveat: PATTERN_CAVEAT,
  };
}

/**
 * For the level-2 nudge (§3.4): true when every one of the out-of-range
 * nights ending `date` followed a high-exposure day, so the message may
 * name that as the likely pattern.
 */
export function outNightsFollowedHighExposure(
  days: readonly ExposureDay[], date: string, consecutiveOut: number,
): boolean {
  if (consecutiveOut < 2) return false;
  const t = exposureThreshold(days, date);
  if (!t) return false;
  const byDate = new Map(days.map(d => [d.date, d]));
  for (let i = 0; i < consecutiveOut; i++) {
    if (!isHighExposure(byDate.get(addDays(date, -i - 1)), t)) return false;
  }
  return true;
}

export interface Association {
  pairs: number;
  r: number | null;
}

/**
 * Trends: strength of association between a day's screen time and the next
 * morning's HRV. Withheld (null) until 21 logged nights exist.
 */
export function screenHrvAssociation(
  days: readonly ExposureDay[], nights: readonly NightInput[], loggedNights: number,
): Association | null {
  if (loggedNights < ASSOCIATION_MIN_NIGHTS) return null;
  const hrvByDate = new Map(nights.filter(n => n.hrv != null).map(n => [n.date, n.hrv as number]));
  const xs: number[] = [], ys: number[] = [];
  for (const d of days) {
    const next = hrvByDate.get(addDays(d.date, 1));
    if (next !== undefined) { xs.push(d.totalMin); ys.push(next); }
  }
  return { pairs: xs.length, r: pearson(xs, ys) };
}
