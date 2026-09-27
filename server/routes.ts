import type { Express } from "express";
import type { Server } from "http";
import { storage, pool } from "./storage";
import {
  insertActivitySchema, insertMealSchema, insertSleepSchema,
  insertBreathworkSchema, insertPostureSchema, insertWorkSchema,
  insertPracticeSchema, insertHealthMarkerSchema, insertGoalSchema,
  insertFoodEntrySchema,
} from "@shared/schema";
import { z } from "zod";
import { execSync } from "child_process";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import _FitParserImport from "fit-file-parser";
const FitParser: any = (_FitParserImport as any).default ?? _FitParserImport;
import { XMLParser } from "fast-xml-parser";
import { registerStravaRoutes } from "./strava-routes";

const upload = multer({ dest: "/tmp/kewt-uploads/" });

// ─── Strava Pipedream connector ───────────────────────────────────────────────
function stravaFetchActivities(perPage = 30, page = 1): any[] {
  try {
    const payload = JSON.stringify({
      source_id: "strava__pipedream",
      tool_name: "strava-get-activity-list",
      arguments: { per_page: perPage, page },
    });
    const result = execSync(`external-tool call '${payload}'`, { timeout: 30000 }).toString();
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.result && Array.isArray(parsed.result)) return parsed.result;
    if (parsed.body && Array.isArray(JSON.parse(parsed.body))) return JSON.parse(parsed.body);
    if (typeof parsed.body === "string") {
      const body = JSON.parse(parsed.body);
      if (Array.isArray(body)) return body;
    }
    return [];
  } catch (e: any) {
    console.error("Strava fetch error:", e.message);
    return [];
  }
}

// ─── Garmin sync state (in-memory) ───────────────────────────────────────────
const integrationTokens: Record<string, { token: string; connectedAt: string }> = {};
let garminCredentials: { email: string; password: string; savedAt: string } | null = null;
let garminSyncState: {
  status: "idle" | "running" | "success" | "error";
  log: string[]; downloaded: number; imported: number;
  startedAt: string | null; finishedAt: string | null; error: string | null;
} = { status: "idle", log: [], downloaded: 0, imported: 0, startedAt: null, finishedAt: null, error: null };
const garminSseClients: Set<any> = new Set();

function garminLog(msg: string) {
  console.log("[Garmin]", msg);
  garminSyncState.log.push(msg);
  const data = JSON.stringify({ type: "log", message: msg, state: garminSyncState });
  Array.from(garminSseClients).forEach(client => {
    try { client.write(`data: ${data}\n\n`); } catch {}
  });
}

async function runGarminSync(userId: number, email: string, password: string) {
  const { chromium } = await import("playwright");
  const downloadDir = `/tmp/kewt-garmin-${Date.now()}`;
  fs.mkdirSync(downloadDir, { recursive: true });

  garminSyncState.status = "running";
  garminSyncState.log = [];
  garminSyncState.downloaded = 0;
  garminSyncState.imported = 0;
  garminSyncState.error = null;
  garminSyncState.startedAt = new Date().toISOString();
  garminSyncState.finishedAt = null;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
  });

  try {
    garminLog("Launching browser...");
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });

    garminLog("Navigating to Garmin Connect login page...");
    await page.goto(
      "https://sso.garmin.com/portal/sso/en-US/sign-in?clientId=GarminConnect&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F",
      { waitUntil: "networkidle", timeout: 40000 }
    );

    garminLog("Waiting for login form...");
    await page.waitForSelector("#email, input[name=email], input[type=email]", { timeout: 20000 });
    garminLog("Entering credentials...");
    await page.fill("#email", email);
    await page.fill("#password", password);
    garminLog("Submitting login...");
    await page.click("button[type=submit]");

    garminLog("Waiting for authentication response...");
    try {
      await page.waitForURL(url => url.href.includes("connect.garmin.com") || url.href.includes("garmin.com/modern"), { timeout: 35000 });
      garminLog("Login successful — landed on Garmin Connect.");
    } catch {
      const currentUrl = page.url();
      garminLog(`Current URL after login attempt: ${currentUrl}`);
      if (currentUrl.includes("connect.garmin.com")) {
        garminLog("Login successful (URL check fallback).");
      } else {
        const pageText = await page.innerText("body").catch(() => "");
        if (pageText.toLowerCase().includes("verification") || pageText.toLowerCase().includes("two-factor") || pageText.toLowerCase().includes("two factor") || pageText.toLowerCase().includes("authenticator")) {
          throw new Error("MFA_REQUIRED: Your Garmin account has two-factor authentication enabled. Please temporarily disable MFA in your Garmin account settings, then try again.");
        }
        throw new Error(`Login timed out. Current page: ${currentUrl}. Check your credentials or temporarily disable MFA.`);
      }
    }

    garminLog("Navigating to Activities list...");
    await page.goto("https://connect.garmin.com/modern/activities", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".activity-name-link, [class*='activity'], .list-item", { timeout: 15000 }).catch(() => { garminLog("Activity list selector not found — trying to proceed anyway..."); });

    garminLog("Fetching recent activity list via Garmin API...");
    const activitiesResponse = await page.evaluate(async () => {
      const resp = await fetch("https://connect.garmin.com/activitylist-service/activities/search/activities?limit=20&start=0&sortField=startLocal&sortOrder=desc", {
        credentials: "include",
        headers: { "NK": "NT", "X-app-ver": "4.85.2.0", "accept": "application/json, text/plain, */*" },
      });
      if (!resp.ok) return null;
      return resp.json();
    });

    if (!activitiesResponse || !Array.isArray(activitiesResponse)) {
      throw new Error("Could not fetch activity list from Garmin Connect.");
    }

    garminLog(`Found ${activitiesResponse.length} recent activities on Garmin Connect.`);
    const toDownload = activitiesResponse.slice(0, 10);
    const downloadedFiles: string[] = [];

    for (let i = 0; i < toDownload.length; i++) {
      const act = toDownload[i];
      const actId = act.activityId;
      const actName = act.activityName || `Activity ${actId}`;
      garminLog(`Downloading [${i+1}/${toDownload.length}] ${actName}...`);
      try {
        const fitBuffer = await page.evaluate(async (id: number) => {
          const resp = await fetch(`https://connect.garmin.com/download-service/files/activity/${id}`, { credentials: "include" });
          if (!resp.ok) return null;
          const buf = await resp.arrayBuffer();
          return Array.from(new Uint8Array(buf));
        }, actId);
        if (fitBuffer && fitBuffer.length > 0) {
          const fitPath = path.join(downloadDir, `${actId}.zip`);
          fs.writeFileSync(fitPath, Buffer.from(fitBuffer));
          downloadedFiles.push(fitPath);
          garminSyncState.downloaded++;
          garminLog(`Downloaded: ${actName} (${Math.round(fitBuffer.length / 1024)} KB)`);
        } else {
          garminLog(`Skipped ${actName} — download returned empty.`);
        }
      } catch (dlErr: any) {
        garminLog(`Failed to download ${actName}: ${dlErr.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    garminLog(`Downloaded ${downloadedFiles.length} files. Extracting and parsing...`);
    let importedCount = 0;

    for (const zipPath of downloadedFiles) {
      try {
        const unzipDir = zipPath.replace(".zip", "_unzipped");
        fs.mkdirSync(unzipDir, { recursive: true });
        execSync(`unzip -o "${zipPath}" -d "${unzipDir}" 2>/dev/null || true`);
        const fitFiles = fs.readdirSync(unzipDir).filter(f => f.toLowerCase().endsWith(".fit"));
        for (const fitFile of fitFiles) {
          const fitPath2 = path.join(unzipDir, fitFile);
          const fitData = fs.readFileSync(fitPath2);
          await new Promise<void>((resolve) => {
            // Parse in raw SI units (meters, m/s) so the conversions below are
            // explicit and correct. Configuring lengthUnit: "mi" here would
            // make total_distance and total_ascent come back already converted,
            // and the / 1609.344 and * 3.28084 below would crush them again.
            const parser = new FitParser({ force: true, speedUnit: "m/s", lengthUnit: "m", temperatureUnit: "celsius", mode: "both" });
            parser.parse(fitData, async (error: any, data: any) => {
              if (error) { garminLog(`Parse error for ${fitFile}: ${error.message}`); resolve(); return; }
              const sessions: any[] = data.activity?.sessions || data.sessions || [];
              const allRecords: any[] = data.activity?.records || data.records || [];
              const allLaps: any[] = data.activity?.laps || data.laps || [];
              for (const session of sessions) {
                try {
                  const sport = (session.sport || "cycling").toLowerCase();
                  const typeMap: Record<string, string> = { cycling: "cycling", running: "running", walking: "walking", swimming: "swimming", hiking: "hiking", strength_training: "strength", generic: "other" };
                  const modality = typeMap[sport] || "other";
                  const startDt = session.start_time ? new Date(session.start_time) : new Date();
                  const fitDateStr = `${startDt.getFullYear()}-${String(startDt.getMonth()+1).padStart(2,"0")}-${String(startDt.getDate()).padStart(2,"0")}`;
                  const durationMin = session.total_elapsed_time ? Math.round(session.total_elapsed_time / 60) : 1;
                  // Distance source priority (all values in meters from the
                  // raw-SI parser config above):
                  //   1. session.total_distance
                  //   2. last record's accumulated distance
                  //   3. sum of lap.total_distance
                  //   4. avg_speed (m/s) * elapsed seconds
                  // Never use the first record's distance as a session total.
                  const lastRec = allRecords.length ? allRecords[allRecords.length - 1] : null;
                  const lapSum = allLaps.reduce((s: number, l: any) => s + (l.total_distance || 0), 0);
                  const distMeters: number | undefined =
                      (session.total_distance && session.total_distance > 0) ? session.total_distance
                    : (lastRec && lastRec.distance > 0)                       ? lastRec.distance
                    : (lapSum > 0)                                             ? lapSum
                    : (session.avg_speed && session.total_elapsed_time)        ? session.avg_speed * session.total_elapsed_time
                    : undefined;
                  const distanceMiles = distMeters !== undefined
                    ? Math.round((distMeters / 1609.344) * 100) / 100
                    : undefined;
                  const notesParts = [
                    session.avg_power ? `Avg power: ${session.avg_power}W` : null,
                    session.normalized_power ? `NP: ${session.normalized_power}W` : null,
                    session.total_ascent ? `Elevation: +${Math.round(session.total_ascent * 3.28084)}ft` : null,
                    session.avg_cadence ? `Cadence: ${session.avg_cadence}rpm` : null,
                    session.avg_heart_rate ? `Avg HR: ${session.avg_heart_rate}bpm` : null,
                    "[Garmin Connect auto-sync]",
                  ].filter(Boolean).join(" | ");
                  await storage.createActivity(userId, {
                    date: fitDateStr,
                    modality, durationMin, distanceMiles,
                    elevationFt: session.total_ascent ? Math.round(session.total_ascent * 3.28084) : undefined,
                    avgHr: session.avg_heart_rate,
                    estCalsBurned: session.total_calories,
                    notes: notesParts,
                    source: "garmin_connect",
                  });
                  importedCount++;
                  garminSyncState.imported = importedCount;
                  garminLog(`Imported: ${modality} ${fitDateStr} (${durationMin}min)`);
                } catch (saveErr: any) {
                  garminLog(`Save error: ${saveErr.message}`);
                }
              }
              resolve();
            });
          });
        }
        fs.rmSync(unzipDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
      } catch (extractErr: any) {
        garminLog(`Extraction error: ${extractErr.message}`);
      }
    }

    garminLog(`Sync complete. ${importedCount} activit${importedCount === 1 ? "y" : "ies"} imported into KEWT.`);
    garminSyncState.status = "success";
    garminSyncState.finishedAt = new Date().toISOString();
  } catch (err: any) {
    const errMsg = err.message || String(err);
    garminLog(`Error: ${errMsg}`);
    garminSyncState.status = "error";
    garminSyncState.error = errMsg;
    garminSyncState.finishedAt = new Date().toISOString();
  } finally {
    await browser.close();
    const data = JSON.stringify({ type: "complete", state: garminSyncState });
    Array.from(garminSseClients).forEach(client => {
      try { client.write(`data: ${data}\n\n`); client.end(); } catch {}
    });
    garminSseClients.clear();
  }
}

// ─── Modality normalizer (canonical lowercase sport names) ──────────────────
function normalizeModality(raw: string | undefined | null): string {
  const s = (raw || "").toLowerCase().trim();
  const map: Record<string, string> = {
    run: "running", running: "running", "trail run": "running", "trail running": "running",
    walk: "walking", walking: "walking",
    bike: "cycling", ride: "cycling", cycling: "cycling", biking: "cycling",
    "indoor cycling": "cycling", "virtual ride": "cycling", "road cycling": "cycling",
    road_gravel: "cycling", gravel: "cycling", "gravel ride": "cycling",
    "road gravel": "cycling", "mountain bike": "cycling", mtb: "cycling",
    "road bike": "cycling", ebike: "cycling",
    swim: "swimming", swimming: "swimming",
    hike: "hiking", hiking: "hiking",
    strength: "strength", strength_training: "strength", "strength training": "strength",
    weights: "strength", lifting: "strength", weight_training: "strength",
    yoga: "yoga", rucking: "rucking",
    breathwork: "breathwork", meditation: "meditation",
    generic: "other", workout: "other", activity: "other",
  };
  return map[s] || s || "other";
}

// ─── Auth guard middleware ────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// IG Post Generator and draft queue access. Per Mark, only he and his wife
// Trish use the system right now, and Trish's exact email is unknown. Mark's
// email is allowlisted by string; the second user is identified by being
// among the first two registered accounts (id <= 2). New accounts must
// either have an allowlisted email or be added explicitly to IG_ALLOW_EMAILS
// below.
const IG_ALLOW_EMAILS = new Set<string>([
  "kantners@gmail.com",
  // "trish@example.com", // add Trish's exact email when known to lock down by email only
]);
const IG_FALLBACK_MAX_ID = 2;
async function requireIGAccess(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const emailOk = IG_ALLOW_EMAILS.has(user.email.toLowerCase());
    const idOk = user.id <= IG_FALLBACK_MAX_ID;
    if (!emailOk && !idOk) return res.status(403).json({ error: "Post Generator access not enabled for this account" });
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ─── Route registration ───────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── Auth routes (public) ──────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName } = req.body as { email: string; password: string; firstName?: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ error: "An account with this email already exists" });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, passwordHash, firstName: firstName || null });
      req.session.userId = user.id;
      res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, onboardingComplete: false } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid email or password" });
      req.session.userId = user.id;
      const loginProfile = await pool.query("SELECT onboarding_complete FROM user_profile WHERE user_id = $1", [user.id]);
      const onboardingComplete = loginProfile.rows[0]?.onboarding_complete === 1 || loginProfile.rows[0]?.onboarding_complete === true;
      res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, onboardingComplete } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const user = await storage.getUserById(req.session.userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const meProfile = await pool.query("SELECT onboarding_complete, is_premium FROM user_profile WHERE user_id = $1", [user.id]);
      const onboardingComplete = meProfile.rows[0]?.onboarding_complete === 1 || meProfile.rows[0]?.onboarding_complete === true;
      const isPremium = meProfile.rows[0]?.is_premium === 1 || meProfile.rows[0]?.is_premium === true;
      res.json({ id: user.id, email: user.email, firstName: user.firstName, onboardingComplete, isPremium });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Env check (public) ────────────────────────────────────────────────────
  app.get("/api/env-check", (_, res) => {
    res.json({ OPENAI_API_KEY: !!process.env.OPENAI_API_KEY, NODE_ENV: process.env.NODE_ENV });
  });

  // ── Demo endpoints (PUBLIC, view-only sample data) ────────────────────────
  // These are intentionally registered BEFORE the global auth middleware so
  // /demo testers can hit them without an account. They return constants
  // only; no DB read, no DB write, no session, no user identifiers. They
  // exist for the /demo route in the client; real auth-protected endpoints
  // remain untouched.
  const DEMO_TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const demoDateOffset = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  app.get("/api/demo/me", (_req, res) => {
    res.json({ id: 0, email: "demo@kewt.local", firstName: "Demo", onboardingComplete: true });
  });

  app.get("/api/demo/dashboard", (_req, res) => {
    res.json({
      currentWeight: 184.2,
      weightTrend: Array.from({ length: 14 }).map((_, i) => ({ date: demoDateOffset(13 - i), weight: 186.1 - i * 0.13 + (i % 3 === 0 ? 0.4 : 0) })),
      weeklyDeficit: Array.from({ length: 7 }).map((_, i) => ({ date: demoDateOffset(6 - i), intake: 2150 + (i % 2 === 0 ? 120 : -90), burn: 2680, deficit: 530 + (i % 2 === 0 ? -120 : 90) })),
      runningPaceTrend: [
        { date: demoDateOffset(11), pace: 8.95 },
        { date: demoDateOffset(7),  pace: 8.82 },
        { date: demoDateOffset(3),  pace: 8.65 },
      ],
      recoveryScore: 72,
      hasTodayData: true,
      topInsights: [
        "Three consecutive nights in the 7-9.5 hour band; recovery base looks supported.",
        "Recent HRV is 4 ms above the prior window; training intensity is sustainable.",
        "Weekly deficit averaged 470 kcal across 7 days; trend is consistent with slow fat loss.",
      ],
      goals: [
        { id: 1, label: "Goal Weight", type: "weight", startValue: 196, currentValue: 184.2, targetValue: 178, unit: "lbs", targetDate: "2026-08-01", notes: "Sustainable cut" },
        { id: 2, label: "Sub-8:00 5K pace", type: "running", startValue: 9.4, currentValue: 8.65, targetValue: 7.9, unit: "min/mi", targetDate: "2026-09-15", notes: "Mix of Zone 2 + intervals" },
        { id: 3, label: "Walking Streak", type: "streak", startValue: 0, currentValue: 38, targetValue: 100, unit: "days", targetDate: "2026-10-30", notes: "Daily 30 min minimum" },
      ],
      streaks: { breathwork: 9, practice: 4, walk: 38 },
      todaySleep: { sleep_score: 84, hours: 7.8, hrv: 51, body_battery_change: 32, resting_hr: 52, spo2_avg: 95, deep_min: 78, rem_min: 102 },
      todayActivity: { distance_miles: 4.2, est_cals_burned: 412, duration_min: 38 },
      todayActivities: [{ id: 9001, date: DEMO_TODAY, modality: "running", durationMin: 38, distanceMiles: 4.2, avgHr: 142, estCalsBurned: 412, intensity: "moderate", notes: null }],
      recentActivities: [{ id: 9001, date: DEMO_TODAY, modality: "running", durationMin: 38, distanceMiles: 4.2, avgHr: 142, estCalsBurned: 412 }],
      recentActivityDate: DEMO_TODAY,
      weekActivities: Array.from({ length: 5 }).map((_, i) => ({ id: 9001 + i, date: demoDateOffset(i * 2), modality: i % 2 === 0 ? "running" : "walking", durationMin: 35 + i * 5, distanceMiles: 3.5 + i * 0.4, avgHr: 138 + i, estCalsBurned: 380 + i * 30 })),
      weeklyMiles: { thisWeek: 18.7, lastWeek: 16.2 },
      sleepTrend: "Stable",
      inflammationSignal: null,
      arcModality: "running",
      arcMetric: "pace",
      arcWindow: 56,
      arcPR: 7.92,
      readinessBreakdown: { hrv: 51, sleepScore: 84, restingHr: 52, bodyBattery: 78, composite: 72, label: "High" as const, color: "#10b981" },
      coachLine: "Today reads as a supportive day. Train as planned, hydrate, and avoid judging body weight from a single morning reading.",
      activeFast: null,
      todayFoodEntries: [],
    });
  });

  app.get("/api/demo/sleep", (_req, res) => {
    // 14 nights of realistic, varied sample sleep data.
    const nights = Array.from({ length: 14 }).map((_, i) => {
      const idx = 13 - i;
      const variance = (i * 37) % 100 / 100;
      const hours = 7.4 + (variance - 0.5) * 1.2;
      const sleepScore = Math.round(72 + variance * 18);
      return {
        id: 8000 + i,
        date: demoDateOffset(idx),
        hours: Math.round(hours * 100) / 100,
        quality: 7 + (i % 3),
        sleepScore,
        restingHr: 50 + Math.round(variance * 6),
        avgOvernightHr: 54 + Math.round(variance * 5),
        deepMin: 60 + Math.round(variance * 35),
        lightMin: 250 + Math.round(variance * 80),
        remMin: 80 + Math.round(variance * 40),
        awakeMin: 8 + Math.round(variance * 14),
        restlessMoments: 12 + Math.round(variance * 25),
        hrv: 44 + Math.round(variance * 14),
        spo2Avg: 94 + Math.round(variance * 3),
        spo2Low: 90 + Math.round(variance * 4),
        respirationAvg: 14 + Math.round(variance * 2),
        respirationLow: 10 + Math.round(variance * 2),
        stress: 18 + Math.round(variance * 14),
        bodyBatteryChange: 25 + Math.round(variance * 25),
        hrvStatus: ["Balanced", "Balanced", "Low", "Balanced"][i % 4],
        moodMorning: 7 + (i % 3),
        fellAsleep: "22:48",
        wokeUp: "06:32",
        notes: null,
      };
    });
    res.json(nights);
  });

  app.get("/api/demo/goals", (_req, res) => {
    res.json([
      { id: 1, label: "Goal Weight", type: "weight", startValue: 196, currentValue: 184.2, targetValue: 178, unit: "lbs", targetDate: "2026-08-01", notes: "Sustainable cut" },
      { id: 2, label: "Sub-8:00 5K pace", type: "running", startValue: 9.4, currentValue: 8.65, targetValue: 7.9, unit: "min/mi", targetDate: "2026-09-15", notes: "Mix of Zone 2 + intervals" },
      { id: 3, label: "Walking Streak", type: "streak", startValue: 0, currentValue: 38, targetValue: 100, unit: "days", targetDate: "2026-10-30", notes: "Daily 30 min minimum" },
    ]);
  });

  app.get("/api/demo/foods", (_req, res) => res.json([]));
  app.get("/api/demo/activities", (_req, res) => res.json([
    { id: 9001, date: DEMO_TODAY, modality: "running", durationMin: 38, distanceMiles: 4.2, avgHr: 142, estCalsBurned: 412, intensity: "moderate" },
    { id: 9002, date: demoDateOffset(2), modality: "walking", durationMin: 45, distanceMiles: 2.8, avgHr: 118, estCalsBurned: 220, intensity: "easy" },
    { id: 9003, date: demoDateOffset(4), modality: "running", durationMin: 28, distanceMiles: 3.2, avgHr: 152, estCalsBurned: 340, intensity: "moderate" },
  ]));

  // ── All routes below require authentication ───────────────────────────────
  registerStravaRoutes(app);
  app.use("/api", requireAuth);

  // ── Activities ────────────────────────────────────────────────────────────
  app.get("/api/activities", async (req, res) => {
    try { res.json(await storage.getActivities(req.session.userId!, 90)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const data = insertActivitySchema.parse(req.body);
      res.json(await storage.createActivity(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/activities/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await storage.updateActivity(req.session.userId!, id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/activities/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ok = await storage.deleteActivity(req.session.userId!, id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Meals ─────────────────────────────────────────────────────────────────
  app.get("/api/meals", async (req, res) => {
    try { res.json(await storage.getMeals(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/meals", async (req, res) => {
    try {
      const data = insertMealSchema.parse(req.body);
      res.json(await storage.createMeal(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Food entries (low-friction signal log) ────────────────────────────────
  app.get("/api/foods", async (req: any, res) => {
    try { res.json(await storage.listFoodEntries(req.session.userId!, 14)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/foods", async (req: any, res) => {
    try {
      const data = insertFoodEntrySchema.parse(req.body);
      res.json(await storage.createFoodEntry(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/foods/:id", async (req: any, res) => {
    try {
      const ok = await storage.deleteFoodEntry(req.session.userId!, Number(req.params.id));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Food photo analyzer (AI vision) ───────────────────────────────────────
  // Accepts one image (nutrition label, supplement-facts, container, or
  // whole food), calls OpenAI's gpt-4o-mini vision model for a structured
  // extraction, then auto-saves a food_entries row with source='ai_photo'.
  // Gracefully degrades to 503 with a clear message when OPENAI_API_KEY is
  // not configured, so the UI can still ship.
  app.post("/api/foods/analyze-photo", upload.single("image"), async (req: any, res) => {
    const filePath = req.file?.path;
    const cleanup = () => { if (filePath) { try { fs.unlinkSync(filePath); } catch {} } };
    try {
      if (!req.file) return res.status(400).json({ error: "No image attached" });
      if (req.file.size > 8 * 1024 * 1024) { cleanup(); return res.status(413).json({ error: "Image is over the 8 MB limit" }); }
      const mime = (req.file.mimetype || "").toLowerCase();
      if (!/^image\/(jpe?g|png|webp|heic|heif)$/.test(mime)) {
        cleanup();
        return res.status(415).json({ error: "Unsupported image type; use JPG, PNG, WebP, or HEIC" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        cleanup();
        return res.status(503).json({ error: "AI image analysis unavailable: missing provider config" });
      }

      const dateOverride = (req.body?.date as string | undefined)?.trim();
      const timeOverride = (req.body?.time as string | undefined)?.trim();

      const buf = fs.readFileSync(filePath);
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      cleanup();

      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey });

      const prompt = `You are a careful nutrition extractor for a KEWT wellness app. Look at the image and return STRICT JSON with these keys. Do not invent specific macros for unlabeled whole-food photos.

{
  "product_name": string | null,
  "brand": string | null,
  "serving_size": string | null,
  "calories": number | null,
  "protein_g": number | null,
  "carbs_g": number | null,
  "fat_g": number | null,
  "sugar_g": number | null,
  "fiber_g": number | null,
  "sodium_mg": number | null,
  "potassium_mg": number | null,
  "magnesium_mg": number | null,
  "caffeine_mg": number | null,
  "creatine_g": number | null,
  "ingredients": string | null,
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | "coffee" | "hydration" | "alcohol" | "post_workout" | "other",
  "portion": "light" | "moderate" | "heavy" | null,
  "description": string,
  "tags": string[],
  "confidence": number,
  "warnings": string | null,
  "raw_visible_label_summary": string | null
}

Rules:
- If a nutrition or supplement-facts label is clearly visible, populate numeric fields from the label only.
- For unlabeled whole-food photos, set all numeric fields to null and put a short note in warnings like "estimate from image only".
- tags is a small list drawn from: protein, carbs, caffeine, hydration, alcohol, high_sodium, sugar, processed.
- confidence is between 0 and 1.
- Return JSON only. No prose, no markdown.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ] as any,
        }],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsed: any;
      try { parsed = JSON.parse(raw); }
      catch { return res.status(502).json({ error: "Model did not return JSON", raw }); }

      // Build the auto-save payload. Cap insane numbers as a defensive guard.
      const cap = (n: any, max: number) => (typeof n === "number" && isFinite(n) && n >= 0 && n <= max) ? n : null;
      const intCap = (n: any, max: number) => { const v = cap(n, max); return v == null ? null : Math.round(v); };

      const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
      const localTimeStr = (() => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })();

      const mealType = ["breakfast","lunch","dinner","snack","coffee","hydration","alcohol","post_workout","other"].includes(parsed.meal_type)
        ? parsed.meal_type : "snack";
      const portion  = ["light","moderate","heavy"].includes(parsed.portion) ? parsed.portion : null;
      const tagsArr  = Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === "string") : [];

      const description = typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim().slice(0, 200)
        : (typeof parsed.product_name === "string" ? parsed.product_name.slice(0, 200) : "AI photo entry");

      const payload: any = {
        date: dateOverride || todayStr,
        time: timeOverride || localTimeStr,
        mealType,
        portion,
        description,
        tags: tagsArr.length ? tagsArr.join(",") : null,
        source: "ai_photo",
        confidence: cap(parsed.confidence, 1),
        productName: typeof parsed.product_name === "string" ? parsed.product_name.slice(0, 120) : null,
        brand:       typeof parsed.brand === "string" ? parsed.brand.slice(0, 120) : null,
        servingSize: typeof parsed.serving_size === "string" ? parsed.serving_size.slice(0, 80) : null,
        calories:    intCap(parsed.calories, 5000),
        proteinG:    cap(parsed.protein_g, 500),
        carbsG:      cap(parsed.carbs_g, 1000),
        fatG:        cap(parsed.fat_g, 500),
        sugarG:      cap(parsed.sugar_g, 500),
        fiberG:      cap(parsed.fiber_g, 200),
        sodiumMg:    intCap(parsed.sodium_mg, 50000),
        potassiumMg: intCap(parsed.potassium_mg, 50000),
        magnesiumMg: intCap(parsed.magnesium_mg, 10000),
        caffeineMg:  intCap(parsed.caffeine_mg, 5000),
        creatineG:   cap(parsed.creatine_g, 50),
        ingredients: typeof parsed.ingredients === "string" ? parsed.ingredients.slice(0, 2000) : null,
        warnings:    typeof parsed.warnings === "string" ? parsed.warnings.slice(0, 400) : null,
      };

      let saved: any = null;
      try {
        saved = await storage.createFoodEntry(req.session.userId!, payload);
      } catch (e: any) {
        // Likely cause: food_entries table missing the new AI columns in
        // production. Return the analysis so the UI can show it, with a
        // clear migration hint.
        return res.status(202).json({
          ok: false,
          requiresMigration: true,
          message: "Photo analyzed but could not be saved. The food_entries table may need a migration (npm run db:push).",
          analysis: payload,
          dbError: e?.message,
        });
      }

      res.json({ ok: true, entry: saved, analysis: payload });
    } catch (e: any) {
      cleanup();
      res.status(500).json({ error: e?.message ?? "Photo analysis failed" });
    }
  });

  // ── Sleep ─────────────────────────────────────────────────────────────────
  app.get("/api/sleep", async (req, res) => {
    try { res.json(await storage.getSleepLogs(req.session.userId!, 60)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sleep", async (req, res) => {
    try {
      const data = insertSleepSchema.parse(req.body);
      res.json(await storage.createSleepLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/sleep/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allowed = ["fellAsleep","wokeUp","moodMorning","notes","quality","sleepScore","hours"];
      const patch: any = {};
      for (const k of allowed) { if (req.body[k] !== undefined) patch[k] = req.body[k]; }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateSleepLog(req.session.userId!, id, patch);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Breathwork ────────────────────────────────────────────────────────────
  app.get("/api/breathwork", async (req, res) => {
    try { res.json(await storage.getBreathworkLogs(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/breathwork", async (req, res) => {
    try {
      const data = insertBreathworkSchema.parse(req.body);
      res.json(await storage.createBreathworkLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Posture ───────────────────────────────────────────────────────────────
  app.get("/api/posture", async (req, res) => {
    try { res.json(await storage.getPostureLogs(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/posture", async (req, res) => {
    try {
      const data = insertPostureSchema.parse(req.body);
      res.json(await storage.createPostureLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Work ──────────────────────────────────────────────────────────────────
  app.get("/api/work", async (req, res) => {
    try { res.json(await storage.getWorkLogs(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/work", async (req, res) => {
    try {
      const data = insertWorkSchema.parse(req.body);
      res.json(await storage.createWorkLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Practice ──────────────────────────────────────────────────────────────
  app.get("/api/practice", async (req, res) => {
    try { res.json(await storage.getPracticeLogs(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/practice", async (req, res) => {
    try {
      const data = insertPracticeSchema.parse(req.body);
      res.json(await storage.createPracticeLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Health Markers ────────────────────────────────────────────────────────
  app.get("/api/health-markers/latest", async (req, res) => {
    try { res.json(await storage.getLatestHealthMarker(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/health-markers", async (req, res) => {
    try { res.json(await storage.getHealthMarkers(req.session.userId!, 90)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/health-markers", async (req, res) => {
    try {
      const data = insertHealthMarkerSchema.parse(req.body);
      res.json(await storage.upsertHealthMarker(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Fasting ─────────────────────────────────────────────────────────────────
  app.get("/api/fasting/active", requireAuth, async (req, res) => {
    try { res.json(await storage.getActiveFast(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/fasting/history", requireAuth, async (req, res) => {
    try { res.json(await storage.getFastingHistory(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fasting/start", requireAuth, async (req, res) => {
    try {
      const goalHours = parseFloat(req.body.goalHours) || 16;
      res.json(await storage.startFast(req.session.userId!, goalHours));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fasting/end", requireAuth, async (req, res) => {
    try {
      const { id, notes } = req.body;
      res.json(await storage.endFast(req.session.userId!, Number(id), notes));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/fasting/:id", requireAuth, async (req, res) => {
    try {
      const ok = await storage.deleteFast(req.session.userId!, Number(req.params.id));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/fasting/:id", requireAuth, async (req, res) => {
    try {
      const { startedAt, endedAt } = req.body;
      const row = await (storage as any).updateFastTimes(
        req.session.userId!, Number(req.params.id), startedAt, endedAt
      );
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Fasted Activity Intelligence ─────────────────────────────────────────
  //
  // GET /api/fasting/activity-report/:activityId
  //   Returns a full Fasted Activity Report for one activity if a fasting
  //   session overlaps its window, otherwise returns { fasted: false }.
  //
  // GET /api/fasting/analytics
  //   Returns aggregated stats across all fasted sessions for Analytics tab.

  app.get("/api/fasting/activity-report/:activityId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const activityId = Number(req.params.activityId);

      // ── Fetch the activity ──────────────────────────────────────────────
      const actResult = await pool.query(
        `SELECT * FROM activities WHERE id = $1 AND user_id = $2`, [activityId, userId]
      );
      if (!actResult.rows.length) return res.status(404).json({ error: "Activity not found" });
      const act = actResult.rows[0];

      // Normalize modality so road_gravel, mtb, etc. resolve to cycling
      act.modality = normalizeModality(act.modality);

      // Reconstruct activity timestamps from date + duration.
      // Notes may start with __kewt__:{...} metadata — strip it before searching for ISO.
      const actDate = act.date as string; // YYYY-MM-DD
      const cleanNotes = (act.notes || "").replace(/__kewt__:\{[^}]*\}/, "").trim();
      let actStartISO: string | null = null;
      const isoMatch = cleanNotes.match(/(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+)/);
      if (isoMatch) actStartISO = isoMatch[1];
      // Fallback: use noon UTC on activity date (conservative; fasting overlap still detected)
      if (!actStartISO) actStartISO = actDate + "T16:30:00Z"; // ~noon EDT for today's ride
      const actStartMs  = new Date(actStartISO).getTime();
      const actEndMs    = actStartMs + (act.duration_min ?? 60) * 60_000;
      const actStartISO2 = new Date(actStartMs).toISOString();
      const actEndISO   = new Date(actEndMs).toISOString();

      // ── Find overlapping fasting sessions ───────────────────────────────
      const fastResult = await pool.query(
        `SELECT * FROM fasting_sessions
          WHERE user_id = $1
            AND started_at < $2
            AND (ended_at IS NULL OR ended_at > $3)
          ORDER BY started_at DESC LIMIT 1`,
        [userId, actEndISO, actStartISO2]
      );
      if (!fastResult.rows.length) return res.json({ fasted: false });
      const fast = fastResult.rows[0];

      // ── Fasting window at activity start ─────────────────────────────────
      const fastStartMs    = new Date(fast.started_at).getTime();
      const fastEndMs      = fast.ended_at ? new Date(fast.ended_at).getTime() : Date.now();
      const hoursAtStart   = (actStartMs - fastStartMs) / 3_600_000;
      const hoursAtEnd     = (actEndMs   - fastStartMs) / 3_600_000;
      const stillActiveDuringActivity = !fast.ended_at || new Date(fast.ended_at).getTime() > actEndMs;
      const overlapType = stillActiveDuringActivity ? "full" :
        (fastEndMs > actStartMs && fastEndMs < actEndMs) ? "partial" : "full";

      // ── Metabolic fuel zone ───────────────────────────────────────────────
      const fuelZone = (h: number): { zone: string; story: string; fatPct: number; glycoPct: number } => {
        if (h < 8)  return { zone: "Glycolytic",       story: "Primarily glucose. Glycogen stores available.",                              fatPct: 30, glycoPct: 70 };
        if (h < 12) return { zone: "Transitional",     story: "Mixed substrate. Insulin declining, fat mobilization beginning.",           fatPct: 45, glycoPct: 55 };
        if (h < 16) return { zone: "Fat-Dominant",     story: "Fat oxidation primary. Glycogen reserve available for surges.",             fatPct: 65, glycoPct: 35 };
        if (h < 20) return { zone: "Deep Fat Oxidation", story: "Near-full fat substrate. Autophagy signals active. Cortisol caution.",   fatPct: 80, glycoPct: 20 };
        return             { zone: "Extended Fast",    story: "Deep autophagy. Gluconeogenesis running. Highest cortisol load. Monitor recovery.", fatPct: 90, glycoPct: 10 };
      };
      const fuelAtStart = fuelZone(hoursAtStart);
      const fuelAtEnd   = fuelZone(hoursAtEnd);

      // ── Fuel curve (10 sample points across activity) ────────────────────
      const steps = 10;
      const fuelCurve = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const h = hoursAtStart + t * (hoursAtEnd - hoursAtStart);
        const z = fuelZone(h);
        const minIntoRide = Math.round(t * (act.duration_min ?? 60));
        return { min: minIntoRide, fat: z.fatPct, glyco: z.glycoPct, label: `${minIntoRide}m` };
      });

// ── Power (measured only) ─────────────────────────────────────────────
      // Surface power ONLY when it is an actual recorded value from a power
      // meter (Strava/Garmin weighted average watts). The previous HR-derived
      // and virtual estimators were removed: they fabricated ~31–35W for
      // typical moderate-HR rides (the phantom "33W") and read as real data.
      let powerW: number | null = null;
      let powerTier: string = "none";

      if (act.weighted_avg_watts && act.weighted_avg_watts > 0) {
        powerW = Math.round(act.weighted_avg_watts);
        powerTier = "measured";
      }

      // ── Prior-night sleep for cortisol baseline ───────────────────────────
      // Look back up to 2 days from activity date for most recent sleep record
      const sleepResult = await pool.query(
        `SELECT hrv, sleep_score, resting_hr FROM sleep_logs
          WHERE user_id = $1 AND date <= $2
          ORDER BY date DESC LIMIT 1`,
        [userId, actDate]
      );
      const sleep = sleepResult.rows[0] ?? null;

      // ── Cortisol Burden Index ─────────────────────────────────────────────
      // Three additive tiers → Low / Moderate / Elevated / High
      let cbiScore = 0;
      let cbiFactors: string[] = [];

      // Baseline tier (prior sleep quality)
      if (sleep) {
        const hrv = sleep.hrv ?? null;
        const sc  = sleep.sleep_score ?? null;
        const rhr = sleep.resting_hr ?? null;
        if (hrv !== null && hrv < 45)  { cbiScore += 2; cbiFactors.push("Low HRV overnight"); }
        if (hrv !== null && hrv < 30)  { cbiScore += 1; cbiFactors.push("Very low HRV"); }
        if (sc  !== null && sc < 60)   { cbiScore += 2; cbiFactors.push("Below-average sleep score"); }
        if (rhr !== null && rhr > 58)  { cbiScore += 1; cbiFactors.push("Elevated resting HR"); }
      } else {
        cbiScore += 1; cbiFactors.push("No prior sleep data");
      }

      // Exercise tier
      const dur = act.duration_min ?? 60;
      if (dur >= 120) { cbiScore += 2; cbiFactors.push("Long-duration session (2+ hours)"); }
      else if (dur >= 60) { cbiScore += 1; cbiFactors.push("Moderate-duration session (1-2 hours)"); }
      const intensity = (act.intensity ?? "").toLowerCase();
      if (["hard","mixed"].includes(intensity)) { cbiScore += 1; cbiFactors.push("High-intensity effort"); }

      // Fasting tier
      if (hoursAtStart >= 20) { cbiScore += 3; cbiFactors.push("Extended fasting state (20+ hours)"); }
      else if (hoursAtStart >= 16) { cbiScore += 2; cbiFactors.push("Deep fasting state (16-20 hours)"); }
      else if (hoursAtStart >= 12) { cbiScore += 1; cbiFactors.push("Fat-dominant fasting state (12-16 hours)"); }

      const cbiLabel = cbiScore <= 2 ? "Low" : cbiScore <= 4 ? "Moderate" : cbiScore <= 6 ? "Elevated" : "High";
      const cbiColor = { Low: "#10b981", Moderate: "#f59e0b", Elevated: "#f97316", High: "#ef4444" }[cbiLabel]!;

      // ── Fasted Training Stimulus Score (FTSS, 0-100) ─────────────────────
      // Fasting depth (0-40) + duration weight (0-30) + zone proxy (0-30)
      const fastDepthScore = Math.min(hoursAtStart / 20, 1) * 40;
      const durScore       = Math.min(dur / 240, 1) * 30; // 4-hr ride = full 30
      const hrProxy        = act.avg_hr ? Math.min((act.avg_hr - 100) / 80, 1) * 30 : 15;
      const ftss           = Math.round(Math.min(fastDepthScore + durScore + hrProxy, 100));
      const ftssLabel      = ftss < 25 ? "Recovery" : ftss < 50 ? "Base" : ftss < 75 ? "Build" : "Peak Stimulus";
      const ftssColor      = ftss < 25 ? "#6b7280" : ftss < 50 ? "#10b981" : ftss < 75 ? "#f59e0b" : "#f97316";

      // ── Benefit badges ────────────────────────────────────────────────────
      const autophagySignal = hoursAtStart >= 16 ? "Elevated" : hoursAtStart >= 12 ? "Active" : "Minimal";
      const fatOxLabel      = fuelAtStart.zone;
      const adaptStimulus   = ftssLabel;

      // ── Cortisol arc curve (10 points, time of day based) ────────────────
      // Model: rises from midnight to ~8-9 AM, peaks, falls through afternoon
      // Exercise adds a transient pulse proportional to intensity
      const startHour = new Date(actStartMs).getHours() + new Date(actStartMs).getMinutes() / 60;
      const cortisolCurve = Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const hrOfDay = startHour + t * (dur / 60);
        // Diurnal baseline: peak at 8, trough at 22
        const diurnal = 50 + 30 * Math.cos((hrOfDay - 8) * Math.PI / 14);
        // Exercise pulse
        const exercisePulse = 20 * Math.sin(t * Math.PI);
        // Fasting modifier
        const fastMod = hoursAtStart >= 16 ? 10 : hoursAtStart >= 12 ? 5 : 0;
        const cortisol = Math.round(Math.min(diurnal + exercisePulse + fastMod, 100));
        const minIntoRide = Math.round(t * dur);
        return { min: minIntoRide, cortisol, label: `${minIntoRide}m` };
      });

      // ── Plain-language narrative ──────────────────────────────────────────
      const narrative = [
        `You entered this ${act.modality ?? "activity"} approximately ${Math.round(hoursAtStart)} hours into a fast, placing your body in the ${fuelAtStart.zone.toLowerCase()} zone.`,
        fuelAtStart.fatPct >= 65
          ? `Fat was your primary fuel source, meaning circulating free fatty acids drove the majority of your energy output throughout this session.`
          : `Your body was drawing on a mixed substrate, transitioning progressively toward fat as the session continued.`,
        cbiLabel === "Low" || cbiLabel === "Moderate"
          ? `Cortisol load was ${cbiLabel.toLowerCase()}, supported by ${sleep ? `a sleep score of ${sleep.sleep_score ?? "—"} and HRV of ${sleep.hrv ?? "—"}` : "available recovery data"}.`
          : `Cortisol burden was ${cbiLabel.toLowerCase()}. Prioritize sleep tonight and monitor tomorrow's HRV before training again.`,
      ].join(" ");

      const recoveryForecast = cbiScore <= 3
        ? "Recovery outlook is favorable. Standard sleep should restore baseline readiness."
        : cbiScore <= 5
        ? "Moderate cortisol burden. Prioritize 7-9 hours tonight and watch morning HRV before deciding tomorrow's intensity."
        : "High cortisol load detected. Full rest recommended tonight. Do not assess readiness until morning HRV is recorded.";

      res.json({
        fasted: true,
        overlapType,
        hoursAtStart:   Math.round(hoursAtStart * 10) / 10,
        hoursAtEnd:     Math.round(hoursAtEnd * 10) / 10,
        fuelZoneStart:  fuelAtStart,
        fuelZoneEnd:    fuelAtEnd,
        fuelCurve,
        cortisolCurve,
        cbi:            { score: cbiScore, label: cbiLabel, color: cbiColor, factors: cbiFactors },
        ftss:           { score: ftss, label: ftssLabel, color: ftssColor },
        power:          powerW ? { watts: powerW, tier: powerTier } : null,
        badges: {
          fuelZone:      fatOxLabel,
          autophagySignal,
          adaptStimulus,
          cortisolBurden: cbiLabel,
        },
        narrative,
        recoveryForecast,
        sleep: sleep ? { hrv: sleep.hrv, sleepScore: sleep.sleep_score, restingHr: sleep.resting_hr } : null,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Activity Enrichment — science context for ALL activities ──────────────
  // Returns training zone, load context, modality science, and recovery
  // prescription for any activity regardless of fasting state.
  app.get("/api/activity-enrichment/:activityId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const activityId = Number(req.params.activityId);

      // ── Fetch activity ───────────────────────────────────────────────────
      const actResult = await pool.query(
        "SELECT * FROM activities WHERE id = $1 AND user_id = $2", [activityId, userId]
      );
      if (!actResult.rows.length) return res.status(404).json({ error: "Activity not found" });
      const act = actResult.rows[0];
      const modality = normalizeModality(act.modality ?? "other");
      const dur = act.duration_min ?? 0;
      const avgHr = act.avg_hr ?? null;
      const distMi = act.distance_miles ?? null;
      const elevFt = act.elevation_ft ?? null;
      const powerW = act.weighted_avg_watts ?? null;
      const actDate = act.date as string;

      // ── Prior-night sleep ────────────────────────────────────────────────
      const sleepResult = await pool.query(
        `SELECT hrv, sleep_score, resting_hr, hours FROM sleep_logs
          WHERE user_id = $1 AND date <= $2
          ORDER BY date DESC LIMIT 1`, [userId, actDate]
      );
      const sleep = sleepResult.rows[0] ?? null;

      // ── 7-day rolling load context ────────────────────────────────────────
      const weekResult = await pool.query(
        `SELECT AVG(duration_min) as avg_dur, COUNT(*) as session_count,
                AVG(avg_hr) as avg_hr_week
         FROM activities
         WHERE user_id = $1 AND date < $2
           AND date >= ($2::date - INTERVAL '7 days')`,
        [userId, actDate]
      );
      const weekAvgDur    = parseFloat(weekResult.rows[0]?.avg_dur ?? "0") || null;
      const weekSessions  = parseInt(weekResult.rows[0]?.session_count ?? "0");
      const weekAvgHr     = parseFloat(weekResult.rows[0]?.avg_hr_week ?? "0") || null;

      // ── HR Zone classification ────────────────────────────────────────────
      // Max HR estimate: 220 - 58 (Mark's age) = 162. Used as default.
      // Will be pulled from profile once age field is available.
      const EST_MAX_HR = 162;
      const hrZone = (() => {
        if (!avgHr) return null;
        const pct = avgHr / EST_MAX_HR;
        if (pct < 0.60) return { zone: 1, label: "Zone 1 · Recovery",      color: "#6b7280", pct: Math.round(pct * 100),
          science: "Sub-threshold movement. Promotes active recovery by increasing blood flow to muscles without adding training stress. Parasympathetic nervous system dominant." };
        if (pct < 0.70) return { zone: 2, label: "Zone 2 · Aerobic Base",  color: "#10b981", pct: Math.round(pct * 100),
          science: "The mitochondrial development zone. Sustained Zone 2 increases mitochondrial density by up to 40% over 8 weeks — the primary driver of long-term endurance capacity (Hood et al., 2011). Fat is the dominant substrate at this intensity." };
        if (pct < 0.80) return { zone: 3, label: "Zone 3 · Tempo",         color: "#3b82f6", pct: Math.round(pct * 100),
          science: "Aerobic tempo — the crossover zone where carbohydrate contribution rises sharply. This intensity improves lactate clearance capacity and raises your sustainable power ceiling. Higher training stress than Zone 2; requires more recovery." };
        if (pct < 0.90) return { zone: 4, label: "Zone 4 · Threshold",     color: "#f59e0b", pct: Math.round(pct * 100),
          science: "Lactate threshold training. Sustained effort near your maximum steady-state power. Improves your FTP and lactate clearance rate. High training stress — typically 48-72 hours recovery needed for full adaptation." };
        return              { zone: 5, label: "Zone 5 · VO₂max",           color: "#ef4444", pct: Math.round(pct * 100),
          science: "Maximal aerobic effort. VO₂max is the strongest single predictor of all-cause mortality in adults over 50 — stronger than smoking, diabetes, or hypertension combined (Myers et al., NEJM 2002). These efforts are powerful adaptations but demand full recovery before the next hard session." };
      })();

      // ── Load context vs 7-day rolling average ────────────────────────────
      const loadContext = (() => {
        if (!weekAvgDur || weekSessions === 0) return null;
        const ratio = dur / weekAvgDur;
        if (ratio < 0.7)  return { label: "Recovery",     color: "#10b981", pct: Math.round(ratio * 100),
          text: `This session was ${Math.round((1 - ratio) * 100)}% shorter than your 7-day average — a well-timed recovery effort that allows adaptation from previous training stress.` };
        if (ratio < 1.15) return { label: "On-Track",     color: "#3b82f6", pct: Math.round(ratio * 100),
          text: `Duration was consistent with your recent training load — within 15% of your 7-day average. Sustainable training progression.` };
        if (ratio < 1.30) return { label: "Build",        color: "#f59e0b", pct: Math.round(ratio * 100),
          text: `This session was ${Math.round((ratio - 1) * 100)}% longer than your 7-day average — a productive training stimulus within safe ramp-rate guidelines (≤10% weekly volume increase).` };
        return              { label: "Peak Load",         color: "#ef4444", pct: Math.round(ratio * 100),
          text: `This session significantly exceeded your recent training volume. High acute:chronic workload ratio (${ratio.toFixed(1)}x). Research shows ACWR >1.5 increases injury risk 2-4× (Gabbett, 2016). Prioritize recovery before the next hard effort.` };
      })();

      // ── Modality-specific science note ───────────────────────────────────
      const modalityNote = (() => {
        switch (modality) {
          case "cycling": {
            if (powerW && powerW > 0) {
              const wkg = (powerW / 84).toFixed(2); // ~185 lbs / 2.205
              return `Power output: ${powerW}W · ${wkg} W/kg. Every 1 kg reduction in body mass at constant FTP improves W/kg by ~0.07 — the equivalent of ~5W of added power on a sustained climb. Cycling economy improves with higher cadence (90-95 rpm) which distributes load across more muscle fibers, delaying fatigue.`;
            }
            if (distMi && dur) {
              const mph = (distMi / (dur / 60)).toFixed(1);
              return `Average speed: ${mph} mph over ${distMi.toFixed(1)} miles. Cycling at aerobic intensities primarily engages slow-twitch Type I fibers, which have 2-3× the mitochondrial density of fast-twitch fibers. Sustained endurance rides build the aerobic base that underlies all performance gains.`;
            }
            return "Cycling at sustained aerobic intensities is one of the most mitochondria-sparing exercises — low joint stress, high cardiac output demand, and exceptional longevity data. Regular cycling reduces all-cause mortality by up to 41% (Celis-Morales et al., BMJ 2017).";
          }
          case "running": {
            if (distMi && dur) {
              const pace = dur / distMi;
              const paceMin = Math.floor(pace); const paceSec = Math.round((pace - paceMin) * 60);
              return `Pace: ${paceMin}:${String(paceSec).padStart(2,"0")}/mi over ${distMi.toFixed(1)} miles. Running economy — the oxygen cost at a given pace — is trainable and accounts for much of the performance difference between runners at similar VO₂max. Even-effort pacing is 2-3% more economical than variable-effort running over the same distance.`;
            }
            return "Running produces 2-3× bodyweight ground reaction forces per stride, making it one of the highest bone-loading exercises available. This mechanical stress stimulates osteoblast activity, increasing bone mineral density — critical for long-term skeletal health in aging athletes.";
          }
          case "walking": {
            const steps = distMi ? Math.round(distMi * 2000) : null;
            return `Walking at a brisk pace (≥3.5 mph) achieves 3-6 METs — sufficient to produce meaningful cardiovascular adaptations. ${steps ? `Your ${distMi?.toFixed(1)} miles equates to approximately ${steps.toLocaleString()} steps. ` : ""}Studies show 7,000+ daily steps reduces all-cause mortality by 50-70% vs. <4,000 steps (Paluch et al., JAMA Network Open 2021). Non-exercise activity thermogenesis (NEAT) from walking is a primary driver of daily caloric expenditure.`;
          }
          case "hiking": {
            if (elevFt) return `Elevation gain of ${elevFt} ft significantly increases metabolic demand — each 1,000 ft of climbing adds approximately 1 MET-hour of additional energy expenditure. Downhill hiking provides unique eccentric muscle loading that stimulates different adaptation pathways than flat or uphill movement, particularly in the vastus lateralis and soleus.`;
            return "Hiking combines aerobic cardiovascular training with proprioceptive challenge from uneven terrain — simultaneously developing cardiovascular fitness, balance, and joint stability in a way flat-surface exercise cannot replicate.";
          }
          case "rucking": {
            return `Weighted rucking at 20-30% of body mass produces ground reaction forces 2-3× greater than unloaded walking, directly stimulating bone remodeling via mechanotransduction — the most accessible bone-loading exercise available. It simultaneously delivers aerobic conditioning, loaded carries build functional strength, and the caloric burn is 2-3× that of unloaded walking at the same pace.`;
          }
          case "swimming": {
            return "Swimming provides cardiovascular stimulus equal to running with near-zero joint compressive load — making it uniquely valuable for active recovery sessions or high-volume training weeks. The horizontal body position reduces hydrostatic pressure on the heart, increasing venous return and stroke volume, which explains why swimmers tend to have exceptionally high cardiac output.";
          }
          case "strength": {
            return `Resistance training triggers a cascade of anabolic hormones — testosterone peaks within 15-30 minutes post-session, GH secretion is elevated for up to 24 hours. Muscle protein synthesis remains elevated for 24-48 hours, peaking at 3-5 hours post-exercise (Phillips, 2014). This session's training stress contributes to the progressive overload that drives long-term strength and lean mass gains.`;
          }
          default:
            return "Every training session contributes to your acute training load. Consistency over weeks and months — not individual session perfection — is the primary driver of endurance adaptation, body composition improvement, and metabolic health.";
        }
      })();

      // ── Recovery prescription ─────────────────────────────────────────────
      const intensity = (act.intensity ?? "").toLowerCase();
      const isHard = ["hard", "mixed"].includes(intensity) || (hrZone?.zone ?? 0) >= 4;
      const isLong = dur >= 90;

      const recoveryNote = (() => {
        if (isHard && isLong) return "High-stress session. Full 48-72 hours before next hard effort. Tonight: 8+ hours sleep, 30-40g protein within 45 min of this session, minimize alcohol. Monitor morning HRV before tomorrow's training decision.";
        if (isHard)           return "Quality effort. Allow 24-48 hours before next threshold or hard session. Standard sleep and nutrition recovery protocols apply.";
        if (isLong)           return "Extended aerobic session. Glycogen partially depleted — prioritize carbohydrate + protein within 45 minutes. 7-9 hours sleep tonight supports full glycogen restoration.";
        if ((hrZone?.zone ?? 0) <= 2) return "Recovery-appropriate intensity. This session adds minimal fatigue while promoting adaptation. You can train again tomorrow at similar or higher intensity.";
        return "Moderate training stress. Standard recovery — 7-9 hours sleep, adequate hydration and protein. Morning HRV tomorrow will confirm readiness for the next session.";
      })();

      // ── Milestone check ───────────────────────────────────────────────────
      const countResult = await pool.query(
        "SELECT COUNT(*) as total FROM activities WHERE user_id = $1 AND date <= $2", [userId, actDate]
      );
      const totalActivities = parseInt(countResult.rows[0]?.total ?? "0");
      const milestone = [10, 25, 50, 100, 250, 500, 1000].includes(totalActivities)
        ? `🏆 Activity #${totalActivities} — milestone reached.`
        : null;

      // ── Plain-language narrative ──────────────────────────────────────────
      const narrative = [
        hrZone
          ? `This ${dur}-minute ${act.modality ?? "session"} ran at an average of ${avgHr} bpm — ${hrZone.label} (${hrZone.pct}% of estimated max HR).`
          : `This ${dur}-minute ${act.modality ?? "session"} is logged and added to your training record.`,
        loadContext
          ? loadContext.text
          : weekSessions === 0
          ? "This is one of your first logged sessions — building your baseline training record."
          : null,
        sleep
          ? `Prior-night sleep score ${sleep.sleep_score ?? "—"} · HRV ${sleep.hrv ?? "—"} ms · Resting HR ${sleep.resting_hr ?? "—"} bpm.`
          : "No prior sleep data on record for additional recovery context.",
      ].filter(Boolean).join(" ");

      res.json({
        activityId,
        modality,
        duration: dur,
        hrZone,
        loadContext,
        modalityNote,
        recoveryNote,
        narrative,
        milestone,
        weekContext: {
          sessions: weekSessions,
          avgDuration: weekAvgDur ? Math.round(weekAvgDur) : null,
          avgHr: weekAvgHr ? Math.round(weekAvgHr) : null,
        },
        sleep: sleep ? {
          hrv: sleep.hrv,
          sleepScore: sleep.sleep_score,
          restingHr: sleep.resting_hr,
          hours: sleep.hours,
        } : null,
        totalActivities,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Fasting Crossroads — science ticker injection (D) ───────────────────
  app.post("/api/fasting/crossroads-science", requireAuth, async (req, res) => {
    try {
      const { fastHours, activityType, durationMin } = req.body as {
        fastHours?: number; activityType?: string; durationMin?: number;
      };
      const hours = Number(fastHours ?? 0);
      const type  = activityType ?? "activity";
      const mins  = Number(durationMin ?? 30);

      const tierLabel =
        hours >= 24 ? "Cellular Reset (24h+)" :
        hours >= 20 ? "Deep Repair (20-24h)" :
        hours >= 16 ? "Autophagy Window (16-20h)" :
        hours >= 12 ? "Metabolic Shift (12-16h)" :
                      "Early Fast (0-12h)";

      const prompt = `You are a precision sports science editor for an elite wellness app called KEWT by Blue Ember Wellness.

A user just completed a ${mins}-minute ${type} while in a ${hours.toFixed(1)}-hour fast (${tierLabel}).

Generate exactly 3 science ticker cards personalized to THIS session. Each card must:
- Be specific to the ${tierLabel} tier and ${type} activity combination
- Reference a real published study with author, journal, and year
- Use direct, confident language — no hedging
- Be genuinely educational, not generic

Return ONLY a JSON array of 3 objects with keys:
- "headline": 4-6 words, bold claim (e.g. "Fasted ${type} Doubles Autophagy")
- "body": 2-3 sentences with the science and citation

No markdown. No extra text. JSON only.`;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.72,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0].message.content ?? "[]";
      const cards = JSON.parse(raw.replace(/^```json\s*/,"").replace(/```$/,""));

      // Inject into today's science_ticker row
      const today = new Date().toISOString().slice(0, 10);
      const existing = await pool.query("SELECT items FROM science_ticker WHERE date = $1", [today]);
      if (existing.rows[0]) {
        const items = JSON.parse(existing.rows[0].items);
        const headlines = new Set(items.map((i: any) => i.headline));
        const fresh = cards.filter((c: any) => !headlines.has(c.headline));
        if (fresh.length > 0) {
          await pool.query("UPDATE science_ticker SET items = $1 WHERE date = $2",
            [JSON.stringify([...cards, ...items]), today]); // prepend so they appear first
        }
      } else {
        await pool.query("INSERT INTO science_ticker (date, items) VALUES ($1, $2)",
          [today, JSON.stringify(cards)]);
      }

      res.json({ ok: true, injected: cards.length });
    } catch (e: any) {
      console.error("[crossroads-science]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Fasted Analytics (aggregated history) ───────────────────────────────
  app.get("/api/fasting/analytics", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;

      // All completed fasting sessions with overlapping activities
      const result = await pool.query(
        `SELECT
            a.id            AS activity_id,
            a.date,
            a.modality,
            a.duration_min,
            a.distance_miles,
            a.elevation_ft,
            a.avg_hr,
            a.intensity,
            a.notes,
            f.started_at    AS fast_start,
            f.ended_at      AS fast_end,
            f.goal_hours,
            s.hrv,
            s.sleep_score,
            s.resting_hr
          FROM activities a
          JOIN fasting_sessions f
            ON f.user_id = a.user_id
           AND f.started_at < (a.date::date + interval '1 day')::text
           AND (f.ended_at IS NULL OR f.ended_at::timestamp > a.date::timestamp)
          LEFT JOIN sleep_logs s
            ON s.user_id = a.user_id AND s.date = a.date
          WHERE a.user_id = $1
          ORDER BY a.date DESC
          LIMIT 60`,
        [userId]
      );

      const rows = result.rows;

      const sessions = rows.map((r: any) => {
        const fastStartMs  = new Date(r.fast_start).getTime();
        const actStartMs   = new Date(r.date + "T12:00:00Z").getTime();
        const hoursAtStart = Math.max(0, (actStartMs - fastStartMs) / 3_600_000);

        const ftssCalc = (h: number, dur: number, avgHr: number | null) => {
          const fd  = Math.min(h / 20, 1) * 40;
          const ds  = Math.min(dur / 240, 1) * 30;
          const hr  = avgHr ? Math.min((avgHr - 100) / 80, 1) * 30 : 15;
          return Math.round(Math.min(fd + ds + hr, 100));
        }
        const fuelLabel = (h: number) => {
          if (h < 8)  return "Glycolytic";
          if (h < 12) return "Transitional";
          if (h < 16) return "Fat-Dominant";
          if (h < 20) return "Deep Fat Oxidation";
          return "Extended Fast";
        }

        const ftss   = ftssCalc(hoursAtStart, r.duration_min ?? 60, r.avg_hr);
        const label  = ftss < 25 ? "Recovery" : ftss < 50 ? "Base" : ftss < 75 ? "Build" : "Peak Stimulus";
        const color  = ftss < 25 ? "#6b7280" : ftss < 50 ? "#10b981" : ftss < 75 ? "#f59e0b" : "#f97316";

        let cbiScore = 0;
        if (r.hrv !== null && r.hrv < 45) cbiScore += 2;
        if (r.sleep_score !== null && r.sleep_score < 60) cbiScore += 2;
        if ((r.duration_min ?? 60) >= 120) cbiScore += 2;
        if (hoursAtStart >= 16) cbiScore += 2;
        const cbiLabel = cbiScore <= 2 ? "Low" : cbiScore <= 4 ? "Moderate" : cbiScore <= 6 ? "Elevated" : "High";

        return {
          activityId: r.activity_id,
          date: r.date,
          modality: r.modality,
          durationMin: r.duration_min,
          distanceMiles: r.distance_miles,
          avgHr: r.avg_hr,
          hoursAtStart: Math.round(hoursAtStart * 10) / 10,
          fuelZone: fuelLabel(hoursAtStart),
          ftss, ftssLabel: label, ftssColor: color,
          cbi: cbiLabel,
          sleep: r.hrv || r.sleep_score ? { hrv: r.hrv, sleepScore: r.sleep_score } : null,
        };
      });

      const totalFastedActivities = sessions.length;
      const avgFtss = sessions.length
        ? Math.round(sessions.reduce((s: number, x: any) => s + x.ftss, 0) / sessions.length)
        : 0;
      const avgHoursAtStart = sessions.length
        ? Math.round(sessions.reduce((s: number, x: any) => s + x.hoursAtStart, 0) / sessions.length * 10) / 10
        : 0;
      const bestSession = sessions.length
        ? sessions.reduce((best: any, x: any) => x.ftss > (best?.ftss ?? 0) ? x : best, null)
        : null;
      const modalityBreakdown: Record<string, number> = {};
      sessions.forEach((s: any) => {
        modalityBreakdown[s.modality] = (modalityBreakdown[s.modality] ?? 0) + 1;
      });

      res.json({ sessions, totalFastedActivities, avgFtss, avgHoursAtStart, bestSession, modalityBreakdown });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Goals ─────────────────────────────────────────────────────────────────
  app.get("/api/goals", async (req, res) => {
    try { res.json(await storage.getGoals(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const data = insertGoalSchema.parse(req.body);
      res.json(await storage.createGoal(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      res.json(await storage.updateGoal(req.session.userId!, id, req.body));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const ok = await storage.deleteGoal(req.session.userId!, parseInt(req.params.id));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────
  app.get("/api/dashboard", async (req, res) => {
    try {
      const clientDate = (req.query.date as string) || undefined;
      res.json(await storage.getDashboardSummary(req.session.userId!, clientDate));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Weekly ────────────────────────────────────────────────────────────────
  app.get("/api/weekly", async (req, res) => {
    try {
      const clientDate = (req.query.date as string) || undefined;
      res.json(await storage.getWeeklyData(req.session.userId!, clientDate));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Correlations ──────────────────────────────────────────────────────────
  app.get("/api/correlations", async (req, res) => {
    try { res.json(await storage.getCorrelations(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Strava: frontend-posted sync ──────────────────────────────────────────
  app.post("/api/strava/sync", async (req, res) => {
    try {
      const { activities: rawActivities } = req.body as { activities: any[] };
      if (!Array.isArray(rawActivities)) return res.status(400).json({ error: "activities array required" });
      const now = new Date().toISOString();
      const mapped = rawActivities.map((a: any) => ({
        stravaId: String(a.id), name: a.name || "Activity", sportType: a.sport_type || a.type || "Workout",
        startDate: a.start_date || now, startDateLocal: a.start_date_local || now,
        movingTimeSec: a.moving_time ?? undefined, distanceMeters: a.distance ?? undefined,
        distanceMiles: a.distance ? Math.round((a.distance / 1609.34) * 100) / 100 : undefined,
        totalElevationGain: a.total_elevation_gain ?? undefined, avgHeartrate: a.average_heartrate ?? undefined,
        maxHeartrate: a.max_heartrate ?? undefined, avgWatts: a.average_watts ?? undefined,
        weightedAvgWatts: a.weighted_average_watts ?? undefined, maxWatts: a.max_watts ?? undefined,
        kilojoules: a.kilojoules ?? undefined, avgCadence: a.average_cadence ?? undefined,
        avgSpeedMs: a.average_speed ?? undefined, sufferScore: a.suffer_score ?? undefined,
        kudosCount: a.kudos_count ?? undefined, deviceName: a.device_name ?? undefined, syncedAt: now,
      }));
      const newCount = await storage.upsertStravaActivities(req.session.userId!, mapped);
      const meta = await storage.getStravaSyncMeta(req.session.userId!);
      await storage.updateStravaSyncMeta(req.session.userId!, now, (meta.totalSynced || 0) + newCount);
      res.json({ synced: newCount, total: rawActivities.length, message: `${newCount} new activities saved.` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/strava/activities", async (req, res) => {
    try { res.json(await storage.getStravaActivities(req.session.userId!, 90)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/strava/meta", async (req, res) => {
    try { res.json(await storage.getStravaSyncMeta(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/strava/fetch-and-sync", async (req, res) => {
    try {
      const perPage = Number(req.body?.per_page) || 30;
      const page = Number(req.body?.page) || 1;
      const rawActivities = stravaFetchActivities(perPage, page);
      if (!rawActivities.length) return res.json({ synced: 0, total: 0, message: "No activities returned from Strava." });
      const now = new Date().toISOString();
      const mapped = rawActivities.map((a: any) => ({
        stravaId: String(a.id), name: a.name || "Activity", sportType: a.sport_type || a.type || "Workout",
        startDate: a.start_date || now, startDateLocal: a.start_date_local || now,
        movingTimeSec: a.moving_time ?? undefined, distanceMeters: a.distance ?? undefined,
        distanceMiles: a.distance ? Math.round((a.distance / 1609.34) * 100) / 100 : undefined,
        totalElevationGain: a.total_elevation_gain ?? undefined, avgHeartrate: a.average_heartrate ?? undefined,
        maxHeartrate: a.max_heartrate ?? undefined, avgWatts: a.average_watts ?? undefined,
        weightedAvgWatts: a.weighted_average_watts ?? undefined, maxWatts: a.max_watts ?? undefined,
        kilojoules: a.kilojoules ?? undefined, avgCadence: a.average_cadence ?? undefined,
        avgSpeedMs: a.average_speed ?? undefined, sufferScore: a.suffer_score ?? undefined,
        kudosCount: a.kudos_count ?? undefined, deviceName: a.device_name ?? undefined, syncedAt: now,
      }));
      const newCount = await storage.upsertStravaActivities(req.session.userId!, mapped);
      const meta = await storage.getStravaSyncMeta(req.session.userId!);
      const newTotal = (meta.totalSynced || 0) + newCount;
      await storage.updateStravaSyncMeta(req.session.userId!, now, newTotal);
      await storage.setIntegrationConnected(req.session.userId!, "strava", now, newCount, newTotal);
      res.json({ synced: newCount, total: rawActivities.length, message: `${newCount} new activities synced from Strava.`, lastSync: now, totalSynced: newTotal });
    } catch (e: any) {
      await storage.setIntegrationError(req.session.userId!, "strava", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Integration status ────────────────────────────────────────────────────
  app.get("/api/integrations/status/:id", async (req, res) => {
    try { res.json(await storage.getIntegrationStatus(req.session.userId!, req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/integrations/disconnect/:id", async (req, res) => {
    try {
      await storage.setIntegrationError(req.session.userId!, req.params.id, "");
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/integration/connect", (req, res) => {
    try {
      const { integration_id, token } = req.body as { integration_id: string; token: string };
      if (!integration_id || !token) return res.status(400).json({ error: "integration_id and token required" });
      const now = new Date().toISOString();
      integrationTokens[integration_id] = { token, connectedAt: now };
      res.json({ success: true, integration_id, connected_at: now });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/integration/status/:id", (req, res) => {
    const tok = integrationTokens[req.params.id];
    res.json({ connected: !!tok, connected_at: tok?.connectedAt ?? null });
  });

  app.get("/api/integration/status", (_, res) => {
    const result: Record<string, any> = {};
    for (const [id, tok] of Object.entries(integrationTokens)) {
      result[id] = { connected: true, connected_at: tok.connectedAt };
    }
    res.json(result);
  });

  // ── CSV / File import ─────────────────────────────────────────────────────
  app.post("/api/import/csv", upload.single("file"), async (req, res) => {
    try {
      const integrationId = (req.body?.integration_id as string) || "unknown";
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const filePath = req.file.path;
      const fileName = req.file.originalname.toLowerCase();
      const raw = fs.readFileSync(filePath, "utf8");
      fs.unlinkSync(filePath);
      let rowCount = 0, preview: string[] = [];
      if (fileName.endsWith(".csv")) {
        const rows = csvParse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
        rowCount = rows.length;
        if (rows.length > 0) preview = Object.keys(rows[0] as object).slice(0, 6);
      } else if (fileName.endsWith(".fit") || fileName.endsWith(".gpx")) {
        rowCount = 1; preview = ["Binary activity file received"];
      } else if (fileName.endsWith(".json")) {
        const json = JSON.parse(raw);
        rowCount = Array.isArray(json) ? json.length : 1;
      } else {
        rowCount = Math.max(raw.split("\n").filter(Boolean).length - 1, 0);
      }
      const now = new Date().toISOString();
      integrationTokens[integrationId] = { token: "csv-import", connectedAt: now };
      res.json({ success: true, integration_id: integrationId, file_name: req.file.originalname, rows_parsed: rowCount, columns_preview: preview, connected_at: now, message: `${req.file.originalname} processed — ${rowCount} record${rowCount === 1 ? "" : "s"} imported.` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── File upload (FIT/TCX/GPX/CSV/XLSX) ───────────────────────────────────
  app.post("/api/upload/activity", upload.array("files", 20), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });
    const userId = req.session.userId!;
    const results: any[] = [];

    for (const file of files) {
      const ext = (file.originalname.split(".").pop() || "").toLowerCase();
      const raw = fs.readFileSync(file.path);
      fs.unlinkSync(file.path);

      try {
        if (ext === "fit") {
          await new Promise<void>((resolve, reject) => {
            // Same as above: keep raw SI units so the conversions below are
            // explicit and correct.
            const parser = new FitParser({ force: true, speedUnit: "m/s", lengthUnit: "m", temperatureUnit: "celsius", elapsedRecordField: true, mode: "both" });
            parser.parse(raw, (error: any, data: any) => {
              if (error) { reject(error); return; }
              const sessions: any[] = data.activity?.sessions || data.sessions || [];
              const allRecords: any[] = data.activity?.records || data.records || [];
              const allLaps: any[] = data.activity?.laps || data.laps || [];
              for (const session of sessions) {
                const sport = (session.sport || data.sport?.sport || "cycling").toLowerCase();
                const startTime = session.start_time ? new Date(session.start_time).toISOString() : new Date().toISOString();
                const durationSec = session.total_elapsed_time ?? session.total_timer_time ?? 0;
                const modalityVal = normalizeModality(sport);
                const displayMap: Record<string, string> = { cycling: "Cycling", running: "Running", walking: "Walking", swimming: "Swimming", hiking: "Hiking", strength: "Strength", other: "Workout" };
                // Distance source priority. All units are meters / m/s from
                // the raw-SI parser config above.
                const lastRec = allRecords.length ? allRecords[allRecords.length - 1] : null;
                const lapSum = allLaps.reduce((s: number, l: any) => s + (l.total_distance || 0), 0);
                const distMeters: number | undefined =
                    (session.total_distance && session.total_distance > 0) ? session.total_distance
                  : (lastRec && lastRec.distance > 0)                       ? lastRec.distance
                  : (lapSum > 0)                                             ? lapSum
                  : (session.avg_speed && session.total_elapsed_time)        ? session.avg_speed * session.total_elapsed_time
                  : undefined;
                results.push({
                  file: file.originalname, status: "parsed",
                  sport: displayMap[modalityVal] || modalityVal.charAt(0).toUpperCase() + modalityVal.slice(1),
                  name: `${displayMap[modalityVal] || modalityVal} ${new Date(startTime).toLocaleDateString()}`,
                  startDate: startTime, durationSec: Math.round(durationSec),
                  distanceMiles: distMeters !== undefined ? Math.round((distMeters / 1609.344) * 100) / 100 : undefined,
                  avgHeartrate: session.avg_heart_rate, maxHeartrate: session.max_heart_rate,
                  avgWatts: session.avg_power, maxWatts: session.max_power,
                  normalizedWatts: session.normalized_power,
                  totalAscentFt: session.total_ascent ? Math.round(session.total_ascent * 3.28084) : undefined,
                  calories: session.total_calories, avgCadence: session.avg_cadence,
                  avgSpeedMph: session.avg_speed ? Math.round((session.avg_speed * 2.23694) * 10) / 10 : undefined,
                });
              }
              resolve();
            });
          });
        } else if (ext === "tcx") {
          const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
          const doc = xmlParser.parse(raw.toString("utf8"));
          const acts = doc?.TrainingCenterDatabase?.Activities?.Activity;
          const actList = Array.isArray(acts) ? acts : acts ? [acts] : [];
          for (const act of actList) {
            const sport = (act["@_Sport"] || "cycling").toLowerCase();
            const laps = Array.isArray(act.Lap) ? act.Lap : act.Lap ? [act.Lap] : [];
            let totalDist = 0, totalTime = 0, totalCal = 0;
            let hrSamples: number[] = [];
            for (const lap of laps) {
              totalDist += Number(lap.DistanceMeters || 0);
              totalTime += Number(lap.TotalTimeSeconds || 0);
              totalCal  += Number(lap.Calories || 0);
              const tracks = Array.isArray(lap.Track) ? lap.Track : lap.Track ? [lap.Track] : [];
              for (const track of tracks) {
                const pts = Array.isArray(track.Trackpoint) ? track.Trackpoint : track.Trackpoint ? [track.Trackpoint] : [];
                for (const pt of pts) { if (pt.HeartRateBpm?.Value) hrSamples.push(Number(pt.HeartRateBpm.Value)); }
              }
            }
            const typeMap: Record<string, string> = { cycling: "Cycling", running: "Run", walking: "Walk", other: "Workout" };
            const actType = typeMap[sport] || sport.charAt(0).toUpperCase() + sport.slice(1);
            const startTime = act["@_StartTime"] || act.Id || new Date().toISOString();
            results.push({
              file: file.originalname, status: "parsed", sport: actType,
              name: `${actType} ${new Date(startTime).toLocaleDateString()}`,
              startDate: new Date(startTime).toISOString(), durationSec: Math.round(totalTime),
              distanceMiles: Math.round((totalDist / 1609.34) * 100) / 100,
              avgHeartrate: hrSamples.length ? Math.round(hrSamples.reduce((a,b) => a+b,0) / hrSamples.length) : undefined,
              calories: totalCal || undefined,
            });
          }
          if (actList.length === 0) results.push({ file: file.originalname, status: "empty", message: "No activities found in TCX." });
        } else if (ext === "csv") {
          const text = raw.toString("utf8").replace(/^\uFEFF/, "");
          const isSleepCsv = /^Sleep Score/i.test(text.trim());
          if (isSleepCsv) {
            const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith(","));
            const kv: Record<string,string> = {};
            for (const line of lines) {
              const comma = line.indexOf(",");
              if (comma < 0) continue;
              const key = line.slice(0, comma).trim().toLowerCase();
              const val = line.slice(comma + 1).trim();
              if (key && val) kv[key] = val;
            }
            const dateRaw = kv["date"] || "";
            const isoMatch = dateRaw.match(/^(\d{4}-\d{2}-\d{2})/);
            const dateStr = isoMatch ? isoMatch[1] : (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; })();
            const parseSleepDuration = (s: string): number => { if (!s) return 0; const hm = s.match(/(\d+)h/); const mm = s.match(/(\d+)m/); return (hm ? parseInt(hm[1]) : 0) + (mm ? parseInt(mm[1]) : 0) / 60; };
            const hours = parseSleepDuration(kv["sleep duration"] || "");
            const scoreRaw = kv["sleep score"] || "";
            const garminScore: number | null = (scoreRaw && parseInt(scoreRaw) > 0) ? parseInt(scoreRaw) : null;
            const quality_label = kv["quality"] || "";
            const qualityFromScore = garminScore != null ? Math.max(1, Math.min(10, Math.round(garminScore / 10))) : null;
            const qualityLabelMap: Record<string,number> = { excellent: 10, good: 8, fair: 6, poor: 3 };
            const quality = qualityFromScore ?? qualityLabelMap[quality_label.toLowerCase()] ?? 5;
            const parseDur = (s: string): number | null => { if (!s) return null; const h = s.match(/(\d+)h/); const m = s.match(/(\d+)m/); const mins = (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0); return mins > 0 ? mins : null; };
            const parseNum = (s: string): number | null => { const n = parseFloat((s || "").replace(/[^0-9.]/g, "")); return isNaN(n) ? null : n; };
            if (hours <= 0) {
              results.push({ file: file.originalname, status: "empty", message: "Could not parse sleep duration from file." });
            } else {
              try {
                await storage.createSleepLog(userId, {
                  date: dateStr, hours: Math.round(hours * 100) / 100, quality,
                  restingHr: parseNum(kv["resting heart rate"] || kv["avg overnight heart rate"] || "") ?? null,
                  fellAsleep: kv["bedtime"] || kv["fell asleep"] || null,
                  wokeUp: kv["wake time"] || kv["woke up"] || null,
                  moodMorning: null, notes: quality_label || null,
                  sleepScore: garminScore,
                  avgOvernightHr: parseNum(kv["avg overnight heart rate"] || "") ?? null,
                  deepMin: parseDur(kv["deep sleep duration"] || kv["deep sleep"] || "") ?? null,
                  lightMin: parseDur(kv["light sleep duration"] || kv["light sleep"] || "") ?? null,
                  remMin: parseDur(kv["rem sleep duration"] || kv["rem duration"] || kv["rem sleep"] || "") ?? null,
                  awakeMin: parseDur(kv["awake duration"] || kv["awake"] || "") ?? null,
                  restlessMoments: parseNum(kv["restless moments"] || kv["restlessness"] || "") ?? null,
                  hrv: parseNum(kv["avg overnight hrv"] || kv["hrv"] || "") ?? null,
                  spo2Avg: parseNum(kv["avg spo₂"] || kv["avg spo2"] || "") ?? null,
                  spo2Low: parseNum(kv["low spo₂"] || kv["low spo2"] || "") ?? null,
                  respirationAvg: parseNum(kv["avg respiration"] || kv["respiration rate"] || "") ?? null,
                  respirationLow: parseNum(kv["low respiration"] || "") ?? null,
                  stress: parseNum(kv["avg stress"] || kv["stress"] || "") ?? null,
                  bodyBatteryChange: parseNum(kv["body battery change"] || kv["body battery"] || "") ?? null,
                  hrvStatus: kv["hrv status"] || kv["hrv_status"] || null,
                });
                results.push({ file: file.originalname, status: "sleep_imported", date: dateStr, hours: Math.round(hours * 100) / 100, quality, message: garminScore ? `Sleep log imported: ${dateStr} — Garmin score ${garminScore}/100` : `Sleep log imported: ${dateStr} — no Garmin score in file` });
              } catch (e: any) {
                results.push({ file: file.originalname, status: "error", message: `Sleep import failed: ${e.message}` });
              }
            }
          } else {
            const rows = csvParse(text, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as any[];
            if (rows.length === 0) { results.push({ file: file.originalname, status: "empty", message: "No data rows found in CSV." }); }
            else {
              const col = (r: any, ...names: string[]): string => { for (const n of names) { const found = Object.keys(r).find((k: string) => k.toLowerCase().trim() === n); if (found && r[found] !== undefined && r[found] !== "") return String(r[found]).trim(); } return ""; };
              const num = (v: string): number | undefined => { const n = parseFloat(v.replace(/,/g,"")); return isNaN(n) ? undefined : n; };
              const parseDuration = (s: string): number | undefined => { if (!s) return undefined; const parts = s.split(":").map(Number); if (parts.some(isNaN)) return undefined; if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2]; if (parts.length === 2) return parts[0]*60 + parts[1]; return undefined; };
              const sportToModality: Record<string,string> = { running: "running", run: "running", "trail running": "running", cycling: "cycling", biking: "cycling", bike: "cycling", "indoor cycling": "cycling", "virtual ride": "cycling", "road cycling": "cycling", walking: "walking", walk: "walking", swimming: "swimming", swim: "swimming", hiking: "hiking", hike: "hiking", "strength training": "strength", strength: "strength", yoga: "yoga", rucking: "rucking", other: "other", generic: "other", workout: "other" };
              const modalityDisplay: Record<string,string> = { running: "Running", cycling: "Cycling", walking: "Walking", swimming: "Swimming", hiking: "Hiking", strength: "Strength", yoga: "Yoga", rucking: "Rucking", breathwork: "Breathwork", meditation: "Meditation", other: "Other" };
              let parsedCount = 0;
              for (const row of rows) {
                const typeVal = col(row, "activity type", "type", "sport", "category", "workout type");
                if (typeVal.toLowerCase().includes("total")) continue;
                const modality = sportToModality[typeVal.toLowerCase().trim()] || "other";
                const sport = modalityDisplay[modality] || "Other";
                const dateRaw2 = col(row, "date", "start time", "activity date", "datetime", "timestamp", "start date");
                let startDate: string;
                try {
                  const isoDateMatch = (dateRaw2 || "").match(/^(\d{4}-\d{2}-\d{2})/);
                  startDate = isoDateMatch ? `${isoDateMatch[1]}T12:00:00.000Z` : new Date().toISOString();
                } catch { startDate = new Date().toISOString(); }
                const timeRaw = col(row, "time", "duration", "elapsed time", "moving time", "total time", "workout time");
                const durationSec = parseDuration(timeRaw);
                const distanceMiles = num(col(row, "distance"));
                const avgHeartrate = num(col(row, "avg hr", "avg heart rate", "average heart rate", "heart rate"));
                const calories = num(col(row, "calories"));
                const npRaw = col(row, "normalized power (np)", "normalized power", "np");
                const avgPwrRaw = col(row, "avg power", "average power");
                const normalizedWatts = num(npRaw) ? Math.round(num(npRaw)!) : undefined;
                const avgWatts = num(avgPwrRaw) ? Math.round(num(avgPwrRaw)!) : undefined;
                const totalAscentFt = num(col(row, "total ascent", "elevation gain", "ascent"));
                const titleRaw = col(row, "title", "name", "activity name", "workout name");
                if (!durationSec && !distanceMiles && !calories) continue;
                results.push({ file: file.originalname, status: "parsed", sport, name: titleRaw || `${sport} ${startDate.split("T")[0]}`, startDate, durationSec, distanceMiles, avgHeartrate, calories, normalizedWatts, avgWatts, totalAscentFt });
                parsedCount++;
              }
              if (parsedCount === 0) results.push({ file: file.originalname, status: "empty", message: "No recognizable activity rows found." });
            }
          }
        } else if (["xlsx","xls","xlsm","ods"].includes(ext)) {
          const workbook = XLSX.read(raw, { type: "buffer", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
          if (rows.length === 0) { results.push({ file: file.originalname, status: "empty", message: "No data rows found." }); }
          else {
            const col = (r: any, ...names: string[]): string => { for (const n of names) { const found = Object.keys(r).find((k: string) => k.toLowerCase().trim() === n); if (found && r[found] !== undefined && r[found] !== "") return String(r[found]).trim(); } return ""; };
            const num = (v: string): number | undefined => { const n = parseFloat(String(v).replace(/,/g,"")); return isNaN(n) ? undefined : n; };
            const parseDur2 = (s: string): number | undefined => { if (!s) return undefined; const parts = s.split(":").map(Number); if (parts.some(isNaN)) return undefined; if (parts.length === 3) return parts[0]*3600+parts[1]*60+parts[2]; if (parts.length === 2) return parts[0]*60+parts[1]; return undefined; };
            const sportMap2: Record<string,string> = { running: "running", run: "running", cycling: "cycling", biking: "cycling", walking: "walking", walk: "walking", swimming: "swimming", hiking: "hiking", hike: "hiking", "strength training": "strength", strength: "strength", yoga: "yoga", rucking: "rucking", other: "other" };
            const dispMap2: Record<string,string> = { running: "Running", cycling: "Cycling", walking: "Walking", swimming: "Swimming", hiking: "Hiking", strength: "Strength", yoga: "Yoga", rucking: "Rucking", other: "Other" };
            let parsedCount2 = 0;
            for (const row of rows) {
              const typeVal = col(row, "activity type", "type", "sport", "category", "workout type");
              if (typeVal.toLowerCase().includes("total")) continue;
              const modality = sportMap2[typeVal.toLowerCase().trim()] || "other";
              const sport = dispMap2[modality] || "Other";
              const dateRaw3 = col(row, "date", "start time", "activity date", "datetime", "timestamp", "start date");
              let startDate: string;
              try {
                const im = (dateRaw3 || "").match(/^(\d{4}-\d{2}-\d{2})/);
                startDate = im ? `${im[1]}T12:00:00.000Z` : new Date().toISOString();
              } catch { startDate = new Date().toISOString(); }
              const durationSec = parseDur2(col(row, "time", "duration", "elapsed time", "moving time", "total time", "workout time"));
              const distanceMiles = num(col(row, "distance"));
              const avgHeartrate = num(col(row, "avg hr", "avg heart rate", "average heart rate", "heart rate"));
              const calories = num(col(row, "calories"));
              const normalizedWatts = num(col(row, "normalized power (np)", "normalized power", "np"));
              const avgWatts = num(col(row, "avg power", "average power"));
              const totalAscentFt = num(col(row, "total ascent", "elevation gain", "ascent"));
              if (!durationSec && !distanceMiles && !calories) continue;
              results.push({ file: file.originalname, status: "parsed", sport, name: col(row,"title","name","activity name") || `${sport} ${startDate.split("T")[0]}`, startDate, durationSec, distanceMiles, avgHeartrate, calories, normalizedWatts, avgWatts, totalAscentFt });
              parsedCount2++;
            }
            if (parsedCount2 === 0) results.push({ file: file.originalname, status: "empty", message: "No recognizable activity rows found." });
          }
        } else {
          results.push({ file: file.originalname, status: "unsupported", message: `File type .${ext} is not supported.` });
        }
      } catch (parseErr: any) {
        results.push({ file: file.originalname, status: "error", message: parseErr.message });
      }
    }

    // Save parsed activities
    const saved: any[] = [];
    for (const r of results) {
      if (r.status === "parsed") {
        try {
          const durationMin = r.durationSec ? Math.round(r.durationSec / 60) : undefined;
          const modality = normalizeModality(r.sport);
          const notesParts = [r.avgWatts ? `Avg power: ${r.avgWatts}W` : null, r.normalizedWatts ? `NP: ${r.normalizedWatts}W` : null, r.totalAscentFt ? `Elevation: +${r.totalAscentFt}ft` : null, r.avgHeartrate ? `Avg HR: ${r.avgHeartrate}bpm` : null, `[Imported from ${r.file}]`].filter(Boolean).join(" | ");
          const act = await storage.createActivity(userId, { date: r.startDate.split("T")[0], modality, durationMin: durationMin || 1, distanceMiles: r.distanceMiles || undefined, elevationFt: r.totalAscentFt || undefined, avgHr: r.avgHeartrate || undefined, estCalsBurned: r.calories || undefined, notes: notesParts, source: "garmin_upload" });
          r.saved_id = act.id;
          saved.push(act);
        } catch (saveErr: any) {
          r.save_error = saveErr.message;
        }
      }
    }

    const sleepImported = results.filter((r: any) => r.status === "sleep_imported").length;
    res.json({ processed: results.length, saved: saved.length + sleepImported, results });
  });

  // ── Garmin credentials (in-memory) ────────────────────────────────────────
  app.post("/api/garmin/credentials", (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    garminCredentials = { email, password, savedAt: new Date().toISOString() };
    res.json({ success: true, email, savedAt: garminCredentials.savedAt });
  });

  app.get("/api/garmin/credentials", (_, res) => {
    if (!garminCredentials) return res.json({ saved: false });
    res.json({ saved: true, email: garminCredentials.email, savedAt: garminCredentials.savedAt });
  });

  app.delete("/api/garmin/credentials", (_, res) => {
    garminCredentials = null;
    res.json({ success: true });
  });

  app.get("/api/garmin/sync/status", (_, res) => { res.json(garminSyncState); });

  app.get("/api/garmin/sync/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "state", state: garminSyncState })}\n\n`);
    garminSseClients.add(res);
    req.on("close", () => garminSseClients.delete(res));
  });

  app.post("/api/garmin/sync", async (req, res) => {
    if (garminSyncState.status === "running") return res.status(409).json({ error: "Sync already in progress" });
    const { email, password } = req.body as { email?: string; password?: string };
    const creds = (email && password ? { email, password } : garminCredentials);
    if (!creds) return res.status(400).json({ error: "No credentials. Save your Garmin credentials first." });
    res.json({ started: true, message: "Garmin sync started. Connect to /api/garmin/sync/stream for live updates." });
    runGarminSync(req.session.userId!, creds.email, creds.password).catch((e) => {
      garminSyncState.status = "error";
      garminSyncState.error = e.message;
    });
  });

  // ── Science Ticker ─────────────────────────────────────────────────────────
  const INFLAMMATION_ITEMS = [
    { headline: "Inflammation is Not Fat", body: "Acute weight gains of 1-5 lbs overnight are almost never fat — they are inflammatory fluid retention driven by cytokine release (IL-6, TNF-alpha). True fat accumulation requires ~3,500 kcal surplus per pound. (Calder et al., Nature Reviews Immunology, 2017)" },
    { headline: "HRV Flags Inflammation", body: "Overnight HRV drop is one of the most sensitive real-time markers of systemic inflammatory tone outside a clinical lab. When HRV falls and the scale rises together, the culprit is almost always fluid redistribution. (Thayer & Lane, Neuroscience & Biobehavioral Reviews, 2009)" },
    { headline: "Sleep Loss Causes Retention", body: "A single night of poor sleep elevates CRP and IL-6 by morning, triggering aldosterone-mediated sodium and water retention. The scale after a poor night is your least reliable fat-mass signal of the week. (Irwin et al., Sleep, 2016)" },
    { headline: "Cortisol Holds Water", body: "Chronic stress elevates cortisol, which stimulates aldosterone — causing kidneys to retain sodium and water. Two weeks of sustained stress can add 4-6 lbs of inflammatory fluid with zero change in adipose tissue. (Dallman et al., PNAS, 2003)" },
    { headline: "Post-Exercise Swelling Is Repair", body: "Post-exercise muscle inflammation is anabolic — it signals satellite cell recruitment for repair. The 1-3 lb gain after a hard walk or run is interstitial fluid flooding damaged myofibers. Suppressing it with NSAIDs blunts adaptation. (Peake et al., Journal of Physiology, 2017)" },
  ];

  // Broader BEI topic bank used to backstop random generation when the
  // saved science_ticker pool is small. Inflammation items are included;
  // additional topics widen the random surface so Generate from random
  // topic produces meaningful variety.
  const BEI_TOPIC_BANK = [
    ...INFLAMMATION_ITEMS,
    { headline: "Zone 2 Builds Mitochondria", body: "Sustained Zone 2 training (60-70% max HR) drives mitochondrial biogenesis via PGC-1α activation, increasing oxidative capacity by 30-40% in 12 weeks. The aerobic base translates directly to higher-output ceilings later. (San-Millán & Brooks, Sports Medicine, 2018)" },
    { headline: "VO2max is Lifespan", body: "Cardiorespiratory fitness measured by VO2max is one of the strongest predictors of all-cause mortality, stronger than smoking or hypertension. Each 1-MET increase associates with roughly 12 percent lower mortality risk. (Mandsager et al., JAMA Network Open, 2018)" },
    { headline: "Deep Sleep Repairs", body: "Slow-wave (deep) sleep drives growth hormone secretion and glymphatic clearance of metabolic waste. Less than 60 minutes of deep sleep on a regular basis correlates with impaired recovery, cognition, and immune function. (Xie et al., Science, 2013)" },
    { headline: "Mitophagy Clears Damage", body: "Fasting and prolonged Zone 2 work both upregulate mitophagy, the selective autophagy of damaged mitochondria. The cellular cleanup primes downstream biogenesis, which is where adaptation actually lives. (Mizushima & Komatsu, Cell, 2011)" },
    { headline: "Autophagy in 16 Hours", body: "Fasted states beyond 16 hours engage autophagy through AMPK activation and mTOR suppression. Even one extended fast per week measurably improves metabolic flexibility and insulin sensitivity in trained adults. (Anton et al., Obesity, 2018)" },
    { headline: "Stress Reactivity Predicts Recovery", body: "Resting HRV reflects parasympathetic tone, and recovery from a stressor is governed more by tone than by the stressor itself. Daily breathwork can raise baseline HRV by 5-10 ms within four weeks. (Lehrer et al., Psychophysiology, 2020)" },
    { headline: "Zone 5 Builds Ceiling", body: "Short, very-hard intervals (Zone 5, 85-95% max HR) raise stroke volume and cardiac output ceilings that long Zone 2 cannot reach alone. A 4x4 minute protocol once weekly is one of the most evidence-backed VO2max levers. (Helgerud et al., Medicine & Science in Sports & Exercise, 2007)" },
    { headline: "Protein Timing After Training", body: "Post-exercise protein within 60 minutes spikes muscle protein synthesis. 30-40 g of complete protein leverages the anabolic window without the diminishing returns seen above 50 g per meal. (Areta et al., Journal of Physiology, 2013)" },
    { headline: "Hydration Drives Performance", body: "A 2 percent body-mass dehydration measurably impairs both endurance and cognitive performance. Sodium plus water — not water alone — is what restores volume in trained athletes after heavy sessions. (Sawka et al., Medicine & Science in Sports & Exercise, 2007)" },
    { headline: "Circadian Rhythm and Strength", body: "Strength and power output peak in the late afternoon when core temperature is highest. Morning training is fine, but personal records typically land between 4 and 7 PM unless the athlete is fully circadian-shifted. (Atkinson & Reilly, Sports Medicine, 1996)" },
    { headline: "Breath Cadence Tunes HRV", body: "Slow-paced breathing near 5.5-6 breaths per minute maximally entrains heart-rate variability and vagal tone, the cleanest non-pharmacological lever for parasympathetic activation. Ten minutes daily is enough to register on HRV trends. (Vaschillo et al., Applied Psychophysiology and Biofeedback, 2006)" },
    { headline: "Walking After Meals", body: "A 10-15 minute walk within 30 minutes of a meal blunts postprandial glucose spikes by 12-22 percent in non-diabetic adults. The effect is smaller than insulin but cumulative across a year of meals. (Buffey et al., Sports Medicine, 2022)" },
  ];

  // Seed science ticker on startup
  (async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await pool.query("SELECT items FROM science_ticker WHERE date = $1", [today]);
      if (existing.rows[0]) {
        const items = JSON.parse(existing.rows[0].items);
        const headlines = new Set(items.map((i: any) => i.headline));
        const toAdd = INFLAMMATION_ITEMS.filter(i => !headlines.has(i.headline));
        if (toAdd.length > 0) {
          await pool.query("UPDATE science_ticker SET items = $1 WHERE date = $2", [JSON.stringify([...items, ...toAdd]), today]);
          console.log(`[science-ticker] Merged ${toAdd.length} inflammation items`);
        }
      } else {
        await pool.query("INSERT INTO science_ticker (date, items) VALUES ($1, $2) ON CONFLICT DO NOTHING", [today, JSON.stringify(INFLAMMATION_ITEMS)]);
        console.log("[science-ticker] Seeded inflammation items for", today);
      }
    } catch (e) { console.error("[science-ticker] Seed error:", e); }
  })();

  // ── Framework Snapshot (Tier 1 live data for BEI Framework page) ───────────
  app.get("/api/framework-snapshot", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      // ── Recovery: latest sleep log ──────────────────────────────────────────
      const sleepRes = await pool.query(
        `SELECT hrv, deep_min, body_battery_change, spo2_avg, respiration_avg, hrv_status
         FROM sleep_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 2`,
        [userId]
      );
      const latestSleep = sleepRes.rows[0] ?? null;
      const prevSleep   = sleepRes.rows[1] ?? null;

      // HRV delta vs previous night
      let hrvDelta: string | null = null;
      if (latestSleep?.hrv != null && prevSleep?.hrv != null) {
        const delta = Math.round(latestSleep.hrv - prevSleep.hrv);
        hrvDelta = delta >= 0 ? `+${delta}ms` : `${delta}ms`;
      }

      // ── Metabolic: latest weight + most recent completed fast ───────────────
      const weightRes = await pool.query(
        `SELECT morning_weight FROM health_markers WHERE user_id = $1 AND morning_weight IS NOT NULL ORDER BY date DESC LIMIT 1`,
        [userId]
      );
      const latestWeight = weightRes.rows[0]?.morning_weight ?? null;

      const fastRes = await pool.query(
        `SELECT started_at, ended_at FROM fasting_sessions
         WHERE user_id = $1 AND ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`,
        [userId]
      );
      let fastWindow: string | null = null;
      if (fastRes.rows[0]) {
        const startMs = new Date(fastRes.rows[0].started_at).getTime();
        const endMs   = new Date(fastRes.rows[0].ended_at).getTime();
        const hrs = (endMs - startMs) / 3_600_000;
        if (!isNaN(hrs) && hrs > 0) {
          fastWindow = `${Math.round(hrs)}h`;
        }
      }

      // ── Respiratory: latest breathwork session + resp rate ──────────────────
      const bwRes = await pool.query(
        `SELECT duration_min, type FROM breathwork_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
        [userId]
      );
      const latestBw = bwRes.rows[0] ?? null;

      res.json({
        recovery: {
          hrv:             latestSleep?.hrv           != null ? `${Math.round(latestSleep.hrv)}ms`  : null,
          deepSleep:       latestSleep?.deep_min      != null ? formatMinutes(latestSleep.deep_min) : null,
          bodyBattery:     latestSleep?.body_battery_change != null
                             ? (latestSleep.body_battery_change >= 0
                                 ? `+${latestSleep.body_battery_change}`
                                 : `${latestSleep.body_battery_change}`)
                             : null,
          spo2:            latestSleep?.spo2_avg      != null ? `${Math.round(latestSleep.spo2_avg)}%` : null,
          hrvStatus:       latestSleep?.hrv_status    ?? null,
        },
        metabolic: {
          weight:      latestWeight != null ? `${latestWeight}lb` : null,
          fastWindow:  fastWindow,
        },
        respiratory: {
          session:     latestBw?.duration_min != null ? `${latestBw.duration_min}min` : null,
          sessionType: latestBw?.type         ?? null,
          respRate:    latestSleep?.respiration_avg != null ? `${Math.round(latestSleep.respiration_avg)}` : null,
          hrvDelta:    hrvDelta,
        },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  app.get("/api/science-ticker", async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await pool.query("SELECT items FROM science_ticker WHERE date = $1 ORDER BY id DESC LIMIT 1", [today]);
      if (result.rows[0]) return res.json(JSON.parse(result.rows[0].items));
      const fallback = await pool.query("SELECT items FROM science_ticker ORDER BY id DESC LIMIT 1");
      if (fallback.rows[0]) return res.json(JSON.parse(fallback.rows[0].items));
      return res.json(INFLAMMATION_ITEMS);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/science-ticker/refresh", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", temperature: 0.7,
        messages: [{ role: "user", content: `You are a sports science editor for an elite endurance athlete app. Generate exactly 7 fresh, evidence-based science ticker headlines for today (${new Date().toDateString()}). Each must be concise (under 25 words), cite a real study or researcher, and be relevant to: HRV, Zone 2 training, VO2max, sleep/recovery, nutrition timing, mitophagy, or masters athletes. Return ONLY a JSON array of objects with keys "headline" (3-5 words, bold topic) and "body" (the headline sentence with citation). No markdown, no extra text.` }]
      });
      const text = completion.choices[0].message.content?.trim() ?? "[]";
      const items = JSON.parse(text.replace(/^```json\s*/,"").replace(/```$/,""));
      const today = new Date().toISOString().slice(0, 10);
      await pool.query("DELETE FROM science_ticker WHERE date = $1", [today]);
      await pool.query("INSERT INTO science_ticker (date, items) VALUES ($1, $2)", [today, JSON.stringify(items)]);
      return res.json({ ok: true, count: items.length, items });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── IG access probe (client gate for Post Generator nav + page) ──────────
  app.get("/api/me/ig-access", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.session.userId);
      if (!user) return res.json({ ok: false });
      const emailOk = IG_ALLOW_EMAILS.has(user.email.toLowerCase());
      const idOk = user.id <= IG_FALLBACK_MAX_ID;
      res.json({ ok: emailOk || idOk });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Practice access probe (client gate for Daily Log Practice row) ───────
  // Mirrors the IG allowlist pattern: Mark by email, Trish via the
  // id <= 2 fallback while her exact email is still unknown. Practice is
  // an optional Daily Log category that is hidden for all other accounts
  // (including beta testers and the public /demo route). The feature
  // remains fully implemented server-side so it can be re-enabled per
  // account or globally without code changes by editing the allowlist.
  const PRACTICE_ALLOW_EMAILS = new Set<string>([
    "kantners@gmail.com",
    // "trish@example.com", // add Trish's exact email when known
  ]);
  const PRACTICE_FALLBACK_MAX_ID = 2;
  app.get("/api/me/practice-access", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.session.userId);
      if (!user) return res.json({ ok: false });
      const emailOk = PRACTICE_ALLOW_EMAILS.has(user.email.toLowerCase());
      const idOk = user.id <= PRACTICE_FALLBACK_MAX_ID;
      res.json({ ok: emailOk || idOk });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── IG Topic Pool (the science_ticker pool Generate picks from) ──────────
  // Reads and writes the shared science_ticker row for today. Gated by the
  // same IG access list. No new table; upserts today's row in place.
  app.get("/api/ig-topic-pool", requireIGAccess, async (_req: any, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const row = await pool.query("SELECT items FROM science_ticker WHERE date = $1 ORDER BY id DESC LIMIT 1", [today]);
      if (row.rows[0]) {
        const items = JSON.parse(row.rows[0].items);
        return res.json({ date: today, items });
      }
      // Fallback: most-recent row.
      const fallback = await pool.query("SELECT date, items FROM science_ticker ORDER BY id DESC LIMIT 1");
      if (fallback.rows[0]) {
        const items = JSON.parse(fallback.rows[0].items);
        return res.json({ date: fallback.rows[0].date, items, stale: true });
      }
      res.json({ date: today, items: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  app.put("/api/ig-topic-pool", requireIGAccess, async (req: any, res) => {
    try {
      const incoming = req.body?.items;
      if (!Array.isArray(incoming)) return res.status(400).json({ error: "items must be an array" });
      // Validate, trim, dedupe by headline.
      const seen = new Set<string>();
      const cleaned: { headline: string; body: string }[] = [];
      for (const it of incoming) {
        const headline = typeof it?.headline === "string" ? it.headline.trim().slice(0, 160) : "";
        const body     = typeof it?.body     === "string" ? it.body.trim().slice(0, 1000) : "";
        if (!headline) continue;
        const key = headline.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push({ headline, body });
      }
      if (cleaned.length === 0) return res.status(400).json({ error: "At least one topic with a headline is required" });
      const today = new Date().toISOString().slice(0, 10);
      const json = JSON.stringify(cleaned);
      // Upsert today's row.
      const existing = await pool.query("SELECT id FROM science_ticker WHERE date = $1 ORDER BY id DESC LIMIT 1", [today]);
      if (existing.rows[0]) {
        await pool.query("UPDATE science_ticker SET items = $1 WHERE id = $2", [json, existing.rows[0].id]);
      } else {
        await pool.query("INSERT INTO science_ticker (date, items) VALUES ($1, $2)", [today, json]);
      }
      res.json({ date: today, items: cleaned });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── IG Drafts CRUD (planner queue) ────────────────────────────────────────
  // Daily generation limit. Counts ig_drafts rows created today (server
  // local time) by the caller. Degrades to used=0 if the table or column
  // is missing, so the route never blocks generation due to a migration
  // gap.
  const IG_DAILY_LIMIT = 10;
  async function igTodayUsed(userId: number): Promise<number> {
    try {
      const row = await pool.query(
        `SELECT count(*)::int AS n FROM ig_drafts
         WHERE user_id = $1 AND created_at >= date_trunc('day', now())`,
        [userId]
      );
      return row.rows[0]?.n ?? 0;
    } catch (e: any) {
      console.warn(`[ig-drafts] today-count unavailable, degrading to 0: ${e?.message}`);
      return 0;
    }
  }
  app.get("/api/ig-drafts/today-count", requireIGAccess, async (req: any, res) => {
    try {
      const used = await igTodayUsed(req.session.userId!);
      res.json({ used, limit: IG_DAILY_LIMIT });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/ig-drafts", requireIGAccess, async (req: any, res) => {
    try { res.json(await storage.listIgDrafts(req.session.userId!)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/ig-drafts", requireIGAccess, async (req: any, res) => {
    try {
      if (!req.body?.caption) return res.status(400).json({ error: "caption required" });
      res.json(await storage.createIgDraft(req.session.userId!, req.body));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/ig-drafts/:id", requireIGAccess, async (req: any, res) => {
    try {
      const row = await storage.updateIgDraft(req.session.userId!, Number(req.params.id), req.body);
      if (!row) return res.status(404).json({ error: "Draft not found" });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/ig-drafts/:id", requireIGAccess, async (req: any, res) => {
    try {
      const ok = await storage.deleteIgDraft(req.session.userId!, Number(req.params.id));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── IG Post Generator ─────────────────────────────────────────────────────
  app.post("/api/generate-ig-post", requireIGAccess, async (req: any, res) => {
    try {
      // Enforce 10/day generation cap before spending any tokens.
      const used = await igTodayUsed(req.session.userId!);
      if (used >= IG_DAILY_LIMIT) {
        return res.status(429).json({
          error: "Daily generation limit reached. Review or schedule existing drafts before generating more.",
          used, limit: IG_DAILY_LIMIT,
        });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey });

      // ── Topic selection ────────────────────────────────────────────────────
      // Priority: (1) client-provided headline, (2) ig_topics table ordered by
      // least-recently-used, (3) today's science_ticker row as legacy fallback.
      const { headline, body } = req.body as { headline?: string; body?: string };
      let tickerHeadline = headline;
      let tickerBody     = body ?? "";
      let topicId: number | null = null;

      if (!tickerHeadline) {
        // Prefer the permanent ig_topics table
        try {
          const topicRow = await pool.query(
            `SELECT id, headline, body FROM ig_topics
             WHERE active = true
             ORDER BY last_used_at ASC NULLS FIRST, RANDOM()
             LIMIT 1`
          );
          if (topicRow.rows[0]) {
            topicId        = topicRow.rows[0].id;
            tickerHeadline = topicRow.rows[0].headline;
            tickerBody     = topicRow.rows[0].body ?? "";
          }
        } catch (_) { /* table may not exist yet — fall through */ }

        // Legacy fallback: today's science_ticker row
        if (!tickerHeadline) {
          const today = new Date().toISOString().slice(0, 10);
          const row = await pool.query(
            "SELECT items FROM science_ticker WHERE date = $1 ORDER BY id DESC LIMIT 1", [today]
          );
          if (row.rows[0]) {
            const items = JSON.parse(row.rows[0].items);
            const pick  = items[Math.floor(Math.random() * items.length)];
            tickerHeadline = pick.headline;
            tickerBody     = pick.body ?? "";
          }
        }
      }

      if (!tickerHeadline) return res.status(400).json({ error: "No topic content available. Add topics to the pool." });

      // Mark topic used (non-blocking — generation proceeds regardless)
      if (topicId) {
        pool.query(
          "UPDATE ig_topics SET last_used_at = NOW(), use_count = use_count + 1 WHERE id = $1",
          [topicId]
        ).catch(() => {});
      }

      // ── Caption generation ─────────────────────────────────────────────────
      const captionPrompt = `You are the social media voice of KEWT by Blue Ember Wellness — a precision endurance performance app. Brand voice: authoritative, warm, science-first, never hype. Tagline: "Breathe. Reset. Return."

Generate an Instagram post caption for this science topic:
Headline: ${tickerHeadline}
Science: ${tickerBody}

Format exactly as:
HOOK: [One punchy sentence, 8-12 words, no hashtags]
BODY: [2-3 sentences expanding the science in plain language]
CITATION: [Author, Year — Journal name, very short]
HASHTAGS: [10-12 relevant hashtags as a single line]

Do not include any labels (HOOK:, BODY: etc) in the output — just the text in order, separated by blank lines. End with: Breathe. Reset. Return. #KEWT #BlueEmberWellnessRVA`;

      const captionResp = await openai.chat.completions.create({
        model: "gpt-4o", temperature: 0.82,
        messages: [{ role: "user", content: captionPrompt }]
      });
      const caption  = captionResp.choices[0].message.content?.trim() ?? "";
      const hookLine = caption.split("\n")[0].trim();

      // ── Image scene generation (dynamic, per-topic) ─────────────────────────
      // Previously: a fixed lookup of ~20 hardcoded scene strings, matched by
      // keyword. Every topic sharing a keyword (e.g. anything mentioning
      // "sleep") produced the *exact same* image prompt every time, so
      // repeated generations looked visually identical even when the caption
      // varied. Now: GPT writes one fresh scene description per generation,
      // grounded in this specific headline + body, using the closest style
      // bucket below only as an aesthetic anchor (mood, lighting, composition)
      // rather than literal output — so two different "sleep" posts no longer
      // render the same image.
      const kw = tickerHeadline.toLowerCase() + " " + tickerBody.toLowerCase();
      const STYLE_ANCHORS: [string[], string][] = [
        [["reiki", "energy medicine", "biofield"], "hands-and-energy macro, deep teal bioluminescence, spiritual atmosphere"],
        [["polyvagal", "vagus", "nervous system"], "abstract neural/lightning network, navy and gold bioluminescence"],
        [["breathwork", "diaphragm", "respiratory", "breath", "lung"], "glowing bioluminescent anatomical macro, dark emerald atmosphere"],
        [["hrv", "heart rate variability", "rmssd"], "bioluminescent anatomical heart macro, teal and amber"],
        [["sleep", "slow-wave", "melatonin", "circadian"], "human figure under vast starfield, navy aurora atmosphere"],
        [["zone 2", "vo2max", "vo2", "mitochondria", "mitophagy"], "solitary endurance athlete, misty mountain, golden rim light"],
        [["cortisol", "stress", "inflammation", "inflammatory"], "abstract cellular biology macro, amber and teal bioluminescence"],
        [["autophagy", "senescent", "longevity", "nad+", "sirtuin", "aging"], "ethereal cellular renewal abstract, teal and violet bioluminescence"],
        [["cold exposure", "brown fat", "ice", "cold water"], "athlete in icy water at dawn, deep blue dramatic backlight"],
        [["fasted", "fasting", "fast", "intermittent"], "endurance athlete at dawn, warm amber horizon, dark foreground"],
        [["fuel", "glycogen", "carbohydrate", "metabol", "ampk"], "abstract glowing molecular structure, teal and amber macro"],
        [["protein", "muscle", "sarcopenia", "hypertrophy", "strength"], "muscular athletic form, dramatic shadow and rim light"],
        [["cycling", "power", "cadence", "ftp", "watt", "bike", "ride"], "cyclist at speed, golden hour, motion blur"],
        [["run", "runner", "rucking", "ruck", "trail"], "solitary trail runner, fog-covered path, moody dawn"],
        [["posture", "spine", "kyphosis", "alignment"], "bioluminescent spine macro, dark background"],
        [["sodium", "electrolyte", "hydration", "lmnt"], "crystalline mineral macro, glowing teal backlight"],
        [["caffeine", "coffee"], "espresso in dramatic chiaroscuro light"],
        [["weight", "fat", "adipose", "bmi", "scale"], "athletic figure at dawn, still water reflection"],
        [["testosterone", "hormone", "endocrin"], "abstract molecular hormone structure, amber and teal macro"],
        [["bone", "density", "osteo"], "crystalline bone microstructure macro, teal bioluminescence"],
      ];
      let styleAnchor = "dramatic mountain athlete, golden hour, dark moody atmosphere with rich color accents";
      for (const [keywords, anchor] of STYLE_ANCHORS) {
        if (keywords.some(k => kw.includes(k))) { styleAnchor = anchor; break; }
      }

      // GPT writes the actual scene, grounded in this specific topic. Falls
      // back to the plain style anchor (old behavior) if this call fails,
      // so image generation never breaks — it just loses variety for that
      // one post.
      let imageTheme = styleAnchor;
      try {
        const sceneResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 1.0,
          messages: [{
            role: "user",
            content: `Write ONE fresh, specific cinematic photo scene description (25-40 words, no text/logos/watermarks mentioned) for an Instagram image, inspired by this science topic:

Headline: ${tickerHeadline}
Science: ${tickerBody}

Visual style anchor (use as mood/lighting/composition inspiration only, do not copy verbatim): ${styleAnchor}

Requirements:
- Must be visually distinct from a generic stock scene — pick a specific subject, angle, or moment tied to THIS headline, not just the general category
- Keep the brand's dark, moody, bioluminescent-or-golden-hour cinematic aesthetic
- Output ONLY the scene description as one sentence fragment, nothing else`
          }],
        });
        const scene = sceneResp.choices[0]?.message?.content?.trim();
        if (scene) imageTheme = scene.replace(/^["']|["']$/g, "");
      } catch (sceneErr: any) {
        console.warn(`[generate-ig-post] scene generation failed, using style anchor fallback: ${sceneErr?.message}`);
      }

      // ── Image generation ───────────────────────────────────────────────────
      const imageModel  = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
      const imagePrompt = `Cinematic 1:1 photography: ${imageTheme}. No text, no logos, no watermarks. Ultra high quality, moody, professional editorial style. Dark shadows with rich color accents. Shot on Phase One, tack sharp subject, beautifully blurred background.`;
      let imageUrl   = "";
      let imageError: string | null = null;
      try {
        const imageResp = await openai.images.generate({
          model: imageModel, prompt: imagePrompt, n: 1, size: "1024x1024",
        } as any);
        const first = imageResp.data?.[0] as any;
        if (first?.url)           imageUrl = first.url;
        else if (first?.b64_json) imageUrl = `data:image/png;base64,${first.b64_json}`;
      } catch (e: any) {
        imageError = e?.message ?? "Image generation failed";
      }

      // ── Auto-save draft ────────────────────────────────────────────────────
      let autoDraft: any = null;
      let usedAfter = used + 1;
      try {
        autoDraft = await storage.createIgDraft(req.session.userId!, {
          headline: tickerHeadline ?? null,
          body: tickerBody ?? null,
          hookLine: hookLine ?? null,
          imageUrl: imageUrl || null,
          caption, status: "draft",
        } as any);
      } catch (e: any) {
        console.warn(`[ig-drafts] auto-save failed, returning generation anyway: ${e?.message}`);
        usedAfter = used;
      }

      res.json({
        caption, hookLine, imageUrl, imageError,
        headline: tickerHeadline, body: tickerBody,
        draftId: autoDraft?.id ?? null, draftEntry: autoDraft,
        used: usedAfter, limit: IG_DAILY_LIMIT,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── IG Topics admin routes (add/list topics to permanent pool) ───────────
  app.get("/api/ig-topics", requireIGAccess, async (_req: any, res) => {
    try {
      const rows = await pool.query(
        "SELECT id, domain, headline, body, citation, last_used_at, use_count, active, created_at FROM ig_topics ORDER BY domain, headline"
      );
      res.json({ topics: rows.rows, total: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/ig-topics", requireIGAccess, async (req: any, res) => {
    try {
      const { domain, headline, body, citation } = req.body;
      if (!domain || !headline) return res.status(400).json({ error: "domain and headline required" });
      const row = await pool.query(
        "INSERT INTO ig_topics (domain, headline, body, citation) VALUES ($1, $2, $3, $4) RETURNING *",
        [domain, headline, body ?? "", citation ?? null]
      );
      res.json(row.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/ig-topics/:id", requireIGAccess, async (req: any, res) => {
    try {
      const { active } = req.body;
      await pool.query("UPDATE ig_topics SET active = $1 WHERE id = $2", [active, req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });


  // Midnight ticker refresh
  (() => {
    const scheduleRefresh = () => {
      const now = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 1, 0, 0);
      const msUntil = next.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return;
          const { OpenAI } = await import("openai");
          const openai = new OpenAI({ apiKey });
          const completion = await openai.chat.completions.create({ model: "gpt-4o-mini", temperature: 0.7, messages: [{ role: "user", content: `Generate 7 fresh science ticker items as JSON array with "headline" and "body" keys. Today is ${new Date().toDateString()}. Topics: HRV, Zone 2, VO2max, sleep, nutrition, mitophagy, masters athletes.` }] });
          const text = completion.choices[0].message.content?.trim() ?? "[]";
          const items = JSON.parse(text.replace(/^```json\s*/,"").replace(/```$/,""));
          const today = new Date().toISOString().slice(0, 10);
          await pool.query("DELETE FROM science_ticker WHERE date = $1", [today]);
          await pool.query("INSERT INTO science_ticker (date, items) VALUES ($1, $2)", [today, JSON.stringify(items)]);
          console.log(`[science-ticker] Refreshed ${items.length} items for ${today}`);
        } catch(e) { console.error("[science-ticker] Midnight refresh failed:", e); }
        scheduleRefresh();
      }, msUntil);
    };
    scheduleRefresh();
  })();

  // ── Garmin link parser ────────────────────────────────────────────────────
  app.post("/api/parse-garmin-link", async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ error: "url required" });
      const urlMatch = url.match(/https?:\/\/[^\s]+/);
      if (urlMatch) url = urlMatch[0];
      url = url.replace(/[,;"'>)]$/, "").split("#")[0].trim();
      if (!url.includes("connect.garmin.com") || !url.includes("activity")) {
        return res.status(400).json({ error: "Please paste a Garmin Connect activity link" });
      }
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" } });
      if (!response.ok) return res.status(400).json({ error: "Could not fetch activity. Make sure the link is publicly shared." });
      const html = await response.text();
      const metrics: Record<string, any> = {};
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) metrics.name = titleMatch[1].replace(" - Garmin Connect","").trim();
      const distMatch = html.match(/(\d+\.?\d*)\s*(?:mi|km|miles?)/i);
      if (distMatch) { const val = parseFloat(distMatch[1]); metrics.distance = val; metrics.distanceUnit = "mi"; }
      const durMatch = html.match(/(\d{1,2}:\d{2}:\d{2})/);
      if (durMatch) { const parts = durMatch[1].split(":").map(Number); metrics.durationSec = parts[0]*3600+parts[1]*60+parts[2]; metrics.durationFormatted = durMatch[1]; }
      const calMatch = html.match(/(\d{3,4})\s*(?:cal|kcal|Calories)/i);
      if (calMatch) metrics.calories = parseInt(calMatch[1]);
      const hrMatch = html.match(/Avg\s*(?:HR|Heart\s*Rate)[^\d]*(\d{2,3})\s*bpm/i) || html.match(/(\d{2,3})\s*bpm/i);
      if (hrMatch) metrics.avgHR = parseInt(hrMatch[1]);
      const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) metrics.date = dateMatch[1];
      if (!metrics.distance && !metrics.durationSec && !metrics.calories && !metrics.avgHR) {
        return res.status(400).json({ error: "Could not extract activity data. Make sure the activity is publicly shared." });
      }
      metrics.sourceUrl = url;
      return res.json({ ok: true, metrics });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Screenshot parse ──────────────────────────────────────────────────────
  app.post("/api/parse-screenshot", upload.single("image"), async (req, res) => {
    let tempPath: string | null = null;
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
      if (!req.file) return res.status(400).json({ error: "No image uploaded" });

      tempPath = req.file.path;
      const imageBuffer = fs.readFileSync(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = req.file.mimetype || "image/jpeg";
      const openai = new (await import("openai")).OpenAI({ apiKey });

      const today = new Date().toISOString().slice(0,10);
      const prompt = `You are a health data extraction assistant for the KEWT wellness app. Analyze this Garmin or 1byone screenshot and extract ALL visible metrics.

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object. No markdown. No explanation. No backticks. Start with { end with }.
- Never omit a field — use null for anything not visible.
- All numbers must be actual numbers, never strings.

═══════════════════════════════════════════
SCREEN TYPE 1: GARMIN SLEEP (any sleep screen)
═══════════════════════════════════════════
Return: {"type":"sleep","data":{...}}

FIELD EXTRACTION RULES for sleep:
- "sleep_score": The large score number shown as "XX / 100" or "XX Score". Extract ONLY the numerator (e.g. if you see "80" above "100" and "Score", return 80, NOT 100).
- "hours": Total sleep duration in decimal hours. Convert from "Xh Ym" format: e.g. "6h 53m" → 6.88, "10h 23m" → 10.38, "7h 30m" → 7.5.
- "deep_min": Deep sleep in minutes. Convert "1h 29m" → 89, "1h 45m" → 105, "45m" → 45.
- "light_min": Light sleep in minutes. Same conversion.
- "rem_min": REM sleep in minutes. Same conversion.
- "awake_min": Awake time in minutes. "9m" → 9, "1m" → 1.
- "resting_hr": Labeled "Resting Heart Rate" (lowest 30-min window). NOT the same as overnight HR.
- "avg_overnight_hr": Labeled "Avg Overnight Heart Rate" or "Avg Overnight HR". Different from resting HR.
- "hrv": Labeled "Avg Overnight HRV" in milliseconds (ms). NOT "7d Avg HRV".
- "hrv_status": The text label below "7d Avg HRV" — e.g. "Low", "Unbalanced", "Balanced", "Good".
- "spo2_avg": Labeled "Avg SpO2" — the percentage number.
- "spo2_low": Labeled "Lowest SpO2" — the percentage number.
- "respiration_avg": Labeled "Avg Respiration" in brpm.
- "respiration_low": Labeled "Lowest Respiration" in brpm.
- "stress": Labeled "Stress" with a number and "avg". Extract just the number.
- "body_battery_change": Labeled "Body Battery Change" — may show as "+85" or "-12". Extract the signed number.
- "restless_moments": In the "Awake/Restlessness" row, extract the count after "Restless Moments" (e.g. "36 Restless Moments" → 36). NOT the "1m" duration.
- "fell_asleep": Time shown at start of timeline (e.g. "9:24 PM" → "21:24", "11:30 PM" → "23:30"). Use 24h HH:MM format.
- "woke_up": Time shown at end of timeline. Same 24h conversion.
- "quality": Map the quality label to a number: "Excellent" → 9, "Good" → 7, "Fair" → 5, "Poor" → 3. Use the Quality label, not Duration label.
- "date": Look for any visible date. If screen shows "Today" with no date, use ${today}.

Full field list:
{"date":"YYYY-MM-DD","sleep_score":number|null,"hours":number|null,"deep_min":number|null,"light_min":number|null,"rem_min":number|null,"awake_min":number|null,"resting_hr":number|null,"avg_overnight_hr":number|null,"hrv":number|null,"hrv_status":string|null,"spo2_avg":number|null,"spo2_low":number|null,"respiration_avg":number|null,"respiration_low":number|null,"stress":number|null,"body_battery_change":number|null,"restless_moments":number|null,"fell_asleep":"HH:MM"|null,"woke_up":"HH:MM"|null,"quality":number|null,"notes":null}

═══════════════════════════════════════════
SCREEN TYPE 2: GARMIN ACTIVITY (any activity screen — Overview, Stats, Charts tabs)
═══════════════════════════════════════════
Return: {"type":"activity","data":{...}}

FIELD EXTRACTION RULES for activity:
- "date": Look for date in "Jun 1 @ 2:23 PM" format → convert to YYYY-MM-DD (e.g. "2026-06-01"). If not visible use ${today}.
- "modality": Map activity type to one of: "walking", "running", "cycling", "hiking", "swimming", "strength", "rucking", "other". Use the activity title or icon.
- "duration_min": "Total Time" shown as MM:SS → convert to decimal minutes. "16:28" → 16.47. "1:05:30" → 65.5.
- "distance_miles": Distance in miles. Already shown in miles (e.g. "0.66 mi" → 0.66).
- "elevation_ft": "Total Ascent" in feet (e.g. "14 ft" → 14).
- "avg_hr": "Avg Heart Rate" in bpm. Extract the number only.
- "est_cals_burned": "Total Calories" (not Active Calories, not Resting Calories). The combined total.
- "intensity": Based on Training Effect Aerobic score: 0.0-1.0 → "easy", 1.1-2.0 → "easy", 2.1-3.0 → "moderate", 3.1-4.0 → "hard", 4.1-5.0 → "hard". Default "moderate" if not shown.
- "perceived_effort": null (not visible on Garmin screens).
- "environment": "outdoor" if map is shown or GPS route visible. "indoor" if treadmill/trainer indicated.
- "notes": null.

Full field list:
{"date":"YYYY-MM-DD","modality":string|null,"duration_min":number|null,"distance_miles":number|null,"elevation_ft":number|null,"avg_hr":number|null,"est_cals_burned":number|null,"intensity":string|null,"perceived_effort":null,"environment":string|null,"notes":null}

═══════════════════════════════════════════
SCREEN TYPE 3: 1BYONE SMART SCALE (body composition app)
═══════════════════════════════════════════
Return: {"type":"body_comp","data":{...}}

FIELD EXTRACTION RULES for body comp:
- All weight values are in lbs.
- "morning_weight": The main weight reading shown prominently.
- "body_fat_pct": Body Fat % value.
- "muscle_mass_lb": Muscle Mass in lbs.
- All other fields: extract the number shown next to each label.

Full field list:
{"date":"YYYY-MM-DD","morning_weight":number|null,"body_fat_pct":number|null,"muscle_mass_lb":number|null,"body_water_pct":number|null,"bmi":number|null,"skeletal_muscle_pct":number|null,"subcutaneous_fat_pct":number|null,"fat_free_lb":number|null,"bone_mass_lb":number|null,"visceral_fat":number|null,"bmr_kcal":number|null,"protein_pct":number|null,"body_score":number|null}`;

      // ── Retry up to 3 times with exponential backoff ──────────────────────
      const MAX_RETRIES = 3;
      let lastError: any = null;
      let completion: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 1500,
            temperature: 0,  // zero temp for deterministic JSON output
            messages: [{ role: "user", content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } }
            ]}],
          });
          break; // success — exit retry loop
        } catch (e: any) {
          lastError = e;
          console.warn(`[parse-screenshot] attempt ${attempt}/${MAX_RETRIES} failed: ${e?.message}`);
          if (attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s before retries 2 and 3
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
          }
        }
      }

      if (!completion) {
        throw lastError ?? new Error("All parse attempts failed — try again");
      }

      // ── Robust JSON extraction ────────────────────────────────────────────
      const raw = completion.choices[0].message.content?.trim() ?? "{}";
      // Strip markdown fences if present despite instructions
      const stripped = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      // Extract the outermost JSON object in case there's any surrounding text
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Response did not contain valid JSON");
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.type || !parsed.data) {
        throw new Error("Unexpected response structure from vision model");
      }

      return res.json({ ok: true, ...parsed });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Screenshot parsing failed" });
    } finally {
      // Always clean up temp file regardless of success or failure
      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
    }
  });

  // ── Screenshot commit ─────────────────────────────────────────────────────
  app.post("/api/commit-screenshot", async (req, res) => {
    try {
      const { type, data } = req.body;
      if (!type || !data) return res.status(400).json({ error: "Missing type or data" });
      const userId = req.session.userId!;

      // Coerce zero to null for fields where 0 is never a valid reading
      const zeroNullNum = (v: any) => (v === 0 || v === "0" ? null : (v || null));
      const zeroNullStr = (v: any) => (!v || v === "0" ? null : v);
      if (type === "sleep") {
        data.sleep_score   = zeroNullNum(data.sleep_score);
        data.hours         = zeroNullNum(data.hours);
        data.hrv           = zeroNullNum(data.hrv);
        data.resting_hr    = zeroNullNum(data.resting_hr);
        data.avg_overnight_hr = zeroNullNum(data.avg_overnight_hr);
        data.spo2_avg      = zeroNullNum(data.spo2_avg);
        data.spo2_low      = zeroNullNum(data.spo2_low);
        data.respiration_avg = zeroNullNum(data.respiration_avg);
        data.respiration_low = zeroNullNum(data.respiration_low);
        data.stress        = zeroNullNum(data.stress);
        data.fell_asleep   = zeroNullStr(data.fell_asleep);
        data.woke_up       = zeroNullStr(data.woke_up);
        data.hrv_status    = zeroNullStr(data.hrv_status);
      }
      if (type === "activity") {
        // Rounds to the nearest whole number for integer-typed columns,
        // while still passing through zeroNullNum's "0 means no reading"
        // logic. Decimal minutes like 59.25 (which the vision prompt
        // explicitly produces for MM:SS durations) become 59 instead of
        // crashing the insert with "invalid input syntax for type integer".
        const roundIntOrNull = (v: any) => {
          const n = zeroNullNum(v);
          return n == null ? null : Math.round(Number(n));
        };
        data.avg_hr           = roundIntOrNull(data.avg_hr);
        data.duration_min     = roundIntOrNull(data.duration_min);
        data.distance_miles   = zeroNullNum(data.distance_miles); // decimal column — left as-is
        data.elevation_ft     = roundIntOrNull(data.elevation_ft);
        data.est_cals_burned  = roundIntOrNull(data.est_cals_burned);
        data.perceived_effort = roundIntOrNull(data.perceived_effort);
        data.modality         = zeroNullStr(data.modality);
        data.intensity        = zeroNullStr(data.intensity);
        data.environment      = zeroNullStr(data.environment);
      }
      if (type === "sleep") {
        const existing = await pool.query("SELECT id FROM sleep_logs WHERE date = $1 AND user_id = $2", [data.date, userId]);
        if (existing.rows[0]) {
          await pool.query(`UPDATE sleep_logs SET hours=COALESCE($1,hours), quality=COALESCE($2,quality), resting_hr=COALESCE($3,resting_hr), sleep_score=COALESCE($4,sleep_score), avg_overnight_hr=COALESCE($5,avg_overnight_hr), deep_min=COALESCE($6,deep_min), light_min=COALESCE($7,light_min), rem_min=COALESCE($8,rem_min), awake_min=COALESCE($9,awake_min), restless_moments=COALESCE($10,restless_moments), hrv=COALESCE($11,hrv), spo2_avg=COALESCE($12,spo2_avg), spo2_low=COALESCE($13,spo2_low), respiration_avg=COALESCE($14,respiration_avg), respiration_low=COALESCE($15,respiration_low), stress=COALESCE($16,stress), body_battery_change=COALESCE($17,body_battery_change), hrv_status=COALESCE($18,hrv_status), fell_asleep=COALESCE($19,fell_asleep), woke_up=COALESCE($20,woke_up), notes=COALESCE($21,notes) WHERE date=$22 AND user_id=$23`,
            [data.hours, data.quality, data.resting_hr, data.sleep_score, data.avg_overnight_hr, data.deep_min, data.light_min, data.rem_min, data.awake_min, data.restless_moments, data.hrv, data.spo2_avg, data.spo2_low, data.respiration_avg, data.respiration_low, data.stress, data.body_battery_change, data.hrv_status, data.fell_asleep, data.woke_up, data.notes, data.date, userId]);
          return res.json({ ok: true, action: "updated", date: data.date });
        } else {
          await pool.query(`INSERT INTO sleep_logs (user_id, date, hours, quality, resting_hr, sleep_score, avg_overnight_hr, deep_min, light_min, rem_min, awake_min, restless_moments, hrv, spo2_avg, spo2_low, respiration_avg, respiration_low, stress, body_battery_change, hrv_status, fell_asleep, woke_up, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
            [userId, data.date, data.hours, data.quality, data.resting_hr, data.sleep_score, data.avg_overnight_hr, data.deep_min, data.light_min, data.rem_min, data.awake_min, data.restless_moments, data.hrv, data.spo2_avg, data.spo2_low, data.respiration_avg, data.respiration_low, data.stress, data.body_battery_change, data.hrv_status, data.fell_asleep, data.woke_up, data.notes]);
          return res.json({ ok: true, action: "inserted", date: data.date });
        }
      }
      if (type === "activity") {
        await pool.query(`INSERT INTO activities (user_id, date, modality, duration_min, distance_miles, elevation_ft, avg_hr, est_cals_burned, intensity, perceived_effort, environment, notes, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [userId, data.date, data.modality, data.duration_min, data.distance_miles, data.elevation_ft, data.avg_hr, data.est_cals_burned, data.intensity, data.perceived_effort, data.environment, data.notes, "screenshot"]);
        return res.json({ ok: true, action: "inserted", date: data.date });
      }
      if (type === "body_comp") {
        const zn = (v: any) => (v === 0 || v === "0" || v == null ? null : Number(v));
        const existing = await pool.query("SELECT id FROM health_markers WHERE date=$1 AND user_id=$2", [data.date, userId]);
        if (existing.rows[0]) {
          await pool.query(`UPDATE health_markers SET
            morning_weight       = COALESCE($1,  morning_weight),
            body_fat_pct         = COALESCE($2,  body_fat_pct),
            muscle_mass_lb       = COALESCE($3,  muscle_mass_lb),
            body_water_pct       = COALESCE($4,  body_water_pct),
            bmi                  = COALESCE($5,  bmi),
            skeletal_muscle_pct  = COALESCE($6,  skeletal_muscle_pct),
            subcutaneous_fat_pct = COALESCE($7,  subcutaneous_fat_pct),
            fat_free_lb          = COALESCE($8,  fat_free_lb),
            bone_mass_lb         = COALESCE($9,  bone_mass_lb),
            visceral_fat         = COALESCE($10, visceral_fat),
            bmr_kcal             = COALESCE($11, bmr_kcal),
            protein_pct          = COALESCE($12, protein_pct),
            body_score           = COALESCE($13, body_score),
            comp_source          = 'scale_screenshot'
          WHERE date=$14 AND user_id=$15`,
            [zn(data.morning_weight), zn(data.body_fat_pct), zn(data.muscle_mass_lb), zn(data.body_water_pct),
             zn(data.bmi), zn(data.skeletal_muscle_pct), zn(data.subcutaneous_fat_pct), zn(data.fat_free_lb),
             zn(data.bone_mass_lb), zn(data.visceral_fat), zn(data.bmr_kcal), zn(data.protein_pct),
             zn(data.body_score), data.date, userId]);
        } else {
          await pool.query(`INSERT INTO health_markers
            (user_id, date, morning_weight, body_fat_pct, muscle_mass_lb, body_water_pct, bmi,
             skeletal_muscle_pct, subcutaneous_fat_pct, fat_free_lb, bone_mass_lb,
             visceral_fat, bmr_kcal, protein_pct, body_score, comp_source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [userId, data.date, zn(data.morning_weight), zn(data.body_fat_pct), zn(data.muscle_mass_lb),
             zn(data.body_water_pct), zn(data.bmi), zn(data.skeletal_muscle_pct), zn(data.subcutaneous_fat_pct),
             zn(data.fat_free_lb), zn(data.bone_mass_lb), zn(data.visceral_fat), zn(data.bmr_kcal),
             zn(data.protein_pct), zn(data.body_score), 'scale_screenshot']);
        }
        return res.json({ ok: true, action: existing.rows[0] ? "updated" : "inserted", date: data.date });
      }
      return res.status(400).json({ error: "Unknown type" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Settings — Week Start ─────────────────────────────────────────────────
  // ── Body Composition History ────────────────────────────────────────────
  app.get("/api/body-composition", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const days = Number(req.query.days ?? 90);
      const rows = await pool.query(
        `SELECT date, morning_weight, body_fat_pct, muscle_mass_lb, body_water_pct, bmi,
                skeletal_muscle_pct, subcutaneous_fat_pct, fat_free_lb, bone_mass_lb,
                visceral_fat, bmr_kcal, protein_pct, body_score, comp_source
         FROM health_markers
         WHERE user_id = $1
           AND date >= (CURRENT_DATE - INTERVAL '1 day' * $2)::text
           AND (body_fat_pct IS NOT NULL OR muscle_mass_lb IS NOT NULL OR body_score IS NOT NULL)
         ORDER BY date ASC`,
        [userId, days]
      );
      res.json({ rows: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Latest body composition (for dashboard card) ──────────────────────────
  app.get("/api/body-composition/latest", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const row = await pool.query(
        `SELECT date, morning_weight, body_fat_pct, muscle_mass_lb, body_water_pct, bmi,
                skeletal_muscle_pct, subcutaneous_fat_pct, fat_free_lb, bone_mass_lb,
                visceral_fat, bmr_kcal, protein_pct, body_score
         FROM health_markers
         WHERE user_id = $1
           AND (body_fat_pct IS NOT NULL OR muscle_mass_lb IS NOT NULL)
         ORDER BY date DESC LIMIT 1`,
        [userId]
      );
      res.json({ data: row.rows[0] ?? null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── 1byone CSV bulk import ──────────────────────────────────────────────
  app.post("/api/body-composition/import-csv", upload.single("file"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const raw = fs.readFileSync(req.file.path, "utf8");
      fs.unlinkSync(req.file.path);

      // Parse CSV — 1byone header:
      // Time,Weight,Weight Unit,BMI,Body Fat(%),Muscle Mass,VisceralFat,
      // Body Water(%),Bone Mass,BMR,Body Type,body Score,Protein Rate,
      // Skeletal Muscle Rate,Subcutaneous Fat,Lean Body Mass,Note
      const rows: any[] = csvParse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        // Skip incomplete scans (1byone writes zeros when it can't get a full read)
        const bodyFat = parseFloat(row["Body Fat(%)"]);
        if (!bodyFat || bodyFat === 0) { skipped++; continue; }

        // Parse timestamp — format: MM-DD-YYYY HH:MM:SS
        const timeParts = (row["Time"] ?? "").trim();
        if (!timeParts) { skipped++; continue; }
        const [datePart] = timeParts.split(" ");
        const [mm, dd, yyyy] = datePart.split("-");
        if (!mm || !dd || !yyyy) { skipped++; continue; }
        const isoDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

        const weight   = parseFloat(row["Weight"]) || null;
        const bmi      = parseFloat(row["BMI"]) || null;
        const muscle   = parseFloat(row["Muscle Mass"]) || null;
        const visceral = parseFloat(row["VisceralFat"]) || null;
        const water    = parseFloat(row["Body Water(%)"]) || null;
        const bone     = parseFloat(row["Bone Mass"]) || null;
        const bmr      = parseFloat(row["BMR"]) || null;
        const bScore   = parseInt(row["body Score"], 10) || null;
        const protein  = parseFloat(row["Protein Rate"]) || null;
        const skeletal = parseFloat(row["Skeletal Muscle Rate"]) || null;
        const subFat   = parseFloat(row["Subcutaneous Fat"]) || null;
        const leanBody = parseFloat(row["Lean Body Mass"]) || null;

        // Upsert: per day, keep best reading (highest body score)
        // Use COALESCE so we never overwrite a good value with null
        await pool.query(
          `INSERT INTO health_markers
             (user_id, date, morning_weight, body_fat_pct, muscle_mass_lb, body_water_pct,
              bmi, skeletal_muscle_pct, subcutaneous_fat_pct, fat_free_lb, bone_mass_lb,
              visceral_fat, bmr_kcal, protein_pct, body_score, comp_source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'1byone_csv')
           ON CONFLICT (user_id, date) DO UPDATE SET
             morning_weight       = CASE WHEN $3 IS NOT NULL AND (health_markers.body_score IS NULL OR $15 > health_markers.body_score) THEN $3 ELSE COALESCE(health_markers.morning_weight, $3) END,
             body_fat_pct         = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $4 ELSE COALESCE(health_markers.body_fat_pct, $4) END,
             muscle_mass_lb       = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $5 ELSE COALESCE(health_markers.muscle_mass_lb, $5) END,
             body_water_pct       = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $6 ELSE COALESCE(health_markers.body_water_pct, $6) END,
             bmi                  = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $7 ELSE COALESCE(health_markers.bmi, $7) END,
             skeletal_muscle_pct  = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $8 ELSE COALESCE(health_markers.skeletal_muscle_pct, $8) END,
             subcutaneous_fat_pct = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $9 ELSE COALESCE(health_markers.subcutaneous_fat_pct, $9) END,
             fat_free_lb          = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $10 ELSE COALESCE(health_markers.fat_free_lb, $10) END,
             bone_mass_lb         = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $11 ELSE COALESCE(health_markers.bone_mass_lb, $11) END,
             visceral_fat         = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $12 ELSE COALESCE(health_markers.visceral_fat, $12) END,
             bmr_kcal             = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $13 ELSE COALESCE(health_markers.bmr_kcal, $13) END,
             protein_pct          = CASE WHEN $15 > COALESCE(health_markers.body_score, 0) THEN $14 ELSE COALESCE(health_markers.protein_pct, $14) END,
             body_score           = GREATEST(COALESCE(health_markers.body_score, 0), $15),
             comp_source          = '1byone_csv'`,
          [userId, isoDate, weight, bodyFat, muscle, water, bmi, skeletal, subFat, leanBody, bone, visceral, bmr, protein, bScore]
        );
        inserted++;
      }

      res.json({ inserted, skipped, total: rows.length });
    } catch (e: any) {
      console.error("CSV import error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings/week-start", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.session.userId!);
      res.json({ weekStart: profile?.weekStart ?? "monday" });
    } catch (e: any) { res.json({ weekStart: "monday" }); }
  });

  app.patch("/api/settings/arc", async (req, res) => {
    try {
      const { arcModality, arcWindow } = req.body as { arcModality?: string; arcWindow?: number };
      const userId = req.session.userId!;
      const sets: string[] = [];
      const vals: any[] = [];
      if (arcModality) { sets.push(`arc_modality = $${vals.length+1}`); vals.push(arcModality); }
      if (arcWindow)   { sets.push(`arc_window = $${vals.length+1}`); vals.push(arcWindow); }
      if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
      vals.push(userId);
      await pool.query(`UPDATE user_profile SET ${sets.join(", ")} WHERE user_id = $${vals.length}`, vals);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/settings/week-start", async (req, res) => {
    try {
      const { weekStart } = req.body as { weekStart: string };
      if (!["monday", "sunday"].includes(weekStart)) return res.status(400).json({ error: "Invalid value" });
      const userId = req.session.userId!;
      const existing = await storage.getProfile(userId);
      if (existing) {
        await pool.query("UPDATE user_profile SET week_start = $1 WHERE user_id = $2", [weekStart, userId]);
      } else {
        await pool.query("INSERT INTO user_profile (user_id, first_name, week_start, onboarding_complete, created_at) VALUES ($1, $2, $3, 0, $4)", [userId, "User", weekStart, new Date().toISOString().split("T")[0]]);
      }
      res.json({ ok: true, weekStart });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Onboarding Profile ────────────────────────────────────────────────────
  app.get("/api/onboarding/profile", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.session.userId!);
      res.json({ profile });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/onboarding/profile", async (req, res) => {
    try {
      const result = await storage.saveProfile(req.session.userId!, req.body);
      res.json({ ok: true, id: result.id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── BEI Data Export ───────────────────────────────────────────────────────
  app.get("/api/bei/export", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [profile, sleep, breath, posture, allGoals, weekly] = await Promise.all([
        storage.getProfile(userId),
        storage.getSleepLogs(userId, 0),
        storage.getBreathworkLogs(userId, 0),
        storage.getPostureLogs(userId, 0),
        storage.getGoals(userId),
        storage.getWeeklyData(userId),
      ]);

      const lines: string[] = [];
      lines.push("KEWT BEI Data Export");
      lines.push(`Generated,${new Date().toISOString()}`);
      lines.push(`User,${profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "KEWT User"}`);
      lines.push(`Export Source,KEWT by Blue Ember Wellness`);
      lines.push("");
      lines.push("SLEEP & READINESS HISTORY");
      lines.push("Date,Hours,Sleep Score,HRV (ms),Resting HR,Body Battery Change,Deep Sleep (min),REM (min),SpO2 Avg");
      for (const s of sleep) {
        lines.push([s.date ?? "", s.hours ?? "", s.sleepScore ?? "", s.hrv ?? "", s.restingHr ?? "", s.bodyBatteryChange ?? "", s.deepMin ?? "", s.remMin ?? "", s.spo2Avg ?? ""].join(","));
      }
      lines.push("");
      lines.push("BREATHWORK LOG");
      lines.push("Date,Duration (min),Type,Notes");
      for (const b of breath) {
        lines.push([b.date ?? "", b.durationMin ?? "", b.type ?? "", (b.notes ?? "").replace(/,/g, ";")].join(","));
      }
      lines.push("");
      lines.push("GOALS & EVENTS");
      lines.push("Name,Type,Status,Start Value,Current Value,Target Value,Target Date,Unit");
      for (const g of allGoals) {
        lines.push([(g.label ?? "").replace(/,/g, ";"), g.type ?? "", g.status ?? "", g.startValue ?? "", g.currentValue ?? "", g.targetValue ?? "", g.targetDate ?? "", g.unit ?? ""].join(","));
      }
      lines.push("");
      lines.push("WEEKLY BEI READINESS TREND");
      lines.push("Date,BEI Readiness Score,Activities,Miles");
      for (const r of weekly.rows) {
        lines.push([r.date ?? "", r.recoveryScore ?? "", r.activities ?? "", ""].join(","));
      }

      const csv = lines.join("\n");
      const filename = `KEWT_BEI_Export_${new Date().toISOString().slice(0,10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
