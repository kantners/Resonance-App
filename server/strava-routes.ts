
/**
 * server/strava-routes.ts
 * Strava OAuth connect/callback, connection status, tiered sync, and disconnect.
 *
 * Wire in with two lines in routes.ts — see the instructions below the file.
 *
 * Routes added:
 *   GET  /api/strava/connect      — redirects the user to Strava to authorize
 *   GET  /api/strava/callback     — Strava lands here after the user approves
 *   GET  /api/strava/status       — is Strava connected for this user?
 *   POST /api/strava/sync-oauth   — fetch latest Strava activities and sync
 *   DELETE /api/strava/disconnect — clear stored tokens from the profile
 */

import type { Express } from "express";
import { pool } from "./storage";
import {
  buildStravaAuthUrl,
  exchangeStravaCode,
  getValidStravaToken,
  fetchStravaActivities,
  normalizeStravaActivity,
} from "./strava";

// ── Auth guard (mirrors the one in routes.ts) ─────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
  next();
}

// ── Persist refreshed tokens back to the user profile ─────────────────────────
async function persistStravaTokens(
  userId: number,
  tokens: { accessToken: string; refreshToken: string; expiresAt: number },
) {
  await pool.query(
    `UPDATE user_profile
        SET strava_access_token  = $1,
            strava_refresh_token = $2,
            strava_expires_at    = $3
      WHERE user_id = $4`,
    [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, userId],
  );
}

// ── Core sync: fetch from Strava API → upsert into activities ─────────────────
async function syncStravaActivities(
  userId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
): Promise<number> {
  // Auto-refresh the token if it's expiring within 5 minutes
  const validToken = await getValidStravaToken(
    { accessToken, refreshToken, expiresAt },
    (t) => persistStravaTokens(userId, t),
  );

  const rawActivities = await fetchStravaActivities(validToken, 30, 1);
  let synced = 0;

  for (const raw of rawActivities) {
    const a = normalizeStravaActivity(raw);
    if (!a.stravaId || !a.date) continue;

    const notes = [
      a.name && a.name !== "Activity" ? a.name : null,
      a.deviceName ? `Device: ${a.deviceName}` : null,
      "[Strava sync]",
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      await pool.query(
        `INSERT INTO activities
           (user_id, date, modality, duration_min, distance_miles, elevation_ft,
            avg_hr, est_cals_burned, notes, source,
            strava_id, device_watts, power_tier,
            weighted_avg_watts, strava_estimate_watts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (user_id, strava_id) WHERE strava_id IS NOT NULL
         DO UPDATE SET
           date                  = EXCLUDED.date,
           modality              = EXCLUDED.modality,
           duration_min          = EXCLUDED.duration_min,
           distance_miles        = EXCLUDED.distance_miles,
           elevation_ft          = EXCLUDED.elevation_ft,
           avg_hr                = EXCLUDED.avg_hr,
           est_cals_burned       = EXCLUDED.est_cals_burned,
           notes                 = EXCLUDED.notes,
           device_watts          = EXCLUDED.device_watts,
           power_tier            = EXCLUDED.power_tier,
           weighted_avg_watts    = EXCLUDED.weighted_avg_watts,
           strava_estimate_watts = EXCLUDED.strava_estimate_watts`,
        [
          userId,
          a.date,
          a.modality,
          a.durationMin,
          a.distanceMiles,
          a.elevationFt,
          a.avgHr,
          a.estCalsBurned,
          notes,
          "strava",
          a.stravaId,
          a.deviceWatts,
          a.powerTier,
          a.weightedAvgWatts,
          a.stravaEstimateWatts,
        ],
      );
      synced++;
    } catch (e: any) {
      console.error(`[Strava sync] activity ${a.stravaId}:`, e.message);
    }
  }

  return synced;
}

// ── Route registration ────────────────────────────────────────────────────────
export function registerStravaRoutes(app: Express): void {

  // Redirect the logged-in user to Strava's authorization page
  app.get("/api/strava/connect", requireAuth, (req: any, res: any) => {
    try {
      const redirectUri = process.env.STRAVA_REDIRECT_URI;
      if (!redirectUri) return res.status(500).json({ error: "STRAVA_REDIRECT_URI not set" });
      // Encode the userId in state so we can verify it matches on the way back
      const url = buildStravaAuthUrl(redirectUri, String(req.session.userId));
      res.redirect(url);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Strava redirects here after the user approves (or denies) access
  app.get("/api/strava/callback", requireAuth, async (req: any, res: any) => {
    try {
      const { code, state, error: oauthError } = req.query as Record<string, string>;

      // User clicked "Deny" on Strava
      if (oauthError) return res.redirect("/?strava=denied");

      // State should match the userId we sent — lightweight CSRF check
      if (state && state !== String(req.session.userId)) {
        return res.status(403).json({ error: "State mismatch" });
      }

      if (!code) return res.status(400).json({ error: "No authorization code received" });

      const tokens = await exchangeStravaCode(code);
      const userId = req.session.userId!;

      // Save connection to the user profile
      await pool.query(
        `UPDATE user_profile
            SET strava_athlete_id    = $1,
                strava_access_token  = $2,
                strava_refresh_token = $3,
                strava_expires_at    = $4,
                strava_scope         = $5,
                strava_connected_at  = now()
          WHERE user_id = $6`,
        [
          tokens.athleteId ?? null,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresAt,
          "read,activity:read_all",
          userId,
        ],
      );

      // Kick off a background sync so activities appear right away
      syncStravaActivities(userId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt)
        .then((n) => console.log(`[Strava] Initial sync: ${n} activities`))
        .catch((e) => console.error("[Strava] Initial sync failed:", e.message));

      res.redirect("/?strava=connected");
    } catch (e: any) {
      console.error("[Strava callback]", e.message);
      res.redirect("/?strava=error");
    }
  });

  // Is Strava connected for the current user?
  app.get("/api/strava/status", requireAuth, async (req: any, res: any) => {
    try {
      const result = await pool.query(
        `SELECT strava_athlete_id, strava_connected_at, strava_scope
           FROM user_profile WHERE user_id = $1`,
        [req.session.userId],
      );
      const row = result.rows[0];
      const connected = !!row?.strava_athlete_id;
      res.json({
        connected,
        athleteId:   connected ? row.strava_athlete_id  : null,
        connectedAt: connected ? row.strava_connected_at : null,
        scope:       connected ? row.strava_scope        : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Manually trigger a Strava sync (fetches latest 30 activities)
  app.post("/api/strava/sync-oauth", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.session.userId!;
      const result = await pool.query(
        `SELECT strava_access_token, strava_refresh_token, strava_expires_at
           FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row?.strava_access_token) {
        return res.status(400).json({
          error: "Strava not connected. Navigate to /api/strava/connect to authorize.",
        });
      }

      const count = await syncStravaActivities(
        userId,
        row.strava_access_token,
        row.strava_refresh_token,
        Number(row.strava_expires_at),
      );
      res.json({ synced: count, message: `${count} activit${count === 1 ? "y" : "ies"} synced from Strava.` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove the Strava connection from the user profile
  app.delete("/api/strava/disconnect", requireAuth, async (req: any, res: any) => {
    try {
      await pool.query(
        `UPDATE user_profile
            SET strava_athlete_id    = NULL,
                strava_access_token  = NULL,
                strava_refresh_token = NULL,
                strava_expires_at    = NULL,
                strava_scope         = NULL,
                strava_connected_at  = NULL
          WHERE user_id = $1`,
        [req.session.userId],
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
