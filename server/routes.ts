import type { Express } from "express";
import type { Server } from "http";
import { storage, pool } from "./storage";
import { insertSleepSchema, insertBreathworkSchema } from "@shared/schema";
import multer from "multer";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import bcrypt from "bcryptjs";

const upload = multer({ dest: path.join(os.tmpdir(), "resonance-uploads") });

// ─── Auth guard middleware ────────────────────────────────────────────────────
// Every data route uses requireAuth explicitly, and a global guard on /api
// (registered after the public auth routes) backs it up.
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
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
      res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName } });
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
      res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName } });
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
      res.json({ id: user.id, email: user.email, firstName: user.firstName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── All routes below require authentication ───────────────────────────────
  app.use("/api", requireAuth);

  // ── Sleep ─────────────────────────────────────────────────────────────────
  app.get("/api/sleep", requireAuth, async (req, res) => {
    try { res.json(await storage.getSleepLogs(req.session.userId!, 60)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sleep", requireAuth, async (req, res) => {
    try {
      const data = insertSleepSchema.parse(req.body);
      res.json(await storage.createSleepLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/sleep/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allowed = ["notes", "sleepScore", "hours", "hrv", "restingHr"];
      const patch: any = {};
      for (const k of allowed) { if (req.body[k] !== undefined) patch[k] = req.body[k]; }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateSleepLog(req.session.userId!, id, patch);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Breathwork (read alongside stillness_sessions for chosen stillness) ───
  app.get("/api/breathwork", requireAuth, async (req, res) => {
    try { res.json(await storage.getBreathworkLogs(req.session.userId!, 30)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/breathwork", requireAuth, async (req, res) => {
    try {
      const data = insertBreathworkSchema.parse(req.body);
      res.json(await storage.createBreathworkLog(req.session.userId!, data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ── Fasting ───────────────────────────────────────────────────────────────
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
      const row = await storage.updateFastTimes(req.session.userId!, Number(req.params.id), startedAt, endedAt);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Screenshot parse ──────────────────────────────────────────────────────
  // Screenshots are sent to OpenAI for parsing; the privacy text says so.
  app.post("/api/parse-screenshot", requireAuth, upload.single("image"), async (req, res) => {
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

      const prompt = `You extract data from a sleep summary screenshot (any watch or ring app).

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object. No markdown. No explanation. No backticks. Start with { end with }.
- Never omit a field — use null for anything not visible.
- All numbers must be actual numbers, never strings.

Return: {"type":"sleep","data":{...}}

FIELD EXTRACTION RULES:
- "date": the wake date as YYYY-MM-DD if a date is visible, otherwise null.
- "hours": total sleep duration in decimal hours. "6h 53m" → 6.88, "7h 30m" → 7.5.
- "sleep_score": the score numerator only ("80 / 100" → 80).
- "hrv": average overnight HRV in milliseconds. NOT a 7-day average.
- "resting_hr": resting heart rate in bpm. NOT the average overnight heart rate.

Full field list:
{"date":"YYYY-MM-DD"|null,"hours":number|null,"sleep_score":number|null,"hrv":number|null,"resting_hr":number|null}`;

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
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[parse-screenshot] attempt ${attempt}/${MAX_RETRIES} failed: ${e?.message}`);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
          }
        }
      }

      if (!completion) {
        throw lastError ?? new Error("All parse attempts failed — try again");
      }

      // ── Robust JSON extraction ────────────────────────────────────────────
      const raw = completion.choices[0].message.content?.trim() ?? "{}";
      const stripped = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Response did not contain valid JSON");
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.type || !parsed.data) {
        throw new Error("Unexpected response structure from vision model");
      }

      return res.json({ ok: true, ...parsed });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Screenshot parsing failed" });
    } finally {
      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
    }
  });

  // ── Screenshot commit ─────────────────────────────────────────────────────
  app.post("/api/commit-screenshot", requireAuth, async (req, res) => {
    try {
      const { type, data } = req.body;
      if (!type || !data) return res.status(400).json({ error: "Missing type or data" });
      if (type !== "sleep") return res.status(400).json({ error: "Unknown type" });
      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        return res.status(400).json({ error: "A wake date (YYYY-MM-DD) is required" });
      }
      const userId = req.session.userId!;

      // Zero is never a valid reading for these fields
      const zeroNullNum = (v: any) => (v === 0 || v === "0" ? null : (v ?? null));
      const hours = zeroNullNum(data.hours);
      const sleepScore = zeroNullNum(data.sleep_score);
      const hrv = zeroNullNum(data.hrv);
      const restingHr = zeroNullNum(data.resting_hr);

      const existing = await pool.query("SELECT id FROM sleep_logs WHERE date = $1 AND user_id = $2", [data.date, userId]);
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE sleep_logs SET hours=COALESCE($1,hours), sleep_score=COALESCE($2,sleep_score), hrv=COALESCE($3,hrv), resting_hr=COALESCE($4,resting_hr) WHERE date=$5 AND user_id=$6`,
          [hours, sleepScore, hrv, restingHr, data.date, userId]);
        return res.json({ ok: true, action: "updated", date: data.date });
      }
      if (hours == null) return res.status(400).json({ error: "Time asleep is required for a new night" });
      await pool.query(
        `INSERT INTO sleep_logs (user_id, date, hours, sleep_score, hrv, resting_hr) VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, data.date, hours, sleepScore, hrv, restingHr]);
      return res.json({ ok: true, action: "inserted", date: data.date });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
