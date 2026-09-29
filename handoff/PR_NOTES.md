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
- **Step 8 (routes):**
  - **Withdrawal no longer frees the allocation row** (a gap in the plan). Deleting the enrollment would have let the next client reuse the same sequence, so withdrawing would effectively re-roll the allocation. Withdrawal now deletes the sessions, clears the touch profile and unlinks the client, but keeps an anonymised tombstone. Migration `0001` makes `study_enrollments.client_user_id` nullable with `ON DELETE SET NULL` so account deletion behaves the same way. Deleting an account withdraws all of its enrollments first.
  - **Readings come only through the client route** (`PATCH /sessions/:id/client`), as HANDOFF §5 lists them. The practitioner's `PATCH` can't set readings or the guess.
  - **Session order enforced server-side:** the pre-reading can't change after the reveal, the post-reading needs the reveal, the guess needs the post-reading, and a session can't be marked complete without the post-reading. `/start` can be repeated; it returns the same condition and keeps the first reveal time. Every reveal is logged to the server log.
  - **The client's guess is stored as an arm code or `not_sure`**, so it works for any arms. The template names (`reiki`/`touch_only`/`rest`) aren't accepted. The practitioner sees the guess only once the session is complete.
  - **Inherent A4 limit:** in a crossover the practitioner knows each client gets each condition once, so after revealing all but one visit, the last one can be deduced. The API never shows it, but the design allows the inference. The protocol's known-limits section already says the practitioner isn't blind.
  - **Deck study 3 template:** primary contrast C−A (Reiki added to breath), secondary C−B. These are my defaults; please confirm.
  - **Per-practitioner results:** a protocol has one practitioner in Layer 0, so only the visibility flag is computed and there's no breakdown.
  - **Export:** a text + CSV bundle (`?part=all|methods|sessions|deviations|results`); no PDF, to avoid a new dependency.
  - **Screenshots:** the model defaults to `gpt-4o-mini` as HANDOFF §0 says (the KEWT copy actually used `gpt-4o`), overridable with `OPENAI_VISION_MODEL`. Fields read with a confidence below 0.7 go into `lowConfidenceFields`.
  - **A morning reading sets that date's `sleep_logs.hrv`,** but not `restingHr`: a 60-second heart rate isn't an overnight resting heart rate.
  - **Routes added beyond §5:** sleep/stillness/reading/exposure/trends reads, settings, account deletion, practitioner setup, templates, protocol draft edit/list/detail/sessions/complete, invite, "my enrollments", and a role-aware session `GET`. `/api/me` now uses `requireAuth` too.
  - **Storage:** `server/storage/` now has an interface, a Drizzle implementation and an in-memory implementation (tests only). The auth rate limiter is per app instance.
  - **Verification:**
    - 82 tests pass, including the route tests for the §7 route fixtures, A1–A4, B5, B6, C10–C12 and the `requireAuth` sweep.
    - Mutation checks: deliberately leaking `condition` from either serializer makes the matching test fail.
    - An end-to-end run of the real server against Postgres (PGlite's wire-protocol server, from a scratch folder) passed 28 checks covering daily data, the Brief (log scale on), and the full study flow, including withdrawal and account deletion. Both migrations applied with `drizzle-kit migrate`.
    - **Correction on that first run:** a stopped background task had left the previous server process running, so the new server failed to bind and the checks ran against the older process (same code, freshly migrated database). At Mark's request, the 28 checks were re-run from a clean start: a fresh PGlite, a fresh `drizzle-kit migrate` (16 tables, 0 users), and a freshly started server on a new port, whose own log shows it served all 55 requests. All 28 passed. Test processes are now stopped by port, not by task.
- **Standing rule (Mark, September 28):** all colors and fonts go through semantic design tokens (CSS variables in `index.css`, mapped in Tailwind), with no hex codes in components, so the palette is a single-file swap. Login.tsx and the placeholder Home get converted in step 9.

## Decisions after step 8 (Mark, September 28)
- **1 and 3 agreed:** W counts calendar nights; the allocation hash includes a nonce.
- **2 agreed:** withdrawal keeps an anonymised allocation tombstone. The Consent text must say so. The approved sentence is in `shared/consentCopy.ts` (`CONSENT_WITHDRAWAL_ALLOCATION_NOTE`), for the Consent screen (9b): "If you leave, Resonance keeps one anonymised allocation record (your slot number only, with no readings, answers or name) so the study's random order stays balanced." Please check the wording.
- **4 agreed as the default:**
  - The primary and secondary contrasts are stored on the protocol, frozen at lock and printed in the methods export, the same as `analysis_scale`. Tests cover edits after lock (409) and the export text.
  - Arms can be flagged `optional` (the factorial's rest arm is). A primary contrast can't use an optional arm (400).
  - Any comparison with an optional arm is labelled exploratory. That covers a secondary that uses it, plus automatic "arm − rest" contrasts for the arms not already compared. The labels appear in the results, the verdict text ("Exploratory. Observed…") and the export (`role` column; "(exploratory)" in methods).
- **5 agreed:** keep `gpt-4o-mini`. `OPENAI_VISION_MODEL=gpt-4o-mini` is in `.env.example`. **To do before relying on it:** evaluate the model on real iOS Screen Time and Android Digital Wellbeing screenshots, checking digit accuracy, the hourly pickup bars and whether the confidence values are calibrated. Switch the model if needed.

## No interim peeking (Mark, September 28)
- Until a protocol is completed, `GET /protocols/:id/results` returns progress and quality checks only (`resultsLocked: true`). Primary, secondary and exploratory contrasts and per-client deltas are all omitted, and the Study screen shows "Results unlock when the study is complete (prevents interim peeking)." Test: `results omit contrasts and per-client deltas until completedAt is set, then include them`.
- **Extended to the export, for the same reason:** mid-study, the export's `results` and `sessions` sections hold only that line. `sessions.csv` pairs each revealed condition with its readings, so it would let anyone rebuild the contrasts. Methods and deviations stay available (the methods file is the pre-registration record).
- ~~**Residual:** the practitioner's session list and single-session `GET`s still return each revealed session's readings.~~ Resolved by the outcome-blind decision below.
- The demo protocol is seeded as completed so the full Study screen can be shown.

## Outcome-blind practitioner (Mark, September 29)
- **Decision:** the practitioner is outcome-blind for the whole study. Until the protocol is completed, no practitioner view of a session shows a reading value.
- **Server:** `toPractitionerSession()` (the single serializer behind the single-session `GET`, the session list and the practitioner `PATCH` reply) omits pre/post rMSSD, heart rate and breaths per minute, and the client's relaxation ratings (also outcomes), until `completedAt`. Instead it sends `preRecorded`/`postRecorded`, the reading time, posture and device, and `valuesLocked: true`. After completion, all values are included. The client still sees their own readings.
- **Export:** already covered. Mid-study, `sessions.csv` holds only the "Results unlock…" line; methods and deviations carry no reading values. The quality panel's device-mismatch list shows devices only.
- **Client:** `PractitionerSessionDto` in `shared/api.ts` and `components/StudyReading.tsx`, which renders "Recorded ✓ · 2:14 PM · Polar H10 + Elite HRV" while `valuesLocked` is true and the values once unlocked. The Session screen (9b) uses it. No current screen lists sessions, so nothing visible changes today.
- **Posture stays visible:** it's a procedure check (the reveal requires a face-up pre-reading), not an outcome.
- **Test:** `outcome-blind: practitioner session views show 'recorded' with time and device, no values, until completion` covers the session `GET`, the list, the `PATCH` reply and the export, before and after completion, plus the client's own view. Mutation check: including the values unconditionally makes it fail.

## Step 9a (priority screens)
- **Tokens:** every color and font family lives in `client/src/index.css` as a CSS variable with a semantic name (`ground`, `surface`, `ink`, `ink-soft`, `muted`, `neutral`, `line`, `control`, `track`, `hairline`, `wash`, `physiology*`, `exposure*`, `alert`), mapped in `tailwind.config.ts`. An audit finds no hex values or raw Tailwind palette colors in the client. `muted` is Mark's text token; shadcn's `muted-foreground` is an alias of it.
- **Screens:** Main (with the B8 first-run/building state and the B7 night count), Recovery-Rule, Morning-Check (manual, source required), Sleep, Exposure-Manual and Study (draft → lock with the ethics reminder, the hash, the fixed scale/device/contrasts, mismatch flags, results locked until completion). Also a Log tab landing page, Settings, Privacy/Terms working text (to review before any public release), Login in tokens, and placeholders for the 9b screens.
- **Copy changes from the canvas:**
  - Recovery-Rule: the label gate is "at least 19 nights (14 + at least 5 of 7)"; with the flag on, the HRV range is described as log-scale; Step 2 says "the nights logged in the last 7 days".
  - Recovery-Rule's level-2 row said "naming the likely cause". Under the wording rule (never "causes") it now reads "naming the pattern behind them if your logs show one". The copy lint caught this.
  - Morning-Check: manual entry, no fingertip or camera text.
  - Main: the week label shows its night count ("Steady · 7 of 7 nights").
- **Copy lint:** `treated as` is allowed (canvas: "commonly treated as meaningful"). Class names are ignored, and JSX prose is read separately, so apostrophes can't open fake strings. Self-tests cover each of these.
- **Removed:** the unused `ui/chart.tsx` and the `recharts` dependency (flagged deprecated); the unused KEWT `DatePicker`/`TimePicker`; and KEWT's "always open on the Dashboard" hash reset.
- **Build warnings:** the 5 esbuild `import.meta` warnings come from `vite.config.ts`, pulled in by the dev-only `server/vite.ts`. They're pre-existing and harmless in production (that path isn't loaded there).

## Step 10 (demo data)
- `npm run seed:demo` refuses to run without `ALLOW_DEMO_SEED=true` and takes the password only from `DEMO_PASSWORD` (C11). Re-running replaces the demo data.
- The seed generates candidate data from a seeded RNG, runs it through the real rule engine, and keeps the first candidate that reproduces the canvas. It then prints the numbers. Verified through the live server as the demo user: Steady · 7 of 7, 48.6 / 55.1, both_out "Noted", 22 / 30, pattern 3 of 4 (5h 47m vs 4h 11m), long game 44 → 48 ms and 57 → 55 bpm, longest quiet 1h 53m (6 stretches, 94 pickups, 23 after 9 PM), stillness 45 min, fasting 14h 20m / 16h. Study: 6/12 clients, 20/36 sessions, A−B +0.67 (−1.9 to +3.2), B−C +1.40 (−0.9 to +3.7), 5 of 12 guesses, 9.1 / 10, 2 of 20 deviations.
- Dates are relative to the day the seed runs ("today" plays the canvas's Friday). With log scale on, the ranges read 45.3–50.3 ms (agreed).
- The demo user is also the demo practitioner. The study is seeded as completed (Mark's instruction), with seven demo clients; the seventh is part-way through, allocated so that their two sessions don't touch the canvas contrasts.
- **Bug found while verifying:** after completion, the quality panel counted every scheduled visit, including visits never held ("2 of 21"). It now counts held (completed) sessions, and a route test shows the old behavior fails. The per-client deltas also skip clients with no held sessions.

## Environment limits
- There's no local Postgres or Docker on the build machine, so `db:migrate`, `seed:demo` and `docker build` can't be run end-to-end locally. CI and Railway cover the build; the DB steps need a Postgres instance.
