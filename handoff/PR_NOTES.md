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
- **Step 6 (rule engine): HANDOFF interpretations.** Please check these.
  - **W is the 7 calendar nights ending last night, counting the logged ones.** §3.2 says "the last 7 logged nights", but under that reading `|W| ≥ 5` could never bind (anyone with 19+ nights always has 7 logged nights), and amendment B7's "6 of 7 nights" would be impossible. B stays "the 14 logged nights before W".
  - **A night's state is judged against the ranges as they stood that morning**, not today's ranges, so a stored night never changes state afterwards. `consecutiveNightsOut` and "nights in range, last 30" use those per-night states.
  - **"Consecutive" means calendar-consecutive:** a night with no HRV breaks the run.
  - **"n / logged" counts only nights that could be judged** (nights that had a full baseline that morning). Nights logged while the baseline was still building aren't counted as out of range.
  - **While the baseline is building,** `nightState` is stored as `no_data` and the escalation level is 0.
  - **Level 2 names a likely pattern** ("Both followed high screen-time days") only when every out-of-range night followed a high-exposure day (§3.6 threshold). The HANDOFF's example ("90+ minutes of screen time after 9 PM") needs per-evening minutes, which Layer 0 doesn't capture.
  - **The pattern callout's "last 28 days"** is the 28 days ending yesterday, and needs at least 7 logged exposure days.
  - **Long game:** both baselines must come from the same HRV source and device. After a device change, the long game waits until 98 comparable nights exist again.
  - **Study analysis on the ln scale** (the protocol default) reports effects as a percent change (for example "+5.2%"). The canvas shows ms, which is the linear scale.
  - **Log-scale ranges:** with the synthetic fixture baseline (HRV 48 ± 5), the log path gives 45.3–50.3 against the linear 45.5–50.5. The plan's "about 45.6–50.7" was an estimate; the real shift depends on the data.
- **Step 7 (tests):**
  - The route-level tests (409 before the pre-reading, client and practitioner concealment, the 401 sweep, demo/real enrollment, the `/api/health` shape) are written together with the routes in step 8, because they can't run before those routes exist. Everything else in the plan's step 7 is in this step.
  - The copy lint scans string literals and JSX text only (not identifiers or comments), and has a self-test that proves it catches banned wording.
  - `tsconfig` now typechecks the tests as well.
  - CI moved up from step 11 to step 7, so it guards every later push.
- **Standing rule (Mark, September 28):** all colors and fonts go through semantic design tokens (CSS variables in `index.css`, mapped in Tailwind), with no hex codes in components, so the palette is a single-file swap. Login.tsx and the placeholder Home get converted in step 9.

## Environment limits
- There's no local Postgres or Docker on the build machine, so `db:migrate`, `seed:demo` and `docker build` can't be run end-to-end locally. CI and Railway cover the build; the DB steps need a Postgres instance.
