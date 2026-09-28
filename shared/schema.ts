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

// ─── SLEEP ────────────────────────────────────────────────────────────────────
export const sleepLogs = pgTable("sleep_logs", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date:               text("date").notNull(),
  hours:              real("hours").notNull(),
  quality:            integer("quality"),               // 1-10; not collected by Resonance
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
