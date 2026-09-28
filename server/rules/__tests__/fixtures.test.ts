// HANDOFF §7: the fixtures taken from the canvas. These must pass before any UI work.
// The route fixtures (409 before pre-reading; no `condition` for the client
// role) are in server/__tests__/study-routes.test.ts.
import { describe, expect, it } from "vitest";
import { computeBrief, contrastFromPairs, round1 } from "..";
import { CANVAS_DATE, canvasNights } from "./helpers";

const linear = { priorLabels: [], tags: [], exposure: [], hrvLogScale: false } as const;

describe("HANDOFF §7 fixtures (linear-scale path)", () => {
  it("baseline 48±5 / 55±2 with the canvas week → steady, 48.6 and 55.1", () => {
    const { dailyStatus: s } = computeBrief({ ...linear, date: CANVAS_DATE, nights: canvasNights() });
    expect(s.weekLabel).toBe("steady");
    expect(round1(s.hrv7Avg!)).toBe(48.6);
    expect(round1(s.rhr7Avg!)).toBe(55.1);
    // The Recovery-Rule screen's ranges: 45.5–50.5 ms and 53–57 bpm.
    expect(s.hrvRangeLow).toBeCloseTo(45.5, 6);
    expect(s.hrvRangeHigh).toBeCloseTo(50.5, 6);
    expect(s.rhrRangeLow).toBeCloseTo(53, 6);
    expect(s.rhrRangeHigh).toBeCloseTo(57, 6);
    expect(s.weekNights).toBe(7);
  });

  it("last night HRV 42, RHR 58 after an in-range night → both_out, 1 night out, level 1", () => {
    const { dailyStatus: s, messages } = computeBrief({ ...linear, date: CANVAS_DATE, nights: canvasNights() });
    expect(s.nightState).toBe("both_out");
    expect(s.consecutiveNightsOut).toBe(1);
    expect(s.escalationLevel).toBe(1);
    expect(messages.lastNight?.title).toBe("Noted");
    expect(messages.lastNight?.body).toContain("HRV 42 ms, resting HR 58 bpm");
  });

  it("13 nights of baseline → building_baseline", () => {
    const { dailyStatus: s } = computeBrief({ ...linear, date: CANVAS_DATE, nights: canvasNights(13) });
    expect(s.weekLabel).toBe("building_baseline");
    expect(s.baselineNights).toBe(13);
    expect(s.escalationLevel).toBe(0);
  });

  it("hard_workout tag on a both-out night → same level, 'expected' wording, same averages", () => {
    const plain = computeBrief({ ...linear, date: CANVAS_DATE, nights: canvasNights() });
    const tagged = computeBrief({ ...linear, date: CANVAS_DATE, nights: canvasNights(), tags: ["hard_workout"] });
    expect(tagged.dailyStatus).toEqual(plain.dailyStatus);
    expect(tagged.dailyStatus.escalationLevel).toBe(1);
    expect(tagged.messages.lastNight?.title).toMatch(/expected/i);
    expect(tagged.messages.lastNight?.body).toMatch(/expected/i);
  });

  it("study pairs (B, A) → mean d +0.67, 95% CI ≈ −1.9 to +3.2, 'Too early to tell'", () => {
    const pairsBA = [[5, 7], [8, 8], [3, 6], [7, 6], [6, 9], [9, 6]];
    const c = contrastFromPairs("A-B", pairsBA.map(([b, a]) => a - b), "linear", 12);
    expect(c.ci!.n).toBe(6);
    expect(c.ci!.mean).toBeCloseTo(0.667, 3);
    expect(c.ci!.low).toBeCloseTo(-1.88, 2);
    expect(c.ci!.high).toBeCloseTo(3.21, 2);
    expect(c.verdict).toBe("too_early");
    expect(c.verdictText).toBe("Too early to tell.");
    // The Study screen's line: three rose, one unchanged, two fell.
    expect([c.rose, c.unchanged, c.fell]).toEqual([3, 1, 2]);
  });
});
