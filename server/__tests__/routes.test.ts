import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STUDY_TEMPLATES } from "@shared/studyTemplates";
import { addDays, verifyAllocation, RULE_VERSION } from "../rules";
import { PUBLIC_API_ROUTES } from "../routes";
import { allKeys, Client, startHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.close(); });

const DEVICE = "Polar H10 + Elite HRV";
const template = STUDY_TEMPLATES.find(t => t.key === "intention_vs_touch")!;

function protocolBody(extra: Record<string, unknown> = {}) {
  return {
    question: template.question,
    primaryOutcome: template.primaryOutcome,
    primaryContrast: template.primaryContrast,
    secondaryContrast: template.secondaryContrast,
    conditions: template.conditions,
    targetClients: 12,
    commitmentText: "I can withhold intention.",
    withholdingProcedure: "Okay, turn off my Reiki transmission.",
    readingDevice: DEVICE,
    analysisScale: "linear",
    ...extra,
  };
}

const reading = (rmssdMs: number, posture = "face_up", readingDevice = DEVICE) =>
  ({ takenAt: "2026-09-28T14:00:00-04:00", rmssdMs, hrBpm: 60, posture, readingDevice });

async function practitioner(email: string, extra: Record<string, unknown> = {}) {
  const c = new Client(h.base);
  await c.register(email, extra);
  expect((await c.post("/api/practitioner", {})).status).toBe(200);
  return c;
}

async function lockedProtocol(p: Client, extra: Record<string, unknown> = {}) {
  const created = await p.post("/api/study/protocols", protocolBody(extra));
  expect(created.status).toBe(201);
  const locked = await p.post(`/api/study/protocols/${created.body.id}/lock`);
  expect(locked.status).toBe(200);
  return locked.body;
}

async function enrolledClient(email: string, protocolId: number, extra: Record<string, unknown> = {}) {
  const c = new Client(h.base);
  await c.register(email, extra);
  const r = await c.post("/api/study/enrollments", { protocolId, consentVersion: "1", touchProfile: { back: "hands_on", front: "hovering" } });
  expect(r.status).toBe(201);
  const mine = await c.get("/api/study/enrollments/mine");
  const entry = mine.body.find((m: any) => m.enrollment.protocolId === protocolId);
  return { c, enrollmentId: r.body.enrollmentId as number, clientCode: r.body.clientCode as string, sessions: entry.sessions as any[] };
}

// ─── Every route requires auth ─────────────────────────────────────────────
describe("authentication", () => {
  function registeredRoutes(): { method: string; path: string; handlers: string[] }[] {
    const stack = (h.app as any).router.stack as any[];
    return stack.filter(l => l.route).flatMap(l =>
      Object.keys(l.route.methods).map(m => ({
        method: m.toUpperCase(),
        path: l.route.path as string,
        handlers: l.route.stack.map((s: any) => s.handle?.name ?? s.name),
      })));
  }

  it("every route except the public auth routes and /api/health carries requireAuth", () => {
    const routes = registeredRoutes();
    expect(routes.length).toBeGreaterThan(30);
    const missing = routes.filter(r => !PUBLIC_API_ROUTES.includes(`${r.method} ${r.path}`) && !r.handlers.includes("requireAuth"));
    expect(missing).toEqual([]);
  });

  it("every non-public route returns 401 without a session", async () => {
    const anon = new Client(h.base);
    for (const r of registeredRoutes()) {
      if (PUBLIC_API_ROUTES.includes(`${r.method} ${r.path}`)) continue;
      const path = r.path.replace(":date", "2026-09-25").replace(/:[a-zA-Z]+/g, "1");
      const res = await anon.req(r.method, path, r.method === "GET" ? undefined : {});
      expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({ route: `${r.method} ${r.path}`, status: 401 });
    }
  });

  it("the default login limit returns 429 on the 11th attempt in the window (C10)", async () => {
    const limited = await startHarness({ authRateLimit: undefined });
    try {
      const c = new Client(limited.base);
      const codes: number[] = [];
      for (let i = 0; i < 11; i++) codes.push((await c.post("/api/auth/login", { email: "x@y.z", password: "nope" })).status);
      expect(codes.slice(0, 10).every(s => s === 401)).toBe(true);
      expect(codes[10]).toBe(429);
    } finally { await limited.close(); }
  });
});

// ─── /api/health (C12) ─────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("is public and returns only { ok, ruleVersion }", async () => {
    const r = await new Client(h.base).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, ruleVersion: RULE_VERSION });
  });

  it("returns 503 with no database details when the ping fails", async () => {
    const broken = await startHarness();
    broken.storage.ping = async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret"); };
    try {
      const r = await new Client(broken.base).get("/api/health");
      expect(r.status).toBe(503);
      expect(r.body).toEqual({ ok: false, ruleVersion: RULE_VERSION });
      expect(r.text).not.toMatch(/ECONNREFUSED|5432|secret/);
    } finally { await broken.close(); }
  });
});

// ─── Daily data: sources and client dates ──────────────────────────────────
describe("daily data", () => {
  it("an HRV value needs its source; a saved default device fills it in", async () => {
    const c = new Client(h.base);
    await c.register("sleeper@example.com");
    const noSource = await c.post("/api/sleep", { date: "2026-09-24", hrv: 48, restingHr: 55 });
    expect(noSource.status).toBe(400);
    expect((await c.patch("/api/settings", { defaultHrvDevice: DEVICE, timeZone: "America/New_York" })).status).toBe(200);
    const ok = await c.post("/api/sleep", { date: "2026-09-24", hrv: 48, restingHr: 55 });
    expect(ok.status).toBe(200);
    expect(ok.body.hrvDevice).toBe(DEVICE);
    expect((await c.post("/api/sleep", { date: "2026-09-24", hrv: 48, hrvSource: "camera", hrvDevice: "x" })).status).toBe(400);
  });

  it("stores entries under the client's local date, not the server's UTC date (B6)", async () => {
    const c = new Client(h.base);
    await c.register("night-owl@example.com", { timeZone: "America/New_York" });
    // 21:30 in New York on Sep 24 is 01:30 UTC on Sep 25.
    const r = await c.post("/api/morning-readings", {
      date: "2026-09-24", takenAt: "2026-09-24T21:30:00-04:00", rmssdMs: 51, heartRateBpm: 58, hrvDevice: "HRV4Training",
    });
    expect(r.status).toBe(200);
    expect(r.body.sleep.date).toBe("2026-09-24");
    expect(r.body.sleep.hrv).toBe(51);
    expect(r.body.sleep.hrvDevice).toBe("HRV4Training");
    const stillness = await c.post("/api/stillness", {
      date: "2026-09-24", startedAt: "2026-09-25T01:30:00Z", minutes: 10, type: "breathwork", phoneLocation: "another_room",
    });
    expect(stillness.status).toBe(200);
    expect(stillness.body.date).toBe("2026-09-24");
    expect((await c.get("/api/stillness?from=2026-09-24&to=2026-09-24")).body.stillness).toHaveLength(1);
    expect((await c.post("/api/sleep", { date: "2026-02-30", hours: 7 })).status).toBe(400);
  });

  it("morning posture: set once; an off-posture reading is stored and flagged, never replacing a usable one", async () => {
    const c = new Client(h.base);
    await c.register("posture@example.com");
    await c.patch("/api/settings", { defaultHrvDevice: DEVICE });
    const read = (date: string, rmssdMs: number, posture: string) => c.post("/api/morning-readings",
      { date, takenAt: `${date}T07:00:00-04:00`, rmssdMs, heartRateBpm: 60, posture });

    // No set posture yet: the first reading's posture becomes it.
    expect((await read("2026-09-20", 48, "seated")).body.offPosture).toBe(false);
    expect((await c.get("/api/me")).body.hrvPosture).toBe("seated");

    // A face-up reading on a new night: stored, flagged on the reading and the night.
    const off = await read("2026-09-21", 60, "face_up");
    expect(off.body).toMatchObject({ offPosture: true, reading: { posture: "face_up", offPosture: true } });
    expect(off.body.sleep).toMatchObject({ hrv: 60, hrvPosture: "face_up", hrvOffPosture: true });
    const brief = await c.get("/api/brief/2026-09-21");
    expect(brief.body.lastNight).toMatchObject({ hrv: 60, offPosture: true, hrvPosture: "face_up", state: "no_data" });
    expect(brief.body.firstRun.nightsLogged).toBe(1);        // only the seated night counts

    // Same night, seated reading first, then face-up: the usable value stays.
    await read("2026-09-22", 47, "seated");
    const late = await read("2026-09-22", 70, "face_up");
    expect(late.body.offPosture).toBe(true);
    expect(late.body.sleep).toMatchObject({ hrv: 47, hrvOffPosture: false });

    // Settings: morning postures only; after a change, face-up is in posture.
    expect((await c.patch("/api/settings", { hrvPosture: "face_down" })).status).toBe(400);
    expect((await c.patch("/api/settings", { hrvPosture: "face_up" })).body.hrvPosture).toBe("face_up");
    expect((await read("2026-09-23", 55, "face_up")).body.offPosture).toBe(false);
    // An overnight HRV typed on the Sleep screen carries no posture and clears the flag.
    const overnight = await c.post("/api/sleep", { date: "2026-09-21", hrv: 49 });
    expect(overnight.body).toMatchObject({ hrv: 49, hrvPosture: null, hrvOffPosture: false });
  });

  it("stillness rules: reiki needs a role, app reading is never stillness", async () => {
    const c = new Client(h.base);
    await c.register("still@example.com");
    const base = { date: "2026-09-24", startedAt: "2026-09-24T15:10:00-04:00", minutes: 10, phoneLocation: "nearby_silenced" };
    expect((await c.post("/api/stillness", { ...base, type: "reiki" })).status).toBe(400);
    expect((await c.post("/api/stillness", { ...base, type: "reading", readingMedium: "app" })).status).toBe(400);
    expect((await c.post("/api/stillness", { ...base, type: "align", postureStyle: "gassho" })).status).toBe(200);
  });

  it("the Brief follows the canvas and stores its rule version and flag (B5)", async () => {
    const c = new Client(h.base);
    const user = await c.register("brief@example.com");
    await c.patch("/api/settings", { defaultHrvDevice: DEVICE });
    const D = "2026-09-25";
    const k = Math.sqrt(13 / 14);
    for (let i = 0; i < 14; i++) {
      const s = i % 2 ? 1 : -1;
      await c.post("/api/sleep", { date: addDays(D, -20 + i), hrv: 48 + s * 5 * k, restingHr: Math.round(55 + s * 2) });
    }
    const wh = [51, 44, 47, 54, 49, 53, 42], wr = [54, 57, 55, 53, 55, 54, 58];
    for (let i = 0; i < 7; i++) await c.post("/api/sleep", { date: addDays(D, -6 + i), hrv: wh[i], restingHr: wr[i], sleepScore: 71 });
    await c.post(`/api/nights/${D}/tags`, { tags: ["hard_workout"] });

    const r = await c.get(`/api/brief/${D}`);
    expect(r.status).toBe(200);
    expect(r.body.week.label).toBe("steady");
    expect(r.body.week.nights).toBe(7);
    expect(r.body.week.hrv7Avg).toBeCloseTo(48.57, 2);
    expect(r.body.lastNight.state).toBe("both_out");
    expect(r.body.lastNight.tags).toEqual(["hard_workout"]);
    expect(r.body.lastNight.message.title).toMatch(/expected/i);
    expect(r.body.ruleVersion).toBe(RULE_VERSION);

    const stored = await h.storage.listDailyStatus(user.id, D, D, RULE_VERSION, false);
    expect(stored).toHaveLength(1);
    expect(stored[0].ruleVersion).toBe(RULE_VERSION);
    expect(stored[0].hrvLogScale).toBe(false);
    expect(stored[0].weekNights).toBe(7);
  });
});

// ─── Session Study ─────────────────────────────────────────────────────────
describe("Session Study", () => {
  it("lock requires the withholding procedure and a reading device; locked protocols are immutable", async () => {
    const p = await practitioner("prac-lock@example.com");
    const draft = await p.post("/api/study/protocols", protocolBody({ withholdingProcedure: "", readingDevice: null }));
    expect(draft.status).toBe(201);
    expect((await p.post(`/api/study/protocols/${draft.body.id}/lock`)).status).toBe(400);
    await p.patch(`/api/study/protocols/${draft.body.id}`, { withholdingProcedure: "Okay, turn off my Reiki transmission." });
    expect((await p.post(`/api/study/protocols/${draft.body.id}/lock`)).status).toBe(400);   // still no device
    await p.patch(`/api/study/protocols/${draft.body.id}`, { readingDevice: DEVICE });
    const locked = await p.post(`/api/study/protocols/${draft.body.id}/lock`);
    expect(locked.status).toBe(200);
    expect(locked.body.allocationSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(locked.body.analysisScale).toBe("linear");
    expect(locked.body.allocationList).toBeUndefined();
    expect((await p.post(`/api/study/protocols/${draft.body.id}/lock`)).status).toBe(409);
    expect((await p.patch(`/api/study/protocols/${draft.body.id}`, { question: "Changed?" })).status).toBe(409);
    const v2 = await p.post("/api/study/protocols", protocolBody({ supersedesId: draft.body.id }));
    expect(v2.body.version).toBe(2);
  });

  it("contrasts are fixed at lock and printed in the methods export, like the analysis scale", async () => {
    const p = await practitioner("prac-contrast@example.com");
    const protocol = await lockedProtocol(p);
    expect((await p.patch(`/api/study/protocols/${protocol.id}`, { primaryContrast: "B-C" })).status).toBe(409);
    expect((await p.patch(`/api/study/protocols/${protocol.id}`, { secondaryContrast: "A-C" })).status).toBe(409);
    expect((await p.patch(`/api/study/protocols/${protocol.id}`, { analysisScale: "ln" })).status).toBe(409);
    const methods = (await p.get(`/api/study/protocols/${protocol.id}/export?part=methods`)).text;
    expect(methods).toContain("Primary contrast (fixed at lock): A-B");
    expect(methods).toContain("Secondary contrast (fixed at lock): B-C");
    expect(methods).not.toContain("exploratory");
  });

  it("factorial with the optional rest arm: rest comparisons are exploratory; the primary can't use rest", async () => {
    const f = STUDY_TEMPLATES.find(t => t.key === "deck_factorial")!;
    const p = await practitioner("prac-factorial@example.com");
    const body = (extra: Record<string, unknown>) => protocolBody({
      question: f.question, primaryContrast: f.primaryContrast, secondaryContrast: f.secondaryContrast,
      conditions: [...f.conditions, f.optionalArm], targetClients: 4, ...extra,
    });
    expect((await p.post("/api/study/protocols", body({ primaryContrast: "C-D" }))).status).toBe(400);
    const created = await p.post("/api/study/protocols", body({ secondaryContrast: "C-D" }));
    expect(created.status).toBe(201);
    const locked = await p.post(`/api/study/protocols/${created.body.id}/lock`);
    expect(locked.status).toBe(200);
    expect((await p.post(`/api/study/protocols/${created.body.id}/complete`)).status).toBe(200);   // results unlock at completion

    const r = await p.get(`/api/study/protocols/${created.body.id}/results`);
    expect(r.body.primary.contrast).toBe("C-A");
    expect(r.body.primary.exploratory).toBe(false);
    expect(r.body.secondary).toMatchObject({ contrast: "C-D", exploratory: true });
    expect(r.body.exploratory.map((c: any) => c.contrast)).toEqual(["A-D", "B-D"]);
    expect(r.body.exploratory.every((c: any) => c.exploratory)).toBe(true);

    const methods = (await p.get(`/api/study/protocols/${created.body.id}/export?part=methods`)).text;
    expect(methods).toContain("D: Rest (touch no, intention withheld, breath pacing no) [optional arm]");
    expect(methods).toContain("Secondary contrast (fixed at lock): C-D (exploratory)");
    expect(methods).toContain("Exploratory contrasts (comparisons with the optional arm; not confirmatory): A-D, B-D");
    const results = (await p.get(`/api/study/protocols/${created.body.id}/export?part=results`)).text;
    expect(results).toContain("secondary (exploratory),C-D");
    expect(results).toContain("exploratory,A-D");
  });

  it("no enrollment before lock; non-practitioners can't create protocols", async () => {
    const p = await practitioner("prac-draft@example.com");
    const draft = await p.post("/api/study/protocols", protocolBody());
    const c = new Client(h.base);
    await c.register("early@example.com");
    const r = await c.post("/api/study/enrollments", { protocolId: draft.body.id, consentVersion: "1", touchProfile: { back: "hands_on" } });
    expect(r.status).toBe(409);
    expect((await c.post("/api/study/protocols", protocolBody())).status).toBe(403);
  });

  it("§7: POST /start before the pre-reading → 409; the full session order holds", async () => {
    const p = await practitioner("prac-flow@example.com");
    const protocol = await lockedProtocol(p);
    const { c, sessions } = await enrolledClient("client-flow@example.com", protocol.id);
    const [s1, s2] = sessions;

    // Before anything: 409.
    expect((await p.post(`/api/study/sessions/${s1.id}/start`)).status).toBe(409);
    // A seated pre-reading isn't enough: it must be face-up.
    await c.patch(`/api/study/sessions/${s1.id}/client`, { preReading: reading(46, "seated") });
    expect((await p.post(`/api/study/sessions/${s1.id}/start`)).status).toBe(409);
    // The client can't post the after-reading or a guess before the session.
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { postReading: reading(52) })).status).toBe(409);
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { clientGuess: "A" })).status).toBe(409);

    await c.patch(`/api/study/sessions/${s1.id}/client`, { preReading: reading(46), relaxPre: 4 });
    const start = await p.post(`/api/study/sessions/${s1.id}/start`);
    expect(start.status).toBe(200);
    expect(["A", "B", "C"]).toContain(start.body.condition);
    if (start.body.condition !== "A") expect(start.body.withholdingProcedure).toMatch(/turn off/);
    else expect(start.body.withholdingProcedure).toBeUndefined();

    // Pre-reading is frozen once revealed.
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { preReading: reading(40) })).status).toBe(409);
    // The client's guess is rejected without the post-reading (§4.3).
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { clientGuess: "A" })).status).toBe(409);
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { postReading: reading(52), relaxPost: 7 })).status).toBe(200);
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { clientGuess: "reiki" })).status).toBe(400);   // arm codes only
    expect((await c.patch(`/api/study/sessions/${s1.id}/client`, { clientGuess: "not_sure" })).status).toBe(200);

    // Practitioner records the session; the practitioner can't post readings or guesses.
    expect((await p.patch(`/api/study/sessions/${s1.id}`, { clientGuess: "A" })).status).toBe(400);
    const done = await p.patch(`/api/study/sessions/${s1.id}`, { intentionHeldRating: 9, driftCount: 1, closingReikiGiven: true, completed: true });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBeTruthy();
    expect(done.body.clientGuess).toBe("not_sure");                  // visible once complete

    // Practitioner fields are the practitioner's only; client fields the client's only.
    expect((await c.patch(`/api/study/sessions/${s2.id}`, { driftCount: 3 })).status).toBe(404);
    expect((await p.patch(`/api/study/sessions/${s2.id}/client`, { relaxPre: 5 })).status).toBe(404);
  });

  it("§7 + §4.3: a client-role GET never contains `condition`, before or after the reveal", async () => {
    const p = await practitioner("prac-conceal@example.com");
    const protocol = await lockedProtocol(p);
    const { c, sessions } = await enrolledClient("client-conceal@example.com", protocol.id);
    const sid = sessions[0].id;
    const forbiddenKeys = ["condition", "conditionSequence", "sequenceBlock", "allocationIndex", "allocationList", "conditionRevealedAt"];

    const check = async () => {
      for (const path of [`/api/study/sessions/${sid}`, "/api/study/enrollments/mine", `/api/study/invite/${protocol.id}`]) {
        const r = await c.get(path);
        expect(r.status).toBe(200);
        const keys = allKeys(r.body);
        for (const k of forbiddenKeys) expect({ path, key: k, present: keys.has(k) }).toEqual({ path, key: k, present: false });
      }
    };
    await check();
    await c.patch(`/api/study/sessions/${sid}/client`, { preReading: reading(46) });
    await p.post(`/api/study/sessions/${sid}/start`);
    await c.patch(`/api/study/sessions/${sid}/client`, { postReading: reading(52) });
    await check();
    // The client can't reach the protocol's practitioner routes either.
    expect((await c.get(`/api/study/protocols/${protocol.id}`)).status).toBe(403);
    expect((await c.get(`/api/study/protocols/${protocol.id}/sessions`)).status).toBe(403);
  });

  it("A4: before /start, the practitioner's session, protocol and session-list GETs show no condition", async () => {
    const p = await practitioner("prac-a4@example.com");
    const protocol = await lockedProtocol(p);
    const { c, sessions } = await enrolledClient("client-a4@example.com", protocol.id);
    const [s1, s2, s3] = sessions;

    const conditionsIn = async () => ({
      session: allKeys((await p.get(`/api/study/sessions/${s1.id}`)).body).has("condition"),
      protocol: [...allKeys((await p.get(`/api/study/protocols/${protocol.id}`)).body)]
        .filter(k => ["condition", "conditionSequence", "allocationList", "allocationNonce"].includes(k)),
      list: (await p.get(`/api/study/protocols/${protocol.id}/sessions`)).body.map((s: any) => s.condition ?? null),
    });

    const before = await conditionsIn();
    expect(before).toEqual({ session: false, protocol: [], list: [null, null, null] });

    await c.patch(`/api/study/sessions/${s1.id}/client`, { preReading: reading(46) });
    // The pre-reading alone reveals nothing.
    expect((await conditionsIn()).list).toEqual([null, null, null]);

    const start = await p.post(`/api/study/sessions/${s1.id}/start`);
    const after = await conditionsIn();
    expect(after.session).toBe(true);
    expect(after.protocol).toEqual([]);
    // Only the started session; future sessions stay hidden.
    expect(after.list).toEqual([start.body.condition, null, null]);
    expect(allKeys((await p.get(`/api/study/sessions/${s2.id}`)).body).has("condition")).toBe(false);
    expect(allKeys((await p.get(`/api/study/sessions/${s3.id}`)).body).has("condition")).toBe(false);
    // Nor do results or the export expose an unrevealed condition: mid-study, the
    // sessions export and the contrasts are withheld entirely (no interim peeking).
    const exp = await p.get(`/api/study/protocols/${protocol.id}/export?part=sessions`);
    expect(exp.text.trim()).toBe("Results unlock when the study is complete (prevents interim peeking).");
    const res = await p.get(`/api/study/protocols/${protocol.id}/results`);
    expect(allKeys(res.body).has("condition")).toBe(false);
    expect(res.body.clientDeltas).toEqual([]);
  });

  it("outcome-blind: practitioner session views show 'recorded' with time and device, no values, until completion", async () => {
    const p = await practitioner("prac-blind@example.com");
    const protocol = await lockedProtocol(p);
    const { c, sessions } = await enrolledClient("client-blind@example.com", protocol.id);
    const [s1, s2] = sessions;
    const VALUE_KEYS = ["preRmssdMs", "preHrBpm", "preBreathsPerMin", "postRmssdMs", "postHrBpm", "postBreathsPerMin", "relaxPre", "relaxPost"];
    const valueKeysIn = (body: unknown) => VALUE_KEYS.filter(k => allKeys(body).has(k));

    await c.patch(`/api/study/sessions/${s1.id}/client`, { preReading: reading(46), relaxPre: 4 });
    await p.post(`/api/study/sessions/${s1.id}/start`);
    await c.patch(`/api/study/sessions/${s1.id}/client`, { postReading: reading(52), relaxPost: 7, clientGuess: "not_sure" });
    const patched = await p.patch(`/api/study/sessions/${s1.id}`, { intentionHeldRating: 9, completed: true });

    // Mid-study, every practitioner view of sessions: the session, the list, the PATCH reply, the export.
    const one = await p.get(`/api/study/sessions/${s1.id}`);
    const list = await p.get(`/api/study/protocols/${protocol.id}/sessions`);
    for (const body of [one.body, list.body, patched.body]) expect(valueKeysIn(body)).toEqual([]);
    expect(one.body).toMatchObject({
      valuesLocked: true, preRecorded: true, postRecorded: true, preReadingDevice: DEVICE, postReadingDevice: DEVICE,
    });
    expect(one.body.preTakenAt).toBeTruthy();
    expect(one.body.postTakenAt).toBeTruthy();
    const other = list.body.find((s: any) => s.id === s2.id);
    expect(other).toMatchObject({ preRecorded: false, postRecorded: false, preTakenAt: null });
    expect((await p.get(`/api/study/protocols/${protocol.id}/export?part=sessions`)).text.trim())
      .toBe("Results unlock when the study is complete (prevents interim peeking).");
    // The client still sees their own readings.
    expect((await c.get(`/api/study/sessions/${s1.id}`)).body).toMatchObject({ preRmssdMs: 46, postRmssdMs: 52, relaxPre: 4, relaxPost: 7 });

    // Values unlock at completion.
    expect((await p.post(`/api/study/protocols/${protocol.id}/complete`)).status).toBe(200);
    const after = await p.get(`/api/study/sessions/${s1.id}`);
    expect(after.body).toMatchObject({ valuesLocked: false, preRmssdMs: 46, postRmssdMs: 52, relaxPre: 4, relaxPost: 7 });
    const afterList = await p.get(`/api/study/protocols/${protocol.id}/sessions`);
    expect(afterList.body.find((s: any) => s.id === s1.id)).toMatchObject({ preRmssdMs: 46, postRmssdMs: 52 });
    expect((await p.get(`/api/study/protocols/${protocol.id}/export?part=sessions`)).text).toContain(",46,");
  });

  it("A1: enrollment takes rows in order from the list fixed at lock; the hash checks out after completion", async () => {
    const p = await practitioner("prac-a1@example.com");
    const protocol = await lockedProtocol(p, { targetClients: 6 });
    const hash = protocol.allocationSha256;
    const codes: string[] = [];
    for (let i = 0; i < 6; i++) codes.push((await enrolledClient(`client-a1-${i}@example.com`, protocol.id)).clientCode);
    expect(codes).toEqual(["C-001", "C-002", "C-003", "C-004", "C-005", "C-006"]);

    // The list is used up: 409, and no new row is generated.
    const late = new Client(h.base);
    await late.register("client-a1-late@example.com");
    expect((await late.post("/api/study/enrollments", { protocolId: protocol.id, consentVersion: "1", touchProfile: { back: "hands_on" } })).status).toBe(409);

    // Completion publishes the list and nonce; they reproduce the hash shown since lock.
    const done = await p.post(`/api/study/protocols/${protocol.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.allocationSha256).toBe(hash);
    expect(verifyAllocation(done.body.allocationNonce, done.body.allocationList, hash)).toBe(true);
    const orders = done.body.allocationList.map((r: any) => r.sequence.join("")).sort();
    expect(orders).toEqual(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"]);

    // Each client's sessions follow their row.
    const list = (await p.get(`/api/study/protocols/${protocol.id}/sessions`)).body;
    for (const row of done.body.allocationList) {
      const code = `C-${String(row.index + 1).padStart(3, "0")}`;
      expect(list.filter((s: any) => s.clientCode === code).map((s: any) => s.condition)).toEqual(row.sequence);
    }
  });

  it("withdrawal deletes study data but keeps the row consumed (no re-rolling)", async () => {
    const p = await practitioner("prac-withdraw@example.com");
    const protocol = await lockedProtocol(p, { targetClients: 6 });
    const first = await enrolledClient("client-w1@example.com", protocol.id);
    expect((await first.c.del(`/api/study/enrollments/${first.enrollmentId}`)).status).toBe(200);
    expect((await first.c.get(`/api/study/sessions/${first.sessions[0].id}`)).status).toBe(404);
    const second = await enrolledClient("client-w2@example.com", protocol.id);
    expect(second.clientCode).toBe("C-002");
    const detail = await p.get(`/api/study/protocols/${protocol.id}`);
    expect(detail.body.enrollments.find((e: any) => e.clientCode === "C-001").withdrawnAt).toBeTruthy();
    expect(allKeys(detail.body.enrollments).has("clientUserId")).toBe(false);
  });

  it("results use the protocol's analysis scale and flag reading-device mismatches (A2, A3)", async () => {
    const p = await practitioner("prac-results@example.com");
    const protocol = await lockedProtocol(p, { analysisScale: "ln", targetClients: 6 });
    const { c, sessions } = await enrolledClient("client-results@example.com", protocol.id);
    for (const [i, s] of sessions.entries()) {
      await c.patch(`/api/study/sessions/${s.id}/client`, { preReading: reading(40) });
      await p.post(`/api/study/sessions/${s.id}/start`);
      await c.patch(`/api/study/sessions/${s.id}/client`, {
        postReading: reading(44 + i, "face_up", i === 2 ? "Oura Gen 3" : DEVICE), clientGuess: "not_sure",
      });
      await p.patch(`/api/study/sessions/${s.id}`, { completed: true, intentionHeldRating: 9 });
    }
    // Mid-study: quality checks (including device mismatches) are visible; contrasts aren't.
    const mid = await p.get(`/api/study/protocols/${protocol.id}/results`);
    expect(mid.status).toBe(200);
    expect(mid.body.analysisScale).toBe("ln");
    expect(mid.body.quality.deviceMismatches.map((m: any) => m.sessionId)).toEqual([sessions[2].id]);
    expect(mid.body.progress).toMatchObject({ clientsEnrolled: 1, clientsComplete: 1, sessionsComplete: 3 });

    expect((await p.post(`/api/study/protocols/${protocol.id}/complete`)).status).toBe(200);
    const r = await p.get(`/api/study/protocols/${protocol.id}/results`);
    expect(r.body.primary.pairs).toHaveLength(1);
    // ln scale (the protocol's), A − B: post-readings were 44 + visit index against a pre of 40.
    const list = (await p.get(`/api/study/protocols/${protocol.id}/sessions`)).body;
    const post = (cond: string) => 44 + list.findIndex((s: any) => s.condition === cond);
    expect(r.body.primary.pairs[0]).toBeCloseTo(Math.log(post("A") / 40) - Math.log(post("B") / 40), 10);
    expect(r.body.primary.verdictText).toBe("Too early to tell.");

    const methods = await p.get(`/api/study/protocols/${protocol.id}/export?part=methods`);
    expect(methods.text).toContain(protocol.allocationSha256);
    expect(methods.text).toContain("ln(rMSSD)");
    expect(methods.text).toContain(DEVICE);
    expect(methods.text).toContain(RULE_VERSION);
    expect(methods.text).not.toMatch(/ILLUSTRATIVE/);
  });

  it("results omit contrasts and per-client deltas until completedAt is set, then include them", async () => {
    const p = await practitioner("prac-peek@example.com");
    const protocol = await lockedProtocol(p, { targetClients: 6 });
    for (const [n, email] of ["client-peek-1@example.com", "client-peek-2@example.com"].entries()) {
      const { c, sessions } = await enrolledClient(email, protocol.id);
      for (const [i, s] of sessions.entries()) {
        await c.patch(`/api/study/sessions/${s.id}/client`, { preReading: reading(40) });
        await p.post(`/api/study/sessions/${s.id}/start`);
        await c.patch(`/api/study/sessions/${s.id}/client`, { postReading: reading(42 + i + n), clientGuess: "not_sure" });
        await p.patch(`/api/study/sessions/${s.id}`, { completed: true, intentionHeldRating: 8 });
      }
    }
    // A third client enrolled but not yet seen: none of their visits are held.
    await enrolledClient("client-peek-3@example.com", protocol.id);
    const url = `/api/study/protocols/${protocol.id}`;

    // Before completion: progress and quality only.
    const before = await p.get(`${url}/results`);
    expect(before.status).toBe(200);
    expect(before.body.resultsLocked).toBe(true);
    expect(before.body.primary).toBeNull();
    expect(before.body.secondary).toBeNull();
    expect(before.body.exploratory).toEqual([]);
    expect(before.body.clientDeltas).toEqual([]);
    expect(allKeys(before.body).has("pairs")).toBe(false);
    expect(allKeys(before.body).has("ci")).toBe(false);
    expect(before.body.progress).toMatchObject({ clientsComplete: 2, sessionsComplete: 6 });
    expect(before.body.quality.blinding.guesses).toBe(4);
    // The export can't be used to peek either.
    const LOCKED = "Results unlock when the study is complete (prevents interim peeking).";
    expect((await p.get(`${url}/export?part=results`)).text).toContain(LOCKED);
    expect((await p.get(`${url}/export?part=sessions`)).text.trim()).toBe(LOCKED);
    expect((await p.get(`${url}/export?part=methods`)).status).toBe(200);

    // After completion: everything.
    expect((await p.post(`${url}/complete`)).status).toBe(200);
    const after = await p.get(`${url}/results`);
    expect(after.body.resultsLocked).toBe(false);
    expect(after.body.primary.contrast).toBe("A-B");
    expect(after.body.primary.pairs).toHaveLength(2);
    expect(after.body.secondary.contrast).toBe("B-C");
    expect(after.body.clientDeltas).toHaveLength(2);
    // Quality counts held sessions only, before and after completion.
    expect(before.body.quality.totalSessions).toBe(6);
    expect(after.body.quality.totalSessions).toBe(6);
    for (const cd of after.body.clientDeltas) expect(Object.keys(cd.deltas).sort()).toEqual(["A", "B", "C"]);
    const sessionsCsv = (await p.get(`${url}/export?part=sessions`)).text;
    // Every scheduled visit is listed; the third client's unheld visits have no readings or completion time.
    const rows = sessionsCsv.trim().split("\n").slice(1).map(l => l.split(","));
    expect(rows).toHaveLength(9);
    expect(rows.filter(r => r[23] !== "")).toHaveLength(6);          // completed_at
    expect(rows.filter(r => r[0] === "C-003").every(r => r[5] === "" && r[11] === "")).toBe(true);   // no pre/post rMSSD
    expect((await p.get(`${url}/export?part=results`)).text).toContain("primary,A-B,2,");
  });

  it("C11: demo accounts can't join real studies, and real clients can't join demo studies", async () => {
    const real = await practitioner("prac-real@example.com");
    const realProtocol = await lockedProtocol(real);
    const demoPrac = await practitioner("prac-demo@example.com");
    await h.storage.updateUserSettings((await demoPrac.get("/api/me")).body.id, {});
    const demoUser = await h.storage.getUserByEmail("prac-demo@example.com");
    (demoUser as any).isDemo = true;                     // seed:demo sets this; there is no API for it
    const demoProtocol = await lockedProtocol(demoPrac);

    const demoClient = new Client(h.base);
    const du = await demoClient.register("client-demo@example.com");
    (await h.storage.getUserById(du.id) as any).isDemo = true;
    const body = (protocolId: number) => ({ protocolId, consentVersion: "1", touchProfile: { back: "hands_on" } });
    expect((await demoClient.post("/api/study/enrollments", body(realProtocol.id))).status).toBe(403);
    expect((await demoClient.post("/api/study/enrollments", body(demoProtocol.id))).status).toBe(201);

    const realClient = new Client(h.base);
    await realClient.register("client-real@example.com");
    expect((await realClient.post("/api/study/enrollments", body(demoProtocol.id))).status).toBe(403);
    expect((await realClient.post("/api/study/enrollments", body(realProtocol.id))).status).toBe(201);

    const demoExport = await demoPrac.get(`/api/study/protocols/${demoProtocol.id}/export?part=methods`);
    expect(demoExport.text).toMatch(/^ILLUSTRATIVE DATA\. No primary data reported\./);
  });

  it("a practitioner can't enroll in their own study, and a stale consent version is refused", async () => {
    const p = await practitioner("prac-self@example.com");
    const protocol = await lockedProtocol(p);
    expect((await p.post("/api/study/enrollments", { protocolId: protocol.id, consentVersion: "1", touchProfile: { back: "hands_on" } })).status).toBe(409);
    const c = new Client(h.base);
    await c.register("client-consent@example.com");
    expect((await c.post("/api/study/enrollments", { protocolId: protocol.id, consentVersion: "0", touchProfile: { back: "hands_on" } })).status).toBe(409);
  });
});
