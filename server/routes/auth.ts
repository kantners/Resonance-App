import type { Express } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { User } from "@shared/schema";
import { zHrvSource } from "@shared/schema";
import { badRequest, conflict, HttpError, requireAuth, userId } from "../http";
import { AUTH_RATE_LIMIT, createRateLimiter } from "../middleware/rateLimit";
import { UniqueViolation } from "../storage/types";
import type { MeResponse } from "@shared/api";
import type { RouteDeps } from ".";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const zTimeZone = z.string().refine(isValidTimeZone, "Unknown IANA time zone");

export function publicUser(u: User, isPractitioner: boolean): MeResponse {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    isDemo: u.isDemo,
    timeZone: u.timeZone,
    defaultHrvSource: u.defaultHrvSource,
    defaultHrvDevice: u.defaultHrvDevice,
    isPractitioner,
  };
}

const zRegister = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().trim().max(80).optional(),
  timeZone: zTimeZone.optional(),
});

const zLogin = z.object({ email: z.string().min(1), password: z.string().min(1) });

const zSettings = z.object({
  firstName: z.string().trim().max(80).nullable().optional(),
  timeZone: zTimeZone.optional(),
  defaultHrvSource: zHrvSource.optional(),
  defaultHrvDevice: z.string().trim().min(1).max(120).optional(),
}).strict();

export function registerAuthRoutes(app: Express, deps: RouteDeps) {
  const { storage } = deps;
  // One limiter per app instance, shared by login and register.
  const authRateLimit = createRateLimiter(deps.authRateLimit ?? AUTH_RATE_LIMIT);
  async function me(u: User) {
    return publicUser(u, !!(await storage.getPractitionerByUserId(u.id)));
  }

  // ── Public ────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    const body = zRegister.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    let user: User;
    try {
      user = await storage.createUser({
        email: body.email, passwordHash, firstName: body.firstName || null, timeZone: body.timeZone ?? null,
      });
    } catch (e) {
      if (e instanceof UniqueViolation) throw conflict("An account with this email already exists");
      throw e;
    }
    req.session.userId = user.id;
    res.json({ ok: true, user: await me(user) });
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    const { email, password } = zLogin.parse(req.body);
    const user = await storage.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    req.session.userId = user.id;
    res.json({ ok: true, user: await me(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // ── Authenticated ─────────────────────────────────────────────────────────
  app.get("/api/me", requireAuth, async (req, res) => {
    const user = await storage.getUserById(userId(req));
    if (!user) throw new HttpError(401, "Authentication required");
    res.json(await me(user));
  });

  app.patch("/api/settings", requireAuth, async (req, res) => {
    const patch = zSettings.parse(req.body);
    const user = await storage.updateUserSettings(userId(req), patch);
    if (!user) throw new HttpError(401, "Authentication required");
    res.json(await me(user));
  });

  // Deletes the account and all personal data (cascade). Study enrollments
  // stay as pseudonymised tombstones so allocation rows stay consumed.
  app.delete("/api/me", requireAuth, async (req, res) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const id = userId(req);
    const user = await storage.getUserById(id);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw badRequest("Password is incorrect");
    const practitioner = await storage.getPractitionerByUserId(id);
    if (practitioner && (await storage.listProtocols(practitioner.id)).length) {
      throw conflict("This account runs a study. Its protocols must be closed out before the account can be deleted.");
    }
    // Study data goes too: withdraw every enrollment (deletes its sessions).
    const now = deps.now();
    for (const e of await storage.listEnrollmentsForClient(id)) await storage.withdrawEnrollment(e.id, now);
    await storage.deleteUser(id);
    req.session.destroy(() => res.json({ ok: true }));
  });
}

export function registerHealthRoute(app: Express, { storage }: RouteDeps, ruleVersion: string) {
  // Public (approved, C12). Returns only { ok, ruleVersion }; no DB details, even on failure.
  app.get("/api/health", async (_req, res) => {
    try {
      await storage.ping();
      res.json({ ok: true, ruleVersion });
    } catch {
      res.status(503).json({ ok: false, ruleVersion });
    }
  });
}
