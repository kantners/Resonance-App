// npm run seed:demo — a clearly labelled demo account whose data reproduces
// the design canvas (HANDOFF §10 of the build prompt; amendment C11).
//
//   ALLOW_DEMO_SEED=true DEMO_PASSWORD=… DATABASE_URL=… npm run seed:demo
//
// Refuses to run unless ALLOW_DEMO_SEED=true; the password comes only from
// DEMO_PASSWORD. Every demo user has is_demo = true, so the app shows
// "Illustrative data" on every screen, demo accounts can't join real studies,
// and real clients can't join the demo study. Re-running replaces the demo data.
//
// The canvas numbers depend on one another (the Brief, "22 / 30", "3 of 4
// high-exposure days", the long game), so the seed generates candidates from a
// seeded RNG, runs each through the real rule engine, and keeps the first that
// matches. Dates are relative to today on this machine: "today" plays the
// canvas's Friday.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import {
  dailyStatus, phoneEvents, practitioners, studyEnrollments, studyProtocols, studySessions, users,
} from "@shared/schema";
import { STUDY_TEMPLATES } from "@shared/studyTemplates";
import {
  addDays, allocationHash, buildAllocationList, computeBrief, contrastFromPairs, mean,
  quietFromEvents, sampleSd, type ExposureDay, type NightInput,
} from "../server/rules";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Refusing to seed demo data: set ALLOW_DEMO_SEED=true (never on a public server).");
  process.exit(1);
}
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
if (DEMO_PASSWORD.length < 8) {
  console.error("Set DEMO_PASSWORD (at least 8 characters). It is never hard-coded.");
  process.exit(1);
}

const DEMO_EMAIL = "demo@resonance.local";
const DEVICE = "Polar H10 + Elite HRV";
const HRV_LOG_SCALE = (process.env.HRV_LOG_SCALE ?? "true").toLowerCase() !== "false";

// ─── Dates and instants on this machine ──────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const D = process.env.DEMO_DATE ?? localDate(new Date());
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Local wall-clock time on a date → ISO instant with offset. */
function at(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const t = new Date(y, m - 1, d, hh, mm);
  const off = -t.getTimezoneOffset();
  return `${date}T${pad(hh)}:${pad(mm)}:00${off >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
  return { next, normal, int: (n: number) => Math.floor(next() * n) };
}

/** Rescale values to an exact mean and sample SD. */
function exact(values: number[], m: number, sd: number): number[] {
  const m0 = mean(values), s0 = sampleSd(values);
  return values.map(v => m + ((v - m0) * sd) / s0);
}
const r1 = (x: number) => Math.round(x * 10) / 10;

// ─── Nights: canvas week, a 48 ± 5 / 55 ± 2 baseline, a 44 / 57 baseline 12 weeks back ─
const WEEK_HRV = [51, 44, 47, 54, 49, 53, 42];
const WEEK_RHR = [54, 57, 55, 53, 55, 54, 58];

function makeNights(seed: number): NightInput[] {
  const g = rng(seed);
  const nights: NightInput[] = [];
  const add = (date: string, hrv: number, rhr: number) =>
    nights.push({ date, hrv: r1(hrv), rhr: Math.round(rhr), hrvSource: "device_manual", hrvDevice: DEVICE });

  // Then-baseline (as of D − 84): the 14 nights before D − 90. Mean 44 ms, 57 bpm.
  const thenHrv = exact(Array.from({ length: 14 }, () => g.normal()), 44, 4.5);
  const thenRhr = exact(Array.from({ length: 14 }, () => g.normal()), 57, 2);
  thenHrv.forEach((v, i) => add(addDays(D, -104 + i), v, thenRhr[i]));
  // Fill D − 90 … D − 21: a slow drift from 44 / 57 towards 48 / 55.
  for (let o = 90; o >= 21; o--) {
    const f = (90 - o) / 69;
    add(addDays(D, -o), 44 + 3.5 * f + g.normal() * 2.2, 57 - 1.7 * f + g.normal() * 1.1);
  }
  // Current baseline B: the 14 nights before the week. Exactly 48 ± 5 ms and 55 ± 2 bpm.
  const bHrv = exact(Array.from({ length: 14 }, () => g.normal()), 48, 5);
  // resting_hr is an integer column: 14 whole numbers with mean 55 and sample SD
  // exactly 2 (squared deviations sum to 4 × 13 = 52), in a shuffled order.
  const rhrDev = [3, -3, 3, -3, 2, -2, 1, -1, 1, -1, 1, -1, 1, -1];
  for (let i = rhrDev.length - 1; i > 0; i--) { const j = g.int(i + 1); [rhrDev[i], rhrDev[j]] = [rhrDev[j], rhrDev[i]]; }
  const bRhr = rhrDev.map(d => 55 + d);
  bHrv.forEach((v, i) => nights.push({ date: addDays(D, -20 + i), hrv: v, rhr: bRhr[i], hrvSource: "device_manual", hrvDevice: DEVICE }));
  // The canvas week.
  WEEK_HRV.forEach((v, i) => add(addDays(D, -6 + i), v, WEEK_RHR[i]));
  return nights;
}

// ─── Exposure: yesterday 5h 47m against a 4h 11m average; 4 high days, 3 followed by low HRV ─
/** Is the night dated `date` below the HRV range as it stood that morning? */
function belowRangeOn(nights: NightInput[], date: string): boolean {
  const st = computeBrief({ date, nights, priorLabels: [], tags: [], exposure: [], hrvLogScale: HRV_LOG_SCALE }).status;
  return !!st.lastNight && !!st.baseline.hrv && st.lastNight.hrv! < st.baseline.hrv.low;
}

function makeExposure(seed: number, nights: NightInput[]): ExposureDay[] | null {
  const g = rng(seed * 7919 + 17);
  const days = Array.from({ length: 28 }, (_, i) => addDays(D, -28 + i));   // D−28 … D−1
  const yesterday = addDays(D, -1);
  // Three more high-exposure days: two followed by a below-range night, one not
  // (with today's, that makes "seen after 3 of your last 4").
  const others = days.filter(d => d !== yesterday);
  const low = others.filter(d => belowRangeOn(nights, addDays(d, 1)));
  const notLow = others.filter(d => !low.includes(d));
  if (low.length < 2 || notLow.length < 1) return null;
  const take = (xs: string[]) => xs.splice(g.int(xs.length), 1)[0];
  const lowPool = [...low], notLowPool = [...notLow];
  const high = [yesterday, take(lowPool), take(lowPool), take(notLowPool)];
  const minutes = new Map(high.map((d, i) => [d, [347, 328, 316, 305][i]]));
  const out: ExposureDay[] = days.map(d => ({ date: d, totalMin: minutes.get(d) ?? Math.round(236 + g.normal() * 12) }));
  // Force the 28-day average to 251 min (4h 11m) by nudging ordinary days.
  let diff = 251 * 28 - out.reduce((acc, e) => acc + e.totalMin, 0);
  const ordinary = out.filter(e => !minutes.has(e.date));
  for (let i = 0; diff !== 0; i = (i + 1) % ordinary.length) {
    const step = Math.sign(diff);
    ordinary[i].totalMin += step;
    diff -= step;
  }
  return out;
}

// ─── Search for data that reproduces the canvas ──────────────────────────────
function check(nights: NightInput[], exposure: ExposureDay[]) {
  const b = computeBrief({ date: D, nights, priorLabels: [], tags: [], exposure, hrvLogScale: HRV_LOG_SCALE });
  const s = b.dailyStatus;
  const ok = s.weekLabel === "steady" && s.nightState === "both_out" && s.consecutiveNightsOut === 1
    && s.escalationLevel === 1 && s.nightsInRangeLast30 === 22 && s.nightsLoggedLast30 === 30
    && b.pattern.triggered && b.pattern.highExposureDays === 4 && b.pattern.seenAfter === 3
    && Math.round(b.pattern.averageMin!) === 251
    && b.longGame != null && Math.round(b.longGame.hrv.then) === 44 && Math.round(b.longGame.hrv.now) === 48
    && b.longGame.hrv.direction === "up" && b.longGame.rhr?.direction === "down"
    && Math.round(b.longGame.rhr.then) === 57 && Math.round(b.longGame.rhr.now) === 55;
  return { ok, brief: b };
}

function search() {
  for (let seed = 1; seed < 20000; seed++) {
    const nights = makeNights(seed);
    const quick = computeBrief({ date: D, nights, priorLabels: [], tags: [], exposure: [], hrvLogScale: HRV_LOG_SCALE }).dailyStatus;
    if (quick.nightsInRangeLast30 !== 22 || quick.nightsLoggedLast30 !== 30 || quick.weekLabel !== "steady" || quick.consecutiveNightsOut !== 1) continue;
    for (let t = 0; t < 40; t++) {
      const exposure = makeExposure(seed * 100 + t, nights);
      if (!exposure) continue;
      const c = check(nights, exposure);
      if (c.ok) return { seed, nights, exposure, brief: c.brief };
    }
  }
  throw new Error("No candidate reproduced the canvas; widen the search.");
}

// ─── Yesterday on the phone (Android events): longest quiet 7:04–8:57 ────────
function yesterdayPickups(date: string): string[] {
  // Busy spans between the six quiet stretches (≥ 30 min, 333 min in total).
  const spans: [string, string, number][] = [
    ["06:42", "07:04", 4], ["08:57", "10:20", 10], ["11:05", "12:40", 11], ["13:20", "14:30", 8],
    ["15:10", "16:00", 6], ["16:48", "18:10", 9], ["18:57", "20:59", 23], ["21:00", "23:50", 23],
  ];
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const out: string[] = [];
  for (const [a, b, n] of spans) {
    const start = toMin(a), end = toMin(b);
    for (let i = 0; i < n; i++) {
      const m = Math.round(start + ((end - start) * i) / Math.max(1, n - 1));
      out.push(at(date, `${pad(Math.floor(m / 60))}:${pad(m % 60)}`));
    }
  }
  return out;
}

// ─── Study: the canvas's six completed clients plus one in progress ─────────
const PAIRS_BA: [number, number][] = [[5, 7], [8, 8], [3, 6], [7, 6], [6, 9], [9, 6]];   // HANDOFF §7
const B_MINUS_C = [3.103, 4.167, -1.154, 2.039, -1.154, 1.4];                           // +1.4, −0.9 to +3.7
const GUESS_CORRECT = [true, false, false, true, false, false, true, true, false, false, true, false];  // 5 of 12 (A and B sessions)

async function main() {
  const { db, pool } = await import("../server/db");
  const { createDbStorage } = await import("../server/storage/db");
  const storage = createDbStorage(db);

  const found = search();
  console.log(`Canvas data found (candidate ${found.seed}).`);

  // Replace any previous demo data. Demo protocols first (they don't cascade from users).
  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true));
  const demoIds = demoUsers.map(u => u.id);
  if (demoIds.length) {
    const pracs = await db.select({ id: practitioners.id }).from(practitioners).where(inArray(practitioners.userId, demoIds));
    const pracIds = pracs.map(p => p.id);
    if (pracIds.length) {
      const prots = await db.select({ id: studyProtocols.id }).from(studyProtocols).where(inArray(studyProtocols.practitionerId, pracIds));
      const protIds = prots.map(p => p.id);
      if (protIds.length) {
        const ens = await db.select({ id: studyEnrollments.id }).from(studyEnrollments).where(inArray(studyEnrollments.protocolId, protIds));
        if (ens.length) await db.delete(studySessions).where(inArray(studySessions.enrollmentId, ens.map(e => e.id)));
        await db.delete(studyEnrollments).where(inArray(studyEnrollments.protocolId, protIds));
        await db.delete(studyProtocols).where(inArray(studyProtocols.id, protIds));
      }
    }
    await db.delete(users).where(inArray(users.id, demoIds));
  }

  // ── The demo user ──────────────────────────────────────────────────────────
  const demo = await storage.createUser({
    email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10), firstName: "Demo",
    isDemo: true, timeZone, defaultHrvSource: "device_manual", defaultHrvDevice: DEVICE, hrvPosture: "seated",
  });

  for (const n of found.nights) {
    await storage.upsertSleep(demo.id, n.date, { hrv: n.hrv, restingHr: n.rhr, hrvSource: n.hrvSource, hrvDevice: n.hrvDevice });
  }
  await storage.upsertSleep(demo.id, D, { sleepScore: 71, hours: 6.8 });   // 6h 48m

  // Yesterday: Android pickups → quiet metrics, plus totals and categories.
  const y = addDays(D, -1);
  const pickups = yesterdayPickups(y);
  const wake = at(y, "06:40"), sleep = at(y, "23:52");
  await db.insert(phoneEvents).values(pickups.map(p => ({ userId: demo.id, at: new Date(p).toISOString(), kind: "pickup" })));
  const q = quietFromEvents(pickups, wake, sleep, timeZone);
  const hourly = Array(24).fill(0);
  for (const p of pickups) hourly[Math.floor(new Date(p).getHours())]++;
  for (const e of found.exposure) {
    const isY = e.date === y;
    await storage.upsertExposure(demo.id, {
      date: e.date, source: isY ? "screenshot" : "manual", platform: isY ? "android" : null, totalMin: e.totalMin,
      pickups: isY ? q.pickups : Math.round(e.totalMin / 3.6), notifications: isY ? 212 : null,
      socialMin: isY ? 158 : null, entertainmentMin: isY ? 112 : null, productivityMin: isY ? 51 : null, otherMin: isY ? 26 : null,
      topApps: isY ? JSON.stringify([{ name: "Instagram", minutes: 104 }, { name: "YouTube", minutes: 81 }, { name: "Safari", minutes: 38 }, { name: "Slack", minutes: 29 }, { name: "Messages", minutes: 24 }]) : null,
      hourlyPickups: isY ? JSON.stringify(hourly) : null,
      pickupsAfter21: isY ? q.pickupsAfter21 : null,
      longestQuietMin: isY ? q.longestQuietMin : null,
      quietStretches30: isY ? q.quietStretches30 : null,
      quietMinutes30Total: isY ? q.quietMinutes30Total : null,
      lastPickupAt: isY ? q.lastPickupAt : null,
      quietSource: isY ? "events" : null,
      lowConfidenceFields: null,
    });
  }
  await storage.createStillness(demo.id, { date: y, startedAt: at(y, "15:10"), minutes: 10, type: "breathwork", phoneLocation: "another_room", breathMethod: "resonance_paced", breathsPerMin: 6 });
  await storage.createStillness(demo.id, { date: y, startedAt: at(y, "21:40"), minutes: 35, type: "reading", readingMedium: "ereader", phoneLocation: "nearby_silenced" });
  await storage.createReading(demo.id, { date: y, startedAt: at(y, "21:40"), medium: "ereader", durationMin: 35, title: null });
  await storage.startFast(demo.id, new Date(Date.now() - (14 * 60 + 20) * 60000).toISOString(), 16);

  // ── Study: the demo user is the practitioner ───────────────────────────────
  const practitioner = await storage.createPractitioner(demo.id, "Blue Ember Wellness (demo)");
  const tpl = STUDY_TEMPLATES.find(t => t.key === "intention_vs_touch")!;
  const protocol = await storage.createProtocol({
    practitionerId: practitioner.id, version: 1, supersedesId: null,
    question: tpl.question, primaryOutcome: tpl.primaryOutcome,
    primaryContrast: tpl.primaryContrast, secondaryContrast: tpl.secondaryContrast,
    conditions: JSON.stringify(tpl.conditions), design: "crossover", targetClients: 12, minDaysBetween: 7,
    withholdingProcedure: "Setting the condition (after the eye pillow is on, about ten seconds, same posture every time): "
      + "A: [what you do, silently, to offer Reiki]. B and C: \"Okay, turn off my Reiki transmission.\" "
      + "At each 5-minute chime: A: silently reaffirm on; B and C: repeat the off phrase. "
      + "On noticing drift during B or C: repeat the off phrase, and add one to the drift count after the session.",
    commitmentText: "I can withhold intention. If A and B don't differ, I'll conclude that intention didn't measurably change this outcome, and present it that way.",
    closingReikiForAll: true, consentVersion: "1", analysisScale: "linear", readingDevice: DEVICE,
  });
  // The allocation list, as at lock. Find an RNG seed whose 7th row starts A,C or C,A,
  // so the in-progress client's two sessions leave the canvas contrasts untouched.
  let list = null as ReturnType<typeof buildAllocationList> | null;
  for (let s = 1; !list; s++) {
    const g = rng(s * 31);
    const candidate = buildAllocationList(["A", "B", "C"], 12, n => g.int(n));
    if (["AC", "CA"].includes(candidate[6].sequence.slice(0, 2).join(""))) list = candidate;
  }
  const nonce = randomBytes(16).toString("hex");
  const lockedAt = new Date(Date.now() - 60 * 86_400_000);
  await storage.lockProtocol(protocol.id, {
    lockedAt, allocationList: JSON.stringify(list), allocationNonce: nonce, allocationSha256: allocationHash(nonce, list),
  });

  let guessIdx = 0, sessionCount = 0;
  const ratings: number[] = [];
  for (let c = 0; c < 7; c++) {
    const row = list[c];
    const client = await storage.createUser({
      email: `demo-client-${c + 1}@resonance.local`, passwordHash: await bcrypt.hash(randomBytes(12).toString("hex"), 10),
      firstName: null, isDemo: true, timeZone,
    });
    const consentedAt = new Date(lockedAt.getTime() + (c + 1) * 3 * 86_400_000);
    const enrollment = await storage.createEnrollmentWithSessions({
      protocolId: protocol.id, clientUserId: client.id, clientCode: `C-${String(row.index + 1).padStart(3, "0")}`,
      consentVersion: "1", consentedAt, touchProfile: JSON.stringify({ back: "hands_on", front: "hovering" }),
      touchProfileLockedAt: consentedAt, allocationIndex: row.index, conditionSequence: JSON.stringify(row.sequence),
      sequenceBlock: row.block,
    }, row.sequence);
    const contexts = (await storage.listSessionContexts(protocol.id)).filter(x => x.enrollment.id === enrollment.id);
    const visits = c < 6 ? 3 : 2;   // the 7th client is part-way through
    for (const ctx of contexts.slice(0, visits)) {
      const cond = ctx.session.condition;
      const [bDelta, aDelta] = c < 6 ? PAIRS_BA[c] : [0, 5];
      const delta = cond === "A" ? aDelta : cond === "B" ? bDelta : c < 6 ? bDelta - B_MINUS_C[c] : 2;
      const pre = 38 + c * 2 + ctx.session.visitNumber;
      const when = new Date(consentedAt.getTime() + ctx.session.visitNumber * 7 * 86_400_000);
      const inContrast = cond === "A" || cond === "B";
      let guess: string | null = null;
      if (c < 6 && inContrast) guess = GUESS_CORRECT[guessIdx++] ? cond : cond === "A" ? "B" : "A";
      else if (c < 6) guess = "C";
      const rating = sessionCount < 18 ? 9 : 10;   // mean 9.1 over 20 sessions
      ratings.push(rating);
      await storage.updateSession(ctx.session.id, {
        conditionRevealedAt: when,
        preTakenAt: when.toISOString(), preRmssdMs: pre, preHrBpm: 64, prePosture: "face_up", preReadingDevice: DEVICE,
        postTakenAt: new Date(when.getTime() + 75 * 60000).toISOString(), postRmssdMs: pre + delta, postHrBpm: 60,
        postPosture: "face_up", postReadingDevice: DEVICE,
        relaxPre: 4, relaxPost: 7, clientGuess: guess, intentionHeldRating: rating, driftCount: cond === "A" ? 0 : 1,
        checklist: JSON.stringify({ spokenGreeting: true, chimePositions: true, faceUpReadings: true, sameRoom: true }),
        deviations: sessionCount === 4 ? "Session started 10 minutes late." : sessionCount === 13 ? "Music played from a different speaker." : null,
        closingReikiGiven: true, completedAt: new Date(when.getTime() + 90 * 60000),
      });
      sessionCount++;
    }
  }
  // Seeded as completed so the full Study screen (results) can be shown (Mark, Sep 28).
  await storage.completeProtocol(protocol.id, new Date(Date.now() - 86_400_000));

  // Make sure no stale computed statuses linger for the demo user.
  await db.delete(dailyStatus).where(eq(dailyStatus.userId, demo.id));

  // ── Report ─────────────────────────────────────────────────────────────────
  const s = found.brief.dailyStatus, p = found.brief.pattern, lg = found.brief.longGame!;
  const primary = contrastFromPairs("A-B", PAIRS_BA.map(([b, a]) => a - b), "linear", 12);
  const secondary = contrastFromPairs("B-C", B_MINUS_C, "linear", 12);
  const f1 = (x: number | null) => (x == null ? "—" : x.toFixed(1));
  console.log([
    ``,
    `Demo data for ${D} (HRV_LOG_SCALE=${HRV_LOG_SCALE}):`,
    `  Week: ${s.weekLabel} · ${s.weekNights} of 7 nights · HRV ${f1(s.hrv7Avg)} ms · RHR ${f1(s.rhr7Avg)} bpm`,
    `  Ranges: HRV ${f1(s.hrvRangeLow)}–${f1(s.hrvRangeHigh)} ms · RHR ${f1(s.rhrRangeLow)}–${f1(s.rhrRangeHigh)} bpm (baseline ${f1(s.hrvBaselineMean)} ± ${f1(s.hrvBaselineSd)}, ${f1(s.rhrBaselineMean)} ± ${f1(s.rhrBaselineSd)})`,
    `  Last night: ${s.nightState}, ${s.consecutiveNightsOut} night out, level ${s.escalationLevel}`,
    `  Nights in range: ${s.nightsInRangeLast30} / ${s.nightsLoggedLast30}`,
    `  Pattern: seen after ${p.seenAfter} of ${p.highExposureDays}; yesterday ${p.yesterdayMin} min vs ${Math.round(p.averageMin!)} min average`,
    `  Long game: HRV ${Math.round(lg.hrv.then)} → ${Math.round(lg.hrv.now)} ms, RHR ${Math.round(lg.rhr!.then)} → ${Math.round(lg.rhr!.now)} bpm`,
    `  Quiet yesterday: longest ${q.longestQuietMin} min, ${q.quietStretches30} stretches (${q.quietMinutes30Total} min), ${q.pickups} pickups, ${q.pickupsAfter21} after 9 PM`,
    `  Study: ${sessionCount} sessions, primary A−B ${primary.ci!.mean.toFixed(2)} (${primary.ci!.low!.toFixed(1)} to ${primary.ci!.high!.toFixed(1)}), `
      + `secondary B−C ${secondary.ci!.mean.toFixed(2)} (${secondary.ci!.low!.toFixed(1)} to ${secondary.ci!.high!.toFixed(1)}), `
      + `intention held ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}`,
    ``,
    `Log in as ${DEMO_EMAIL} with the DEMO_PASSWORD you set.`,
  ].join("\n"));
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
