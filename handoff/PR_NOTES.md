# PR notes (collected during the build; folded into the PR body at step 12)

## Process notes
- **Verification piping (steps 3–4).** The check/build commands in steps 2–4 were piped through `tail` without `set -o pipefail`, so the shell's exit status was `tail`'s, not `tsc`'s. The step 3 commit message says check and build passed. Its output showed no diagnostics, so that claim holds, but the exit code wasn't what confirmed it. In step 4, the same piping briefly hid a real failure in the new `server/middleware/rateLimit.ts`: iterating a `Map` was rejected because `tsconfig.json` set no `target` (the ES3 default). Fixed in step 4 by setting `"target": "ES2022"`, which matches Node 24, and clearing the stale `tsbuildinfo`. From step 4 on, verification runs with `pipefail`.

## Changes beyond the plan (so far)
- **Step 3:** `/api/commit-screenshot` requires a client-supplied wake date instead of defaulting to the server clock (early part of B6).
- **Step 4:**
  - Removed `reusePort: true` from `httpServer.listen`. It fails with `ENOTSUP` on Windows, and a single process doesn't need it.
  - Request logging no longer writes response bodies, which contained personal health data.
  - The error handler no longer echoes 5xx error messages (for example database errors) to clients.
  - The Dockerfile runs `npm ci`, the build and the app as the unprivileged `node` user (requested). `/app` and every copied file are owned by `node` via `COPY --chown`, which avoids a `chown -R` layer that would duplicate `node_modules`.
- **Step 5 (schema):**
  - `sleep_logs.hours` is nullable (a reading can come in before the night's duration).
  - KEWT's Garmin-specific sleep columns (stages, SpO₂, respiration, stress, body battery, overnight HR, HRV status, mood) are dropped. Resonance keeps `hours`, `sleepScore`, `hrv`, `restingHr` and `notes` (HANDOFF §0).
  - New `unique(user_id, date)` on `sleep_logs` (one night per wake date).
  - `morning_readings.date` holds the client's local date (B6).
  - `daily_status.week_nights`/`baseline_nights` (B7), `study_protocols.consent_version` and `supersedes_id` (version lineage), and `digital_exposure.hourly_pickups` (iOS quiet estimate).
  - The `session` table is defined in the schema, so the migration creates it; `createTableIfMissing` is off.
  - `drizzle.config.ts` only requires `DATABASE_URL` for commands that connect.
  - Verified: `migrations/0000_init.sql` applies cleanly to PGlite (embedded Postgres, run from a scratch folder, not a project dependency), with the unique constraint and cascade deletes smoke-tested.
- **Standing rule (Mark, September 28):** all colors and fonts go through semantic design tokens (CSS variables in `index.css`, mapped in Tailwind), with no hex codes in components, so the palette is a single-file swap. Login.tsx and the placeholder Home get converted in step 9.

## Environment limits
- There's no local Postgres or Docker on the build machine, so `db:migrate`, `seed:demo` and `docker build` can't be run end-to-end locally. CI and Railway cover the build; the DB steps need a Postgres instance.
