// Spot heart rate from a Bluetooth sensor: summary numbers only, in a series
// of its own (never merged into sleep resting HR).
import type { Express } from "express";
import { z } from "zod";
import { zSpotHrKind } from "@shared/schema";
import { badRequest, idParam, rangeQuery, requireAuth, userId, zLocalDate } from "../http";
import { zIsoInstant } from "./daily";
import type { RouteDeps } from ".";

const bpm = z.number().min(25).max(230).nullable().optional();

const zSpotHr = z.object({
  date: zLocalDate,
  takenAt: zIsoInstant,
  kind: zSpotHrKind,
  lowestSteadyBpm: bpm,
  meanBpm: bpm,
  startBpm: bpm,
  endBpm: bpm,
  durationS: z.number().int().min(1).max(24 * 3600),
  sampleCount: z.number().int().min(1).max(100_000),
  device: z.string().trim().max(120).nullable().optional(),
  stillnessSessionId: z.number().int().positive().nullable().optional(),
}).strict()
  .refine(s => s.kind !== "calm" || s.lowestSteadyBpm != null || s.meanBpm != null,
    { message: "A calm reading needs a lowest steady or mean value", path: ["meanBpm"] })
  .refine(s => s.kind !== "stillness" || s.startBpm != null || s.endBpm != null,
    { message: "A stillness reading needs a start or end value", path: ["startBpm"] })
  .refine(s => s.kind === "stillness" || s.stillnessSessionId == null,
    { message: "stillnessSessionId is only for stillness readings", path: ["stillnessSessionId"] });

export function registerSpotHrRoutes(app: Express, { storage }: RouteDeps) {
  app.post("/api/spot-hr", requireAuth, async (req, res) => {
    const uid = userId(req);
    const s = zSpotHr.parse(req.body);
    if (s.stillnessSessionId != null) {
      const day = await storage.listStillness(uid, s.date, s.date);
      if (!day.some(x => x.id === s.stillnessSessionId)) throw badRequest("That stillness session was not found on this date");
    }
    res.json(await storage.createSpotHr(uid, {
      ...s,
      lowestSteadyBpm: s.lowestSteadyBpm ?? null, meanBpm: s.meanBpm ?? null,
      startBpm: s.startBpm ?? null, endBpm: s.endBpm ?? null,
      device: s.device ?? null, stillnessSessionId: s.stillnessSessionId ?? null,
    }));
  });

  app.get("/api/spot-hr", requireAuth, async (req, res) => {
    const { from, to } = rangeQuery(req);
    res.json(await storage.listSpotHr(userId(req), from, to));
  });

  app.delete("/api/spot-hr/:id", requireAuth, async (req, res) => {
    res.json({ ok: await storage.deleteSpotHr(userId(req), idParam(req)) });
  });
}
