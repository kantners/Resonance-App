// Bluetooth LE Heart Rate Measurement parser and spot-capture summary.
// Pure TypeScript with no DOM or framework imports, so the KEWT app can copy
// this file as it is. Spec: Bluetooth GATT Heart Rate Service 0x180D,
// characteristic Heart Rate Measurement 0x2A37.

export const HR_MIN = 25;
export const HR_MAX = 230;

export type Contact = "unsupported" | "detected" | "lost";

export interface HrMeasurement {
  bpm: number;
  /** Beat-to-beat intervals in ms. Empty when the device sends BPM only (watch broadcast). */
  rrMs: number[];
  contact: Contact;
}

/** Returns null for a truncated packet. */
export function parseHeartRateMeasurement(dv: DataView): HrMeasurement | null {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint8(0);
  const wide = (flags & 0x01) !== 0;          // BPM is uint16
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  const hasEnergy = (flags & 0x08) !== 0;     // uint16 energy expended
  const hasRR = (flags & 0x10) !== 0;

  let i = 1;
  if (i + (wide ? 2 : 1) > dv.byteLength) return null;
  const bpm = wide ? dv.getUint16(i, true) : dv.getUint8(i);
  i += wide ? 2 : 1;
  if (hasEnergy) i += 2;

  const rrMs: number[] = [];
  while (hasRR && i + 1 < dv.byteLength) {
    rrMs.push((dv.getUint16(i, true) / 1024) * 1000);   // units are 1/1024 s
    i += 2;
  }
  const contact: Contact = !contactSupported ? "unsupported" : contactDetected ? "detected" : "lost";
  return { bpm, rrMs, contact };
}

export interface HrSample { t: number; bpm: number }   // t: ms since capture start

export interface CaptureSummary {
  /** Valid samples kept (after dropping out-of-range values). */
  count: number;
  /** Capture length in seconds, first to last kept sample. */
  durationS: number;
  /** Mean BPM over the samples after the settling period; null if none. */
  meanBpm: number | null;
  /** Lowest mean BPM over any steady window; null when no window qualified. */
  lowestSteadyBpm: number | null;
}

export interface SummaryOptions {
  settleS?: number;      // ignored at the start while the person settles (default 60)
  windowS?: number;      // steady window length (default 60)
  maxSpreadBpm?: number; // a window wider than this is not steady (default 10)
  minCoverage?: number;  // fraction of the window that must have samples at ~1 Hz (default 0.6)
}

export function summarizeCapture(samples: HrSample[], opts: SummaryOptions = {}): CaptureSummary {
  const { settleS = 60, windowS = 60, maxSpreadBpm = 10, minCoverage = 0.6 } = opts;
  const valid = samples.filter(s => s.bpm >= HR_MIN && s.bpm <= HR_MAX).sort((a, b) => a.t - b.t);
  const durationS = valid.length ? (valid[valid.length - 1].t - valid[0].t) / 1000 : 0;
  const kept = valid.filter(s => s.t >= settleS * 1000);
  const meanBpm = kept.length ? round1(kept.reduce((a, s) => a + s.bpm, 0) / kept.length) : null;

  let lowest: number | null = null;
  let lo = 0;
  for (let hi = 0; hi < kept.length; hi++) {
    while (kept[hi].t - kept[lo].t > windowS * 1000) lo++;
    const win = kept.slice(lo, hi + 1);
    const spanOk = kept[hi].t - kept[lo].t >= windowS * 1000 * 0.95;
    if (!spanOk || win.length < windowS * minCoverage) continue;
    const bpms = win.map(s => s.bpm);
    if (Math.max(...bpms) - Math.min(...bpms) > maxSpreadBpm) continue;
    const m = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    if (lowest == null || m < lowest) lowest = m;
  }
  return { count: valid.length, durationS: Math.round(durationS), meanBpm, lowestSteadyBpm: lowest == null ? null : round1(lowest) };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
