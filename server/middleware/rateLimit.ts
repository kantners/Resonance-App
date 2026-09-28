import type { Request, Response, NextFunction } from "express";

// Basic in-memory, per-IP fixed-window-by-timestamps limiter. No dependency.
// Good enough for a single Railway instance; state resets on restart.
export interface RateLimitOptions {
  max: number;           // attempts allowed per window
  windowMs: number;      // window length
  now?: () => number;    // injectable clock for tests
}

export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  function prune(t: number) {
    for (const [key, times] of hits) {
      const kept = times.filter(ts => t - ts < windowMs);
      if (kept.length) hits.set(key, kept);
      else hits.delete(key);
    }
  }

  let lastPrune = 0;

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const t = now();
    if (t - lastPrune > windowMs) { prune(t); lastPrune = t; }

    const key = req.ip ?? "unknown";
    const recent = (hits.get(key) ?? []).filter(ts => t - ts < windowMs);
    if (recent.length >= max) {
      const retryAfterSec = Math.ceil((windowMs - (t - recent[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      hits.set(key, recent);
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    recent.push(t);
    hits.set(key, recent);
    next();
  };
}

// Login and register: 10 attempts per 15 minutes per IP.
export const authRateLimit = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
