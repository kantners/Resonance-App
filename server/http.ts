import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { isValidDate } from "./rules/dates";

/** An error with an HTTP status; its message is safe to show the client. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const forbidden = (msg = "Not allowed") => new HttpError(403, msg);

/** Every data route uses this. Study routes add a role check on top. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function userId(req: Request): number {
  const id = req.session?.userId;
  if (!id) throw new HttpError(401, "Authentication required");
  return id;
}

/** A calendar date supplied by the client (the user's local date). */
export const zLocalDate = z.string().refine(isValidDate, "Expected a valid YYYY-MM-DD date");

export function dateParam(req: Request, name = "date"): string {
  const v = req.params[name];
  if (typeof v !== "string" || !isValidDate(v)) throw badRequest(`${name} must be a valid YYYY-MM-DD date`);
  return v;
}

export function idParam(req: Request, name = "id"): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`${name} must be a positive integer`);
  return n;
}

/** Optional ?from&to date range. */
export function rangeQuery(req: Request): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  for (const k of ["from", "to"] as const) {
    const v = req.query[k];
    if (v === undefined) continue;
    if (typeof v !== "string" || !isValidDate(v)) throw badRequest(`${k} must be a valid YYYY-MM-DD date`);
    out[k] = v;
  }
  return out;
}

/** Final error handler: 4xx messages are shown; 5xx details never leave the server. */
export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      issues: err.issues.map(i => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const status = err?.status || err?.statusCode;
  if (status && status < 500) return res.status(status).json({ error: err.message || "Request error" });
  console.error("Internal Server Error:", err);
  return res.status(500).json({ error: "Internal Server Error" });
}
