// Quiet metrics (HANDOFF §3.7). "Quiet" means time without the phone and
// nothing more; it does not measure calm.
import { localMinuteOfDay } from "./dates";

export interface QuietMetrics {
  source: "events" | "hourly_estimate";
  estimated: boolean;                  // true for the iOS hourly path; the UI says "estimated"
  longestQuietMin: number;
  longestQuietStart: string | null;    // ISO (events path only)
  longestQuietEnd: string | null;
  quietStretches30: number;
  quietMinutes30Total: number;
  pickups: number;
  pickupsPerWakingHour: number | null;
  pickupsAfter21: number;
  lastPickupAt: string | null;         // ISO (events path only)
  minutesLastPickupToSleep: number | null;
}

const MIN = 60_000;

/**
 * Android: pickups between wake (end of last sleep) and bedtime (start of the
 * next sleep). Gaps include wake → first pickup and last pickup → sleep.
 */
export function quietFromEvents(
  pickupsIso: readonly string[], wakeIso: string, sleepIso: string, timeZone: string,
): QuietMetrics {
  const wake = Date.parse(wakeIso);
  const sleep = Date.parse(sleepIso);
  if (!(sleep > wake)) throw new Error("sleep must be after wake");
  const pickups = pickupsIso
    .map(p => Date.parse(p))
    .filter(t => t >= wake && t <= sleep)
    .sort((a, b) => a - b);

  const points = [wake, ...pickups, sleep];
  let longest = 0, longestStart = wake, longestEnd = sleep, stretches = 0, stretchTotal = 0;
  for (let i = 1; i < points.length; i++) {
    const gapMin = (points[i] - points[i - 1]) / MIN;
    if (gapMin > longest) { longest = gapMin; longestStart = points[i - 1]; longestEnd = points[i]; }
    if (gapMin >= 30) { stretches++; stretchTotal += gapMin; }
  }

  const awakeHours = (sleep - wake) / (60 * MIN);
  const after21 = pickups.filter(t => localMinuteOfDay(new Date(t), timeZone) >= 21 * 60).length;
  const last = pickups.length ? pickups[pickups.length - 1] : null;

  return {
    source: "events",
    estimated: false,
    longestQuietMin: Math.round(longest),
    longestQuietStart: new Date(longestStart).toISOString(),
    longestQuietEnd: new Date(longestEnd).toISOString(),
    quietStretches30: stretches,
    quietMinutes30Total: Math.round(stretchTotal),
    pickups: pickups.length,
    pickupsPerWakingHour: awakeHours > 0 ? pickups.length / awakeHours : null,
    pickupsAfter21: after21,
    lastPickupAt: last != null ? new Date(last).toISOString() : null,
    minutesLastPickupToSleep: last != null ? Math.round((sleep - last) / MIN) : null,
  };
}

/**
 * iOS: the hourly pickups chart from a Screen Time screenshot. Longest quiet
 * ≈ the longest run of zero-pickup waking hours. Always labelled "estimated".
 * `wakeHour` is the first waking hour, `sleepHour` the first hour asleep
 * (e.g. 7 and 24 for 07:00–midnight).
 */
export function quietFromHourly(hourly: readonly number[], wakeHour: number, sleepHour: number): QuietMetrics {
  if (hourly.length !== 24) throw new Error("hourly pickups must have 24 entries");
  if (!(wakeHour >= 0 && sleepHour <= 24 && sleepHour > wakeHour)) throw new Error("invalid waking hours");
  let longestRun = 0, run = 0, stretches = 0, stretchTotal = 0;
  const closeRun = () => {
    if (run > 0) { stretches++; stretchTotal += run * 60; }
    run = 0;
  };
  for (let h = wakeHour; h < sleepHour; h++) {
    if (hourly[h] === 0) { run++; longestRun = Math.max(longestRun, run); }
    else closeRun();
  }
  closeRun();
  const pickups = hourly.slice(wakeHour, sleepHour).reduce((a, b) => a + b, 0);
  return {
    source: "hourly_estimate",
    estimated: true,
    longestQuietMin: longestRun * 60,
    longestQuietStart: null,
    longestQuietEnd: null,
    quietStretches30: stretches,           // every zero hour is a ≥30-minute stretch
    quietMinutes30Total: stretchTotal,
    pickups,
    pickupsPerWakingHour: pickups / (sleepHour - wakeHour),
    pickupsAfter21: hourly.slice(21, 24).reduce((a, b) => a + b, 0),
    lastPickupAt: null,
    minutesLastPickupToSleep: null,
  };
}
