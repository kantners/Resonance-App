import { describe, expect, it } from "vitest";
import { eveningAnnotation, sleepWindowError } from "../evening";

const NOW = new Date("2026-10-14T12:00:00Z");
const fast = (startedAt: string, endedAt: string | null = null) => ({ startedAt, endedAt });

describe("eveningAnnotation", () => {
  it("gap = last meal (start of the spanning fast) to sleep onset", () => {
    const a = eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T19:00:00Z", "2026-10-14T11:00:00Z")], NOW);
    expect(a.gapHours).toBe(4);
    expect(a.lateMeal).toBe(false);
    expect(a.fastHours).toBe(16);
    expect(a.longFast).toBe(false);
  });
  it("flags a late meal under 3 h, exactly 3 h is not late", () => {
    expect(eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T21:00:00Z")], NOW).lateMeal).toBe(true);
    expect(eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T20:00:00Z")], NOW).lateMeal).toBe(false);
  });
  it("marks a long fast at 20 h or more, using now while active", () => {
    const a = eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T16:00:00Z")], NOW);
    expect(a.fastHours).toBe(20);
    expect(a.longFast).toBe(true);
  });
  it("null when no fast spans onset or onset is unknown", () => {
    expect(eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T10:00:00Z", "2026-10-13T18:00:00Z")], NOW).gapHours).toBeNull();
    expect(eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-14T01:00:00Z")], NOW).gapHours).toBeNull();
    expect(eveningAnnotation(null, [fast("2026-10-13T19:00:00Z")], NOW).gapHours).toBeNull();
  });
  it("picks the latest start when fasts overlap", () => {
    const a = eveningAnnotation("2026-10-13T23:00:00Z", [fast("2026-10-13T12:00:00Z"), fast("2026-10-13T20:00:00Z")], NOW);
    expect(a.gapHours).toBe(3);
  });
});

describe("sleepWindowError", () => {
  it("accepts one end, rejects reversed or over-long windows", () => {
    expect(sleepWindowError("2026-10-13T22:00:00Z", null)).toBeNull();
    expect(sleepWindowError("2026-10-13T22:00:00Z", "2026-10-14T06:00:00Z")).toBeNull();
    expect(sleepWindowError("2026-10-14T06:00:00Z", "2026-10-13T22:00:00Z")).toMatch(/before/);
    expect(sleepWindowError("2026-10-13T00:00:00Z", "2026-10-14T06:00:00Z")).toMatch(/20 hours/);
  });
});
