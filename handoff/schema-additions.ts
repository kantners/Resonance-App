/**
 * Resonance — schema additions (reconciled with KEWT's shared/schema.ts, Sep 27 2026)
 *
 * Written to match KEWT conventions so it can be appended to shared/schema.ts
 * (or copied into a Resonance fork of it) without translation:
 *   - serial integer primary keys; user_id is integer → users.id (serial)
 *   - calendar dates as text "YYYY-MM-DD"; instants as ISO text, except
 *     created/updated/audit stamps, which use timestamp() like igDrafts
 *   - categorical values as text with the allowed values in a comment,
 *     validated with zod at the route (KEWT does not use pgEnum)
 *   - unique constraints in the array form: (t) => [unique(...)]
 *   - drizzle-zod insert schemas omit id + userId
 *
 * REUSED FROM KEWT, NOT REDEFINED HERE (see HANDOFF.md §0):
 *   sleep_logs (hours, sleepScore, hrv, restingHr, notes) — plus 3 new columns below
 *   fasting_sessions (startedAt, endedAt, goalHours, notes)
 *   users, express-session auth, requireAuth, /api/parse-screenshot pipeline
 *
 * Deliberately NOT reused: practice_logs. It stores clientName in plain text;
 * Session Study data must be keyed by client code only.
 */

import {
  pgTable, text, integer, real, serial, boolean, timestamp, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema"; // if appended to shared/schema.ts, drop this import

// ─── ADD TO sleep_logs (inside the existing pgTable definition) ──────────────
//   hrvSource:        text("hrv_source").default("device_manual"), // camera | device_manual
//   hrvDevice:        text("hrv_device"),                          // "Garmin Fenix 7", "Oura Gen 3"…
//   morningReadingId: integer("morning_reading_id"),               // → morning_readings.id when camera
// NOTE: sleep_logs.date is the WAKE date (Garmin convention). Resonance's
// "last night" for the Brief on date D is the sleep_logs row where date = D.

// ─── DIGITAL EXPOSURE (one row per user per day) ─────────────────────────────
export const digitalExposure = pgTable("digital_exposure", {
  id:                  serial("id").primaryKey(),
  userId:              integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:                text("date").notNull(),                 // YYYY-MM-DD, the day the phone was used
  source:              text("source").notNull(),               // screenshot | manual
  platform:            text("platform"),                       // ios | android | null (manual)
  totalMin:            integer("total_min").notNull(),
  pickups:             integer("pickups"),
  notifications:       integer("notifications"),
  socialMin:           integer("social_min"),
  entertainmentMin:    integer("entertainment_min"),
  productivityMin:     integer("productivity_min"),
  otherMin:            integer("other_min"),
  topApps:             text("top_apps"),                       // JSON: [{name, minutes}]
  pickupsAfter21:      integer("pickups_after_21"),
  longestQuietMin:     integer("longest_quiet_min"),
  quietStretches30:    integer("quiet_stretches_30"),
  quietMinutes30Total: integer("quiet_minutes_30_total"),
  lastPickupAt:        text("last_pickup_at"),                 // ISO
  quietSource:         text("quiet_source"),                   // events | hourly_estimate | manual
  lowConfidenceFields: text("low_confidence_fields"),          // JSON: ["pickups"]
  createdAt:           timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("digital_exposure_user_date").on(t.userId, t.date)]);
export const insertDigitalExposureSchema = createInsertSchema(digitalExposure).omit({ id: true, userId: true, createdAt: true });
export type InsertDigitalExposure = z.infer<typeof insertDigitalExposureSchema>;
export type DigitalExposure = typeof digitalExposure.$inferSelect;

// ─── READING ─────────────────────────────────────────────────────────────────
export const readingLogs = pgTable("reading_logs", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:        text("date").notNull(),
  startedAt:   text("started_at"),                              // ISO, optional
  medium:      text("medium").notNull(),                        // physical | ereader | app
  durationMin: integer("duration_min").notNull(),
  title:       text("title"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
export const insertReadingLogSchema = createInsertSchema(readingLogs).omit({ id: true, userId: true, createdAt: true });
export type InsertReadingLog = z.infer<typeof insertReadingLogSchema>;
export type ReadingLog = typeof readingLogs.$inferSelect;

// ─── NIGHT CONTEXT TAGS ("Anything that explains it?") ───────────────────────
export const nightContextTags = pgTable("night_context_tags", {
  id:     serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:   text("date").notNull(),                                 // same date as the sleep_logs row
  tag:    text("tag").notNull(),                                  // alcohol | late_meal | hard_workout | illness | travel
}, (t) => [unique("night_tag_user_date_tag").on(t.userId, t.date, t.tag)]);

// ─── MORNING READING (Resonance's own 60-second camera HRV) ──────────────────
export const morningReadings = pgTable("morning_readings", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  takenAt:       text("taken_at").notNull(),                      // ISO
  durationSec:   integer("duration_sec").notNull().default(60),
  rmssdMs:       real("rmssd_ms").notNull(),
  heartRateBpm:  real("heart_rate_bpm").notNull(),
  signalQuality: real("signal_quality"),                          // 0–1
  posture:       text("posture").notNull().default("seated"),     // seated | face_up | face_down
});
export const insertMorningReadingSchema = createInsertSchema(morningReadings).omit({ id: true, userId: true });
export type MorningReading = typeof morningReadings.$inferSelect;

// ─── STILLNESS (chosen) ──────────────────────────────────────────────────────
// Separate from KEWT's breathwork_logs. The Brief sums both when computing
// "stillness you chose" (breathwork_logs rows count as type=breathwork).
export const stillnessSessions = pgTable("stillness_sessions", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:          text("date").notNull(),
  startedAt:     text("started_at").notNull(),                    // ISO
  minutes:       integer("minutes").notNull(),
  type:          text("type").notNull(),                          // breathwork | meditation | reiki | walk | reading | nothing
  reikiRole:     text("reiki_role"),                              // given | received (required when type = reiki)
  readingMedium: text("reading_medium"),                          // physical | ereader (type = reading; app reading is never stillness)
  phoneLocation: text("phone_location").notNull(),                // another_room | nearby_silenced | with_me_sound_on
  notes:         text("notes"),
});
export const insertStillnessSchema = createInsertSchema(stillnessSessions).omit({ id: true, userId: true });
export type StillnessSession = typeof stillnessSessions.$inferSelect;

// ─── PHONE EVENTS (Android only; iOS relies on screenshot aggregates) ────────
export const phoneEvents = pgTable("phone_events", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  at:         text("at").notNull(),                               // ISO
  kind:       text("kind").notNull(),                             // pickup | notification
  appId:      text("app_id"),
  sessionSec: integer("session_sec"),
});

// ─── DAILY STATUS (computed, auditable; one row per user/date/rule version) ──
export const dailyStatus = pgTable("daily_status", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:                 text("date").notNull(),                   // the morning the Brief is for
  ruleVersion:          text("rule_version").notNull(),           // "2026.09-r2"
  hrvSourceUsed:        text("hrv_source_used").notNull(),
  hrvBaselineMean:      real("hrv_baseline_mean"),
  hrvBaselineSd:        real("hrv_baseline_sd"),
  rhrBaselineMean:      real("rhr_baseline_mean"),
  rhrBaselineSd:        real("rhr_baseline_sd"),
  hrvRangeLow:          real("hrv_range_low"),
  hrvRangeHigh:         real("hrv_range_high"),
  rhrRangeLow:          real("rhr_range_low"),
  rhrRangeHigh:         real("rhr_range_high"),
  hrv7Avg:              real("hrv_7_avg"),
  rhr7Avg:              real("rhr_7_avg"),
  weekLabel:            text("week_label").notNull(),             // building_baseline | steady | drifting_down | recovering
  nightState:           text("night_state").notNull(),            // in_range | one_out | both_out | no_data
  consecutiveNightsOut: integer("consecutive_nights_out").notNull(),
  escalationLevel:      integer("escalation_level").notNull(),    // 0–4
  nightsInRangeLast30:  integer("nights_in_range_last_30"),
  nightsLoggedLast30:   integer("nights_logged_last_30"),
  computedAt:           timestamp("computed_at").defaultNow().notNull(),
}, (t) => [unique("daily_status_user_date_rule").on(t.userId, t.date, t.ruleVersion)]);
export type DailyStatus = typeof dailyStatus.$inferSelect;

// ═════════════════════════════════════════════════════════════════════════════
// SESSION STUDY (practitioner mode). Client identity never leaves users/
// study_enrollments; practitioners see client_code only.
// ═════════════════════════════════════════════════════════════════════════════

export const practitioners = pgTable("practitioners", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  displayCode:  text("display_code").notNull(),                   // "Practitioner A"
  practiceName: text("practice_name"),
});

export const studyProtocols = pgTable("study_protocols", {
  id:                   serial("id").primaryKey(),
  practitionerId:       integer("practitioner_id").notNull().references(() => practitioners.id),
  version:              integer("version").notNull().default(1),
  question:             text("question").notNull(),
  primaryOutcome:       text("primary_outcome").notNull(),
  primaryContrast:      text("primary_contrast").notNull(),       // "A-B"
  secondaryContrast:    text("secondary_contrast"),               // "B-C"
  conditions:           text("conditions").notNull(),             // JSON [{code,label,touch,intention}]
  design:               text("design").notNull().default("crossover_3x3"),
  targetClients:        integer("target_clients").notNull(),
  minDaysBetween:       integer("min_days_between"),
  withholdingProcedure: text("withholding_procedure").notNull(),  // lock refused while empty
  commitmentText:       text("commitment_text").notNull(),
  closingReikiForAll:   boolean("closing_reiki_for_all").notNull().default(true),
  lockedAt:             timestamp("locked_at"),                   // null = draft; immutable once set
  completedAt:          timestamp("completed_at"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export const studyEnrollments = pgTable("study_enrollments", {
  id:                   serial("id").primaryKey(),
  protocolId:           integer("protocol_id").notNull().references(() => studyProtocols.id),
  clientUserId:         integer("client_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientCode:           text("client_code").notNull(),            // "C-014"
  consentVersion:       text("consent_version").notNull(),
  consentedAt:          timestamp("consented_at").notNull(),
  withdrawnAt:          timestamp("withdrawn_at"),
  touchProfile:         text("touch_profile").notNull(),          // JSON {"back":"hands_on","front":"hovering"}
  touchProfileLockedAt: timestamp("touch_profile_locked_at").notNull(),
  conditionSequence:    text("condition_sequence").notNull(),     // JSON ["B","A","C"] — never sent to client role
  sequenceBlock:        integer("sequence_block").notNull(),
}, (t) => [
  unique("enrollment_protocol_client").on(t.protocolId, t.clientUserId),
  unique("enrollment_protocol_code").on(t.protocolId, t.clientCode),
]);

export const studySessions = pgTable("study_sessions", {
  id:                  serial("id").primaryKey(),
  enrollmentId:        integer("enrollment_id").notNull().references(() => studyEnrollments.id, { onDelete: "cascade" }),
  visitNumber:         integer("visit_number").notNull(),         // 1..3
  condition:           text("condition").notNull(),               // A | B | C
  conditionRevealedAt: timestamp("condition_revealed_at"),        // only after pre-reading exists
  preTakenAt:          text("pre_taken_at"),
  preRmssdMs:          real("pre_rmssd_ms"),
  preHrBpm:            real("pre_hr_bpm"),
  prePosture:          text("pre_posture"),                       // must be face_up
  postTakenAt:         text("post_taken_at"),
  postRmssdMs:         real("post_rmssd_ms"),
  postHrBpm:           real("post_hr_bpm"),
  postPosture:         text("post_posture"),
  relaxPre:            integer("relax_pre"),                      // 0–10, client
  relaxPost:           integer("relax_post"),
  clientGuess:         text("client_guess"),                      // reiki | touch_only | rest | not_sure — client device only
  intentionHeldRating: integer("intention_held_rating"),          // 0–10, practitioner
  driftCount:          integer("drift_count").notNull().default(0),
  checklist:           text("checklist"),                         // JSON
  deviations:          text("deviations"),
  stonesNotes:         text("stones_notes"),
  clientReport:        text("client_report"),
  closingReikiGiven:   boolean("closing_reiki_given"),
  completedAt:         timestamp("completed_at"),
}, (t) => [unique("session_enrollment_visit").on(t.enrollmentId, t.visitNumber)]);
export type StudySession = typeof studySessions.$inferSelect;

// ─── Route-level validators (KEWT validates categorical text with zod) ───────
export const zExposureSource = z.enum(["screenshot", "manual"]);
export const zReadingMedium  = z.enum(["physical", "ereader", "app"]);
export const zContextTag     = z.enum(["alcohol", "late_meal", "hard_workout", "illness", "travel"]);
export const zStillnessType  = z.enum(["breathwork", "meditation", "reiki", "walk", "reading", "nothing"]);
export const zPhoneLocation  = z.enum(["another_room", "nearby_silenced", "with_me_sound_on"]);
export const zStudyCondition = z.enum(["A", "B", "C"]);
export const zClientGuess    = z.enum(["reiki", "touch_only", "rest", "not_sure"]);
