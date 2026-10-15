import { describe, expect, it } from "vitest";
import { parseHeartRateMeasurement, summarizeCapture, summarizeSession, windowMean, type HrSample } from "../shared/heartRate";

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("parseHeartRateMeasurement", () => {
  it("reads an 8-bit BPM packet with no RR (watch broadcast)", () => {
    expect(parseHeartRateMeasurement(dv([0x00, 62]))).toEqual({ bpm: 62, rrMs: [], contact: "unsupported" });
  });
  it("reads a 16-bit BPM packet", () => {
    expect(parseHeartRateMeasurement(dv([0x01, 0x2c, 0x01]))?.bpm).toBe(300);
  });
  it("reads RR intervals in 1/1024 s and converts to ms", () => {
    const r = parseHeartRateMeasurement(dv([0x10, 60, 0x00, 0x04, 0x00, 0x03]))!;   // 1024 and 768 units
    expect(r.rrMs[0]).toBeCloseTo(1000, 5);
    expect(r.rrMs[1]).toBeCloseTo(750, 5);
  });
  it("skips the energy field before RR", () => {
    const r = parseHeartRateMeasurement(dv([0x18, 70, 0xff, 0xff, 0x00, 0x04]))!;
    expect(r.bpm).toBe(70);
    expect(r.rrMs).toHaveLength(1);
  });
  it("reports sensor contact", () => {
    expect(parseHeartRateMeasurement(dv([0x06, 60]))?.contact).toBe("detected");
    expect(parseHeartRateMeasurement(dv([0x04, 60]))?.contact).toBe("lost");
  });
  it("returns null for truncated packets", () => {
    expect(parseHeartRateMeasurement(dv([0x00]))).toBeNull();
    expect(parseHeartRateMeasurement(dv([0x01, 60]))).toBeNull();
  });
});

const series = (secs: number, f: (s: number) => number): HrSample[] =>
  Array.from({ length: secs + 1 }, (_, s) => ({ t: s * 1000, bpm: f(s) }));

describe("summarizeCapture", () => {
  it("finds a steady 60 bpm in a flat 5 minute capture", () => {
    const r = summarizeCapture(series(300, () => 60));
    expect(r.lowestSteadyBpm).toBe(60);
    expect(r.meanBpm).toBe(60);
    expect(r.durationS).toBe(300);
  });
  it("ignores the settling period, where HR is still high", () => {
    const r = summarizeCapture(series(300, s => (s < 60 ? 90 : 58)));
    expect(r.lowestSteadyBpm).toBe(58);
    expect(r.meanBpm).toBe(58);
  });
  it("picks the lowest steady window while HR drifts down", () => {
    const r = summarizeCapture(series(300, s => 70 - s / 30));   // 70 -> 60
    expect(r.lowestSteadyBpm!).toBeLessThan(62);
    expect(r.lowestSteadyBpm!).toBeGreaterThan(59);
  });
  it("rejects windows that are not steady", () => {
    const r = summarizeCapture(series(300, s => (s % 2 ? 50 : 80)));
    expect(r.lowestSteadyBpm).toBeNull();
  });
  it("returns null when the capture is too short", () => {
    expect(summarizeCapture(series(90, () => 60)).lowestSteadyBpm).toBeNull();
  });
  it("returns null when samples are sparse", () => {
    const sparse = series(300, () => 60).filter((_, i) => i % 5 === 0);
    expect(summarizeCapture(sparse).lowestSteadyBpm).toBeNull();
  });
  it("drops out-of-range values", () => {
    const s = series(300, () => 60); s[100].bpm = 0; s[101].bpm = 255;
    const r = summarizeCapture(s);
    expect(r.count).toBe(299);
    expect(r.lowestSteadyBpm).toBe(60);
  });
  it("handles an empty capture", () => {
    expect(summarizeCapture([])).toEqual({ count: 0, durationS: 0, meanBpm: null, lowestSteadyBpm: null });
  });
});

describe("summarizeSession", () => {
  it("reports start from the pre-roll and end from the last minute", () => {
    // 30 s at 66, then 5 minutes drifting 66 -> 54
    const smp = series(330, s => (s <= 30 ? 66 : 66 - ((s - 30) / 300) * 12));
    const r = summarizeSession(smp, 330_000);
    expect(r.startBpm).toBe(66);
    expect(r.endBpm!).toBeLessThan(57);
    expect(r.endBpm!).toBeGreaterThan(53);
    expect(r.durationS).toBe(300);
  });
  it("returns null for end when the tail has too few samples", () => {
    const smp = series(330, () => 60).filter(s => s.t < 280_000);   // sensor dropped for the last 50 s
    expect(summarizeSession(smp, 330_000).endBpm).toBeNull();
  });
  it("handles a session shorter than the pre-roll", () => {
    const r = summarizeSession(series(20, () => 60), 20_000);
    expect(r.durationS).toBe(0);
    expect(r.endBpm).toBeNull();
  });
  it("windowMean ignores out-of-range samples", () => {
    expect(windowMean([{ t: 0, bpm: 0 }, { t: 1, bpm: 60 }], 0, 10, 1)).toBe(60);
  });
});
