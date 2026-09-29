// Morning posture, treated like the device (Mark, Sep 29): a reading off the
// set posture is stored and flagged but never averaged; a change of the set
// posture restarts the baseline.
import { describe, expect, it } from "vitest";
import {
  addDays, comparableNights, computeBaseline, computeStatus, diffDays, longGame, mean,
  patternCallout, screenHrvAssociation, type ExposureDay, type NightInput,
} from "..";
import { CANVAS_DATE, CANVAS_WEEK_HRV, canvasNights, night } from "./helpers";

const D = CANVAS_DATE;
const seated = (ns: NightInput[]): NightInput[] => ns.map(n => ({ ...n, hrvPosture: "seated" }));
const offPostureOn = (ns: NightInput[], date: string, hrv: number): NightInput[] =>
  ns.map(n => (n.date === date ? { ...n, hrv, hrvPosture: "face_up", hrvOffPosture: true } : n));
const status = (nights: NightInput[]) => computeStatus({ date: D, nights, priorLabels: [], hrvLogScale: false });

describe("morning posture (set once, like the device)", () => {
  it("an off-posture night in the week is left out of the week and its average", () => {
    const nights = offPostureOn(seated(canvasNights()), addDays(D, -3), 20);   // an extreme value, flagged
    const s = status(nights);
    expect(s.weekNights).toBe(6);
    expect(s.hrv7Avg).toBeCloseTo(mean(CANVAS_WEEK_HRV.filter((_, i) => i !== 3)), 10);
    expect(s.weekLabel).toBe("steady");                    // "Steady · 6 of 7 nights"
    expect(s.baseline.base).toHaveLength(14);              // it didn't restart the baseline either
  });

  it("an off-posture night doesn't count toward the 14 baseline nights", () => {
    const baseNight = addDays(D, -10);
    const nights = offPostureOn(seated(canvasNights()), baseNight, 200);
    const b = computeBaseline(nights, D, false);
    expect(b.base).toHaveLength(13);
    expect(b.base.some(n => n.date === baseNight)).toBe(false);
    expect(b.hrv).toBeNull();                               // no ranges until 14 usable nights
  });

  it("an off-posture last night is shown as noted, not judged, averaged or counted as out", () => {
    const clean = status(seated(canvasNights()));
    const s = status(offPostureOn(seated(canvasNights()), D, 30));
    expect(s.lastNightOffPosture).toBe(true);
    expect(s.lastNight).toBeNull();
    expect(s.nightState).toBe("no_data");
    expect(s.consecutiveNightsOut).toBe(0);
    expect(s.escalationLevel).toBe(0);
    expect(s.weekNights).toBe(clean.weekNights - 1);
    expect(s.consistency.logged).toBe(clean.consistency.logged - 1);
    expect(clean.lastNightOffPosture).toBe(false);
  });

  it("a flagged night is still stored input: flagging is reversible data, not deletion", () => {
    const nights = offPostureOn(seated(canvasNights()), D, 30);
    expect(nights.find(n => n.date === D)).toMatchObject({ hrv: 30, hrvPosture: "face_up", hrvOffPosture: true });
    expect(comparableNights(nights, D).some(n => n.date === D)).toBe(false);
  });

  it("changing the set posture restarts the baseline, the same as a device change", () => {
    // After a Settings change to face-up, this morning's face-up reading is in posture (not flagged).
    const nights = seated(canvasNights()).map(n => (n.date === D ? { ...n, hrvPosture: "face_up" } : n));
    const s = status(nights);
    expect(s.weekLabel).toBe("building_baseline");
    expect(s.baseline.base).toHaveLength(0);
    expect(s.weekNights).toBe(1);
    expect(comparableNights(nights, D).map(n => n.date)).toEqual([D]);
  });

  it("overnight values (no posture) mixed with seated readings don't restart anything", () => {
    const nights = seated(canvasNights()).map((n, i) => (i % 3 === 0 ? { ...n, hrvPosture: null } : n));
    const b = computeBaseline(nights, D, false);
    expect(b.base).toHaveLength(14);
    expect(b.week).toHaveLength(7);
  });

  it("a posture change among overnight values is still detected across the gap", () => {
    const nights = seated(canvasNights()).map(n =>
      n.date === addDays(D, -1) ? { ...n, hrvPosture: null } : n.date === D ? { ...n, hrvPosture: "face_up" } : n);
    expect(comparableNights(nights, D).map(n => n.date)).toEqual([D]);
  });

  it("the pattern callout and the Trends association skip off-posture nights", () => {
    const exposure: ExposureDay[] = Array.from({ length: 28 }, (_, i) => {
      const date = addDays(D, -28 + i);
      return { date, totalMin: [1, 5, 12].includes(diffDays(date, D)) ? 347 : 240 + (i % 3) * 5 };
    });
    expect(patternCallout(exposure, seated(canvasNights()), D, false).triggered).toBe(true);
    expect(patternCallout(exposure, offPostureOn(seated(canvasNights()), D, 42), D, false).triggered).toBe(false);

    const days = [{ date: addDays(D, -1), totalMin: 300 }, { date: addDays(D, -2), totalMin: 200 }];
    const withOff = offPostureOn(seated(canvasNights()), D, 42);
    expect(screenHrvAssociation(days, withOff, 21)!.pairs).toBe(1);
    expect(screenHrvAssociation(days, seated(canvasNights()), 21)!.pairs).toBe(2);
  });

  it("the long game counts only usable nights", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...night(addDays(D, -119 + i), 48, 55), hrvPosture: "seated" }));
    expect(longGame(many, D, false)).not.toBeNull();
    const flagged = many.map((n, i) => (i < 30 ? { ...n, hrvPosture: "face_up", hrvOffPosture: true } : n));
    expect(longGame(flagged, D, false)).toBeNull();          // 90 usable nights < 98
  });
});
