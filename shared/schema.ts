/**
 * Resonance schema. Started from KEWT's users/sleep/breathwork/fasting tables and
 * merged with handoff/schema-additions.ts plus the BUILD_PLAN deltas.
 *
 * Conventions (HANDOFF §0):
 *   - serial integer primary keys; user_id is integer → users.id
 *   - calendar dates as text "YYYY-MM-DD", always the user's local date as sent
 *     by the client (never derived from the server clock); instants as ISO text,
 *     except created/updated/audit stamps, which use timestamp()
 *   - categorical values as text, validated with the z* enums at the bottom
 *   - drizzle-zod insert schemas omit id + userId
 */
import {
  pgTable, text, integer, real, serial, boolean, timestamp, unique, varchar, json, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── USERS (auth) ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name"),
  isDemo:       boolean("is_demo").notNull().default(false),    // seed:demo accounts; drives "Illustrative data"
  timeZone:     text("time_zone"),                               // IANA, e.g. "America/New_York"
  defaultHrvSource: text("default_hrv_source"),                  // camera | device_manual (first-run question)
  defaultHrvDevice: text("default_hrv_device"),                  // device + app, prefilled on readings
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── SESSION STORE (connect-pg-simple) ───────────────────────────────────────
// Defined here so the migrations own it; matches connect-pg-simple's table.sql.
export const session = pgTable("session", {
  sid:    varchar("sid").primaryKey(),
  sess:   json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => [index("IDX_session_expire").on(t.expire)]);

// ─── SLEEP ────────────────────────────────────────────────────────────────────
// date is the WAKE date (Garmin convention): the Brief for date D uses the row
// dated D as "last night". One row per user per night.
export const sleepLogs = pgTable("sleep_logs", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:             text("date").notNull(),
  hours:            real("hours"),                                // null until time asleep is entered
  quality:          integer("quality"),                           // 1-10; kept from KEWT, not collected
  sleepScore:       integer("sleep_score"),                       // device 0-100; never a label input
  restingHr:        integer("resting_hr"),
  hrv:              real("hrv"),                                  // rMSSD, ms
  hrvSource:        text("hrv_source").notNull().default("device_manual"), // camera | device_manual
  hrvDevice:        text("hrv_device"),                           // "Polar H10 + Elite HRV"; a change resets the baseline
  morningReadingId: integer("morning_reading_id").references(() => morningReadings.id, { onDelete: "set null" }),
  notes:            text("notes"),
}, (t) => [unique("sleep_user_date").on(t.userId, t.date)]);
export const insertSleepSchema = createInsertSchema(sleepLogs).omit({ id: true, userId: true });
export type InsertSleep = z.infer<typeof insertSleepSchema>;
export type SleepLog = typeof sleepLogs.$inferSelect;

// ─── BREATHWORK (KEWT; read alongside stillness_sessions as type=breathwork) ─
export const breathworkLogs = pgTable("breathwork_logs", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:            text("date").notNull(),
  type:            text("type").notNull(),
  durationMin:     integer("duration_min").notNull(),
  quality:         integer("quality"),
  perceivedEffect: integer("perceived_effect"),
  notes:           text("notes"),
});
export const insertBreathworkSchema = createInsertSchema(breathworkLogs).omit({ id: true, userId: true });
export type InsertBreathwork = z.infer<typeof insertBreathworkSchema>;
export type BreathworkLog = typeof breathworkLogs.$inferSelect;

// ─── FASTING SESSIONS ─────────────────────────────────────────────────────────
export const fastingSessions = pgTable("fasting_sessions", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt:   text("started_at").notNull(),   // ISO instant
  endedAt:     text("ended_at"),                // null = still active
  goalHours:   real("goal_hours").default(16),
  notes:       text("notes"),
});
export const insertFastingSchema = createInsertSchema(fastingSessions).omit({ id: true, userId: true });
export type InsertFasting = z.infer<typeof insertFastingSchema>;
export type FastingSession = typeof fastingSessions.$inferSelect;

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
  hourlyPickups:       text("hourly_pickups"),                 // JSON: number[24] (iOS screenshot)
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
export type NightContextTag = typeof nightContextTags.$inferSelect;

// ─── MORNING READING ─────────────────────────────────────────────────────────
// Layer 0: typed-in readings from a named device + app (camera PPG deferred to
// Layer 1). Every reading records its source; a source change resets the baseline.
export const morningReadings = pgTable("morning_readings", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:          text("date").notNull(),                          // user's local date (client-supplied)
  takenAt:       text("taken_at").notNull(),                      // ISO
  durationSec:   integer("duration_sec").notNull().default(60),
  rmssdMs:       real("rmssd_ms").notNull(),
  heartRateBpm:  real("heart_rate_bpm").notNull(),
  signalQuality: real("signal_quality"),                          // 0–1
  posture:       text("posture").notNull().default("seated"),     // seated | face_up | face_down
  hrvSource:     text("hrv_source").notNull().default("device_manual"), // camera | device_manual
  hrvDevice:     text("hrv_device").notNull(),                    // device + app, required
});
export const insertMorningReadingSchema = createInsertSchema(morningReadings).omit({ id: true, userId: true });
export type InsertMorningReading = z.infer<typeof insertMorningReadingSchema>;
export type MorningReading = typeof morningReadings.$inferSelect;

// ─── STILLNESS (chosen) ──────────────────────────────────────────────────────
// Separate from breathwork_logs. The Brief sums both when computing
// "stillness you chose" (breathwork_logs rows count as type=breathwork).
export const stillnessSessions = pgTable("stillness_sessions", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:          text("date").notNull(),
  startedAt:     text("started_at").notNull(),                    // ISO
  minutes:       integer("minutes").notNull(),
  type:          text("type").notNull(),                          // breathwork | meditation | reiki | walk | reading | nothing | align
  reikiRole:     text("reiki_role"),                              // given | received (required when type = reiki)
  readingMedium: text("reading_medium"),                          // physical | ereader (type = reading; app reading is never stillness)
  phoneLocation: text("phone_location").notNull(),                // another_room | nearby_silenced | with_me_sound_on
  breathsPerMin: real("breaths_per_min"),                         // §9.2
  rmssdDuringMs: real("rmssd_during_ms"),                         // §9.2; LF is never computed during paced breathing
  breathMethod:  text("breath_method"),                           // joshin_kokyu_ho | resonance_paced | natural | other
  hrSource:      text("hr_source"),                               // chest_strap | camera | manual
  postureStyle:  text("posture_style"),                           // gassho | other (type = align); no posture scoring in v1
  notes:         text("notes"),
});
export const insertStillnessSchema = createInsertSchema(stillnessSessions).omit({ id: true, userId: true });
export type InsertStillness = z.infer<typeof insertStillnessSchema>;
export type StillnessSession = typeof stillnessSessions.$inferSelect;

// ─── PHONE EVENTS (Android only; capture deferred — needs a native plugin) ───
export const phoneEvents = pgTable("phone_events", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  at:         text("at").notNull(),                               // ISO
  kind:       text("kind").notNull(),                             // pickup | notification
  appId:      text("app_id"),
  sessionSec: integer("session_sec"),
});
export type PhoneEvent = typeof phoneEvents.$inferSelect;

// ─── DAILY STATUS (computed, auditable; one row per user/date/rule version/flag) ─
export const dailyStatus = pgTable("daily_status", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:                 text("date").notNull(),                   // the morning the Brief is for
  ruleVersion:          text("rule_version").notNull(),           // "2026.09-r2"
  hrvLogScale:          boolean("hrv_log_scale").notNull(),       // HRV_LOG_SCALE value used
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
  weekNights:           integer("week_nights").notNull(),         // nights in W (label shows "n of 7")
  baselineNights:       integer("baseline_nights").notNull(),     // nights in B
  weekLabel:            text("week_label").notNull(),             // building_baseline | steady | drifting_down | recovering
  nightState:           text("night_state").notNull(),            // in_range | one_out | both_out | no_data
  consecutiveNightsOut: integer("consecutive_nights_out").notNull(),
  escalationLevel:      integer("escalation_level").notNull(),    // 0–4
  nightsInRangeLast30:  integer("nights_in_range_last_30"),
  nightsLoggedLast30:   integer("nights_logged_last_30"),
  computedAt:           timestamp("computed_at").defaultNow().notNull(),
}, (t) => [unique("daily_status_user_date_rule_flag").on(t.userId, t.date, t.ruleVersion, t.hrvLogScale)]);
export type DailyStatus = typeof dailyStatus.$inferSelect;
export type InsertDailyStatus = typeof dailyStatus.$inferInsert;

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
export type Practitioner = typeof practitioners.$inferSelect;

// Everything below lockedAt is frozen at lock; a change creates version + 1 as
// a new row (supersedesId → the previous version). Existing enrollments stay.
export const studyProtocols = pgTable("study_protocols", {
  id:                   serial("id").primaryKey(),
  practitionerId:       integer("practitioner_id").notNull().references(() => practitioners.id),
  version:              integer("version").notNull().default(1),
  supersedesId:         integer("supersedes_id"),                 // previous version's id
  question:             text("question").notNull(),
  primaryOutcome:       text("primary_outcome").notNull(),
  primaryContrast:      text("primary_contrast").notNull(),       // "A-B"
  secondaryContrast:    text("secondary_contrast"),               // "B-C"
  conditions:           text("conditions").notNull(),             // JSON [{code,label,touch,intention,breathPacing}], 2–4 arms
  design:               text("design").notNull().default("crossover"),
  targetClients:        integer("target_clients").notNull(),
  minDaysBetween:       integer("min_days_between"),
  withholdingProcedure: text("withholding_procedure").notNull(),  // lock refused while empty
  commitmentText:       text("commitment_text").notNull(),
  closingReikiForAll:   boolean("closing_reiki_for_all").notNull().default(true),
  consentVersion:       text("consent_version").notNull().default("1"),
  analysisScale:        text("analysis_scale").notNull().default("ln"), // linear | ln — frozen at lock (A2)
  readingDevice:        text("reading_device"),                   // device + app — required to lock (A3)
  allocationList:       text("allocation_list"),                  // JSON [{index, block, sequence}] — set at lock (A1)
  allocationNonce:      text("allocation_nonce"),                 // 128-bit hex; revealed only after completion
  allocationSha256:     text("allocation_sha256"),                // SHA-256 of canonical {nonce, list}
  lockedAt:             timestamp("locked_at"),                   // null = draft; immutable once set
  completedAt:          timestamp("completed_at"),                // lifts concealment
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});
export type StudyProtocol = typeof studyProtocols.$inferSelect;

export const studyEnrollments = pgTable("study_enrollments", {
  id:                   serial("id").primaryKey(),
  protocolId:           integer("protocol_id").notNull().references(() => studyProtocols.id),
  // Nulled on withdrawal or account deletion: the row stays as an anonymised
  // tombstone so its allocation row stays consumed (no re-rolling by withdrawing).
  clientUserId:         integer("client_user_id").references(() => users.id, { onDelete: "set null" }),
  clientCode:           text("client_code").notNull(),            // "C-014"
  consentVersion:       text("consent_version").notNull(),
  consentedAt:          timestamp("consented_at").notNull(),
  withdrawnAt:          timestamp("withdrawn_at"),
  touchProfile:         text("touch_profile").notNull(),          // JSON {"back":"hands_on","front":"hovering"}
  touchProfileLockedAt: timestamp("touch_profile_locked_at").notNull(),
  allocationIndex:      integer("allocation_index").notNull(),    // row taken from the protocol's allocation list
  conditionSequence:    text("condition_sequence").notNull(),     // JSON ["B","A","C"], copied from that row — never sent to client role
  sequenceBlock:        integer("sequence_block").notNull(),
}, (t) => [
  unique("enrollment_protocol_client").on(t.protocolId, t.clientUserId),
  unique("enrollment_protocol_code").on(t.protocolId, t.clientCode),
  unique("enrollment_protocol_allocation").on(t.protocolId, t.allocationIndex),
]);
export type StudyEnrollment = typeof studyEnrollments.$inferSelect;

export const studySessions = pgTable("study_sessions", {
  id:                  serial("id").primaryKey(),
  enrollmentId:        integer("enrollment_id").notNull().references(() => studyEnrollments.id, { onDelete: "cascade" }),
  visitNumber:         integer("visit_number").notNull(),         // 1..arms
  condition:           text("condition").notNull(),               // A | B | C | D
  conditionRevealedAt: timestamp("condition_revealed_at"),        // only after pre-reading exists
  preTakenAt:          text("pre_taken_at"),
  preRmssdMs:          real("pre_rmssd_ms"),
  preHrBpm:            real("pre_hr_bpm"),
  prePosture:          text("pre_posture"),                       // must be face_up
  preBreathsPerMin:    real("pre_breaths_per_min"),               // §9.2
  preReadingDevice:    text("pre_reading_device"),                // A3: compared with protocol.readingDevice
  postTakenAt:         text("post_taken_at"),
  postRmssdMs:         real("post_rmssd_ms"),
  postHrBpm:           real("post_hr_bpm"),
  postPosture:         text("post_posture"),
  postBreathsPerMin:   real("post_breaths_per_min"),
  postReadingDevice:   text("post_reading_device"),
  relaxPre:            integer("relax_pre"),                      // 0–10, client
  relaxPost:           integer("relax_post"),
  clientGuess:         text("client_guess"),                      // an arm code | not_sure — client device only
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

// ─── Route-level validators (categorical text is validated with zod) ─────────
export const zDate           = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const zExposureSource = z.enum(["screenshot", "manual"]);
export const zPlatform       = z.enum(["ios", "android"]);
export const zQuietSource    = z.enum(["events", "hourly_estimate", "manual"]);
export const zReadingMedium  = z.enum(["physical", "ereader", "app"]);
export const zContextTag     = z.enum(["alcohol", "late_meal", "hard_workout", "illness", "travel"]);
export const zHrvSource      = z.enum(["camera", "device_manual"]);
export const zPosture        = z.enum(["seated", "face_up", "face_down"]);
export const zStillnessType  = z.enum(["breathwork", "meditation", "reiki", "walk", "reading", "nothing", "align"]);
export const zReikiRole      = z.enum(["given", "received"]);
export const zPhoneLocation  = z.enum(["another_room", "nearby_silenced", "with_me_sound_on"]);
export const zBreathMethod   = z.enum(["joshin_kokyu_ho", "resonance_paced", "natural", "other"]);
export const zHrSource       = z.enum(["chest_strap", "camera", "manual"]);
export const zPostureStyle   = z.enum(["gassho", "other"]);
export const zStudyCondition = z.enum(["A", "B", "C", "D"]);
export const zClientGuess    = z.enum(["reiki", "touch_only", "rest", "not_sure"]); // A/B/C template; configurable arms use arm codes
export const zAnalysisScale  = z.enum(["linear", "ln"]);

export type ContextTag = z.infer<typeof zContextTag>;
export type StudyCondition = z.infer<typeof zStudyCondition>;
export type AnalysisScale = z.infer<typeof zAnalysisScale>;

// A study arm (§9.1). Conditions are data-driven: 2 to 4 arms.
export const zStudyArm = z.object({
  code: zStudyCondition,
  label: z.string().min(1),
  touch: z.boolean(),
  intention: z.boolean(),
  breathPacing: z.boolean(),
});
export type StudyArm = z.infer<typeof zStudyArm>;
export const zStudyArms = z.array(zStudyArm).min(2).max(4)
  .refine(arms => arms.every((a, i) => a.code === "ABCD"[i]), "Arms must be coded A, B, C, D in order");
