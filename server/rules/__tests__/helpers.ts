import { addDays, type NightInput } from "..";

export const DEVICE = "Polar H10 + Elite HRV";

export function night(date: string, hrv: number | null, rhr: number | null, device = DEVICE): NightInput {
  return { date, hrv, rhr, hrvSource: "device_manual", hrvDevice: device };
}

/**
 * `count` baseline nights ending the day before `endExclusive`, alternating
 * mean ± a so the sample SD is exactly `sd` (needs an even count).
 */
export function baselineNights(
  endExclusive: string, count: number, hrvMean: number, hrvSd: number, rhrMean: number, rhrSd: number,
): NightInput[] {
  if (count % 2) throw new Error("even count needed for an exact SD");
  const k = Math.sqrt((count - 1) / count);
  const out: NightInput[] = [];
  for (let i = 0; i < count; i++) {
    const sign = i % 2 ? 1 : -1;
    out.push(night(addDays(endExclusive, -count + i), hrvMean + sign * hrvSd * k, rhrMean + sign * rhrSd * k));
  }
  return out;
}

export const CANVAS_DATE = "2026-09-25";   // Friday, Sep 25 (the canvas Brief)
export const CANVAS_WEEK_HRV = [51, 44, 47, 54, 49, 53, 42];
export const CANVAS_WEEK_RHR = [54, 57, 55, 53, 55, 54, 58];

/** The canvas: baseline HRV 48 ± 5, RHR 55 ± 2, then the canvas week ending CANVAS_DATE. */
export function canvasNights(baselineCount = 14): NightInput[] {
  const weekStart = addDays(CANVAS_DATE, -6);
  const base = baselineCount % 2
    ? [...baselineNights(addDays(weekStart, -1), baselineCount - 1, 48, 5, 55, 2), night(addDays(weekStart, -1), 48, 55)]
    : baselineNights(weekStart, baselineCount, 48, 5, 55, 2);
  const week = CANVAS_WEEK_HRV.map((h, i) => night(addDays(weekStart, i), h, CANVAS_WEEK_RHR[i]));
  return [...base, ...week];
}
