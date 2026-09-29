// Baseline windows and normal ranges (HANDOFF §3.1–3.2).
import { addDays } from "./dates";
import { mean, sampleSd } from "./stats";

/** One night's inputs: a sleep_logs row, keyed by its wake date. */
export interface NightInput {
  date: string;              // wake date, YYYY-MM-DD
  hrv: number | null;        // rMSSD, ms
  rhr: number | null;        // resting HR, bpm
  hrvSource: string;         // camera | device_manual
  hrvDevice: string | null;  // device + app
  /** Posture of the morning reading behind `hrv`; null/absent for overnight values. */
  hrvPosture?: string | null;
  /** The reading was off the user's set posture: stored and shown, never averaged. */
  hrvOffPosture?: boolean;
}

/** A night that counts: it has an HRV value. Nights without HRV are skipped, never imputed. */
export type LoggedNight = NightInput & { hrv: number };

export interface Range {
  mean: number;   // arithmetic mean of B (shown on screen)
  sd: number;     // sample SD of B (shown on screen)
  low: number;
  high: number;
}

export interface Baseline {
  asOf: string;               // the morning these ranges are for
  ready: boolean;             // |B| = 14 and |W| ≥ 5
  week: LoggedNight[];        // W: logged nights among the 7 calendar nights ending asOf
  base: LoggedNight[];        // B: the 14 logged nights before W (fewer while building)
  hrv: Range | null;
  rhr: Range | null;
  hrvLogScale: boolean;
}

export const BASELINE_NIGHTS = 14;
export const WEEK_DAYS = 7;
export const MIN_WEEK_NIGHTS = 5;
const HRV_SD_FACTOR = 0.5;
const RHR_SD_FACTOR = 1.0;

function sourceKey(n: NightInput): string {
  return `${n.hrvSource}|${(n.hrvDevice ?? "").trim().toLowerCase()}`;
}

/** A usable night: it has an HRV value and wasn't taken off the set posture. */
export function isUsableNight(n: NightInput): n is LoggedNight {
  return n.hrv != null && n.hrv > 0 && !n.hrvOffPosture;
}

/**
 * Logged nights up to and including `asOf`, oldest first, restricted to the
 * nights since the most recent change of HRV source, device or posture:
 * readings from different devices or postures aren't comparable, so the
 * baseline restarts (§1). Off-posture nights are left out entirely, so they
 * never restart anything. Overnight values carry no posture and never count
 * as a posture change.
 */
export function comparableNights(nights: readonly NightInput[], asOf: string): LoggedNight[] {
  const logged = nights
    .filter((n): n is LoggedNight => isUsableNight(n) && n.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let start = 0;
  let lastPosture: string | null = null;
  for (let i = 0; i < logged.length; i++) {
    const n = logged[i];
    if (i > 0 && sourceKey(n) !== sourceKey(logged[i - 1])) start = i;
    if (n.hrvPosture) {
      if (lastPosture && n.hrvPosture !== lastPosture) start = i;
      lastPosture = n.hrvPosture;
    }
  }
  return logged.slice(start);
}

function hrvRange(values: number[], logScale: boolean): Range {
  const m = mean(values);
  const sd = sampleSd(values);
  if (!logScale) return { mean: m, sd, low: m - HRV_SD_FACTOR * sd, high: m + HRV_SD_FACTOR * sd };
  // §8.1: ranges on ln(rMSSD), converted back. Displayed mean/SD stay in ms.
  const lns = values.map(Math.log);
  const mLn = mean(lns);
  const sdLn = sampleSd(lns);
  return { mean: m, sd, low: Math.exp(mLn - HRV_SD_FACTOR * sdLn), high: Math.exp(mLn + HRV_SD_FACTOR * sdLn) };
}

function rhrRange(values: number[]): Range | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const sd = sampleSd(values);
  return { mean: m, sd, low: m - RHR_SD_FACTOR * sd, high: m + RHR_SD_FACTOR * sd };
}

/**
 * W = logged nights among the 7 calendar nights ending `asOf` (so the label
 * can say "6 of 7 nights"); B = the 14 logged nights before W. Ranges exist
 * once B is complete; the label needs |W| ≥ 5 as well.
 */
export function computeBaseline(nights: readonly NightInput[], asOf: string, hrvLogScale: boolean): Baseline {
  const comparable = comparableNights(nights, asOf);
  const weekStart = addDays(asOf, -(WEEK_DAYS - 1));
  const week = comparable.filter(n => n.date >= weekStart);
  const before = comparable.filter(n => n.date < weekStart);
  const base = before.slice(-BASELINE_NIGHTS);
  const complete = base.length === BASELINE_NIGHTS;
  const hrv = complete ? hrvRange(base.map(n => n.hrv), hrvLogScale) : null;
  const rhr = complete ? rhrRange(base.filter(n => n.rhr != null).map(n => n.rhr as number)) : null;
  return {
    asOf,
    ready: complete && week.length >= MIN_WEEK_NIGHTS,
    week,
    base,
    hrv,
    rhr,
    hrvLogScale,
  };
}

// HRV above range or RHR below range counts as in range; it never "boosts" anything.
export function strainedHrv(x: number | null, hrv: Range | null): boolean {
  return x != null && hrv != null && x < hrv.low;
}

export function strainedRhr(x: number | null, rhr: Range | null): boolean {
  return x != null && rhr != null && x > rhr.high;
}
