import { describe, expect, it } from "vitest";
import {
  addDays, computeBaseline, computeBrief, computeStatus, longGame, mean, nightsInRangeLast30,
  parseHrvLogScale, RULE_VERSION, sampleSd, type NightInput, type PriorLabel,
} from "..";
import { baselineNights, CANVAS_DATE, canvasNights, night } from "./helpers";

const D = CANVAS_DATE;

function steadyWeek(end: string, hrv = 48, rhr = 55, days = 7): NightInput[] {
  return Array.from({ length: days }, (_, i) => night(addDays(end, -days + 1 + i), hrv, rhr));
}

describe("baseline windows and ranges (§3.2)", () => {
  it("uses the sample SD (n − 1)", () => {
    expect(sampleSd([1, 2, 3, 4])).toBeCloseTo(1.2910, 4);
  });

  it("log scale: range is exp(mean_ln ± 0.5·sd_ln); displayed mean/SD stay in ms", () => {
    const nights = canvasNights();
    const b = computeBaseline(nights, D, true);
    const lns = b.base.map(n => Math.log(n.hrv));
    const m = mean(lns), sd = sampleSd(lns);
    expect(b.hrv!.low).toBeCloseTo(Math.exp(m - 0.5 * sd), 10);
    expect(b.hrv!.high).toBeCloseTo(Math.exp(m + 0.5 * sd), 10);
    expect(b.hrv!.mean).toBeCloseTo(48, 10);
    expect(b.hrv!.sd).toBeCloseTo(5, 10);
    // RHR is never log-scaled.
    expect(b.rhr!.low).toBeCloseTo(53, 10);
  });

  it("the flag parser defaults on and only explicit values turn it off", () => {
    expect(parseHrvLogScale(undefined)).toBe(true);
    expect(parseHrvLogScale("true")).toBe(true);
    expect(parseHrvLogScale("false")).toBe(false);
    expect(parseHrvLogScale("0")).toBe(false);
    expect(RULE_VERSION).toBe("2026.09-r2");
  });

  it("the label needs at least 5 of the 7 nights (B7 night count)", () => {
    const base = baselineNights(addDays(D, -6), 14, 48, 5, 55, 2);
    const fourNights = [0, 2, 4, 6].map(i => night(addDays(D, -6 + i), 48, 55));
    const fiveNights = [0, 1, 2, 4, 6].map(i => night(addDays(D, -6 + i), 48, 55));
    const s4 = computeStatus({ date: D, nights: [...base, ...fourNights], priorLabels: [], hrvLogScale: false });
    const s5 = computeStatus({ date: D, nights: [...base, ...fiveNights], priorLabels: [], hrvLogScale: false });
    expect(s4.weekLabel).toBe("building_baseline");
    expect(s4.weekNights).toBe(4);
    expect(s5.weekLabel).toBe("steady");
    expect(s5.weekNights).toBe(5);
  });

  it("nights without HRV are skipped, never imputed", () => {
    const nights = [...canvasNights(), night(addDays(D, -30), null, 50)];
    const withNull = computeBrief({ date: D, nights, priorLabels: [], tags: [], exposure: [], hrvLogScale: false });
    const without = computeBrief({ date: D, nights: canvasNights(), priorLabels: [], tags: [], exposure: [], hrvLogScale: false });
    expect(withNull.dailyStatus).toEqual(without.dailyStatus);
  });

  it("a change of HRV device restarts the baseline", () => {
    const nights = canvasNights().map(n => (n.date === D ? { ...n, hrvDevice: "Oura Gen 3" } : n));
    const s = computeStatus({ date: D, nights, priorLabels: [], hrvLogScale: false });
    expect(s.weekLabel).toBe("building_baseline");
    expect(s.baseline.base).toHaveLength(0);
    expect(s.weekNights).toBe(1);
  });
});

describe("week label and escalation (§3.3–3.4)", () => {
  const base = baselineNights(addDays(D, -6), 14, 48, 5, 55, 2);

  it("a strained 7-night average → drifting_down, level 3 even when last night is in range", () => {
    const week = steadyWeek(addDays(D, -1), 44, 55, 6);          // average below 45.5
    const nights = [...base, ...week, night(D, 48, 55)];          // last night in range
    const s = computeStatus({ date: D, nights, priorLabels: [], hrvLogScale: false });
    expect(s.weekLabel).toBe("drifting_down");
    expect(s.nightState).toBe("in_range");
    expect(s.escalationLevel).toBe(3);
  });

  it("RHR alone can strain the week", () => {
    const nights = [...base, ...steadyWeek(D, 48, 58)];
    expect(computeStatus({ date: D, nights, priorLabels: [], hrvLogScale: false }).weekLabel).toBe("drifting_down");
  });

  it("HRV above range or RHR below range never counts as strained", () => {
    const nights = [...base, ...steadyWeek(D, 70, 45)];
    const s = computeStatus({ date: D, nights, priorLabels: [], hrvLogScale: false });
    expect(s.weekLabel).toBe("steady");
    expect(s.nightState).toBe("in_range");
  });

  it("recovering: not strained now, drifting on one of the previous 7 mornings", () => {
    const nights = [...base, ...steadyWeek(D)];
    const prior: PriorLabel[] = [{ date: addDays(D, -7), weekLabel: "drifting_down" }];
    expect(computeStatus({ date: D, nights, priorLabels: prior, hrvLogScale: false }).weekLabel).toBe("recovering");
    const older: PriorLabel[] = [{ date: addDays(D, -8), weekLabel: "drifting_down" }];
    expect(computeStatus({ date: D, nights, priorLabels: older, hrvLogScale: false }).weekLabel).toBe("steady");
  });

  it("2 nights out in a row → level 2; a missing night breaks the run", () => {
    // Longer baseline so the previous night has its own full baseline too.
    const longBase = baselineNights(addDays(D, -6), 20, 48, 5, 55, 2);
    const week = [...steadyWeek(addDays(D, -2), 48, 55, 5), night(addDays(D, -1), 42, 55), night(D, 42, 55)];
    const s = computeStatus({ date: D, nights: [...longBase, ...week], priorLabels: [], hrvLogScale: false });
    expect(s.consecutiveNightsOut).toBe(2);
    expect(s.escalationLevel).toBe(2);

    const gap = [...steadyWeek(addDays(D, -3), 48, 55, 4), night(addDays(D, -2), 42, 55), night(D, 42, 55)];
    const g = computeStatus({ date: D, nights: [...longBase, ...gap], priorLabels: [], hrvLogScale: false });
    expect(g.consecutiveNightsOut).toBe(1);
    expect(g.escalationLevel).toBe(1);
  });

  it("level 4: drifting for 14+ consecutive mornings and 7-night RHR above range", () => {
    const nights = [...base, ...steadyWeek(D, 44, 58)];
    const drifting = (n: number): PriorLabel[] =>
      Array.from({ length: n }, (_, i) => ({ date: addDays(D, -1 - i), weekLabel: "drifting_down" as const }));
    const at13 = computeStatus({ date: D, nights, priorLabels: drifting(12), hrvLogScale: false });
    const at14 = computeStatus({ date: D, nights, priorLabels: drifting(13), hrvLogScale: false });
    expect(at13.driftingMornings).toBe(13);
    expect(at13.escalationLevel).toBe(3);
    expect(at14.driftingMornings).toBe(14);
    expect(at14.escalationLevel).toBe(4);
    // RHR in range → never level 4, however long the drift.
    const hrvOnly = computeStatus({ date: D, nights: [...base, ...steadyWeek(D, 44, 55)], priorLabels: drifting(20), hrvLogScale: false });
    expect(hrvOnly.escalationLevel).toBe(3);
  });

  it("level 4 wording says to talk to a clinician, plainly", () => {
    const nights = [...base, ...steadyWeek(D, 44, 58)];
    const prior = Array.from({ length: 13 }, (_, i) => ({ date: addDays(D, -1 - i), weekLabel: "drifting_down" as const }));
    const r = computeBrief({ date: D, nights, priorLabels: prior, tags: [], exposure: [], hrvLogScale: false });
    expect(r.messages.week?.body).toContain("worth raising with a clinician");
  });
});

describe("consistency and long game (§3.5)", () => {
  it("counts nights in range among the last 30 logged nights, judged against that morning's ranges", () => {
    // 20 baseline nights before the last 30, so every one of the 30 has a full baseline that morning.
    const out = addDays(D, -3);
    const nights = [
      ...baselineNights(addDays(D, -29), 20, 48, 5, 55, 2),
      ...steadyWeek(D, 48, 55, 30).map(n => (n.date === out ? night(out, 40, 55) : n)),
    ];
    const c = nightsInRangeLast30(nights, D, false);
    expect(c.logged).toBe(30);
    expect(c.inRange).toBe(29);

    // While the baseline is still building, early nights aren't judged (and aren't counted as out).
    const young = nightsInRangeLast30(canvasNights(), D, false);
    expect(young.logged).toBeLessThan(21);
    expect(young.inRange).toBeLessThanOrEqual(young.logged);
  });

  it("long game appears from 98 comparable nights and describes direction only past 0.5 SD", () => {
    const old = baselineNights(addDays(D, -90), 14, 44, 5, 57, 2);          // baseline 84 days back
    const fill = steadyWeek(addDays(D, -21), 46, 56, 70);                    // filler history
    const recent = [...baselineNights(addDays(D, -6), 14, 48, 5, 55, 2), ...steadyWeek(D, 48, 55)];
    const nights = [...old, ...fill.filter(n => n.date > addDays(D, -90) && n.date < addDays(D, -20)), ...recent];
    const lg = longGame(nights, D, false);
    expect(lg).not.toBeNull();
    expect(lg!.hrv.now).toBeCloseTo(48, 6);
    expect(lg!.hrv.direction).toBe("up");       // +4 ms > 0.5 × 5
    expect(lg!.rhr!.direction).toBe("down");     // −2 bpm > 0.5 × 2

    expect(longGame(recent, D, false)).toBeNull(); // too few nights
  });
});
