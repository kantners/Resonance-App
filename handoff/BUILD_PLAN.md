# Resonance Layer 0: build plan (rev. 2, with PLAN_AMENDMENTS.md)

## Context
This folder started as a copy of KEWT: about 30k lines covering training, nutrition, IG posts, Strava and Garmin, all under KEWT branding, pointing at KEWT's production server, and with auth gaps. `handoff/CLAUDE_CODE_BUILD_PROMPT.md` asks for it to become **Resonance Layer 0**, a narrow HRV and phone-exposure instrument plus a practitioner Session Study, built to HANDOFF.md and the 14 design screens. Revision 2 folds in every item of `handoff/PLAN_AMENDMENTS.md` (tagged **[A1]**…**[D15]** below). On approval, this plan gets copied to `handoff/BUILD_PLAN.md` as the step-1 commit on branch `build/layer-0`.

**Precedence when sources disagree:** PLAN_AMENDMENTS, then the build prompt, then Mark's Sep 28 answers, then HANDOFF.md, then the design screens. KEWT (`..\kewt-app`) is never touched.

**Working rhythm [D13]:** every step ends with a commit **and a push** of `build/layer-0` to `origin` (`kantners/Resonance-App`), so nothing is lost if a session pauses.

## Decisions settled with Mark (Sep 28)
1. **Label gate:** HANDOFF rule, `|B| = 14 && |W| ≥ 5`. The Recovery-Rule copy changes to "at least 19 nights (14 for the baseline, at least 5 for the week)".
2. **Log scale (daily Brief):** `HRV_LOG_SCALE` defaults to on and applies to **ranges only**: `exp(mean_ln ± 0.5·sd_ln)`. The 7-night average stays arithmetic. The demo range reads about 45.6–50.7. The copy says the HRV range is computed on a log scale. The §7 fixtures run with the flag off, and the log path has its own tests. (The study does **not** use this flag; see A2.)
3. **Removal scope:** keep only the HANDOFF §0 keep-list.
4. **No camera PPG in Layer 0.** Readings are entered manually, and every reading requires a source (device + app) in `hrvSource`/`hrvDevice`. PPG is deferred to Layer 1 with chest-strap RR, and has to be validated against a reference before any study uses it. This forces copy changes on Morning-Check (no fingertip or camera text; "use the same device every morning; the baseline restarts if it changes") and on Consent ("a 60-second reading").
5. **`/api/health` is public** [C12] and returns only `{ ok, ruleVersion }`. On a failed DB ping it returns `503 { ok: false, ruleVersion }`, with no error text.
6. **`gh`:** Mark installs and authenticates it before step 12 [D15].

## Study integrity [A1–A4]
- **[A1] Allocation list generated at lock.**
  - `POST /protocols/:id/lock` builds the full list for `targetClients`: shuffled blocks via `crypto.randomInt`, rounded up to whole blocks. The blocks are:
    - 2 arms: AB/BA
    - 3 arms: all 6 permutations
    - 4 arms: a Williams square
  - Stored on the protocol as `allocation_list` (JSON rows `{index, block, sequence}`), together with `allocation_nonce` (128-bit random) and `allocation_sha256 = SHA-256(canonical JSON {nonce, list})`.
  - Enrollment takes the lowest unused row: `study_enrollments.allocation_index`, with `unique(protocol_id, allocation_index)`, inside a transaction, retrying on conflict. It **never generates** a row, and returns 409 when the list is used up.
  - The hash appears on the Study screen and in the export. The list and nonce go into the export only after `completedAt`.
  - *Why the nonce (an addition, flagged in the PR):* 12 rows of 6 orderings is about 2·10⁹ possibilities, so an unsalted hash could be brute-forced to recover the order early. The nonce keeps the hash verifiable afterwards without revealing anything before completion.
- **[A2] `study_protocols.analysis_scale` (`linear` | `ln`),** chosen in the draft (default `ln`) and frozen at lock. Deltas and CIs read it from the protocol and ignore `HRV_LOG_SCALE`. It's printed in the methods export.
- **[A3] `study_protocols.reading_device`** (device + app), required to lock and frozen at lock. Every session records `pre_reading_device` and `post_reading_device`. Results and the Study screen flag any session where either doesn't match. Mismatched sessions stay in the analysis, but they're counted and listed in the quality panel and the export.
- **[A4] Practitioner-side concealment.**
  - A single serializer, `toPractitionerSession()`, includes `condition` only when `conditionRevealedAt` is set.
  - Practitioner `GET /protocols/:id` omits `allocation_list`/`nonce` until completion.
  - The practitioner session list applies the same serializer and never exposes `conditionSequence`.
  - Client-role serializers never include `condition` or `conditionSequence` at all until completion.
  - Route tests cover all three practitioner `GET`s (session, protocol, session list) before and after `/start`, plus the client `GET`.
- Once locked, every protocol field is immutable (including the scale, device, arms and allocation). An edit creates `version + 1` with a new allocation at its own lock.

## Correctness [B5–B8]
- **[B5]** `daily_status.hrv_log_scale boolean not null`. The unique key becomes `(user_id, date, rule_version, hrv_log_scale)`.
- **[B6] Client-supplied dates only.**
  - `users.time_zone` (IANA) is set on first run from `Intl.DateTimeFormat().resolvedOptions().timeZone` and can be edited in Settings.
  - Every "today" route takes `date=YYYY-MM-DD` from the client (path or body) and validates it with zod. The server never derives a calendar date from its own clock.
  - Instants (`startedAt`, `takenAt`) stay ISO with an offset.
  - A test posts a 21:30 America/New_York entry (01:30 UTC the next day) and asserts it's stored and briefed under the local date.
- **[B7]** The week label always carries its night count (for example "Steady · 6 of 7 nights", or "· 7 of 7 nights" for a full week). The rules output `weekNights`, and the UI component won't render a label without it.
- **[B8] First-run / building-baseline Brief.** "Resonance is learning your baseline. N of 14 nights logged." It includes the HRV source question (device + app, which sets `hrvSource`/`hrvDevice`), a link to log a night, and the time zone confirmation. Design tokens only, no new art.

## Deployment and security [C9–C11]
- **[C9] Node 24:**
  - Dockerfile uses `node:24-slim` and runs `npm ci` with no prune, so `drizzle-kit` stays available for Railway's pre-deploy `npx drizzle-kit migrate`. It copies `migrations/` and `drizzle.config.ts` (checked against `.dockerignore`).
  - CI runs Node 24.
  - `package.json` gets `"engines": { "node": ">=24" }`.
- **[C10] Production hardening:**
  - `trust proxy 1` in production.
  - Session cookie: `secure` in production, `httpOnly`, `sameSite: 'lax'`.
  - `SESSION_SECRET` is required in production, with no fallback.
  - `server/middleware/rateLimit.ts` is an in-memory limiter (a Map of IP → timestamps, pruned) that allows 10 attempts per 15 minutes per IP on login and register and returns 429. It's unit-tested.
- **[C11] Demo safety:**
  - `seed:demo` exits unless `ALLOW_DEMO_SEED=true`.
  - The password comes from `DEMO_PASSWORD`; the script exits if it's missing.
  - Enrollment refuses a demo client on a real protocol and a real client on a demo protocol. A protocol counts as demo when its practitioner's user has `is_demo`. Both directions are tested.
  - `.env.example` adds `ALLOW_DEMO_SEED=false` and `DEMO_PASSWORD=`.

## Other defaults (listed in the PR)
- **Rules location:** `server/rules/`, not `/lib/rules`.
- **Escalation** = the highest applicable level.
- **Baseline restart:** B and W include only nights since the latest change in `hrvSource`/`hrvDevice`.
- **Long game:** 84 days back, shown from 98 logged nights. The pattern callout follows §3.6, with strength of association only from 21 nights.
- **Schema deltas beyond `schema-additions.ts`:**
  - `users.is_demo`, `users.time_zone`
  - `sleep_logs.quality` nullable
  - `morning_readings.hrv_source` and `hrv_device`
  - `study_sessions.pre_breaths_per_min`, `post_breaths_per_min`, `pre_reading_device`, `post_reading_device`
  - `study_protocols.analysis_scale`, `reading_device`, `allocation_list`, `allocation_nonce`, `allocation_sha256`
  - `study_enrollments.allocation_index` (replacing the in-enrollment generation of `condition_sequence`, which is now copied from the row)
  - `stillness_sessions` §9.2/§9.3 columns
  - `daily_status.hrv_log_scale`
  - the `session` table
  - `zStillnessType` += `align`; `zStudyCondition` → `A|B|C|D`
- **Arms:** configurable 2–4 arms with two templates (Intention vs touch; Deck study 3 factorial). Client guess = arm labels plus `not_sure`.
- **Roles:** practitioner = has a `practitioners` row (created from Settings). Client = the enrollment's `clientUserId`.
- **Extra routes the screens need:**
  - sleep and fasting (kept)
  - `POST/GET /api/reading`
  - `GET /api/exposure/:date`
  - `GET /api/trends?from&to`
  - `GET /api/study/protocols[/:id]`
  - `GET /api/study/protocols/:id/sessions`
  - `POST /api/study/protocols/:id/complete`
  - `GET /api/study/sessions/:id`
  - `GET /api/study/invite/:protocolId`
  - `POST /api/practitioner`
  - `PATCH /api/settings`
- **Export:** CSV + methods text (no PDF library). The methods section includes the protocol text, consent version, allocation method, `allocation_sha256`, `analysis_scale`, `reading_device` and `RULE_VERSION`. Demo protocols print "Illustrative data. No primary data reported."
- **Android `phone_events`:** the quiet math is pure and tested, but there's no capture route yet (it needs a native plugin). Deferred.
- **A "Log" tab landing page** (not in the canvas): a plain list of the log screens.

## Steps (each ends with commit + push)
**2. Identity and cleanup**
- `package.json`: `resonance`, `0.1.0`, `private`, no license, no `capacitor` block, and `engines` node ≥24.
- `capacitor.config.ts`: Resonance appId and name, no `server.url`.
- `index.html`, `manifest.json` and `sw.js` (`resonance-v1`) get the Resonance name.
- Delete the `kewt_*`, `bew_*`, `hero_*`, `integration_hero` and `splash_source` assets and `index.css.new_top`. Icons and splash screens are regenerated as plain placeholders by a zero-dependency `script/placeholder-icons.mjs` (zlib PNG).
- New `README.md`.

**3. Remove non-carried modules**
- **Server:** delete `strava*.ts` and every route off the keep-list, including Garmin, IG, science, meals/foods, posture, work, goals, body comp/health markers, activities, practice, integrations, import/upload, dashboard/weekly/correlations, framework, bei export, onboarding and `/api/demo/*`.
- `server/storage.ts` and `shared/schema.ts` are trimmed to users, sleep, breathwork and fasting.
- **Client:** delete the KEWT pages and components. `App.tsx` becomes a slim shell.
- Remove the dependencies that become unused (supabase-js, better-sqlite3, playwright, xlsx, fit-file-parser, fast-xml-parser, csv-parse, passport…) and trim the allowlist in `script/build.ts`.
- `npm run check` passes.

**4. Build and deploy hygiene**
- `package-lock.json` committed.
- `@capacitor/cli` → ^8.
- `cross-env` in the `dev`/`start` scripts.
- `.gitattributes`.
- `.env.example` (plus the C11 variables).
- **[C9]** Dockerfile on Node 24 plus a `.dockerignore` check.
- **[C10]** cookie, proxy, secret and rate-limit hardening in `server/index.ts` and the auth routes.

**5. Schema and migrations**
- Merge the additions plus every delta above into `shared/schema.ts`.
- `db:generate` / `db:migrate` scripts.
- `migrations/0000_*.sql` creates the full schema from scratch.

**6. Rule engine: `server/rules/`** (pure; flags and dates passed in, never read from env or clock)
- `version.ts`: `RULE_VERSION = "2026.09-r2"`.
- `stats.ts`.
- `baseline.ts`: windows, source reset, linear and ln ranges.
- `status.ts`: night state, week label plus `weekNights`, consecutive nights out, escalation, tag wording, n/30, long game. The output includes `ruleVersion` and `hrvLogScale`.
- `pattern.ts`.
- `quiet.ts`.
- `study.ts`: allocation-list builder (injectable RNG), canonical JSON + SHA-256 hashing, deltas on `protocol.analysisScale`, paired t CI, verdict text (never "proves"), quality panel including the device-mismatch count, per-practitioner hiding.
- `server/services/brief.ts` assembles the inputs and upserts `daily_status`.

**7. Tests (Vitest) + CI**
- **Rule tests:** every §7 fixture.
- **Allocation tests:**
  - each block of 6 contains all six orders
  - 2- and 4-arm balance
  - a list is generated once at lock
  - enrollment consumes rows in order and returns 409 when they're used up
  - the hash is stable and verifiable from the nonce + list
- **Other unit tests:** `analysis_scale` is honored while `HRV_LOG_SCALE` is ignored [A2]; device mismatch is flagged [A3]; the label's night count [B7]; the near-midnight date test [B6]; the rate limiter [C10].
- **Route tests** use an app factory with an in-memory storage fake and `node:http` (no supertest):
  - 409 on `/start` without a pre-reading
  - client `GET` without `condition` (deep key check)
  - **[A4]** the three practitioner `GET`s before and after `/start`
  - a guess without a post-reading is rejected
  - lock refused with an empty withholding procedure or no reading device
  - **[C11]** demo/real enrollment is refused both ways
  - every non-public `/api` route returns 401 (iterating the router stack)
  - `/api/health` shape and no DB error text on failure [C12]
- **Copy lint test:** banned words in `client/src`.
- **CI** is added here rather than in step 11, so the tests guard every later push: `.github/workflows/ci.yml` on Node 24 runs `npm ci`, `check`, `test` and `build` on push and PR. Step 11 then becomes a no-op check.

**8. Server routes**
- Every HANDOFF §5 route plus the extras above.
- `requireAuth` on everything except register, login, logout, `/api/me` and `/api/health`. `requirePractitioner` and client ownership checks on study routes.
- The A1–A4 and C11 behavior.
- `morning-readings` requires a source.
- `parse-screenshot` gets the `screen_time` type, with per-field confidence (< 0.7 → `lowConfidenceFields`) and `hourlyPickups` for iOS.
- Privacy text: screenshots go to OpenAI.

**9a. Priority screens for October 4 [D14]**, in this order, each ported from `design/screens/*.html` with the tokens (IBM Plex Sans/Mono, Newsreader, `#F3F4F1`, `#15191C`, `#1F5FA8`, `#B4500B`), mobile-first at 390 px:
1. **Main** (plus the B8 first-run state and the B7 night count)
2. **Recovery-Rule**
3. **Morning-Check** (manual, source required)
4. **Sleep**
5. **Exposure-Manual**
6. **Study** (shows the allocation hash, analysis scale, reading device and mismatch flags)

The minimal Login, Settings (time zone, HRV source, practitioner setup, delete account), Privacy and Terms pages are built alongside, because they're needed to use the app. These screens have no streaks, badges or notifications.

**10. Demo data.** `npm run seed:demo`, guarded by C11: `demo@resonance.local`, `is_demo`, with canvas-matching data for the priority screens, plus the "Illustrative data" tag.

**12. Draft PR.** Push, then `gh pr create --draft` against `main`. The body lists:
- the §8 defaults and the Sep 28 decisions
- the amendments A1–C12
- deferrals: camera PPG, Android `phone_events`, PDF export, the screens after October 4
- disagreements with the HANDOFF: the rules path, the `|W| ≥ 5` copy change, the allocation-hash nonce

**▶ Stopping point for October 4:** after 9a + 10 + the draft PR. If usage gets tight earlier, I stop at the last clean, pushed commit and report where things stand. The tests are never cut short to reach more screens.

**9b. After October 4:** Session, Consent, Quiet, Trends, Exposure-Screenshot (with the adapted `ScreenshotImport`), Reading, Stillness, Fasting. After those, the PR comes out of draft.

## Critical files
`shared/schema.ts`, `server/routes.ts`, `server/storage.ts`, `server/index.ts`, the new `server/rules/*`, `server/services/brief.ts`, `server/middleware/rateLimit.ts`, `client/src/App.tsx`, the new `client/src/screens/*`, `ScreenshotImport.tsx`, `package.json`, `Dockerfile`, `capacitor.config.ts`, `drizzle.config.ts`, `script/build.ts`, `script/seed-demo.ts`.

## Verification
- `npm run check`, `npm test` and `npm run build` pass locally before every push. CI is green on each push from step 7 on.
- Against a local Postgres: `npm run db:migrate` on an empty DB, then `ALLOW_DEMO_SEED=true DEMO_PASSWORD=… npm run seed:demo`, then `npm run dev`.
  - Check the six priority screens at 390 px against the HTML (Brief: "Steady · 7 of 7 nights", 48.6/55.1, Noted, 22/30, pattern 3 of 4).
  - A new account shows the first-run state.
- `curl /api/health` returns `{ok, ruleVersion}`. Other `/api` routes return 401 without a cookie. The 11th login attempt in 15 minutes returns 429.
- **Study walkthrough** in two browser sessions:
  - lock (the hash is shown)
  - enroll (takes row 0)
  - the practitioner `GET`s hide the condition
  - `/start` before the pre-reading returns 409
  - pre-reading → start (condition revealed) → the client view still hides it
  - post-reading → guess → results, with a device-mismatch flag if a different device is entered
- `docker build .` succeeds on `node:24-slim`, and `npx drizzle-kit migrate` runs inside the image.
- `grep -ri kewt` finds nothing outside `handoff/` and `docs/`.
