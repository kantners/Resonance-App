import "dotenv/config";
import { createServer } from "http";
import { randomBytes, randomInt } from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createApp } from "./app";
import { db, pool } from "./db";
import { parseHrvLogScale } from "./rules";
import { serveStatic } from "./static";
import { createDbStorage } from "./storage/db";
import { createOpenAiVision } from "./vision";

const isProduction = process.env.NODE_ENV === "production";

export function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${time} [${source}] ${message}`);
}

const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET;

const app = createApp({
  isProduction,
  sessionSecret,
  // The "session" table is created by migrations/.
  sessionStore: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
  log: line => log(line),
  deps: {
    storage: createDbStorage(db),
    hrvLogScale: parseHrvLogScale(process.env.HRV_LOG_SCALE),
    now: () => new Date(),
    randomInt: n => randomInt(n),
    randomHex: bytes => randomBytes(bytes).toString("hex"),
    vision: process.env.OPENAI_API_KEY ? createOpenAiVision(process.env.OPENAI_API_KEY) : undefined,
  },
});

const httpServer = createServer(app);

(async () => {
  if (isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
