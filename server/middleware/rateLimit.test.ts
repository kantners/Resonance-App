import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

function call(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
  let status = 200;
  let passed = false;
  const res: any = { setHeader() {}, status(s: number) { status = s; return res; }, json() { return res; } };
  limiter({ ip } as any, res, () => { passed = true; });
  return passed ? 200 : status;
}

describe("auth rate limit (C10)", () => {
  it("allows 10 attempts per 15 minutes per IP, then returns 429, and resets after the window", () => {
    let now = 0;
    const limiter = createRateLimiter({ max: 10, windowMs: 15 * 60_000, now: () => now });
    const codes = Array.from({ length: 11 }, () => call(limiter, "1.2.3.4"));
    expect(codes.slice(0, 10).every(c => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
    expect(call(limiter, "5.6.7.8")).toBe(200);            // other IPs are independent
    now += 15 * 60_000;
    expect(call(limiter, "1.2.3.4")).toBe(200);            // window has passed
  });
});
