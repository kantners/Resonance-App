# Resonance: design-to-build handoff (Claude Code)

**Round:** September 2026 design pass
**Source of truth for screens:** the Resonance design canvas (14 screens across three rows: Read, Log, Session Study). Screen names below match the canvas artboards.
**Screens:** `../design/index.html` (gallery), `../design/screens/*.html` (static exports), `../design/source/*.dc.html` (editable canvas sources).
**Stack:** Postgres + Drizzle + Express.

> **Base code:** Resonance builds on KEWT's `shared/schema.ts` and `server/routes.ts` (`D:\__BlueEmberWellness\05_Digital\Applications\kewt-app`). **Read KEWT, never write to it.** Copy what Resonance needs into the Resonance project. See §0.
 `schema-additions.ts` (next to this file) holds new enums and tables. Existing tables get ALTERs, listed in §2.

Where this document and the canvas disagree, this document wins. It's the more recent one on rules.

---

## 0. Reconciliation with KEWT (read first)

KEWT was reviewed read-only on September 27, 2026. `schema-additions.ts` is written in KEWT's conventions.

**Standing decision (Mark, September 27, 2026): Resonance is, and always will be, its own app, built from a copy of KEWT's code. The two apps never merge and never share anything at runtime.** Specifically:
- **New repository.** Copy the KEWT source files; don't fork, and don't carry KEWT's git history or remotes.
- **Own Postgres database and own Railway service.** No shared `DATABASE_URL`, no shared tables, and no queries across the two apps.
- **Own user accounts.** A person who uses both apps has two separate logins, and their data never passes between them automatically. If a transfer is ever wanted, it's an export the user starts, followed by an import, never a sync.
- **Own identity:** Capacitor `appId` (for example `com.blueemberwellness.resonance`), app name, icons, splash screens, manifest, privacy policy and terms. Remove all KEWT branding and assets from the copy.
- **Own secrets:** a new `SESSION_SECRET` and new API keys. Nothing is copied over from KEWT's `.env`.
- **Fixes land in the copy.** The three KEWT security issues below are fixed in Resonance from the first commit. KEWT itself is not touched.

**Copy into Resonance, then adapt:**
- `users` (serial `id`), express-session + bcrypt auth, `requireAuth`
- `sleep_logs`: already has `hours`, `sleepScore`, `hrv`, `restingHr`, `notes`
- `fasting_sessions`: `startedAt`, `endedAt`, `goalHours`, `notes`; matches the Fasting screen exactly
- the `/api/parse-screenshot` → `/api/commit-screenshot` pipeline (OpenAI vision, gpt-4o-mini) and the `ScreenshotImport` component. Add a new screen type, **iOS Screen Time / Android Digital Wellbeing**, that returns the `digital_exposure` fields plus a per-field confidence. Low-confidence fields go into `lowConfidenceFields` so the screen can highlight them.
- `breathwork_logs`: read alongside `stillness_sessions` when summing chosen stillness

**Don't carry over:** the IG post generator, the science ticker, Strava/Garmin sync, meals and food, posture, work logs, goals and body composition. Resonance is deliberately narrow.

**Don't reuse `practice_logs` for the study.** It stores `clientName` in plain text. Study data lives in the new `study_*` tables, keyed by client code only.

**Conventions to follow:**
- Integer foreign keys to `users.id`, not UUIDs.
- Dates as text `YYYY-MM-DD`.
- Categorical values as text, validated with zod (the `z*` enums at the bottom of `schema-additions.ts`).
- `sleep_logs.date` is the **wake date** (Garmin convention), so the Brief for date D uses the sleep row dated D as "last night".

**Found in KEWT, worth fixing there separately (don't copy these patterns):**
1. Many data routes (for example `GET/POST /api/sleep`) don't use `requireAuth`. They rely on `req.session.userId!`. **Every Resonance route must use `requireAuth`**, and study routes also need a role check (practitioner or client).
2. `/api/garmin/credentials` has no authentication, and it holds a Garmin email and password in one in-memory variable shared by every user.
3. Screenshots are sent to OpenAI for parsing. Screen Time screenshots show app names and usage, so the Resonance privacy text has to say so. Consider on-device parsing later.

---

## 1. Decisions locked this round

| Area | Decision |
|---|---|
| Headline label | Based on the **7-night average** vs. normal range: `Steady` / `Drifting down` / `Recovering`. The old per-night `Low / Moderate / High` is retired. |
| Single nights | Reported as a state (`in_range`, `one_out`, `both_out`), never as a verdict. First night out shows as **"Noted"**. |
| Escalation | Four-step ladder (§3.4). Level 4 tells the user to talk to a clinician, plainly, without softening. |
| Consistency metric | "Nights in range, last 30: n / 30." **No streaks anywhere.** |
| Label inputs | HRV and resting HR only. Sleep score and screen time are never inputs. |
| Context tags | Alcohol, late meal, hard workout, illness, travel. Tagged nights **still count** in every average. Tags only change the wording of messages. |
| HRV comparability | The baseline restarts when the HRV source or device changes. Resonance's own 60-second camera reading is the recommended source. |
| Quiet | "Longest quiet stretch" = the longest gap between pickups while awake. Chosen stillness is logged separately. |
| Session Study | 3-condition crossover (A Reiki, B touch-only with intention withheld, C rest). Primary contrast A−B within each client. Protocol is locked before data. Closing Reiki for every client *after* the readings and the client's guess. |

---

## 2. Changes to existing KEWT tables

**`sleep_logs`: add 3 columns** (definitions are commented at the top of `schema-additions.ts`):
- `hrv_source` (`camera` | `device_manual`, default `device_manual`)
- `hrv_device`: free text. A change in this value (or in `hrv_source`) resets the baseline.
- `morning_reading_id` → `morning_readings.id`

**New tables** (instead of changing KEWT tables): `digital_exposure`, `reading_logs`, `night_context_tags`, `morning_readings`, `stillness_sessions`, `phone_events`, `daily_status`, `practitioners`, `study_protocols`, `study_enrollments`, `study_sessions`.

The quiet metrics (`longest_quiet_min`, `quiet_stretches_30`, `quiet_minutes_30_total`, `pickups_after_21`, `last_pickup_at`, `quiet_source`) live on `digital_exposure`.

`schema-additions.ts` typechecks against KEWT's pinned `drizzle-orm@0.39.3`, `drizzle-zod@0.7.0` and `zod@3.24.2`.

---

## 3. Rule engine (`RULE_VERSION = "2026.09-r2"`)

Keep this as pure functions in `/lib/rules`, with no database access. Every output written to `daily_status` records `ruleVersion`.

### 3.1 Inputs per night
`sleep_logs.hrv` (ms) and `sleep_logs.restingHr` (bpm) for each night with data (or `morning_readings.rmssdMs` when `hrv_source = camera`). Nights with no HRV are **skipped, never imputed**.

### 3.2 Baseline and normal range
- **Week window** `W` = the last 7 logged nights, ending last night.
- **Baseline window** `B` = the 14 logged nights before `W`.
- Show no label until `|B| = 14` and `|W| ≥ 5` (the UI shows "Building your baseline").
- `hrvRange = mean(B.hrv) ± 0.5·sd(B.hrv)`
- `rhrRange = mean(B.rhr) ± 1.0·sd(B.rhr)`
- Use the sample standard deviation (n − 1).

> **Open decision (§8.1): log scale.** The HRV literature computes ranges on `ln(rMSSD)` and converts back: `exp(mean_ln ± 0.5·sd_ln)`. It is more defensible statistically. The displayed numbers would shift slightly from the canvas mockups. Build it behind a flag `HRV_LOG_SCALE`, default **on** unless Mark says otherwise.

### 3.3 States
```
strainedHRV(x) = x < hrvRange.low
strainedRHR(x) = x > rhrRange.high
// HRV above range or RHR below range counts as in range; it never "boosts" anything.

nightState(n) = count(strainedHRV(n.hrv), strainedRHR(n.rhr)) → 0:'in_range', 1:'one_out', 2:'both_out'

weekStrained = strainedHRV(avg(W.hrv)) || strainedRHR(avg(W.rhr))

weekLabel =
  weekStrained                                    → 'drifting_down'
  !weekStrained && anyDriftingInPrior7Days(user)  → 'recovering'
  else                                            → 'steady'
```
`anyDriftingInPrior7Days` checks the stored `daily_status.weekLabel` for the 7 previous mornings.

### 3.4 Escalation ladder
| Level | Condition | Message behaviour |
|---|---|---|
| 0 | Last night in range | No message |
| 1 | 1 night out (`consecutiveNightsOut = 1`) | "Noted." At most one small suggestion. |
| 2 | 2 or more consecutive nights out | Direct nudge. Name the likely cause if the logs support it (§3.6), e.g. "Both followed 90+ minutes of screen time after 9 PM." |
| 3 | `weekLabel = drifting_down` | The label changes, and the pattern summary is shown |
| 4 | `drifting_down` for 14 or more consecutive mornings **and** `avg(W.rhr) > rhrRange.high` | Plain statement that the pattern is worth raising with a clinician. No diagnosis, no softening. |

**Tag wording:** if last night carries `hard_workout`, a level-1 message reads as expected ("Expected after a hard session"). Tags never change the level or the averages.

### 3.5 Consistency and the long game
- `nightsInRangeLast30` = nights with `nightState = 'in_range'` among the last 30 **logged** nights. Show it as `n / logged`.
- **Long game:** compare the current baseline mean (`B`) with the baseline mean computed as of 84 days earlier. Show both numbers ("44 → 48 ms"). Only describe a direction in words if the change exceeds 0.5 × current SD; otherwise say "holding steady".

### 3.6 Pattern callout ("Pattern noted")
- A **high-exposure day** has screen minutes ≥ mean + 1 SD of the user's last 28 days.
- Trigger the callout when yesterday was high-exposure **and** this morning's HRV is below range.
- Supporting line: "Seen after k of your last m high-exposure days", where m counts high-exposure days in the last 28 and k those followed by below-range HRV.
- Always end with "An association, not a diagnosis."
- Trends: show "strength of association" only once 21 or more logged nights exist.

### 3.7 Quiet metrics
**Android (`quiet_source = 'events'`):** from `phone_events` where `kind = 'pickup'`, between wake (end of last sleep) and bedtime (start of the next sleep):
- `longest_quiet_min` = largest gap between consecutive pickups, including wake → first pickup and last pickup → sleep.
- `quiet_stretches_30` and `quiet_minutes_30_total` = gaps of 30 minutes or more.
- Pickups per waking hour; pickups after 21:00; minutes from last pickup to sleep.

**iOS (`'hourly_estimate'`):** parse the hourly pickups chart from the Screen Time screenshot. Longest quiet ≈ the longest run of zero-pickup hours. Label it "estimated" in the UI.

---

## 4. Session Study

### 4.1 Protocol lifecycle
- The practitioner drafts the protocol: question, conditions, outcome, contrasts, target number of clients, **written withholding procedure**, commitment text.
- `POST /lock` sets `lockedAt`. After that the protocol is **immutable**: any change creates `version + 1` as a new protocol, and existing enrollments stay on their version.
- No enrollments are allowed until the protocol is locked.

### 4.2 Allocation
- A 3×3 crossover uses all 6 orderings of A, B and C: ABC, ACB, BAC, BCA, CAB, CBA. That balances order and carryover.
- Allocate in **shuffled blocks of 6**, one ordering per enrolled client. Use a cryptographic RNG. Store `condition_sequence` and `sequence_block` at enrollment.

### 4.3 Concealment (role-based, enforced server-side)
- The **client role never receives** `condition`, `condition_sequence`, or anything derived from them until `protocol` is marked complete.
- The **practitioner** gets the condition for a visit only from `POST /sessions/:id/start`. That endpoint returns 409 unless the pre-reading (`preRmssdMs`, `prePosture = 'face_up'`) is already stored. This enforces the order: before reading, then eye pillow on, then reveal.
- The **client guess** is posted from the *client's* device and is rejected if `postRmssdMs` is missing.
- Log every reveal (`conditionRevealedAt`).

### 4.4 Session order (the UI enforces it in this order)
1. Greeting (no touch)
2. Client face-up, 2-minute settle
3. Pre-reading
4. Reveal to the practitioner, then the withholding procedure is shown for B and C
5. Session on a 5-minute position chime
6. Post-reading, face-up
7. Client guess and relaxation rating on the client's phone
8. Closing Reiki (every condition)
9. Practitioner checklist, intention-held rating (0–10), drift count, deviations

### 4.5 Analysis (`GET /protocols/:id/results`)
- Per session: `delta = postRmssd − preRmssd` (on the ln scale if `HRV_LOG_SCALE`).
- **Primary:** for each client with both A and B, `d_i = delta_A − delta_B`. Report the mean of `d`, a 95% CI from the t distribution (df = n − 1), and the n.
- **Secondary:** the same for B − C.
- **Verdict text:** "Too early to tell" while n < target **or** the CI includes 0. Otherwise report the direction and size. Never use the word "proves".
- **Quality panel:**
  - Blinding: correct guesses / guesses among A and B sessions, shown against chance (0.5).
  - Mean `intentionHeldRating` and total drift count.
  - Sessions with deviations.
- **Per-practitioner results stay hidden** until each practitioner has 10 or more sessions in each compared condition.
- Withdrawn clients are excluded from analysis, and their data is deleted on request (§6).

### 4.6 Export (`GET /protocols/:id/export`)
A PDF or CSV bundle containing:
- the locked protocol text
- the consent version
- the allocation method
- every session row (client codes only)
- all deviations
- the analysis code version and the results.

---

## 5. Routes to add to `routes.ts`

```
GET    /api/brief/:date                      → week label, 7-night bars, last night, tags, n/30, long game, quiet summary, pattern
POST   /api/nights/:date/tags                { tags: ContextTag[] }  (replaces the set for that night)
POST   /api/morning-readings                 { takenAt, rmssdMs, heartRateBpm, signalQuality, posture }
POST   /api/stillness                        { startedAt, minutes, type, reikiRole?, readingMedium?, phoneLocation, notes? }
GET    /api/stillness?from&to
GET    /api/quiet/:date                      → pickups timeline (Android) or hourly estimate (iOS), stretches, pulls
POST   /api/exposure                         (existing, extended with the §2 fields)

# practitioner role
POST   /api/study/protocols
POST   /api/study/protocols/:id/lock
GET    /api/study/protocols/:id/results
GET    /api/study/protocols/:id/export
POST   /api/study/sessions/:id/start         → { condition, withholdingProcedure? }   (409 without pre-reading)
PATCH  /api/study/sessions/:id               practitioner fields only

# client role
POST   /api/study/enrollments                { protocolId, consentVersion, touchProfile }  → { clientCode }
DELETE /api/study/enrollments/:id            withdraw + delete study data
PATCH  /api/study/sessions/:id/client        { preReading? | postReading? | relaxPre/Post | clientGuess }
```

---

## 6. Privacy and security
- Study data is keyed by `clientCode`. The practitioner UI never shows client names alongside readings.
- A client's daily data (sleep, screen time, stillness) is **never** visible to the practitioner. Only the on-table study fields are shared.
- `DELETE` on an enrollment cascades to its sessions and to the client's copies of them. Aggregates already shown at a public talk can't be recalled, and the consent text says so.
- The touch profile is also a record of touch consent. Store it even outside studies (future `touch_profiles` table; not needed yet).
- Wording rule for marketing and export copy: results are always "observed in our sessions", never promises of benefit.

---

## 7. Tests: fixtures taken from the canvas
These must pass before any UI work:

| Fixture | Expected |
|---|---|
| Baseline HRV 48 ± 5 (SD), RHR 55 ± 2; week HRV [51,44,47,54,49,53,42], RHR [54,57,55,53,55,54,58] | `weekLabel = steady`, `hrv7Avg = 48.6`, `rhr7Avg = 55.1` (linear-scale path) |
| Same week, last night HRV 42, RHR 58, previous night in range | `nightState = both_out`, `consecutiveNightsOut = 1`, `escalationLevel = 1` |
| 13 nights of baseline | `weekLabel = building_baseline` |
| Tag `hard_workout` on a both-out night | Same level, "expected" wording |
| Study: pairs (B, A) = (5,7) (8,8) (3,6) (7,6) (6,9) (9,6) | mean d = +0.67, 95% CI ≈ −1.9 to +3.2, verdict "Too early to tell" |
| `POST /start` before pre-reading | 409 |
| Client role `GET` on a session | response contains no `condition` field |

---

## 8. Open decisions for Mark (build with the defaults, flag in the PR)
1. **Log-scale HRV ranges.** Default **on**.
2. **Rule timing for the long game.** Default 84 days back, shown after 98 logged nights.
3. **Study price** placeholder on the consent screen: `[YOUR STUDY PRICE]`.
4. **Withholding procedure text.** The practitioner writes it in the protocol draft. The app won't allow the protocol to be locked while it's empty.
5. **Ethics review.** If results will go beyond a practice talk (for example a journal), get IRB approval or exemption before the first enrollment. The app can't enforce this; the protocol screen shows a reminder.

---

## 9. IRRC deck alignment (v1 scope additions)

Source: `IRRC_2026_Autonomic_Balance_FINAL.pptx`, the version accepted by the Center for Reiki Research, presented October 4, 2026. The deck states "no primary data reported". Nothing in the app, or in any export, may suggest otherwise until real data exists.

**9.1 Configurable study conditions.** `study_protocols.conditions` already holds a list. Make conditions fully data-driven, with 2 to 4 arms, each defined by `{code, label, touch, intention, breathPacing}`. Ship two templates:
- **Deck study 3 (factorial):** breath only / Reiki only / breath + Reiki (+ optional rest).
- **Intention against touch:** A Reiki / B touch only / C rest (the current design).

Allocation, concealment and analysis (§4) must work for any number of arms from 2 to 4. For a design with more than 3 arms, use balanced Latin squares.

**9.2 Breathing rate.** Add to `stillness_sessions`:
- `breaths_per_min real`
- `rmssd_during_ms real`
- `breath_method text` (`joshin_kokyu_ho` | `resonance_paced` | `natural` | `other`)
- `hr_source text` (`chest_strap` | `camera` | `manual`)

Also add `breaths_per_min` to `study_sessions` for the pre and post readings. **Never compute or show LF during paced breathing** (deck slide 5).

**9.3 Align.** Add `align` to `zStillnessType`, with an optional `posture_style text` (`gassho` | `other`). No posture scoring in v1.

**9.4 Wording rule.** Anywhere the app describes the framework, use the deck's own terms: *false sympathetic triggering* (labeled as a hypothesis), *the four routes: Meter, Breathe, Align, Receive*, and *RMSSD as the primary endpoint*.

Everything beyond the deck is staged in `../docs/roadmap.md`. Don't build past Layer 0 until that file's gates are met.
