import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp } from "../app";
import type { RouteDeps } from "../routes";
import { createMemoryStorage } from "../storage/memory";

export interface Harness {
  base: string;
  storage: ReturnType<typeof createMemoryStorage>;
  app: ReturnType<typeof createApp>;
  close(): Promise<void>;
}

export async function startHarness(overrides: Partial<RouteDeps> = {}): Promise<Harness> {
  const storage = createMemoryStorage();
  let seed = 12345;
  const app = createApp({
    isProduction: false,
    sessionSecret: "test-secret",
    deps: {
      storage,
      hrvLogScale: false,
      now: () => new Date("2026-09-28T15:00:00Z"),
      // Deterministic but varied allocation RNG for tests.
      randomInt: n => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; },
      randomHex: bytes => randomBytes(bytes).toString("hex"),
      authRateLimit: { max: 1000, windowMs: 60_000 },   // the real limit has its own test
      ...overrides,
    },
  });
  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    storage: storage as any,
    app,
    close: () => new Promise(r => server.close(() => r())),
  };
}

export interface Res { status: number; body: any; text: string }

/** A client with its own cookie jar (one per user). */
export class Client {
  private cookie = "";
  constructor(private base: string) {}

  async req(method: string, path: string, body?: unknown): Promise<Res> {
    const r = await fetch(this.base + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.getSetCookie();
    if (set.length) this.cookie = set.map(c => c.split(";")[0]).join("; ");
    const text = await r.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    return { status: r.status, body: parsed, text };
  }
  get(p: string) { return this.req("GET", p); }
  post(p: string, b?: unknown) { return this.req("POST", p, b ?? {}); }
  patch(p: string, b: unknown) { return this.req("PATCH", p, b); }
  del(p: string, b?: unknown) { return this.req("DELETE", p, b); }

  async register(email: string, extra: Record<string, unknown> = {}) {
    const r = await this.post("/api/auth/register", { email, password: "correct-horse-battery", ...extra });
    if (r.status !== 200) throw new Error(`register failed: ${r.status} ${r.text}`);
    return r.body.user;
  }
}

/** Every key anywhere in a JSON value (for "never contains condition" checks). */
export function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach(x => allKeys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}
