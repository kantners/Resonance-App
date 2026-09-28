// Night state, week label, escalation, consistency and the long game
// (HANDOFF §3.3–3.5). Pure functions: no database, no clock, no environment.
import { addDays, diffDays } from "./dates";
import {
  type Baseline, type NightInput, type Range,
  computeBaseline, comparableNights, strainedHrv, strainedRhr,
} from "./baseline";
import { mean } from "./stats";

export type NightState = "in_range" | "one_out" | "both_out";
export type WeekLabel = "building_baseline" | "steady" | "drifting_down" | "recovering";

export interface PriorLabel {
  date: string;        // a previous morning
  weekLabel: WeekLabel;
}

function countStrains(hrv: number | null, rhr: number | null, b: Baseline): number {
  return Number(strainedHrv(hrv, b.hrv)) + Number(strainedRhr(rhr, b.rhr));
}

function toState(strains: number): NightState {
  return strains === 0 ? "in_range" : strains === 1 ? "one_out" : "both_out";
}

/**
 * The state of the night dated `date`, judged against the ranges as they
 * stood that morning (so a night's state never changes after the fact).
 * null when there is no logged night on that date or no baseline yet.
 */
export function nightStateOn(nights: readonly NightInput[], date: string, hrvLogScale: boolean): NightState | null {
  const b = computeBaseline(nights, date, hrvLogScale);
  const night = b.week.find(n => n.date === date);
  if (!night || !b.hrv) return null;
  return toState(countStrains(night.hrv, night.rhr, b));
}

/** Calendar-consecutive out-of-range nights ending on `date`; a missing night breaks the run. */
export function consecutiveNightsOut(nights: readonly NightInput[], date: string, hrvLogScale: boolean): number {
  let count = 0;
  for (let d = date; ; d = addDays(d, -1)) {
    const s = nightStateOn(nights, d, hrvLogScale);
    if (s === "one_out" || s === "both_out") count++;
    else return count;
  }
}

/** Consecutive mornings labelled drifting_down, ending today (today's label included). */
export function driftingStreak(today: WeekLabel, date: string, prior: readonly PriorLabel[]): number {
  if (today !== "drifting_down") return 0;
  const byDate = new Map(prior.map(p => [p.date, p.weekLabel]));
  let streak = 1;
  for (let d = addDays(date, -1); byDate.get(d) === "drifting_down"; d = addDays(d, -1)) streak++;
  return streak;
}

export interface Consistency {
  inRange: number;   // nights in range among the last 30 logged nights
  logged: number;    // of those, nights that could be judged (had a baseline)
}

/** §3.5 "Nights in range, last 30: n / logged". No streaks anywhere. */
export function nightsInRangeLast30(nights: readonly NightInput[], date: string, hrvLogScale: boolean): Consistency {
  const last30 = comparableNights(nights, date).slice(-30);
  let inRange = 0, logged = 0;
  for (const n of last30) {
    const s = nightStateOn(nights, n.date, hrvLogScale);
    if (s === null) continue;
    logged++;
    if (s === "in_range") inRange++;
  }
  return { inRange, logged };
}

export type Direction = "up" | "down" | "holding_steady";

export interface LongGameSignal {
  then: number;       // baseline mean 84 days earlier
  now: number;        // current baseline mean
  direction: Direction;
}

export interface LongGame {
  sinceDate: string;
  hrv: LongGameSignal;
  rhr: LongGameSignal | null;
}

export const LONG_GAME_DAYS_BACK = 84;
export const LONG_GAME_MIN_NIGHTS = 98;

function direction(then: number, now: Range): Direction {
  const diff = now.mean - then;
  // Only describe a direction if the change exceeds 0.5 × current SD.
  if (Math.abs(diff) <= 0.5 * now.sd) return "holding_steady";
  return diff > 0 ? "up" : "down";
}

/**
 * §3.5 long game: the current baseline mean against the baseline mean as of
 * 84 days earlier. Shown from 98 comparable logged nights (§8.2); both
 * baselines must come from the same HRV source and device.
 */
export function longGame(nights: readonly NightInput[], date: string, hrvLogScale: boolean): LongGame | null {
  const comparable = comparableNights(nights, date);
  if (comparable.length < LONG_GAME_MIN_NIGHTS) return null;
  const now = computeBaseline(comparable, date, hrvLogScale);
  const sinceDate = addDays(date, -LONG_GAME_DAYS_BACK);
  const then = computeBaseline(comparable, sinceDate, hrvLogScale);
  if (!now.hrv || !then.hrv) return null;
  return {
    sinceDate,
    hrv: { then: then.hrv.mean, now: now.hrv.mean, direction: direction(then.hrv.mean, now.hrv) },
    rhr: now.rhr && then.rhr
      ? { then: then.rhr.mean, now: now.rhr.mean, direction: direction(then.rhr.mean, now.rhr) }
      : null,
  };
}

export interface StatusInput {
  date: string;                       // the morning the Brief is for (client's local date)
  nights: readonly NightInput[];      // sleep_logs rows (any order, any dates)
  priorLabels: readonly PriorLabel[]; // stored daily_status labels for previous mornings
  hrvLogScale: boolean;
}

export interface Status {
  baseline: Baseline;
  lastNight: NightInput | null;       // the logged night dated `date`, if any
  hrv7Avg: number | null;
  rhr7Avg: number | null;
  weekNights: number;
  weekLabel: WeekLabel;
  nightState: NightState | "no_data";
  consecutiveNightsOut: number;
  driftingMornings: number;
  escalationLevel: 0 | 1 | 2 | 3 | 4;
  consistency: Consistency;
}

export function computeStatus({ date, nights, priorLabels, hrvLogScale }: StatusInput): Status {
  const baseline = computeBaseline(nights, date, hrvLogScale);
  const lastNight = baseline.week.find(n => n.date === date) ?? null;

  const weekHrv = baseline.week.map(n => n.hrv);
  const weekRhr = baseline.week.filter(n => n.rhr != null).map(n => n.rhr as number);
  const hrv7Avg = weekHrv.length ? mean(weekHrv) : null;
  const rhr7Avg = weekRhr.length ? mean(weekRhr) : null;

  let weekLabel: WeekLabel;
  if (!baseline.ready) {
    weekLabel = "building_baseline";
  } else if (strainedHrv(hrv7Avg, baseline.hrv) || strainedRhr(rhr7Avg, baseline.rhr)) {
    weekLabel = "drifting_down";
  } else {
    const weekAgo = addDays(date, -7);
    const recentlyDrifting = priorLabels.some(p =>
      p.weekLabel === "drifting_down" && p.date >= weekAgo && diffDays(p.date, date) >= 1);
    weekLabel = recentlyDrifting ? "recovering" : "steady";
  }

  const nightState = nightStateOn(nights, date, hrvLogScale) ?? "no_data";
  const consecutive = consecutiveNightsOut(nights, date, hrvLogScale);
  const driftingMornings = driftingStreak(weekLabel, date, priorLabels);

  // §3.4: the level is the highest one whose condition holds. Tags never change it.
  let escalationLevel: Status["escalationLevel"] = 0;
  if (weekLabel !== "building_baseline") {
    if (consecutive >= 1) escalationLevel = 1;
    if (consecutive >= 2) escalationLevel = 2;
    if (weekLabel === "drifting_down") escalationLevel = 3;
    if (weekLabel === "drifting_down" && driftingMornings >= 14 && strainedRhr(rhr7Avg, baseline.rhr)) {
      escalationLevel = 4;
    }
  }

  return {
    baseline,
    lastNight,
    hrv7Avg,
    rhr7Avg,
    weekNights: baseline.week.length,
    weekLabel,
    nightState,
    consecutiveNightsOut: consecutive,
    driftingMornings,
    escalationLevel,
    consistency: nightsInRangeLast30(nights, date, hrvLogScale),
  };
}
