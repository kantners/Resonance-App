// Small, dependency-free statistics used by the rules.

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error("mean of empty set");
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n − 1), as HANDOFF §3.2 requires. */
export function sampleSd(xs: readonly number[]): number {
  if (xs.length < 2) throw new Error("sample SD needs at least 2 values");
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (xs.length - 1));
}

// Two-sided 95% critical values of Student's t (the 0.975 quantile).
const T975: Record<number, number> = {
  1: 12.7062, 2: 4.3027, 3: 3.1824, 4: 2.7764, 5: 2.5706, 6: 2.4469, 7: 2.3646,
  8: 2.3060, 9: 2.2622, 10: 2.2281, 11: 2.2010, 12: 2.1788, 13: 2.1604, 14: 2.1448,
  15: 2.1314, 16: 2.1199, 17: 2.1098, 18: 2.1009, 19: 2.0930, 20: 2.0860, 21: 2.0796,
  22: 2.0739, 23: 2.0687, 24: 2.0639, 25: 2.0595, 26: 2.0555, 27: 2.0518, 28: 2.0484,
  29: 2.0452, 30: 2.0423, 40: 2.0211, 50: 2.0086, 60: 2.0003, 80: 1.9901, 100: 1.9840,
  120: 1.9799,
};
const Z975 = 1.95996;

/** 0.975 quantile of t with `df` degrees of freedom (table; interpolated in 1/df above 30). */
export function tCritical975(df: number): number {
  if (!Number.isInteger(df) || df < 1) throw new Error(`invalid df ${df}`);
  if (T975[df] !== undefined) return T975[df];
  const keys = Object.keys(T975).map(Number).sort((a, b) => a - b);
  const hi = keys.find(k => k > df);
  const lo = [...keys].reverse().find(k => k < df)!;
  if (hi === undefined) {
    // Between 120 and infinity: interpolate towards the normal quantile in 1/df.
    const w = (1 / df) / (1 / 120);
    return Z975 + (T975[120] - Z975) * w;
  }
  const w = (1 / df - 1 / hi) / (1 / lo - 1 / hi);
  return T975[hi] + (T975[lo] - T975[hi]) * w;
}

export interface MeanCI {
  n: number;
  mean: number;
  sd: number | null;
  low: number | null;   // null when n < 2
  high: number | null;
}

/** Mean with a 95% CI from the t distribution (df = n − 1). */
export function meanCI95(xs: readonly number[]): MeanCI {
  const n = xs.length;
  if (n === 0) throw new Error("no values");
  const m = mean(xs);
  if (n < 2) return { n, mean: m, sd: null, low: null, high: null };
  const sd = sampleSd(xs);
  const half = tCritical975(n - 1) * sd / Math.sqrt(n);
  return { n, mean: m, sd, low: m - half, high: m + half };
}

/** Pearson correlation; null when undefined (fewer than 3 pairs or zero variance). */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) throw new Error("length mismatch");
  if (xs.length < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
