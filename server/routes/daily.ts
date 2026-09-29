import type { Express } from "express";
import { z } from "zod";
import {
  zContextTag, zExposureSource, zPlatform, zPosture, zHrvSource, zStillnessType, zReikiRole, zPhoneLocation,
  zBreathMethod, zHrSource, zPostureStyle, zReadingMedium, insertBreathworkSchema,
  type SleepLog, type User,
} from "@shared/schema";
import {
  addDays, comparableNights, computeBrief, nightStateOn, quietFromEvents, quietFromHourly, screenHrvAssociation,
  RULE_VERSION, type NightInput,
} from "../rules";
import { badRequest, dateParam, idParam, notFound, rangeQuery, requireAuth, userId, zLocalDate } from "../http";
import type { BriefResponse } from "@shared/api";
import type { RouteDeps } from ".";

export function toNight(s: SleepLog): NightInput {
  return { date: s.date, hrv: s.hrv, rhr: s.restingHr, hrvSource: s.hrvSource, hrvDevice: s.hrvDevice };
}

const zIsoInstant = z.string().refine(s => !Number.isNaN(Date.parse(s)) && /T/.test(s), "Expected an ISO date-time");

/**
 * Every HRV value needs its source (device + app), from the request or the
 * user's saved default. Layer 0 has no camera capture (deferred to Layer 1).
 */
function hrvSourceFor(user: User, body: { hrvSource?: string; hrvDevice?: string }) {
  const hrvSource = body.hrvSource ?? user.defaultHrvSource ?? "device_manual";
  if (hrvSource === "camera") throw badRequest("Camera readings aren't available yet. Enter the reading and the device it came from.");
  const hrvDevice = body.hrvDevice?.trim() || user.defaultHrvDevice;
  if (!hrvDevice) throw badRequest("Every HRV reading needs its source: the device and app it came from.");
  return { hrvSource, hrvDevice };
}

const zSleep = z.object({
  date: zLocalDate,                                   // wake date
  hours: z.number().min(0).max(24).nullable().optional(),
  sleepScore: z.number().int().min(0).max(100).nullable().optional(),
  hrv: z.number().positive().max(400).nullable().optional(),
  restingHr: z.number().int().min(20).max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  hrvSource: zHrvSource.optional(),
  hrvDevice: z.string().trim().max(120).optional(),
}).strict();

const zMorningReading = z.object({
  date: zLocalDate,
  takenAt: zIsoInstant,
  rmssdMs: z.number().positive().max(400),
  heartRateBpm: z.number().min(20).max(220),
  signalQuality: z.number().min(0).max(1).nullable().optional(),
  posture: zPosture.default("seated"),
  hrvSource: zHrvSource.optional(),
  hrvDevice: z.string().trim().max(120).optional(),
}).strict();

const zStillness = z.object({
  date: zLocalDate,
  startedAt: zIsoInstant,
  minutes: z.number().int().min(1).max(24 * 60),
  type: zStillnessType,
  reikiRole: zReikiRole.nullable().optional(),
  readingMedium: zReadingMedium.nullable().optional(),
  phoneLocation: zPhoneLocation,
  breathsPerMin: z.number().positive().max(60).nullable().optional(),
  rmssdDuringMs: z.number().positive().max(400).nullable().optional(),
  breathMethod: zBreathMethod.nullable().optional(),
  hrSource: zHrSource.nullable().optional(),
  postureStyle: zPostureStyle.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()
  .refine(s => s.type !== "reiki" || !!s.reikiRole, { message: "Reiki sessions need a role: given or received", path: ["reikiRole"] })
  .refine(s => s.type !== "reading" || (s.readingMedium === "physical" || s.readingMedium === "ereader"),
    { message: "Reading counts as stillness only on paper or an offline e-reader", path: ["readingMedium"] })
  .refine(s => s.type === "align" || s.postureStyle == null, { message: "postureStyle is only for align", path: ["postureStyle"] });

const zReading = z.object({
  date: zLocalDate,
  startedAt: zIsoInstant.nullable().optional(),
  medium: zReadingMedium,
  durationMin: z.number().int().min(1).max(24 * 60),
  title: z.string().trim().max(200).nullable().optional(),
}).strict();

const zMinutes = z.number().int().min(0).max(24 * 60);
export const zExposure = z.object({
  date: zLocalDate,
  source: zExposureSource,
  platform: zPlatform.nullable().optional(),
  totalMin: zMinutes,
  pickups: z.number().int().min(0).max(5000).nullable().optional(),
  notifications: z.number().int().min(0).max(20000).nullable().optional(),
  socialMin: zMinutes.nullable().optional(),
  entertainmentMin: zMinutes.nullable().optional(),
  productivityMin: zMinutes.nullable().optional(),
  otherMin: zMinutes.nullable().optional(),
  topApps: z.array(z.object({ name: z.string().trim().min(1).max(80), minutes: zMinutes })).max(20).nullable().optional(),
  hourlyPickups: z.array(z.number().int().min(0).max(1000)).length(24).nullable().optional(),
  wakeHour: z.number().int().min(0).max(23).optional(),      // for the iOS hourly estimate
  sleepHour: z.number().int().min(1).max(24).optional(),
  pickupsAfter21: z.number().int().min(0).nullable().optional(),
  longestQuietMin: zMinutes.nullable().optional(),
  lowConfidenceFields: z.array(z.string().max(40)).max(40).nullable().optional(),
}).strict();

export function registerDailyRoutes(app: Express, deps: RouteDeps) {
  const { storage } = deps;

  async function currentUser(uid: number): Promise<User> {
    const u = await storage.getUserById(uid);
    if (!u) throw notFound("User not found");
    return u;
  }

  // ── Brief ─────────────────────────────────────────────────────────────────
  app.get("/api/brief/:date", requireAuth, async (req, res) => {
    const uid = userId(req);
    const date = dateParam(req);
    const user = await currentUser(uid);
    const flag = deps.hrvLogScale;

    const sleepRows = await storage.listSleep(uid, undefined, date);
    const nights = sleepRows.map(toNight);
    const [tags, exposureRows, priorRows, stillness, breathwork] = await Promise.all([
      storage.getNightTags(uid, date),
      storage.listExposure(uid, addDays(date, -60), date),
      storage.listDailyStatus(uid, addDays(date, -14), addDays(date, -1), RULE_VERSION, flag),
      storage.listStillness(uid, addDays(date, -1), addDays(date, -1)),
      storage.listBreathwork(uid, addDays(date, -1), addDays(date, -1)),
    ]);

    const brief = computeBrief({
      date, nights, tags, hrvLogScale: flag,
      priorLabels: priorRows.map(r => ({ date: r.date, weekLabel: r.weekLabel as any })),
      exposure: exposureRows.map(e => ({ date: e.date, totalMin: e.totalMin })),
    });
    await storage.upsertDailyStatus(uid, brief.dailyStatus);

    const { status } = brief;
    const b = status.baseline;
    const lastSleep = sleepRows.find(s => s.date === date) ?? null;
    const yesterday = exposureRows.find(e => e.date === addDays(date, -1)) ?? null;
    const bars = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      const n = b.week.find(x => x.date === d);
      return { date: d, hrv: n?.hrv ?? null, rhr: n?.rhr ?? null, state: n ? nightStateOn(nights, d, flag) : null };
    });

    const body: BriefResponse = {
      date,
      ruleVersion: RULE_VERSION,
      hrvLogScale: flag,
      isDemo: user.isDemo,
      firstRun: {
        nightsLogged: comparableNights(nights, date).length,
        baselineNights: b.base.length,
        baselineNeeded: 14,
        hrvDevice: user.defaultHrvDevice,
        timeZone: user.timeZone,
      },
      week: {
        label: status.weekLabel,
        nights: status.weekNights,
        hrv7Avg: status.hrv7Avg,
        rhr7Avg: status.rhr7Avg,
        hrvRange: b.hrv,
        rhrRange: b.rhr,
        hrvStrained: status.hrv7Avg != null && !!b.hrv && status.hrv7Avg < b.hrv.low,
        rhrStrained: status.rhr7Avg != null && !!b.rhr && status.rhr7Avg > b.rhr.high,
        bars,
        message: brief.messages.week,
      },
      lastNight: {
        date,
        hrv: lastSleep?.hrv ?? null,
        rhr: lastSleep?.restingHr ?? null,
        sleepScore: lastSleep?.sleepScore ?? null,
        hours: lastSleep?.hours ?? null,
        hrvDevice: lastSleep?.hrvDevice ?? null,
        state: status.nightState,
        consecutiveOut: status.consecutiveNightsOut,
        tags,
        message: brief.messages.lastNight,
      },
      escalationLevel: status.escalationLevel,
      consistency: status.consistency,
      longGame: brief.longGame,
      yesterday: {
        date: addDays(date, -1),
        exposure: yesterday && {
          totalMin: yesterday.totalMin, pickups: yesterday.pickups, notifications: yesterday.notifications,
          pickupsAfter21: yesterday.pickupsAfter21, longestQuietMin: yesterday.longestQuietMin,
          quietSource: yesterday.quietSource, source: yesterday.source,
        },
        stillnessMin: stillness.reduce((a, s) => a + s.minutes, 0) + breathwork.reduce((a, s) => a + s.durationMin, 0),
      },
      pattern: brief.pattern,
    };
    res.json(body);
  });

  app.post("/api/nights/:date/tags", requireAuth, async (req, res) => {
    const date = dateParam(req);
    const { tags } = z.object({ tags: z.array(zContextTag).max(5) }).strict().parse(req.body);
    res.json({ date, tags: await storage.setNightTags(userId(req), date, tags) });
  });

  // ── Sleep ─────────────────────────────────────────────────────────────────
  app.get("/api/sleep", requireAuth, async (req, res) => {
    const { from, to } = rangeQuery(req);
    res.json(await storage.listSleep(userId(req), from, to));
  });

  app.post("/api/sleep", requireAuth, async (req, res) => {
    const uid = userId(req);
    const { date, hrvSource, hrvDevice, ...fields } = zSleep.parse(req.body);
    const source = fields.hrv != null ? hrvSourceFor(await currentUser(uid), { hrvSource, hrvDevice }) : {};
    res.json(await storage.upsertSleep(uid, date, { ...fields, ...source }));
  });

  // ── Morning reading (manual in Layer 0; source required) ──────────────────
  app.post("/api/morning-readings", requireAuth, async (req, res) => {
    const uid = userId(req);
    const body = zMorningReading.parse(req.body);
    const source = hrvSourceFor(await currentUser(uid), body);
    const reading = await storage.createMorningReading(uid, {
      date: body.date, takenAt: body.takenAt, rmssdMs: body.rmssdMs, heartRateBpm: body.heartRateBpm,
      signalQuality: body.signalQuality ?? null, posture: body.posture, ...source,
    });
    // The reading becomes that morning's HRV input. Its heart rate is a
    // 60-second value, not overnight resting HR, so restingHr is left alone.
    const sleep = await storage.upsertSleep(uid, body.date, { hrv: body.rmssdMs, ...source, morningReadingId: reading.id });
    res.json({ reading, sleep });
  });

  // ── Breathwork (kept from KEWT; counts as chosen stillness) ───────────────
  app.get("/api/breathwork", requireAuth, async (req, res) => {
    const { from, to } = rangeQuery(req);
    res.json(await storage.listBreathwork(userId(req), from, to));
  });

  app.post("/api/breathwork", requireAuth, async (req, res) => {
    const data = insertBreathworkSchema.extend({ date: zLocalDate }).parse(req.body);
    res.json(await storage.createBreathwork(userId(req), data));
  });

  // ── Stillness and reading ─────────────────────────────────────────────────
  app.post("/api/stillness", requireAuth, async (req, res) => {
    const s = zStillness.parse(req.body);
    res.json(await storage.createStillness(userId(req), {
      ...s,
      reikiRole: s.type === "reiki" ? s.reikiRole ?? null : null,
      readingMedium: s.type === "reading" ? s.readingMedium ?? null : null,
    }));
  });

  app.get("/api/stillness", requireAuth, async (req, res) => {
    const uid = userId(req);
    const { from, to } = rangeQuery(req);
    const [stillness, breathwork] = await Promise.all([storage.listStillness(uid, from, to), storage.listBreathwork(uid, from, to)]);
    res.json({ stillness, breathwork });
  });

  app.post("/api/reading", requireAuth, async (req, res) => {
    res.json(await storage.createReading(userId(req), zReading.parse(req.body)));
  });

  app.get("/api/reading", requireAuth, async (req, res) => {
    const { from, to } = rangeQuery(req);
    res.json(await storage.listReading(userId(req), from, to));
  });

  // ── Exposure and quiet ────────────────────────────────────────────────────
  app.post("/api/exposure", requireAuth, async (req, res) => {
    res.json(await saveExposure(deps, userId(req), zExposure.parse(req.body)));
  });

  app.get("/api/exposure/:date", requireAuth, async (req, res) => {
    const row = await storage.getExposure(userId(req), dateParam(req));
    res.json(row);
  });

  app.get("/api/quiet/:date", requireAuth, async (req, res) => {
    const uid = userId(req);
    const date = dateParam(req);
    const user = await currentUser(uid);
    const [exposure, stillness, breathwork] = await Promise.all([
      storage.getExposure(uid, date), storage.listStillness(uid, date, date), storage.listBreathwork(uid, date, date),
    ]);

    // Android events path, when the client supplies the waking window.
    let events: ReturnType<typeof quietFromEvents> | null = null;
    const wake = typeof req.query.wake === "string" ? req.query.wake : null;
    const sleep = typeof req.query.sleep === "string" ? req.query.sleep : null;
    if (wake && sleep && !Number.isNaN(Date.parse(wake)) && !Number.isNaN(Date.parse(sleep))) {
      const rows = await storage.listPhoneEvents(uid, new Date(wake).toISOString(), new Date(sleep).toISOString());
      const pickups = rows.filter(r => r.kind === "pickup").map(r => r.at);
      if (pickups.length) events = quietFromEvents(pickups, wake, sleep, user.timeZone ?? "UTC");
    }

    res.json({
      date,
      exposure,
      hourlyPickups: exposure?.hourlyPickups ? JSON.parse(exposure.hourlyPickups) : null,
      events,
      estimated: exposure?.quietSource === "hourly_estimate",
      stillness,
      breathwork,
      stillnessMin: stillness.reduce((a, s) => a + s.minutes, 0) + breathwork.reduce((a, s) => a + s.durationMin, 0),
    });
  });

  // ── Trends ────────────────────────────────────────────────────────────────
  app.get("/api/trends", requireAuth, async (req, res) => {
    const uid = userId(req);
    const { from, to } = rangeQuery(req);
    if (!from || !to || from > to) throw badRequest("from and to are required, with from ≤ to");
    const lastFrom = addDays(from, -7), lastTo = addDays(from, -1);
    const [exposure, sleep] = await Promise.all([
      storage.listExposure(uid, lastFrom, to),
      storage.listSleep(uid, undefined, addDays(to, 1)),
    ]);
    const sleepByDate = new Map(sleep.map(s => [s.date, s]));
    const expByDate = new Map(exposure.map(e => [e.date, e]));
    const day = (d: string) => {
      const e = expByDate.get(d);
      const next = sleepByDate.get(addDays(d, 1));
      return { date: d, screenMin: e?.totalMin ?? null, pickups: e?.pickups ?? null,
        source: e?.source ?? null, nextMorningHrv: next?.hrv ?? null, nextSleepScore: next?.sleepScore ?? null };
    };
    const span = (a: string, b: string) => {
      const out = [];
      for (let d = a; d <= b; d = addDays(d, 1)) out.push(day(d));
      return out;
    };
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null);
      return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null;
    };
    const summary = (days: ReturnType<typeof day>[]) => ({
      screenMin: avg(days.map(d => d.screenMin)),
      pickups: avg(days.map(d => d.pickups)),
      hrv: avg(days.map(d => d.nextMorningHrv)),
      sleepScore: avg(days.map(d => d.nextSleepScore)),
    });
    const nights = sleep.map(toNight);
    const loggedNights = comparableNights(nights, to).length;
    const thisWeek = span(from, to);
    res.json({
      from, to,
      days: thisWeek,
      thisWeek: summary(thisWeek),
      lastWeek: summary(span(lastFrom, lastTo)),
      loggedNights,
      nightsForAssociation: 21,
      association: screenHrvAssociation(
        exposure.filter(e => e.date >= from && e.date <= to).map(e => ({ date: e.date, totalMin: e.totalMin })),
        nights, loggedNights),
    });
  });

  // ── Fasting (instants, not calendar dates) ────────────────────────────────
  app.get("/api/fasting/active", requireAuth, async (req, res) => {
    res.json(await storage.getActiveFast(userId(req)));
  });

  app.get("/api/fasting/history", requireAuth, async (req, res) => {
    res.json(await storage.getFastingHistory(userId(req), 30));
  });

  app.post("/api/fasting/start", requireAuth, async (req, res) => {
    const body = z.object({
      goalHours: z.number().min(1).max(72).default(16),
      startedAt: zIsoInstant.optional(),
    }).strict().parse(req.body ?? {});
    res.json(await storage.startFast(userId(req), body.startedAt ?? deps.now().toISOString(), body.goalHours));
  });

  app.post("/api/fasting/end", requireAuth, async (req, res) => {
    const body = z.object({
      id: z.number().int().positive(),
      notes: z.string().max(2000).optional(),
      endedAt: zIsoInstant.optional(),
    }).strict().parse(req.body);
    const row = await storage.endFast(userId(req), body.id, body.endedAt ?? deps.now().toISOString(), body.notes);
    if (!row) throw notFound();
    res.json(row);
  });

  app.patch("/api/fasting/:id", requireAuth, async (req, res) => {
    const body = z.object({ startedAt: zIsoInstant.optional(), endedAt: zIsoInstant.optional() }).strict().parse(req.body);
    const row = await storage.updateFastTimes(userId(req), idParam(req), body.startedAt, body.endedAt);
    if (!row) throw notFound();
    res.json(row);
  });

  app.delete("/api/fasting/:id", requireAuth, async (req, res) => {
    res.json({ ok: await storage.deleteFast(userId(req), idParam(req)) });
  });
}

/** Shared by POST /api/exposure and the screenshot commit. */
export async function saveExposure(deps: RouteDeps, uid: number, body: z.infer<typeof zExposure>) {
  const { wakeHour, sleepHour, hourlyPickups, topApps, lowConfidenceFields, ...fields } = body;
  let quiet: Record<string, number | string | null> = {};
  if (hourlyPickups) {
    const q = quietFromHourly(hourlyPickups, wakeHour ?? 7, sleepHour ?? 24);
    quiet = {
      longestQuietMin: q.longestQuietMin, quietStretches30: q.quietStretches30,
      quietMinutes30Total: q.quietMinutes30Total, pickupsAfter21: q.pickupsAfter21, quietSource: "hourly_estimate",
    };
  } else if (fields.longestQuietMin != null) {
    quiet = { quietSource: "manual" };
  }
  return deps.storage.upsertExposure(uid, {
    ...fields,
    platform: fields.platform ?? null,
    topApps: topApps ? JSON.stringify(topApps) : null,
    hourlyPickups: hourlyPickups ? JSON.stringify(hourlyPickups) : null,
    lowConfidenceFields: lowConfidenceFields?.length ? JSON.stringify(lowConfidenceFields) : null,
    ...quiet,
  });
}
