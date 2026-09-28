import { describe, expect, it } from "vitest";
import {
  addDays, computeBrief, diffDays, isValidDate, localDateOf, localMinuteOfDay,
  patternCallout, quietFromEvents, quietFromHourly, screenHrvAssociation, type ExposureDay,
} from "..";
import { CANVAS_DATE, canvasNights } from "./helpers";

const D = CANVAS_DATE;

/** 28 days ending yesterday at ~4h, with a few high days and yesterday high. */
function exposure(highOffsets: number[]): ExposureDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(D, -28 + i);
    const offset = diffDays(date, D);             // 28..1
    return { date, totalMin: highOffsets.includes(offset) ? 347 : 240 + (i % 3) * 5 };
  });
}

describe("pattern callout (§3.6)", () => {
  it("triggers when yesterday was high-exposure and this morning's HRV is below range", () => {
    const p = patternCallout(exposure([1, 5, 12]), canvasNights(), D, false);
    expect(p.triggered).toBe(true);
    expect(p.yesterdayMin).toBe(347);
    expect(p.highExposureDays).toBe(3);
    expect(p.seenAfter).toBeGreaterThanOrEqual(1);          // at least this morning
    expect(p.seenAfter).toBeLessThanOrEqual(p.highExposureDays);
    expect(p.hrvDiffFromBaselineMs).toBeCloseTo(42 - 48, 6);
    expect(p.caveat).toBe("An association, not a diagnosis.");
  });

  it("doesn't trigger when yesterday was ordinary", () => {
    expect(patternCallout(exposure([5, 12]), canvasNights(), D, false).triggered).toBe(false);
  });

  it("needs at least 7 exposure days for a threshold", () => {
    const few = exposure([1]).slice(-6);
    expect(patternCallout(few, canvasNights(), D, false).triggered).toBe(false);
  });

  it("level 2 names the pattern only when every out night followed a high-exposure day", () => {
    // The canvas week, but the night before last is also out (42 ms / 58 bpm). 16 baseline
    // nights so that night also has a full baseline of its own that morning.
    const nights = canvasNights(16).map(n => (n.date === addDays(D, -1) ? { ...n, hrv: 42, rhr: 58 } : n));
    const withHigh = computeBrief({ date: D, nights, priorLabels: [], tags: [], exposure: exposure([1, 2]), hrvLogScale: false });
    expect(withHigh.dailyStatus.escalationLevel).toBeGreaterThanOrEqual(2);
    expect(withHigh.messages.lastNight?.body).toContain("followed high screen-time days");
    const without = computeBrief({ date: D, nights, priorLabels: [], tags: [], exposure: exposure([1]), hrvLogScale: false });
    expect(without.messages.lastNight?.body).not.toContain("screen-time");
  });

  it("Trends association is withheld below 21 logged nights", () => {
    expect(screenHrvAssociation(exposure([1]), canvasNights(), 20)).toBeNull();
    expect(screenHrvAssociation(exposure([1]), canvasNights(), 21)).not.toBeNull();
  });
});

describe("quiet metrics (§3.7)", () => {
  const tz = "America/New_York";

  it("Android events: gaps include wake → first pickup and last pickup → sleep", () => {
    // Awake 06:40–23:52 EDT (UTC−4). Pickups at 07:04, 08:57, 21:30, 23:50.
    const q = quietFromEvents(
      ["2026-09-24T11:04:00Z", "2026-09-24T12:57:00Z", "2026-09-25T01:30:00Z", "2026-09-25T03:50:00Z"],
      "2026-09-24T10:40:00Z", "2026-09-25T03:52:00Z", tz,
    );
    expect(q.pickups).toBe(4);
    expect(q.longestQuietMin).toBe(12 * 60 + 33);           // 08:57 → 21:30
    expect(q.quietStretches30).toBe(3);                      // 07:04–08:57, 08:57–21:30, 21:30–23:50
    expect(q.pickupsAfter21).toBe(2);
    expect(q.minutesLastPickupToSleep).toBe(2);
    expect(q.estimated).toBe(false);
  });

  it("iOS hourly: longest run of zero-pickup waking hours, labelled estimated", () => {
    const hourly = Array(24).fill(0);
    [7, 8, 12, 13, 14, 20, 21, 22].forEach(h => (hourly[h] = 3));
    const q = quietFromHourly(hourly, 7, 24);
    expect(q.estimated).toBe(true);
    expect(q.longestQuietMin).toBe(5 * 60);                  // 15:00–20:00
    expect(q.pickupsAfter21).toBe(6);
    expect(q.pickups).toBe(24);
  });
});

describe("dates come from the client, never the server clock (B6)", () => {
  it("a 21:30 entry in New York is 01:30 UTC the next day but belongs to the local date", () => {
    const instant = "2026-09-25T01:30:00Z";
    expect(instant.slice(0, 10)).toBe("2026-09-25");        // what a UTC server would say
    expect(localDateOf(instant, "America/New_York")).toBe("2026-09-24");
    expect(localMinuteOfDay(instant, "America/New_York")).toBe(21 * 60 + 30);
  });

  it("calendar arithmetic ignores DST and rejects impossible dates", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");      // US DST ends Nov 1
    expect(addDays("2026-03-08", -1)).toBe("2026-03-07");
    expect(diffDays("2026-09-01", "2026-09-25")).toBe(24);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-09-25")).toBe(true);
  });
});
