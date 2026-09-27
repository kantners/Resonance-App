import {
  pgTable, text, integer, real, serial, boolean, timestamp, unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── USERS (auth) ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────
export const activities = pgTable("activities", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:           text("date").notNull(),           // YYYY-MM-DD
  modality:       text("modality").notNull(),       // cycling|running|walking|rucking|hiking|swimming|strength|yoga|other
  durationMin:    integer("duration_min").notNull(),
  distanceMiles:  real("distance_miles"),
  elevationFt:    integer("elevation_ft"),
  avgHr:          integer("avg_hr"),
  estCalsBurned:  integer("est_cals_burned"),
  intensity:      text("intensity"),                // easy|moderate|hard|mixed
  perceivedEffort:integer("perceived_effort"),      // 1-10
  notes:          text("notes"),
  source:         text("source").default("manual"),
  environment:    text("environment").default("outdoor"),
  tss:            real("tss"),            // Training Stress Score (premium Tier 3)
  zone2Min:       integer("zone2_min"),   // Zone 2 minutes (premium Tier 3)
});
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, userId: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// ─── MEALS ────────────────────────────────────────────────────────────────────
export const meals = pgTable("meals", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:      text("date").notNull(),
  mealType:  text("meal_type").notNull(),
  mealTime:  text("meal_time"),
  calories:  integer("calories").notNull(),
  proteinG:  real("protein_g").default(0),
  carbsG:    real("carbs_g").default(0),
  fatG:      real("fat_g").default(0),
  foods:     text("foods"),
  notes:     text("notes"),
});
export const insertMealSchema = createInsertSchema(meals).omit({ id: true, userId: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof meals.$inferSelect;

// ─── SLEEP ────────────────────────────────────────────────────────────────────
export const sleepLogs = pgTable("sleep_logs", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:               text("date").notNull(),
  hours:              real("hours").notNull(),
  quality:            integer("quality").notNull(),     // 1-10
  sleepScore:         integer("sleep_score"),           // Garmin 0-100
  restingHr:          integer("resting_hr"),
  avgOvernightHr:     integer("avg_overnight_hr"),
  fellAsleep:         text("fell_asleep"),
  wokeUp:             text("woke_up"),
  deepMin:            integer("deep_min"),
  lightMin:           integer("light_min"),
  remMin:             integer("rem_min"),
  awakeMin:           integer("awake_min"),
  restlessMoments:    integer("restless_moments"),
  hrv:                real("hrv"),
  spo2Avg:            real("spo2_avg"),
  spo2Low:            real("spo2_low"),
  respirationAvg:     real("respiration_avg"),
  respirationLow:     real("respiration_low"),
  stress:             integer("stress"),
  bodyBatteryChange:  integer("body_battery_change"),
  hrvStatus:          text("hrv_status"),
  moodMorning:        integer("mood_morning"),
  notes:              text("notes"),
});
export const insertSleepSchema = createInsertSchema(sleepLogs).omit({ id: true, userId: true });
export type InsertSleep = z.infer<typeof insertSleepSchema>;
export type SleepLog = typeof sleepLogs.$inferSelect;

// ─── BREATHWORK ───────────────────────────────────────────────────────────────
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

// ─── POSTURE ──────────────────────────────────────────────────────────────────
export const postureLogs = pgTable("posture_logs", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:         text("date").notNull(),
  alignment:    integer("alignment").notNull(),
  tightAreas:   text("tight_areas"),
  painPresent:  integer("pain_present").default(0),
  painLocation: text("pain_location"),
  painSeverity: integer("pain_severity"),
  notes:        text("notes"),
});
export const insertPostureSchema = createInsertSchema(postureLogs).omit({ id: true, userId: true });
export type InsertPosture = z.infer<typeof insertPostureSchema>;
export type PostureLog = typeof postureLogs.$inferSelect;

// ─── WORK LOGS ────────────────────────────────────────────────────────────────
export const workLogs = pgTable("work_logs", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:        text("date").notNull(),
  role:        text("role").notNull(),
  hours:       real("hours").notNull(),
  stress:      integer("stress").notNull(),
  energyLevel: integer("energy_level"),
  mood:        integer("mood"),
  notes:       text("notes"),
});
export const insertWorkSchema = createInsertSchema(workLogs).omit({ id: true, userId: true });
export type InsertWork = z.infer<typeof insertWorkSchema>;
export type WorkLog = typeof workLogs.$inferSelect;

// ─── PERSONAL PRACTICE ────────────────────────────────────────────────────────
export const practiceLogs = pgTable("practice_logs", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:           text("date").notNull(),
  type:           text("type").notNull(),
  durationMin:    integer("duration_min").notNull(),
  quality:        integer("quality"),
  clientName:     text("client_name"),
  clientOutcome:  integer("client_outcome"),
  revenueUsd:     real("revenue_usd"),
  notes:          text("notes"),
});
export const insertPracticeSchema = createInsertSchema(practiceLogs).omit({ id: true, userId: true });
export type InsertPractice = z.infer<typeof insertPracticeSchema>;
export type PracticeLog = typeof practiceLogs.$inferSelect;

// ─── DAILY HEALTH MARKERS ─────────────────────────────────────────────────────
export const healthMarkers = pgTable("health_markers", {
  id:                  serial("id").primaryKey(),
  userId:              integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:                text("date").notNull(),
  morningWeight:       real("morning_weight"),
  energyLevel:         integer("energy_level"),
  mood:                integer("mood"),
  hydrationOz:         integer("hydration_oz"),
  notes:               text("notes"),
  // Body composition (1byone / BIA scale)
  bodyFatPct:          real("body_fat_pct"),
  muscleMassLb:        real("muscle_mass_lb"),
  bodyWaterPct:        real("body_water_pct"),
  bmi:                 real("bmi"),
  skeletalMusclePct:   real("skeletal_muscle_pct"),
  subcutaneousFatPct:  real("subcutaneous_fat_pct"),
  fatFreeLb:           real("fat_free_lb"),
  boneMassLb:          real("bone_mass_lb"),
  visceralFat:         integer("visceral_fat"),
  bmrKcal:             integer("bmr_kcal"),
  proteinPct:          real("protein_pct"),
  bodyScore:           integer("body_score"),
  compSource:          text("comp_source"),
}, (t) => [unique("health_markers_user_date").on(t.userId, t.date)]);
export const insertHealthMarkerSchema = createInsertSchema(healthMarkers).omit({ id: true, userId: true });
export type InsertHealthMarker = z.infer<typeof insertHealthMarkerSchema>;
export type HealthMarker = typeof healthMarkers.$inferSelect;

// ─── GOALS ────────────────────────────────────────────────────────────────────
export const goals = pgTable("goals", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:         text("type").notNull(),
  label:        text("label").notNull(),
  startValue:   real("start_value").notNull(),
  targetValue:  real("target_value").notNull(),
  currentValue: real("current_value").notNull(),
  targetDate:   text("target_date").notNull(),
  unit:         text("unit"),
  status:       text("status").default("active"),
  notes:        text("notes"),
});
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, userId: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

// ─── STRAVA ───────────────────────────────────────────────────────────────────
export const stravaActivities = pgTable("strava_activities", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stravaId:           text("strava_id").notNull(),
  name:               text("name").notNull(),
  sportType:          text("sport_type").notNull(),
  startDate:          text("start_date").notNull(),
  startDateLocal:     text("start_date_local").notNull(),
  movingTimeSec:      integer("moving_time_sec"),
  distanceMeters:     real("distance_meters"),
  distanceMiles:      real("distance_miles"),
  totalElevationGain: real("total_elevation_gain"),
  avgHeartrate:       real("avg_heartrate"),
  maxHeartrate:       real("max_heartrate"),
  avgWatts:           real("avg_watts"),
  weightedAvgWatts:   real("weighted_avg_watts"),
  maxWatts:           real("max_watts"),
  kilojoules:         real("kilojoules"),
  avgCadence:         real("avg_cadence"),
  avgSpeedMs:         real("avg_speed_ms"),
  sufferScore:        integer("suffer_score"),
  kudosCount:         integer("kudos_count"),
  deviceName:         text("device_name"),
  syncedAt:           text("synced_at").notNull(),
}, (t) => [unique("strava_user_activity").on(t.userId, t.stravaId)]);
export type StravaActivity = typeof stravaActivities.$inferSelect;

export const stravaSyncMeta = pgTable("strava_sync_meta", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastSyncAt:  text("last_sync_at"),
  totalSynced: integer("total_synced").default(0),
});

// ─── ONBOARDING PROFILE ───────────────────────────────────────────────────────
export const userProfile = pgTable("user_profile", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  firstName:            text("first_name").notNull(),
  lastName:             text("last_name"),
  age:                  integer("age"),
  biologicalSex:        text("biological_sex"),
  heightIn:             real("height_in"),
  weightLbs:            real("weight_lbs"),
  favoriteActivities:   text("favorite_activities"),
  fitnessLevel:         text("fitness_level"),
  primaryGoal:          text("primary_goal"),
  baselineHrv:          real("baseline_hrv"),
  baselineRestingHr:    integer("baseline_resting_hr"),
  baselineSleepHours:   real("baseline_sleep_hours"),
  baselineSleepScore:   integer("baseline_sleep_score"),
  baselineBodyBattery:  integer("baseline_body_battery"),
  workStressLevel:      integer("work_stress_level"),
  postureAwareness:     integer("posture_awareness"),
  breathworkExperience: text("breathwork_experience"),
  sleepPriority:        integer("sleep_priority"),
  upcomingEvents:       text("upcoming_events"),
  philosophyAcknowledged: integer("philosophy_acknowledged").default(0),
  onboardingComplete:   integer("onboarding_complete").default(0),
  weekStart:            text("week_start").default("monday"),
  isPremium:            integer("is_premium").default(0),   // 0 = free, 1 = premium
  arcModality:          text("arc_modality").default("running"),  // primary sport for Kinetic Arc
  arcWindow:            integer("arc_window").default(56),         // days of history: 28, 56, 84
  createdAt:            text("created_at").notNull(),
});
export const insertUserProfileSchema = createInsertSchema(userProfile).omit({ id: true, userId: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfile.$inferSelect;

// ─── SCIENCE TICKER ───────────────────────────────────────────────────────────
export const scienceTicker = pgTable("science_ticker", {
  id:    serial("id").primaryKey(),
  date:  text("date").notNull(),
  items: text("items").notNull(), // JSON
});

// ─── INTEGRATION STATUS ───────────────────────────────────────────────────────
export const integrationStatus = pgTable("integration_status", {
  id:            text("id").notNull(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connected:     boolean("connected").default(false),
  lastSync:      text("last_sync"),
  lastSyncCount: integer("last_sync_count").default(0),
  totalSynced:   integer("total_synced").default(0),
  error:         text("error"),
}, (t) => [unique("integration_user").on(t.id, t.userId)]);

// ─── SESSION STORE (for connect-pg-simple) ────────────────────────────────────
// Table is created automatically by connect-pg-simple — no schema definition needed.

// ─── FASTING SESSIONS ─────────────────────────────────────────────────────────
export const fastingSessions = pgTable("fasting_sessions", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt:   text("started_at").notNull(),   // ISO timestamp string
  endedAt:     text("ended_at"),                // null = still active
  goalHours:   real("goal_hours").default(16),
  notes:       text("notes"),
});

export const insertFastingSchema = createInsertSchema(fastingSessions).omit({ id: true, userId: true });
export type InsertFasting = z.infer<typeof insertFastingSchema>;
export type FastingSession = typeof fastingSessions.$inferSelect;

// ─── IG DRAFTS (Post Generator planner queue) ─────────────────────────────────
// Saves a generated IG post snapshot so it can be reopened, scheduled, edited,
// or marked posted later. Direct publishing is intentionally not part of MVP.
export const igDrafts = pgTable("ig_drafts", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  headline:     text("headline"),
  body:         text("body"),
  hookLine:     text("hook_line"),
  imageUrl:     text("image_url"),
  caption:      text("caption").notNull(),
  status:       text("status").notNull().default("draft"), // draft | approved | scheduled | posted
  scheduledAt:  text("scheduled_at"),                       // ISO timestamp string
  postedAt:     text("posted_at"),                          // ISO timestamp string
  postedUrl:    text("posted_url"),                         // optional link user pastes after manually publishing
  notes:        text("notes"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
export const insertIgDraftSchema = createInsertSchema(igDrafts).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertIgDraft = z.infer<typeof insertIgDraftSchema>;
export type IgDraft = typeof igDrafts.$inferSelect;

// ─── IG TOPICS (Post Generator permanent topic pool) ──────────────────────────
// This table was referenced throughout server/routes.ts (Topic Manager panel,
// the least-recently-used rotation query in /api/generate-ig-post) but was
// never actually added here — which is why every request against it failed
// with `relation "ig_topics" does not exist`. Distinct from science_ticker
// (today's small rotating cache): this is the larger, permanent pool with
// real last-used/use-count tracking so topic selection can rotate properly
// instead of cycling through a handful of daily items.
export const igTopics = pgTable("ig_topics", {
  id:         serial("id").primaryKey(),
  domain:     text("domain").notNull(), // metabolic|cardiovascular|recovery|sleep|breathwork|energy_medicine|longevity|nutrition|biomechanics|biomarkers
  headline:   text("headline").notNull(),
  body:       text("body").default(""),
  citation:   text("citation"),
  lastUsedAt: timestamp("last_used_at"),
  useCount:   integer("use_count").notNull().default(0),
  active:     boolean("active").notNull().default(true),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
export const insertIgTopicSchema = createInsertSchema(igTopics).omit({ id: true, lastUsedAt: true, useCount: true, createdAt: true });
export type InsertIgTopic = z.infer<typeof insertIgTopicSchema>;
export type IgTopic = typeof igTopics.$inferSelect;

// ─── FOOD ENTRIES (low-friction signal log; complements the precision meals table) ─────
// Captures meal type, free-text description, portion estimate, and a set of
// tags. Distinct from the calorie/macro meals table so the user can log a
// "coffee + lunch + alcohol with dinner" day without committing to calories.
export const foodEntries = pgTable("food_entries", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:      text("date").notNull(),         // YYYY-MM-DD local
  time:      text("time"),                    // HH:MM local, optional
  mealType:  text("meal_type").notNull(),     // breakfast|lunch|dinner|snack|coffee|hydration|alcohol|post_workout|other
  portion:   text("portion"),                 // light|moderate|heavy|null
  description: text("description"),           // free text, optional
  tags:      text("tags"),                    // comma-separated: protein,carbs,caffeine,hydration,alcohol,high_sodium,sugar,processed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertFoodEntrySchema = createInsertSchema(foodEntries).omit({ id: true, userId: true, createdAt: true });
export type InsertFoodEntry = z.infer<typeof insertFoodEntrySchema>;
export type FoodEntry = typeof foodEntries.$inferSelect;
