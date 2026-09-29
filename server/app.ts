import express, { type Express } from "express";
import session, { type Store } from "express-session";
import { randomBytes } from "crypto";
import { errorHandler } from "./http";
import { registerRoutes, type RouteDeps } from "./routes";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export interface AppOptions {
  deps: RouteDeps;
  isProduction: boolean;
  sessionSecret?: string;
  sessionStore?: Store;          // Postgres in production; express-session's memory store in tests
  log?: (line: string) => void;
}

/**
 * The Express app without the Vite/static layer, so tests can drive it
 * directly with an in-memory storage.
 */
export function createApp({ deps, isProduction, sessionSecret, sessionStore, log }: AppOptions): Express {
  if (isProduction && !sessionSecret) {
    throw new Error("SESSION_SECRET is not set. It is required in production.");
  }

  const app = express();
  // Railway terminates TLS at its proxy; trust one hop so secure cookies and
  // req.ip (used by the rate limiter) work. Not trusted in development.
  if (isProduction) app.set("trust proxy", 1);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(session({
    store: sessionStore,
    // No fixed fallback: development gets a random per-process secret.
    secret: sessionSecret || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }));

  if (log) {
    // Method, path, status and timing only. Response bodies are never logged:
    // they contain personal health data.
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        if (req.path.startsWith("/api")) log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
      });
      next();
    });
  }

  registerRoutes(app, deps);
  app.use(errorHandler);
  return app;
}
