/**
 * server/strava.ts
 * Strava integration: OAuth token lifecycle + activity normalization.
 *
 * POWER-DATA HONESTY RULE (KEWT policy):
 * Strava returns watts for many rides that have NO power meter — those are
 * Strava's own algorithmic ESTIMATE, not real data. The only field that says
 * the watts came from a real power meter is `device_watts === true`.
 *
 * This module surfaces that distinction as an explicit `powerTier`:
 *   - "measured"        → real power meter (device_watts true). Safe to show as power.
 *   - "strava_estimate" → Strava's algorithm. Carried separately + must be labeled.
 *   - "none"            → no watts at all.
 *
 * Real watts go into `weightedAvgWatts` ONLY when measured; the estimate is
 * kept in `stravaEstimateWatts` so the UI can never confuse the two.
 */

const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export type StravaPowerTier = "measured" | "strava_estimate" | "none";

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  athleteId?: number;
}

// ─── OAuth: build the authorize URL the athlete clicks ────────────────────────
// Send the user here in their browser to grant access. `state` is echoed back
// to your callback so you can tie the grant to the logged-in KEWT user.
export function buildStravaAuthUrl(redirectUri: string, state = ""): string {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) throw new Error("STRAVA_CLIENT_ID not set");
  const params = new URLSearchParams({
    client_id: String(clientId),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    // read = profile basics; activity:read_all = all activities incl. private.
    // Confirm scope names against current Strava developer docs when you build.
    scope: "read,activity:read_all",
    state,
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

// ─── OAuth: authorization code → tokens ───────────────────────────────────────
export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not set");
  }
  const resp = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    throw new Error(`Strava token exchange failed: ${resp.status} ${await resp.text()}`);
  }
  const data: any = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete?.id,
  };
}

// ─── OAuth: refresh an expired/expiring token ─────────────────────────────────
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not set");
  }
  const resp = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    throw new Error(`Strava token refresh failed: ${resp.status} ${await resp.text()}`);
  }
  const data: any = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Strava can rotate this — always persist it
    expiresAt: data.expires_at,
  };
}

/**
 * Returns a valid access token, refreshing if it expires within 5 minutes.
 * Pass a `persist` callback to write rotated tokens back to the user profile
 * so the connection stays alive without re-authorizing.
 */
export async function getValidStravaToken(
  tokens: StravaTokens,
  persist?: (t: StravaTokens) => Promise<void>,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt - nowSec > 300) return tokens.accessToken;
  const refreshed = await refreshStravaToken(tokens.refreshToken);
  const merged: StravaTokens = { ...tokens, ...refreshed };
  if (persist) await persist(merged);
  return merged.accessToken;
}

// ─── Fetch the athlete's activities (owned-integration path) ──────────────────
export async function fetchStravaActivities(
  accessToken: string,
  perPage = 30,
  page = 1,
): Promise<any[]> {
  const resp = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?per_page=${perPage}&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) {
    throw new Error(`Strava activity fetch failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

// ─── Power tier — the honesty gate ────────────────────────────────────────────
export function stravaPowerTier(raw: any): StravaPowerTier {
  // Real meter: device_watts true AND a usable watts value present.
  if (raw?.device_watts === true && Number(raw.weighted_average_watts ?? raw.average_watts) > 0) {
    return "measured";
  }
  // Strava produced a number but it's algorithmic, not from a meter.
  if (Number(raw?.average_watts) > 0) return "strava_estimate";
  return "none";
}

// ─── Sport mapping → KEWT canonical modality ──────────────────────────────────
const SPORT_TO_MODALITY: Record<string, string> = {
  Ride: "cycling", VirtualRide: "cycling", GravelRide: "cycling",
  MountainBikeRide: "cycling", EBikeRide: "cycling", EMountainBikeRide: "cycling",
  Handcycle: "cycling",
  Run: "running", TrailRun: "running", VirtualRun: "running", Treadmill: "running",
  Walk: "walking", Hike: "hiking",
  Swim: "swimming",
  WeightTraining: "strength", Crossfit: "strength",
  Yoga: "yoga", Workout: "other", Rowing: "other", Elliptical: "other",
};

// ─── Normalize ONE raw Strava activity → KEWT shape ───────────────────────────
// Works for both connection methods: pass it the raw activity object whether it
// came from fetchStravaActivities() (OAuth) or your Pipedream connector.
export function normalizeStravaActivity(raw: any) {
  const tier = stravaPowerTier(raw);
  const measured = tier === "measured";
  const sportType = raw.sport_type || raw.type || "Workout";
  const distMeters = Number(raw.distance) || 0;

  return {
    stravaId: String(raw.id),
    name: raw.name || "Activity",
    sportType,
    modality: SPORT_TO_MODALITY[sportType] ?? "other",
    startDate: raw.start_date || null,
    startDateLocal: raw.start_date_local || null,
    date: (raw.start_date_local || raw.start_date || "").slice(0, 10) || null,
    durationMin: raw.moving_time ? Math.round(raw.moving_time / 60) : null,
    movingTimeSec: raw.moving_time ?? null,
    elapsedTimeSec: raw.elapsed_time ?? null,
    distanceMeters: distMeters || null,
    distanceMiles: distMeters ? Math.round((distMeters / 1609.344) * 100) / 100 : null,
    elevationFt: raw.total_elevation_gain
      ? Math.round(raw.total_elevation_gain * 3.28084)
      : null,
    avgHr: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
    maxHr: raw.max_heartrate ? Math.round(raw.max_heartrate) : null,
    avgSpeedMs: raw.average_speed ?? null,
    avgCadence: raw.average_cadence ?? null,
    estCalsBurned: raw.calories ?? (raw.kilojoules ? Math.round(raw.kilojoules) : null),
    kilojoules: raw.kilojoules ?? null,

    // ── Power (honesty-gated) ──────────────────────────────────────────────
    deviceWatts: raw.device_watts === true,
    powerTier: tier,                                  // measured | strava_estimate | none
    weightedAvgWatts: measured                        // REAL watts only — null otherwise
      ? Math.round(Number(raw.weighted_average_watts ?? raw.average_watts))
      : null,
    stravaEstimateWatts: tier === "strava_estimate"   // estimate kept separate + labelable
      ? Math.round(Number(raw.average_watts))
      : null,
    maxWatts: measured && raw.max_watts ? Math.round(raw.max_watts) : null,

    sufferScore: raw.suffer_score ?? null,
    deviceName: raw.device_name ?? null,
    source: "strava",
  };
}
