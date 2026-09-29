// Screenshot parsing (HANDOFF §0): /api/parse-screenshot → /api/commit-screenshot.
// Screenshots are sent to OpenAI for parsing; the privacy text says so.
// Screen Time screenshots show app names and usage.
import type { Express } from "express";
import multer from "multer";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { z } from "zod";
import { badRequest, HttpError, requireAuth, userId, zLocalDate } from "../http";
import { saveExposure, zExposure } from "./daily";
import type { RouteDeps } from ".";

const upload = multer({
  dest: path.join(os.tmpdir(), "resonance-uploads"),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const LOW_CONFIDENCE = 0.7;

const JSON_RULES = `CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object. No markdown. No explanation. No backticks. Start with { end with }.
- Never omit a field — use null for anything not visible.
- All numbers must be actual numbers, never strings.`;

const SLEEP_PROMPT = `You extract data from a sleep summary screenshot (any watch or ring app).

${JSON_RULES}

Return: {"type":"sleep","data":{...},"confidence":{...}}

FIELD RULES:
- "date": the wake date as YYYY-MM-DD if a date is visible, otherwise null.
- "hours": total sleep in decimal hours ("6h 53m" → 6.88).
- "sleep_score": the score numerator only ("80 / 100" → 80).
- "hrv": average overnight HRV in ms. NOT a 7-day average.
- "resting_hr": resting heart rate in bpm. NOT the average overnight heart rate.
"confidence": for each field, a number from 0 to 1: how sure you are the value is read correctly (1 = clearly legible).

{"type":"sleep","data":{"date":…,"hours":…,"sleep_score":…,"hrv":…,"resting_hr":…},"confidence":{"date":…,"hours":…,"sleep_score":…,"hrv":…,"resting_hr":…}}`;

const SCREEN_TIME_PROMPT = `You extract data from an iOS Screen Time or Android Digital Wellbeing screenshot for ONE day.

${JSON_RULES}

Return: {"type":"screen_time","platform":"ios"|"android","data":{...},"confidence":{...}}

FIELD RULES (all durations in whole minutes: "5h 47m" → 347):
- "total_min": total screen time for the day.
- "pickups": number of pickups (iOS) or unlocks (Android).
- "notifications": number of notifications.
- "social_min", "entertainment_min", "productivity_min", "other_min": category totals if shown (iOS categories: Social, Entertainment, Productivity & Finance; put anything else, e.g. Uncategorized, in other_min).
- "top_apps": up to 5 most-used apps as [{"name": string, "minutes": number}], in the order shown.
- "hourly_pickups": if a per-hour pickups chart is visible, 24 numbers for hours 0–23 (read bar heights against the axis; 0 where no bar); otherwise null.
"confidence": for each field, a number from 0 to 1: how sure you are the value is read correctly. Use a low value when digits are cropped, blurred or estimated from a chart.

{"type":"screen_time","platform":…,"data":{"total_min":…,"pickups":…,"notifications":…,"social_min":…,"entertainment_min":…,"productivity_min":…,"other_min":…,"top_apps":…,"hourly_pickups":…},"confidence":{"total_min":…,"pickups":…,"notifications":…,"social_min":…,"entertainment_min":…,"productivity_min":…,"other_min":…,"top_apps":…,"hourly_pickups":…}}`;

function extractJson(raw: string): any {
  const stripped = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const m = stripped.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Response did not contain valid JSON");
  return JSON.parse(m[0]);
}

/** Per-field confidence → the fields the screen should highlight for checking. */
export function lowConfidenceFields(confidence: Record<string, unknown> | undefined, data: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(data)) {
    if (data[k] == null) continue;
    const c = Number(confidence?.[k]);
    if (!Number.isFinite(c) || c < LOW_CONFIDENCE) out.push(k);
  }
  return out;
}

export function registerScreenshotRoutes(app: Express, deps: RouteDeps) {
  app.post("/api/parse-screenshot", requireAuth, upload.single("image"), async (req, res) => {
    const tempPath = req.file?.path ?? null;
    try {
      if (!deps.vision) throw new HttpError(503, "Screenshot parsing isn't configured on this server.");
      if (!req.file) throw badRequest("No image uploaded");
      if (!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(req.file.mimetype)) throw badRequest("Upload a PNG, JPEG, WebP or HEIC image");
      const kind = z.enum(["sleep", "screen_time"]).default("screen_time").parse(req.body?.kind || undefined);
      const base64 = fs.readFileSync(req.file.path).toString("base64");
      const parsed = extractJson(await deps.vision(kind === "sleep" ? SLEEP_PROMPT : SCREEN_TIME_PROMPT, base64, req.file.mimetype));
      if (!parsed?.type || !parsed?.data) throw new Error("Unexpected response structure from vision model");
      res.json({ ok: true, ...parsed, lowConfidenceFields: lowConfidenceFields(parsed.confidence, parsed.data) });
    } finally {
      if (tempPath) fs.promises.unlink(tempPath).catch(() => {});
    }
  });

  const zCommit = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("sleep"),
      data: z.object({
        date: zLocalDate,
        hours: z.number().min(0).max(24).nullable().optional(),
        sleep_score: z.number().int().min(0).max(100).nullable().optional(),
        hrv: z.number().positive().max(400).nullable().optional(),
        resting_hr: z.number().int().min(20).max(200).nullable().optional(),
        hrv_device: z.string().trim().max(120).optional(),
      }),
    }),
    z.object({ type: z.literal("screen_time"), data: zExposure.omit({ source: true }) }),
  ]);

  // The client confirms (and edits) the parsed values, then commits them with its own local date.
  app.post("/api/commit-screenshot", requireAuth, async (req, res) => {
    const uid = userId(req);
    const body = zCommit.parse(req.body);
    if (body.type === "screen_time") {
      const row = await saveExposure(deps, uid, { ...body.data, source: "screenshot" });
      return res.json({ ok: true, type: "screen_time", exposure: row });
    }
    const d = body.data;
    const user = (await deps.storage.getUserById(uid))!;
    const hrvDevice = d.hrv_device?.trim() || user.defaultHrvDevice;
    if (d.hrv != null && !hrvDevice) throw badRequest("Every HRV reading needs its source: the device and app it came from.");
    const patch = Object.fromEntries(Object.entries({
      hours: d.hours, sleepScore: d.sleep_score, hrv: d.hrv, restingHr: d.resting_hr,
      ...(d.hrv != null ? { hrvSource: "device_manual", hrvDevice } : {}),
    }).filter(([, v]) => v != null));
    // A screenshot HRV is an overnight value: it carries no posture.
    if (d.hrv != null) Object.assign(patch, { hrvPosture: null, hrvOffPosture: false });
    const sleep = await deps.storage.upsertSleep(uid, d.date, patch);
    res.json({ ok: true, type: "sleep", sleep });
  });
}
