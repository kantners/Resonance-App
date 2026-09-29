import type { Express } from "express";
import { requireAuth } from "../http";
import { RULE_VERSION } from "../rules";
import type { IStorage } from "../storage/types";
import { registerAuthRoutes, registerHealthRoute } from "./auth";
import { registerDailyRoutes } from "./daily";
import { registerScreenshotRoutes } from "./screenshot";
import { registerStudyRoutes } from "./study";

/** Sends one image with a prompt to a vision model; returns the raw text reply. */
export type VisionFn = (prompt: string, base64Image: string, mimeType: string) => Promise<string>;

export interface RouteDeps {
  storage: IStorage;
  hrvLogScale: boolean;                // HRV_LOG_SCALE, parsed once at startup
  now: () => Date;                     // instants only (audit stamps); calendar dates always come from the client
  randomInt: (n: number) => number;    // allocation RNG (crypto.randomInt in production)
  randomHex: (bytes: number) => string;
  vision?: VisionFn;                   // absent when OPENAI_API_KEY isn't set
  authRateLimit?: { max: number; windowMs: number };   // defaults to 10 per 15 minutes per IP
}

export const PUBLIC_API_ROUTES = [
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/health",
];

export function registerRoutes(app: Express, deps: RouteDeps) {
  registerHealthRoute(app, deps, RULE_VERSION);
  registerAuthRoutes(app, deps);

  // Every route registered below also carries requireAuth itself; this guard
  // backs that up for anything under /api, including unknown paths.
  app.use("/api", requireAuth);

  registerDailyRoutes(app, deps);
  registerScreenshotRoutes(app, deps);
  registerStudyRoutes(app, deps);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}
