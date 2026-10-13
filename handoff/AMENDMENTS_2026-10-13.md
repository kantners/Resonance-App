# Amendments, October 13, 2026 (Mark): evening exposure, confounders, double-counting, HRV portability

Branch: `amend/2026-10-13` (cut from `build/layer-0` at 4bbae27). `build/layer-0` stays demo-safe.
Status key: [done] [spec] [open = answer needed before build]

## Decisions (Mark, Oct 13)
- **D1. Keep both day and night tracking.** Daytime quiet (`longest_quiet_min`, `quiet_stretches_30`, pickups per waking hour) measures attention capture and the missing quiet. The evening window measures exposure before sleep. Neither replaces the other.
- **D2. The evening window is anchored to each person's own sleep onset. Its length is fixed.**
  - Primary window: the 2 hours before sleep onset. Secondary window: the 4 hours before.
  - The lengths are rule constants, versioned with `RULE_VERSION`. They are the same for every user and not user-settable, so no one can tune the window until a pattern appears.
  - The anchor makes the window fit night owls and shift workers automatically.
- **D3. A night's date stays the wake date.** Timestamps are now stored, so window math never depends on the date label.
- **D4. New confounder tags:** `late_caffeine` (caffeine after noon), `high_stress` (a high-stress day), `late_exercise` (exercise within 3 h of bed). The existing `hard_workout` stays; it describes intensity, while `late_exercise` describes timing.
- **D5. Cycle phase: optional and opt-in,** with consent wording. It is health data.
- **D6. Double-counting:** app-medium reading minutes are inside the phone's screen-time total. They are never added to it. They are shown as a subset and subtracted for a secondary measure.
- **D7. HRV stays rMSSD only.** A schema guard enforces this. The Apple path (Layer 1, needs a Mac) computes rMSSD from HealthKit beat-to-beat series and never uses Apple's SDNN figure.
- **D8. Palette [done]** (commit b54820a): Blue Ember tokens in `client/src/index.css`.

## 1. Schema (migration `0003_evening_confounders.sql`) [spec]

**`sleep_logs`**
- `sleep_onset_at text` (ISO, nullable) and `wake_at text` (ISO, nullable). The Sleep screen asks for both. Evening metrics are computed only for nights where `sleep_onset_at` exists; a missing onset means no evening value, never an imputed one.
- `hrv_metric text NOT NULL DEFAULT 'rmssd'` with `CHECK (hrv_metric = 'rmssd')`. Any future import of SDNN fails at the database, not just in code.

**`digital_exposure`**
- `hourly_minutes text`: JSON `number[24]`, minutes of use per clock hour (from the iOS Screen Time hourly chart; Android from `phone_events` once captured). This sits alongside the existing `hourly_pickups`.
- Evening values are **not** stored here. A window can cross midnight and span two exposure dates, so it is computed per night by the rule engine (§2) from the raw hourly arrays or events, and stored in `daily_status` with the rule version.

**`daily_status`** (computed, auditable, one row per night)
- `evening_min_2h`, `evening_min_4h`, `evening_pickups_2h`, `evening_pickups_4h` (integer, nullable)
- `evening_source text`: `events` | `hourly_estimate` | `manual`
- `evening_coverage real` (0 to 1): the fraction of the 4-hour window covered by exposure data. Below 0.75, the values are stored but not used in associations.
- `evening_anchor_at text`: the sleep onset used
- `evening_reading_app_min integer`: app-reading minutes inside the window (§4)

**`night_context_tags`**: extend `zContextTag` with `late_caffeine`, `high_stress`, `late_exercise`. This is a text column validated by zod, so no column change is needed. Convention: a tag on night D describes the day and evening that led into the sleep ending on wake date D.

**Cycle tracking (opt-in, §3)**
- `users.cycle_consent_at timestamp`, `users.cycle_consent_version text` (both null = off)
- New table `cycle_events(id, user_id → users ON DELETE CASCADE, date text, kind text)`, with `kind = 'period_start'`. Unique on (user, date, kind).

**`zHrvSource`**: add `health_import`. It is reserved and unused until Layer 1.

## 2. Rules (`RULE_VERSION = "2026.10-r4"`) [spec]
- **Evening window:** `[onset − 2h, onset)` (primary) and `[onset − 4h, onset)` (secondary).
  - From `phone_events`: exact sums.
  - From hourly arrays: prorate partial hours linearly (an onset at 23:20 takes 20/60 of the 23:00 hour). This is labelled "estimated" in the UI, the same as quiet metrics.
  - A window crossing midnight reads the previous date's array for the earlier hours.
- **Labels are unchanged.** HRV and resting HR remain the only label inputs. Evening exposure feeds the pattern callout and Trends, never the label.
- **Pattern callout [open Q2]:** a high-exposure evening is `evening_min_2h ≥ mean + 1 SD` of the user's last 28 qualifying nights (coverage ≥ 0.75). The daily total remains the fallback until 14 such nights exist, and the wording names which measure was used.
- **Confounders:** tags still never change averages or levels; they change wording only (HANDOFF §3.4). Trends gains a **sensitivity view** that recomputes the association with tagged nights excluded and shows both n values side by side.
- **Day metrics:** unchanged.

## 3. Cycle tracking, opt-in [spec, open Q1]
- Off by default. It is turned on in Settings behind a consent screen (versioned copy in `shared/consentCopy.ts`).
- **Input: period start dates only** (proposed). The app computes the cycle day. It never predicts ovulation or fertility and never estimates a phase from HRV.
- **Use:** an optional covariate in Trends and the sensitivity view only. It is never a label input and never appears on the Brief.
- **Never shared:** not with practitioners, not in study exports, and not in a future clinician summary unless the user includes it explicitly.
- **Turning it off deletes `cycle_events`** and clears the consent stamp.
- **Draft consent copy (for Mark's review):** "Hormonal cycles change heart rate variability. If you choose, you can log the day each period starts, and Resonance will account for your cycle when it looks for patterns. This is health information. It stays in your account, it is never shared with practitioners or included in study exports, and turning this off deletes it."

## 4. Double-counting [spec]
- Screen time is reported exactly as the phone reports it. App-reading minutes are shown as a subset of that total ("of which reading: 40m") and are never added to it.
- **Secondary measure:** `screen_min_ex_reading = totalMin − Σ app-medium reading minutes that date`. If the result is negative, flag a data inconsistency instead of clamping it to zero.
- **Evening window:** app reading whose `started_at` falls inside the window is subtracted in the same way and stored as `evening_reading_app_min`.
- Physical and e-reader reading never touch screen time. They already count as chosen stillness (unchanged).

## 5. Screens and parser [spec]
- **Sleep:** add "Fell asleep" and "Woke" time fields. They're optional, and the hint says evening patterns need them.
- **Context tags (the Brief's "Anything that explains it?"):** add three chips: "Caffeine after noon", "Stressful day", "Exercise within 3 h of bed".
- **Settings:** a "Cycle tracking" toggle leading to the consent screen.
- **Screenshot parser:** add `hourly_minutes` to the iOS Screen Time extraction, with per-field confidence like the rest. Android Digital Wellbeing's hourly view varies by version, so evaluate it on real screenshots before relying on it (this extends PR_NOTES decision 5).
- **Android native usage capture (`phone_events`, UsageStatsManager) moves up** to the first item after this amendment. It is the only exact source of evening timing, and the project is Android-first. It needs the usage-access permission and Google Play's declaration for that permission.

## 6. Tests (must pass before any UI)
- Window math: an onset at 23:20 prorates the 21:00 and 23:00 hours; a 00:30 onset reads the previous date's hours; no onset gives null values; coverage below 0.75 is excluded from associations.
- Event path sums exactly; the hourly path is labelled estimated.
- Tags leave averages and levels untouched (a regression test against the r3 behaviour); the sensitivity view reports both n values.
- Double-counting: the subset display, `screen_min_ex_reading`, the negative-result flag, and reading inside the evening window.
- `hrv_metric` CHECK rejects any value other than rmssd (route test plus migration test).
- Cycle: off by default; consent required; turning it off deletes the events; never present in practitioner views or exports (mutation check).
- Copy lint covers the new consent copy.

## 7. Open questions (Mark)
- Q1. Cycle input: period start dates only (proposed) or a daily phase pick?
- Q2. Switch the pattern callout to evening minutes once 14 qualifying nights exist (proposed), or keep daily totals?
- Q3. Builder: Claude in this chat via the device shell, or Claude Code from this spec?
- Q4. Merge the palette commit into `build/layer-0` before October 20?
- Q5. Fasting, phase B (deferred by Mark on Oct 13; phase A, the plain tracker, is built). (a) Record "last meal" when a fast ends and compute the last-meal-to-sleep-onset gap each night, as another anchored window like the evening screen window. (b) Add a late-meal confounder tag. (c) Mark long-fast days (about 20 h or more) as their own stratum so they don't read as unexplained HRV drops. Any change to the rules needs a new RULE_VERSION and a baseline restart for the affected fields. Fasting stays out of the Brief's recovery wording until this is specified.

## Q5 status (2026-10-13): fasting phase B built
- Migration `0003_sleep_onset_wake` adds `sleep_logs.sleep_onset` and `wake_time` (ISO instants). The spec's planned `0003_evening_confounders` is now `0004`.
- Screenshot reader fills Fell asleep / Woke; both editable in review and on the Sleep screen. "Kitchen closed" on the Fasting screen starts a 16 h fast.
- `server/rules/evening.ts`: gap = start of the fast spanning sleep onset to onset; `late_meal` = gap under 3 h; long fast = 20 h or more. Thresholds are rules of thumb.
- DISPLAY ONLY: not stored as tags, not inputs to computeBrief. RULE_VERSION deliberately NOT bumped (it keys stored daily_status rows, so a bump would orphan prior labels and restart the baseline). Revisit when evening confounders become a stratum.
