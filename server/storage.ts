import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, gte, lte, and, isNotNull } from "drizzle-orm";
import {
  users, activities, meals, sleepLogs, breathworkLogs, postureLogs,
  workLogs, practiceLogs, healthMarkers, goals,
  stravaActivities, stravaSyncMeta, userProfile, integrationStatus,
  fastingSessions, igDrafts, foodEntries,
  type User, type InsertUser,
  type Activity, type InsertActivity,
  type Meal, type InsertMeal,
  type SleepLog, type InsertSleep,
  type BreathworkLog, type InsertBreathwork,
  type PostureLog, type InsertPosture,
  type WorkLog, type InsertWork,
  type PracticeLog, type InsertPractice,
  type HealthMarker, type InsertHealthMarker,
  type Goal, type InsertGoal,
  type StravaActivity,
  type UserProfile,
  type FastingSession,
  type IgDraft, type InsertIgDraft,
  type FoodEntry, type InsertFoodEntry,
} from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ─── Type helpers ─────────────────────────────────────────────────────────────

export interface StravaActivityInsert {
  stravaId: string;
  name: string;
  sportType: string;
  startDate: string;
  startDateLocal: string;
  movingTimeSec?: number;
  distanceMeters?: number;
  distanceMiles?: number;
  totalElevationGain?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  avgWatts?: number;
  weightedAvgWatts?: number;
  maxWatts?: number;
  kilojoules?: number;
  avgCadence?: number;
  avgSpeedMs?: number;
  sufferScore?: number;
  kudosCount?: number;
  deviceName?: string;
  syncedAt: string;
}

export interface DashboardSummary {
  currentWeight: number | null;
  weightTrend: { date: string; weight: number }[];
  weeklyDeficit: { date: string; intake: number; burn: number; deficit: number }[];
  runningPaceTrend: { date: string; pace: number }[];
  recoveryScore: number;
  topInsights: string[];
  hasTodayData: boolean;
  goals: Goal[];
  streaks: { breathwork: number; practice: number; walk: number };
  todaySleep: {
    sleep_score: number | null; hours: number | null; hrv: number | null;
    body_battery_change: number | null; resting_hr: number | null;
    spo2_avg: number | null; deep_min: number | null; rem_min: number | null;
  } | null;
  todayActivity: { distance_miles: number | null; est_cals_burned: number | null; duration_min: number | null } | null;
  weeklyMiles: { thisWeek: number; lastWeek: number };
  sleepTrend: string | null;
  inflammationSignal: { detected: boolean; message: string } | null;
  readinessBreakdown: {
    hrv: number | null;
    sleepScore: number | null;
    restingHr: number | null;
    bodyBattery: number | null;
    composite: number;
    label: "Peak" | "High" | "Moderate" | "Low" | "Rest";
    color: string;
  };
  coachLine: string;
  activeFast: {
    id: number;
    startedAt: string;
    elapsedHours: number;
    fuelZone: string;
    fuelZoneColor: string;
    targetHours: number | null;
  } | null;
}

export interface WeeklyRow {
  date: string;
  dayLabel: string;
  weight: number | null;
  calsIntake: number;
  calsBurn: number;
  deficit: number;
  sleepHours: number | null;
  sleepQuality: number | null;
  restingHr: number | null;
  mood: number | null;
  activities: string;
  breathwork: boolean;
  practice: boolean;
  recoveryScore: number | null;
}

export interface WeeklyData {
  rows: WeeklyRow[];
  modalityBreakdown: { modality: string; minutes: number }[];
  weekStats: {
    avgWeight: number | null;
    totalCalsBurned: number;
    totalCalsIntake: number;
    netDeficit: number;
    avgSleepHours: number | null;
    avgResting: number | null;
    avgMood: number | null;
  };
}

export interface CorrelationResult {
  metricA: string;
  metricB: string;
  coefficient: number;
  significance: string;
  insight: string;
}

export interface IStorage {
  // Auth
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;
  // Activities
  getActivities(userId: number, days?: number): Promise<Activity[]>;
  createActivity(userId: number, data: InsertActivity): Promise<Activity>;
  updateActivity(userId: number, id: number, data: Partial<InsertActivity>): Promise<Activity | null>;
  deleteActivity(userId: number, id: number): Promise<boolean>;
  // Meals
  getMeals(userId: number, days?: number): Promise<Meal[]>;
  createMeal(userId: number, data: InsertMeal): Promise<Meal>;
  // Sleep
  getSleepLogs(userId: number, days?: number): Promise<SleepLog[]>;
  createSleepLog(userId: number, data: InsertSleep): Promise<SleepLog>;
  updateSleepLog(userId: number, id: number, data: Partial<InsertSleep>): Promise<SleepLog | null>;
  // Breathwork
  getBreathworkLogs(userId: number, days?: number): Promise<BreathworkLog[]>;
  createBreathworkLog(userId: number, data: InsertBreathwork): Promise<BreathworkLog>;
  // Posture
  getPostureLogs(userId: number, days?: number): Promise<PostureLog[]>;
  createPostureLog(userId: number, data: InsertPosture): Promise<PostureLog>;
  // Work
  getWorkLogs(userId: number, days?: number): Promise<WorkLog[]>;
  createWorkLog(userId: number, data: InsertWork): Promise<WorkLog>;
  // Practice
  getPracticeLogs(userId: number, days?: number): Promise<PracticeLog[]>;
  createPracticeLog(userId: number, data: InsertPractice): Promise<PracticeLog>;
  // Health Markers
  getHealthMarkers(userId: number, days?: number): Promise<HealthMarker[]>;
  getLatestHealthMarker(userId: number): Promise<HealthMarker | null>;
  upsertHealthMarker(userId: number, data: InsertHealthMarker): Promise<HealthMarker>;
  // Goals
  getGoals(userId: number): Promise<Goal[]>;
  updateGoal(userId: number, id: number, data: Partial<InsertGoal>): Promise<Goal>;
  createGoal(userId: number, data: InsertGoal): Promise<Goal>;
  deleteGoal(userId: number, id: number): Promise<boolean>;
  // Strava
  upsertStravaActivities(userId: number, acts: StravaActivityInsert[]): Promise<number>;
  getStravaActivities(userId: number, days?: number): Promise<StravaActivity[]>;
  getStravaSyncMeta(userId: number): Promise<{ lastSyncAt: string | null; totalSynced: number }>;
  updateStravaSyncMeta(userId: number, lastSyncAt: string, totalSynced: number): Promise<void>;
  // Integration status
  getIntegrationStatus(userId: number, id: string): Promise<{ connected: boolean; lastSync: string | null; totalSynced: number; lastSyncCount: number; error: string | null }>;
  setIntegrationConnected(userId: number, id: string, lastSync: string, lastSyncCount: number, totalSynced: number): Promise<void>;
  setIntegrationError(userId: number, id: string, error: string): Promise<void>;
  // Profile
  getProfile(userId: number): Promise<UserProfile | null>;
  saveProfile(userId: number, data: any): Promise<any>;
  // Aggregates
  getDashboardSummary(userId: number, clientDate?: string): Promise<DashboardSummary>;
  getWeeklyData(userId: number, clientDate?: string): Promise<WeeklyData>;
  getCorrelations(userId: number): Promise<CorrelationResult[]>;
  // Fasting
  getActiveFast(userId: number): Promise<FastingSession | null>;
  getFastingHistory(userId: number, limit?: number): Promise<FastingSession[]>;
  startFast(userId: number, goalHours: number): Promise<FastingSession>;
  endFast(userId: number, id: number, notes?: string): Promise<FastingSession | null>;
  deleteFast(userId: number, id: number): Promise<boolean>;
  updateFastTimes(userId: number, id: number, startedAt?: string, endedAt?: string): Promise<FastingSession | null>;
  // IG Drafts (Post Generator planner)
  listIgDrafts(userId: number): Promise<IgDraft[]>;
  createIgDraft(userId: number, data: InsertIgDraft): Promise<IgDraft>;
  updateIgDraft(userId: number, id: number, data: Partial<InsertIgDraft>): Promise<IgDraft | null>;
  deleteIgDraft(userId: number, id: number): Promise<boolean>;
  // Food entries (low-friction signal log)
  listFoodEntries(userId: number, days?: number): Promise<FoodEntry[]>;
  createFoodEntry(userId: number, data: InsertFoodEntry): Promise<FoodEntry>;
  deleteFoodEntry(userId: number, id: number): Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(days: number, today?: string): string {
  let y: number, m: number, d: number;
  if (today) {
    [y, m, d] = today.split("-").map(Number);
  } else {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
  }
  const anchor = new Date(y, m - 1, d, 12, 0, 0);
  anchor.setDate(anchor.getDate() - days);
  const ry = anchor.getFullYear();
  const rm = String(anchor.getMonth() + 1).padStart(2, "0");
  const rd = String(anchor.getDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

function calcRecoveryScore(
  sleep: number | null, sleepQ: number | null,
  restHr: number | null, mood: number | null,
  breathwork: boolean
): number {
  let score = 50;
  if (sleepQ) score += (sleepQ - 5) * 4;
  if (sleep) score += sleep >= 7 ? 8 : sleep >= 6 ? 0 : -8;
  if (restHr) score += restHr <= 56 ? 10 : restHr <= 62 ? 5 : restHr <= 70 ? 0 : -10;
  if (mood) score += (mood - 5) * 2;
  if (breathwork) score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Storage implementation ───────────────────────────────────────────────────

export const storage: IStorage = {

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async getUserByEmail(email) {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return rows[0] ?? null;
  },

  async getUserById(id) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0] ?? null;
  },

  async createUser(data) {
    const rows = await db.insert(users).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return rows[0];
  },

  // ── Activities ───────────────────────────────────────────────────────────────

  async getActivities(userId, days = 90) {
    if (days === 0) {
      return db.select().from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.date));
    }
    const since = getDateRange(days);
    return db.select().from(activities)
      .where(and(eq(activities.userId, userId), gte(activities.date, since)))
      .orderBy(desc(activities.date));
  },

  async createActivity(userId, data) {
    // Auto-calc calories if not provided
    if (!data.estCalsBurned && data.durationMin) {
      const mets: Record<string, number> = {
        cycling: 7.5, running: 9.8, walking: 3.5, rucking: 8, hiking: 6,
        swimming: 8, strength: 5, yoga: 2.5, yard_work: 4.5,
        breathwork: 1.5, meditation: 1.2, other: 5,
      };
      const met = mets[data.modality] || 5;
      const weightKg = 83;
      data.estCalsBurned = Math.round((met * weightKg * data.durationMin) / 60);
    }
    const rows = await db.insert(activities).values({ ...data, userId }).returning();
    return rows[0];
  },

  async updateActivity(userId, id, data) {
    const rows = await db.update(activities).set(data)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  async deleteActivity(userId, id) {
    const rows = await db.delete(activities)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)))
      .returning();
    return rows.length > 0;
  },

  // ── Meals ────────────────────────────────────────────────────────────────────

  async getMeals(userId, days = 30) {
    if (days === 0) {
      return db.select().from(meals)
        .where(eq(meals.userId, userId))
        .orderBy(desc(meals.date));
    }
    const since = getDateRange(days);
    return db.select().from(meals)
      .where(and(eq(meals.userId, userId), gte(meals.date, since)))
      .orderBy(desc(meals.date));
  },

  async createMeal(userId, data) {
    const rows = await db.insert(meals).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Sleep ────────────────────────────────────────────────────────────────────

  async getSleepLogs(userId, days = 30) {
    if (days === 0) {
      return db.select().from(sleepLogs)
        .where(eq(sleepLogs.userId, userId))
        .orderBy(desc(sleepLogs.date));
    }
    const since = getDateRange(days);
    return db.select().from(sleepLogs)
      .where(and(eq(sleepLogs.userId, userId), gte(sleepLogs.date, since)))
      .orderBy(desc(sleepLogs.date));
  },

  async createSleepLog(userId, data) {
    const rows = await db.insert(sleepLogs).values({ ...data, userId }).returning();
    return rows[0];
  },

  async updateSleepLog(userId, id, data) {
    const rows = await db.update(sleepLogs).set(data)
      .where(and(eq(sleepLogs.id, id), eq(sleepLogs.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  // ── Breathwork ───────────────────────────────────────────────────────────────

  async getBreathworkLogs(userId, days = 30) {
    if (days === 0) {
      return db.select().from(breathworkLogs)
        .where(eq(breathworkLogs.userId, userId))
        .orderBy(desc(breathworkLogs.date));
    }
    const since = getDateRange(days);
    return db.select().from(breathworkLogs)
      .where(and(eq(breathworkLogs.userId, userId), gte(breathworkLogs.date, since)))
      .orderBy(desc(breathworkLogs.date));
  },

  async createBreathworkLog(userId, data) {
    const rows = await db.insert(breathworkLogs).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Posture ──────────────────────────────────────────────────────────────────

  async getPostureLogs(userId, days = 30) {
    if (days === 0) {
      return db.select().from(postureLogs)
        .where(eq(postureLogs.userId, userId))
        .orderBy(desc(postureLogs.date));
    }
    const since = getDateRange(days);
    return db.select().from(postureLogs)
      .where(and(eq(postureLogs.userId, userId), gte(postureLogs.date, since)))
      .orderBy(desc(postureLogs.date));
  },

  async createPostureLog(userId, data) {
    const rows = await db.insert(postureLogs).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Work ─────────────────────────────────────────────────────────────────────

  async getWorkLogs(userId, days = 30) {
    if (days === 0) {
      return db.select().from(workLogs)
        .where(eq(workLogs.userId, userId))
        .orderBy(desc(workLogs.date));
    }
    const since = getDateRange(days);
    return db.select().from(workLogs)
      .where(and(eq(workLogs.userId, userId), gte(workLogs.date, since)))
      .orderBy(desc(workLogs.date));
  },

  async createWorkLog(userId, data) {
    const rows = await db.insert(workLogs).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Practice ─────────────────────────────────────────────────────────────────

  async getPracticeLogs(userId, days = 30) {
    if (days === 0) {
      return db.select().from(practiceLogs)
        .where(eq(practiceLogs.userId, userId))
        .orderBy(desc(practiceLogs.date));
    }
    const since = getDateRange(days);
    return db.select().from(practiceLogs)
      .where(and(eq(practiceLogs.userId, userId), gte(practiceLogs.date, since)))
      .orderBy(desc(practiceLogs.date));
  },

  async createPracticeLog(userId, data) {
    const rows = await db.insert(practiceLogs).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Health Markers ───────────────────────────────────────────────────────────

  async getHealthMarkers(userId, days = 90) {
    if (days === 0) {
      return db.select().from(healthMarkers)
        .where(eq(healthMarkers.userId, userId))
        .orderBy(desc(healthMarkers.date));
    }
    const since = getDateRange(days);
    return db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), gte(healthMarkers.date, since)))
      .orderBy(desc(healthMarkers.date));
  },

  async getLatestHealthMarker(userId) {
    const withWeight = await db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), isNotNull(healthMarkers.morningWeight)))
      .orderBy(desc(healthMarkers.date))
      .limit(1);
    if (withWeight[0]) return withWeight[0];
    const any = await db.select().from(healthMarkers)
      .where(eq(healthMarkers.userId, userId))
      .orderBy(desc(healthMarkers.date))
      .limit(1);
    return any[0] ?? null;
  },

  async upsertHealthMarker(userId, data) {
    const existing = await db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), eq(healthMarkers.date, data.date)));
    if (existing[0]) {
      const rows = await db.update(healthMarkers).set(data)
        .where(and(eq(healthMarkers.userId, userId), eq(healthMarkers.date, data.date)))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(healthMarkers).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Goals ────────────────────────────────────────────────────────────────────

  async getGoals(userId) {
    return db.select().from(goals).where(eq(goals.userId, userId));
  },

  async deleteGoal(userId: number, id: number) {
    const result = await db.delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  },

  async updateGoal(userId, id, data) {
    const rows = await db.update(goals).set(data)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();
    return rows[0];
  },

  async createGoal(userId, data) {
    const rows = await db.insert(goals).values({ ...data, userId }).returning();
    return rows[0];
  },

  // ── Strava ───────────────────────────────────────────────────────────────────

  async upsertStravaActivities(userId, acts) {
    let inserted = 0;
    for (const a of acts) {
      const existing = await db.select().from(stravaActivities)
        .where(and(eq(stravaActivities.userId, userId), eq(stravaActivities.stravaId, a.stravaId)));
      if (!existing[0]) {
        await db.insert(stravaActivities).values({ ...a, userId });
        inserted++;
      }
    }
    return inserted;
  },

  async getStravaActivities(userId, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const all = await db.select().from(stravaActivities)
      .where(eq(stravaActivities.userId, userId))
      .orderBy(desc(stravaActivities.startDate));
    return all.filter(a => new Date(a.startDate) >= since);
  },

  async getStravaSyncMeta(userId) {
    const rows = await db.select().from(stravaSyncMeta)
      .where(eq(stravaSyncMeta.userId, userId))
      .limit(1);
    return { lastSyncAt: rows[0]?.lastSyncAt ?? null, totalSynced: rows[0]?.totalSynced ?? 0 };
  },

  async updateStravaSyncMeta(userId, lastSyncAt, totalSynced) {
    const existing = await db.select().from(stravaSyncMeta)
      .where(eq(stravaSyncMeta.userId, userId))
      .limit(1);
    if (existing[0]) {
      await db.update(stravaSyncMeta).set({ lastSyncAt, totalSynced })
        .where(eq(stravaSyncMeta.userId, userId));
    } else {
      await db.insert(stravaSyncMeta).values({ userId, lastSyncAt, totalSynced });
    }
  },

  // ── Integration Status ────────────────────────────────────────────────────────

  async getIntegrationStatus(userId, id) {
    const rows = await db.select().from(integrationStatus)
      .where(and(eq(integrationStatus.id, id), eq(integrationStatus.userId, userId)));
    if (!rows[0]) return { connected: false, lastSync: null, totalSynced: 0, lastSyncCount: 0, error: null };
    const r = rows[0];
    return {
      connected:     r.connected ?? false,
      lastSync:      r.lastSync ?? null,
      totalSynced:   r.totalSynced ?? 0,
      lastSyncCount: r.lastSyncCount ?? 0,
      error:         r.error ?? null,
    };
  },

  async setIntegrationConnected(userId, id, lastSync, lastSyncCount, totalSynced) {
    const existing = await db.select().from(integrationStatus)
      .where(and(eq(integrationStatus.id, id), eq(integrationStatus.userId, userId)));
    if (existing[0]) {
      await db.update(integrationStatus)
        .set({ connected: true, lastSync, lastSyncCount, totalSynced, error: null })
        .where(and(eq(integrationStatus.id, id), eq(integrationStatus.userId, userId)));
    } else {
      await db.insert(integrationStatus)
        .values({ id, userId, connected: true, lastSync, lastSyncCount, totalSynced, error: null });
    }
  },

  async setIntegrationError(userId, id, error) {
    const existing = await db.select().from(integrationStatus)
      .where(and(eq(integrationStatus.id, id), eq(integrationStatus.userId, userId)));
    if (existing[0]) {
      await db.update(integrationStatus)
        .set({ connected: false, error })
        .where(and(eq(integrationStatus.id, id), eq(integrationStatus.userId, userId)));
    } else {
      await db.insert(integrationStatus)
        .values({ id, userId, connected: false, error });
    }
  },

  // ── Profile ───────────────────────────────────────────────────────────────────

  async getProfile(userId) {
    const rows = await db.select().from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  async saveProfile(userId, data) {
    const existing = await db.select().from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);
    const values = {
      userId,
      firstName:             data.firstName,
      lastName:              data.lastName ?? null,
      age:                   data.age ?? null,
      biologicalSex:         data.biologicalSex ?? null,
      heightIn:              data.heightIn ?? null,
      weightLbs:             data.weightLbs ?? null,
      favoriteActivities:    data.favoriteActivities ?? null,
      fitnessLevel:          data.fitnessLevel ?? null,
      primaryGoal:           data.primaryGoal ?? null,
      baselineHrv:           data.baselineHrv ?? null,
      baselineRestingHr:     data.baselineRestingHr ?? null,
      baselineSleepHours:    data.baselineSleepHours ?? null,
      baselineSleepScore:    data.baselineSleepScore ?? null,
      baselineBodyBattery:   data.baselineBodyBattery ?? null,
      workStressLevel:       data.workStressLevel ?? null,
      postureAwareness:      data.postureAwareness ?? null,
      breathworkExperience:  data.breathworkExperience ?? null,
      sleepPriority:         data.sleepPriority ?? null,
      upcomingEvents:        data.upcomingEvents ?? null,
      philosophyAcknowledged: data.philosophyAcknowledged ?? 0,
      onboardingComplete:    data.onboardingComplete ?? 0,
      weekStart:             data.weekStart ?? "monday",
      arcModality:           data.arcModality ?? "running",
      arcWindow:             data.arcWindow ?? 56,
      createdAt:             data.createdAt ?? new Date().toISOString().split("T")[0],
    };
    if (existing[0]) {
      const rows = await db.update(userProfile).set(values)
        .where(eq(userProfile.userId, userId))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(userProfile).values(values).returning();
    return rows[0];
  },

  // ── Fasting ───────────────────────────────────────────────────────────────────

  async getActiveFast(userId) {
    const row = await db.select().from(fastingSessions)
      .where(and(eq(fastingSessions.userId, userId), isNotNull(fastingSessions.startedAt)))
      .orderBy(desc(fastingSessions.id))
      .limit(1)
      .then(r => r[0] ?? null);
    if (!row || row.endedAt) return null;
    return row;
  },

  async getFastingHistory(userId, limit = 30) {
    return db.select().from(fastingSessions)
      .where(and(eq(fastingSessions.userId, userId)))
      .orderBy(desc(fastingSessions.id))
      .limit(limit);
  },

  async startFast(userId, goalHours) {
    // End any still-open fast first
    const active = await (storage as any).getActiveFast(userId);
    if (active) {
      await db.update(fastingSessions)
        .set({ endedAt: new Date().toISOString() })
        .where(eq(fastingSessions.id, active.id));
    }
    const rows = await db.insert(fastingSessions)
      .values({ userId, startedAt: new Date().toISOString(), goalHours })
      .returning();
    return rows[0];
  },

  async endFast(userId, id, notes) {
    const rows = await db.update(fastingSessions)
      .set({ endedAt: new Date().toISOString(), notes: notes ?? null })
      .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  async deleteFast(userId, id) {
    const result = await db.delete(fastingSessions)
      .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  },

  async updateFastTimes(userId: number, id: number, startedAt?: string, endedAt?: string) {
    const update: Record<string, any> = {};
    if (startedAt !== undefined) update.startedAt = startedAt;
    if (endedAt   !== undefined) update.endedAt   = endedAt;
    const rows = await db.update(fastingSessions)
      .set(update)
      .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  // ── IG Drafts ────────────────────────────────────────────────────────────────

  async listIgDrafts(userId: number) {
    return db.select().from(igDrafts)
      .where(eq(igDrafts.userId, userId))
      .orderBy(desc(igDrafts.id));
  },

  async createIgDraft(userId: number, data: InsertIgDraft) {
    const rows = await db.insert(igDrafts)
      .values({ ...data, userId })
      .returning();
    return rows[0];
  },

  async updateIgDraft(userId: number, id: number, data: Partial<InsertIgDraft>) {
    const rows = await db.update(igDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(igDrafts.id, id), eq(igDrafts.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  async deleteIgDraft(userId: number, id: number) {
    const result = await db.delete(igDrafts)
      .where(and(eq(igDrafts.id, id), eq(igDrafts.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  },

  // ── Food entries ─────────────────────────────────────────────────────────────

  async listFoodEntries(userId: number, days = 14) {
    const cutoff = getDateRange(days);
    // Degrade to empty if the food_entries table is missing in production
    // (npm run db:push pending). Avoids breaking Daily Log Food accordion
    // and the Nutrition page while the migration ships.
    try {
      return await db.select().from(foodEntries)
        .where(and(eq(foodEntries.userId, userId), gte(foodEntries.date, cutoff)))
        .orderBy(desc(foodEntries.id));
    } catch (e: any) {
      console.warn(`[foods] list unavailable, degrading to empty: ${e?.message}`);
      return [];
    }
  },

  async createFoodEntry(userId: number, data: InsertFoodEntry) {
    const rows = await db.insert(foodEntries)
      .values({ ...data, userId })
      .returning();
    return rows[0];
  },

  async deleteFoodEntry(userId: number, id: number) {
    const result = await db.delete(foodEntries)
      .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  },

  // ── Dashboard Summary ────────────────────────────────────────────────────────

  async getDashboardSummary(userId, clientDate) {
    const today = clientDate || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    })();

    // Weight trend (last 30 days)
    const markers = await db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), gte(healthMarkers.date, getDateRange(30, today))))
      .orderBy(healthMarkers.date);
    const weightTrend = markers.filter(m => m.morningWeight).map(m => ({ date: m.date, weight: m.morningWeight! }));
    const currentWeight = weightTrend.length > 0 ? weightTrend[weightTrend.length - 1].weight : null;

    // Weekly deficit (last 7 days)
    // BMR pulled from most recent body comp scale reading.
    // NEAT multiplier is tiered by day activity level:
    //   1.15 (sedentary) — no logged workouts
    //   1.35 (active)    — at least one logged workout
    // TODO (Phase 2): replace baseBurn with real Garmin TDEE once API integration is live.
    const recentBmrRow = await db.select({ bmr: healthMarkers.bmrKcal })
      .from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), isNotNull(healthMarkers.bmrKcal)))
      .orderBy(desc(healthMarkers.date))
      .limit(1);
    const bmr = recentBmrRow.length > 0 && recentBmrRow[0].bmr
      ? recentBmrRow[0].bmr
      : 1440; // fallback if no scale data yet

    const last7 = [];
    const [ty0, tm0, td0] = today.split("-").map(Number);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ty0, tm0 - 1, td0, 12, 0, 0);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const dayMeals = await db.select().from(meals)
        .where(and(eq(meals.userId, userId), eq(meals.date, dateStr)));
      const dayActs = await db.select().from(activities)
        .where(and(eq(activities.userId, userId), eq(activities.date, dateStr)));
      const intake = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      const activityBurn = dayActs.reduce((s, a) => s + (a.estCalsBurned || 0), 0);
      const hasAnyData = intake > 0 || activityBurn > 0;
      // Tiered NEAT: active days (logged workout) get 1.35, sedentary days get 1.15
      const neatMultiplier = dayActs.length > 0 ? 1.35 : 1.15;
      const baseBurn = Math.round(bmr * neatMultiplier);
      const burn = hasAnyData ? activityBurn + baseBurn : 0;
      last7.push({ date: dateStr, intake, burn, deficit: hasAnyData ? burn - intake : 0 });
    }

    // Kinetic Arc — sport-aware pace/speed/duration trend
    const arcProfileRows = await db.select().from(userProfile)
      .where(eq(userProfile.userId, userId)).limit(1);
    const arcModality = arcProfileRows[0]?.arcModality ?? "running";
    const arcWindow   = arcProfileRows[0]?.arcWindow   ?? 56;

    // Sports that use pace (min/mile): running, walking, hiking, rucking
    // Sports that use speed (mph): cycling
    // Sports that use pace/100m: swimming
    // Sports that use duration (min): strength, yoga, breathwork, meditation, other
    const PACE_SPORTS    = ["running", "walking", "hiking", "rucking"];
    const SPEED_SPORTS   = ["cycling"];
    const SWIM_SPORTS    = ["swimming"];
    const DURATION_SPORTS = ["strength", "yoga", "breathwork", "meditation", "other"];

    const arcActs = await db.select().from(activities)
      .where(and(
        eq(activities.userId, userId),
        eq(activities.modality, arcModality),
        gte(activities.date, getDateRange(arcWindow, today))
      ))
      .orderBy(activities.date);

    // Determine metric type and compute value per activity
    let arcMetric: "pace" | "speed" | "swim_pace" | "duration" = "pace";
    if (SPEED_SPORTS.includes(arcModality))    arcMetric = "speed";
    else if (SWIM_SPORTS.includes(arcModality)) arcMetric = "swim_pace";
    else if (DURATION_SPORTS.includes(arcModality)) arcMetric = "duration";

    const runningPaceTrend = arcActs
      .filter(a => {
        if (arcMetric === "duration") return !!a.durationMin;
        return !!(a.durationMin && a.distanceMiles && a.distanceMiles > 0);
      })
      .map(a => {
        let value: number;
        if (arcMetric === "pace")       value = a.durationMin! / a.distanceMiles!;
        else if (arcMetric === "speed") value = Math.round((a.distanceMiles! / (a.durationMin! / 60)) * 10) / 10;
        else if (arcMetric === "swim_pace") value = a.durationMin! / (a.distanceMiles! * 17.6); // min per 100m
        else                            value = a.durationMin!;
        return { date: a.date, pace: value };
      });

    // PR: best value for the arc modality across all time
    const allArcActs = await db.select().from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.modality, arcModality)))
      .orderBy(activities.date);
    let arcPR: number | null = null;
    const prCandidates = allArcActs
      .filter(a => arcMetric === "duration" ? !!a.durationMin : !!(a.durationMin && a.distanceMiles && a.distanceMiles > 0))
      .map(a => {
        if (arcMetric === "pace")       return a.durationMin! / a.distanceMiles!;
        if (arcMetric === "speed")      return Math.round((a.distanceMiles! / (a.durationMin! / 60)) * 10) / 10;
        if (arcMetric === "swim_pace")  return a.durationMin! / (a.distanceMiles! * 17.6);
        return a.durationMin!;
      });
    if (prCandidates.length > 0) {
      // Best pace = lowest value; best speed/duration = highest value
      arcPR = (arcMetric === "speed" || arcMetric === "duration")
        ? Math.max(...prCandidates)
        : Math.min(...prCandidates);
    }

    // Today sleep + fallback to most recent
    const todaySleepRows = await db.select().from(sleepLogs)
      .where(and(eq(sleepLogs.userId, userId), eq(sleepLogs.date, today)));
    const todaySleep_ = todaySleepRows[0];
    let recentSleep_: SleepLog | undefined = todaySleep_;
    if (!recentSleep_) {
      const recent = await db.select().from(sleepLogs)
        .where(eq(sleepLogs.userId, userId))
        .orderBy(desc(sleepLogs.date))
        .limit(1);
      recentSleep_ = recent[0];
    }

    const todayBreathRows = await db.select().from(breathworkLogs)
      .where(and(eq(breathworkLogs.userId, userId), eq(breathworkLogs.date, today)));
    const todayBreath = todayBreathRows[0];

    const todayMarkerRows = await db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), eq(healthMarkers.date, today)));
    const todayMarker = todayMarkerRows[0];

    const recoveryScore = calcRecoveryScore(
      recentSleep_?.hours ?? null,
      recentSleep_?.quality ?? null,
      recentSleep_?.restingHr ?? null,
      todayMarker?.mood ?? null,
      !!todayBreath
    );

    // Breathwork streak
    const allBreath = await db.select().from(breathworkLogs)
      .where(eq(breathworkLogs.userId, userId))
      .orderBy(desc(breathworkLogs.date));
    const breathDates = new Set(allBreath.map(b => b.date));
    let breathworkStreak = 0;
    { const [ty2, tm2, td2] = today.split("-").map(Number);
      for (let i = 0; i < 365; i++) {
        const d = new Date(ty2, tm2 - 1, td2 - i, 12, 0, 0);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        if (breathDates.has(ds)) breathworkStreak++; else break;
      }
    }

    // Practice streak
    const allPractice = await db.select().from(practiceLogs)
      .where(eq(practiceLogs.userId, userId))
      .orderBy(desc(practiceLogs.date));
    const practiceDates = new Set(allPractice.map(p => p.date));
    let practiceStreak = 0;
    { const [ty3, tm3, td3] = today.split("-").map(Number);
      for (let i = 0; i < 365; i++) {
        const d = new Date(ty3, tm3 - 1, td3 - i, 12, 0, 0);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        if (practiceDates.has(ds)) practiceStreak++; else break;
      }
    }

    // Insights
    const insights: string[] = [];
    if (recoveryScore >= 75) insights.push("Recovery score strong — green light for hard training today.");
    else if (recoveryScore < 45) insights.push("Recovery deficit detected — consider easy or rest day.");
    if (breathworkStreak >= 3) insights.push(`Breathwork streak: ${breathworkStreak} days — keep it going.`);
    const weightGoalForInsight = (await db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.type, "weight"))).limit(1))[0];
    if (currentWeight && weightGoalForInsight) insights.push(`Current weight: ${currentWeight} lbs — ${(currentWeight - weightGoalForInsight.targetValue).toFixed(1)} lbs to goal.`);
    if (insights.length === 0) insights.push("Log today's data to unlock insights.");

    const allGoals = await db.select().from(goals).where(eq(goals.userId, userId));

    // Keep weight goal currentValue in sync with the most recent logged weight
    if (currentWeight !== null) {
      const weightGoal = allGoals.find(g => g.type === "weight");
      if (weightGoal && weightGoal.currentValue !== currentWeight) {
        await db.update(goals).set({ currentValue: currentWeight })
          .where(and(eq(goals.id, weightGoal.id), eq(goals.userId, userId)));
        weightGoal.currentValue = currentWeight;
      }
    }

    const hasTodayData = !!(todaySleep_ || todayMarker);

    // Walk streak
    const allActs = await db.select().from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.date));
    const walkDates = new Set(allActs.map(a => a.date));
    let walkStreak = 0;
    { const [ty4, tm4, td4] = today.split("-").map(Number);
      for (let i = 0; i < 365; i++) {
        const d = new Date(ty4, tm4 - 1, td4 - i, 12, 0, 0);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        if (walkDates.has(ds)) walkStreak++; else break;
      }
    }

    // Today's activity totals — strictly today only, no fallback to prior days
    const actSource = allActs.filter(a => a.date === today);
    const todayActivity = actSource.length > 0 ? {
      distance_miles: Math.round(actSource.reduce((s, a) => s + (a.distanceMiles || 0), 0) * 10) / 10,
      est_cals_burned: actSource.reduce((s, a) => s + (a.estCalsBurned || 0), 0),
      duration_min: actSource.reduce((s, a) => s + (a.durationMin || 0), 0),
    } : null;
    // Most-recent activity day, used by the dashboard's Recent Move card so
    // the most recent move keeps showing until a new one is logged. allActs
    // is already sorted desc by date, so the first element is the newest day.
    const recentDate = allActs.length > 0 ? allActs[0].date : null;
    const recentActivities = recentDate ? allActs.filter(a => a.date === recentDate) : [];

    // Weekly mileage
    const profileRows = await db.select().from(userProfile)
      .where(eq(userProfile.userId, userId)).limit(1);
    const weekStartPref: "monday" | "sunday" = (profileRows[0]?.weekStart ?? "monday") as "monday" | "sunday";

    const getWeekStart = (offset: number) => {
      const [ty, tm, td] = today.split("-").map(Number);
      const anchor = new Date(ty, tm - 1, td, 12, 0, 0);
      const day = anchor.getDay();
      const startDay = weekStartPref === "sunday" ? 0 : 1;
      const diff = ((day - startDay + 7) % 7) + (offset * 7);
      anchor.setDate(anchor.getDate() - diff);
      return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`;
    };
    const thisWeekStart = getWeekStart(0);
    const lastWeekStart = getWeekStart(1);
    const lastWeekEnd = (() => {
      const d = new Date(thisWeekStart + "T12:00:00");
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const thisWeekActs = await db.select().from(activities)
      .where(and(eq(activities.userId, userId), gte(activities.date, thisWeekStart)));
    const lastWeekActs = await db.select().from(activities)
      .where(and(eq(activities.userId, userId), gte(activities.date, lastWeekStart), lte(activities.date, lastWeekEnd)));
    const weeklyMiles = {
      thisWeek: Math.round(thisWeekActs.reduce((s, a) => s + (a.distanceMiles || 0), 0) * 10) / 10,
      lastWeek: Math.round(lastWeekActs.reduce((s, a) => s + (a.distanceMiles || 0), 0) * 10) / 10,
    };

    // Sleep trend
    const sleep7 = await db.select().from(sleepLogs)
      .where(and(eq(sleepLogs.userId, userId), gte(sleepLogs.date, getDateRange(7, today))));
    const sleep7prior = await db.select().from(sleepLogs)
      .where(and(
        eq(sleepLogs.userId, userId),
        gte(sleepLogs.date, getDateRange(14, today)),
        lte(sleepLogs.date, getDateRange(7, today))
      ));
    let sleepTrend: string | null = null;
    if (sleep7.length >= 3 && sleep7prior.length >= 2) {
      const avgDeep = (arr: typeof sleep7) => arr.reduce((s, r) => s + (r.deepMin || 0), 0) / arr.length;
      const avgScore = (arr: typeof sleep7) => arr.reduce((s, r) => s + (r.sleepScore || 0), 0) / arr.length;
      const deepDelta = Math.round(((avgDeep(sleep7) - avgDeep(sleep7prior)) / Math.max(avgDeep(sleep7prior), 1)) * 100);
      const scoreDelta = Math.round(avgScore(sleep7) - avgScore(sleep7prior));
      if (Math.abs(deepDelta) >= 10) {
        sleepTrend = deepDelta > 0
          ? `Deep sleep up ${deepDelta}% over 7 days — recovery trending strong.`
          : `Deep sleep down ${Math.abs(deepDelta)}% over 7 days — prioritize early sleep tonight.`;
      } else if (Math.abs(scoreDelta) >= 5) {
        sleepTrend = scoreDelta > 0
          ? `Sleep score up ${scoreDelta} pts this week — keep the consistency.`
          : `Sleep score down ${Math.abs(scoreDelta)} pts this week — watch your wind-down routine.`;
      }
    }

    // Today sleep summary for card
    const todaySleep = recentSleep_ ? {
      sleep_score: recentSleep_.sleepScore ?? null,
      hours: recentSleep_.hours ?? null,
      hrv: recentSleep_.hrv ?? null,
      body_battery_change: recentSleep_.bodyBatteryChange ?? null,
      resting_hr: recentSleep_.restingHr ?? null,
      spo2_avg: recentSleep_.spo2Avg ?? null,
      deep_min: recentSleep_.deepMin ?? null,
      rem_min: recentSleep_.remMin ?? null,
    } : null;

    // Inflammation signal
    let inflammationSignal: { detected: boolean; message: string } | null = null;
    const recentSleepRows = await db.select().from(sleepLogs)
      .where(eq(sleepLogs.userId, userId))
      .orderBy(desc(sleepLogs.date))
      .limit(2);
    const recentWeightRows = await db.select().from(healthMarkers)
      .where(and(eq(healthMarkers.userId, userId), isNotNull(healthMarkers.morningWeight)))
      .orderBy(desc(healthMarkers.date))
      .limit(2);
    if (recentSleepRows.length >= 2 && recentWeightRows.length >= 2) {
      const hrvToday = recentSleepRows[0]?.hrv;
      const hrvYest  = recentSleepRows[1]?.hrv;
      const wtToday  = recentWeightRows[0]?.morningWeight;
      const wtYest   = recentWeightRows[1]?.morningWeight;
      if (hrvToday && hrvYest && wtToday && wtYest) {
        const hrvDrop   = (hrvYest as number) - (hrvToday as number);
        const scaleDiff = (wtToday as number) - (wtYest as number);
        if (hrvDrop >= 5 && scaleDiff >= 0.5) {
          inflammationSignal = {
            detected: true,
            message: `Your HRV dropped ${Math.round(hrvDrop)}ms overnight while the scale rose ${scaleDiff.toFixed(1)} lbs. This is a classic inflammation pattern — fluid redistribution from recovery, stress, or sleep quality — not fat gain. Your body is repairing. Trust the data.`,
          };
        }
      }
    }

    // ── Readiness Breakdown ──────────────────────────────────────────
    // Four Garmin signals → composite 0-100 readiness score
    const rdHrv     = recentSleep_?.hrv ?? null;
    const rdScore   = recentSleep_?.sleepScore ?? null;
    const rdHr      = recentSleep_?.restingHr ?? null;
    const rdBattery = recentSleep_?.bodyBatteryChange ?? null;

    // Each signal scores 0-25 pts
    let rdComposite = 0;
    if (rdHrv !== null) {
      // HRV: >=60ms = full 25, 40-60 scaled, <40 = partial
      rdComposite += Math.min(25, Math.round((rdHrv / 60) * 25));
    }
    if (rdScore !== null) {
      // Sleep score: /100 → /25
      rdComposite += Math.round(rdScore / 4);
    }
    if (rdHr !== null) {
      // Resting HR: <=50 = 25, 50-80 scaled inversely, >80 = 0
      rdComposite += Math.max(0, Math.round(((80 - rdHr) / 30) * 25));
    }
    if (rdBattery !== null) {
      // Body Battery gain: >=60 = 25, scaled
      rdComposite += Math.min(25, Math.round((rdBattery / 60) * 25));
    }
    // If no signals at all, fall back to existing recoveryScore
    const hasRdSignals = [rdHrv, rdScore, rdHr, rdBattery].some(v => v !== null);
    if (!hasRdSignals) rdComposite = recoveryScore;
    rdComposite = Math.min(100, Math.max(0, rdComposite));

    const rdLabel =
      rdComposite >= 85 ? "Peak" :
      rdComposite >= 70 ? "High" :
      rdComposite >= 50 ? "Moderate" :
      rdComposite >= 30 ? "Low" : "Rest";
    const rdColor =
      rdComposite >= 85 ? "#10b981" :
      rdComposite >= 70 ? "#34d399" :
      rdComposite >= 50 ? "#f59e0b" :
      rdComposite >= 30 ? "#f97316" : "#ef4444";

    const readinessBreakdown = {
      hrv: rdHrv,
      sleepScore: rdScore,
      restingHr: rdHr,
      bodyBattery: rdBattery,
      composite: rdComposite,
      label: rdLabel as "Peak" | "High" | "Moderate" | "Low" | "Rest",
      color: rdColor,
    };

    // ── Contextual Coach Line ────────────────────────────────────────
    let coachLine = "Log today's data to unlock your coach line.";
    if (rdLabel === "Peak") {
      coachLine = "All systems green. Today is built for quality output.";
    } else if (rdLabel === "High") {
      coachLine = "Strong readiness. Push with intention.";
    } else if (rdLabel === "Moderate") {
      const todayActCount = actSource.length;
      if (todayActCount > 0) coachLine = "Moderate readiness with activity already banked. Recovery matters now.";
      else coachLine = "Moderate readiness. Build, don't burn.";
    } else if (rdLabel === "Low") {
      coachLine = "Low readiness detected. Protect sleep tonight and keep effort easy.";
    } else {
      coachLine = "Your body is asking for rest. Breathwork and light movement only.";
    }
    // Override with inflammation insight if present
    if (inflammationSignal?.detected) {
      coachLine = "Inflammation pattern detected. Support recovery before loading.";
    }
    // Sleep trend override
    if (sleepTrend && rdLabel === "Moderate") {
      if (sleepTrend.includes("up")) coachLine = "Sleep improving this week. Build on the momentum.";
    }

    // ── Active Fasting Session ───────────────────────────────────────
    const activeFastRows = await pool.query(
      `SELECT id, started_at, goal_hours FROM fasting_sessions WHERE user_id = $1 AND ended_at IS NULL ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    let activeFast = null;
    if (activeFastRows.rows.length > 0) {
      const af = activeFastRows.rows[0];
      const startedAt = af.started_at as string;
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      const elapsedHours = elapsedMs / 3600000;
      const fzLabel =
        elapsedHours < 8   ? "Glycolytic" :
        elapsedHours < 12  ? "Transitional" :
        elapsedHours < 16  ? "Fat-Dominant" :
        elapsedHours < 20  ? "Deep Fat Oxidation" : "Extended Fast";
      const fzColor =
        elapsedHours < 8   ? "#6b7280" :
        elapsedHours < 12  ? "#f59e0b" :
        elapsedHours < 16  ? "#f97316" :
        elapsedHours < 20  ? "#10b981" : "#8b5cf6";
      activeFast = {
        id: af.id as number,
        startedAt,
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        fuelZone: fzLabel,
        fuelZoneColor: fzColor,
        targetHours: af.goal_hours ?? null,
      };
    }

    // Today's food entries (low-friction signal log). Used by the
    // Dashboard Daily Intelligence Fuel Watch section. Always returns an
    // array. Wrapped in try/catch so the whole dashboard summary does not
    // 500 if the food_entries table has not yet been migrated in
    // production (npm run db:push after the schema landed).
    let todayFoodEntries: any[] = [];
    try {
      todayFoodEntries = await db.select().from(foodEntries)
        .where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, today)))
        .orderBy(desc(foodEntries.id));
    } catch (e: any) {
      console.warn(`[dashboard] food_entries unavailable, degrading to empty: ${e?.message}`);
    }

    return {
      currentWeight, weightTrend, weeklyDeficit: last7, runningPaceTrend,
      recoveryScore, hasTodayData, topInsights: insights, goals: allGoals,
      streaks: { breathwork: breathworkStreak, practice: practiceStreak, walk: walkStreak },
      todaySleep, todayActivity, weeklyMiles, sleepTrend, inflammationSignal,
      arcModality, arcMetric, arcWindow, arcPR,
      // Full activity arrays for clickable card drawers
      todayActivities: actSource,
      recentActivities,
      recentActivityDate: recentDate,
      weekActivities:  thisWeekActs,
      // New dynamic features
      readinessBreakdown,
      coachLine,
      activeFast,
      todayFoodEntries,
    };
  },

  // ── Weekly Data ───────────────────────────────────────────────────────────────

  async getWeeklyData(userId, clientDate) {
    const rows: WeeklyRow[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayW = clientDate || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    })();
    const [twy, twm, twd] = todayW.split("-").map(Number);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(twy, twm - 1, twd, 12, 0, 0);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const dayLabel = dayNames[d.getDay()];

      const [dayMeals, dayActs, daySleepRows, dayBreathRows, dayPracticeRows, dayMarkerRows] = await Promise.all([
        db.select().from(meals).where(and(eq(meals.userId, userId), eq(meals.date, dateStr))),
        db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.date, dateStr))),
        db.select().from(sleepLogs).where(and(eq(sleepLogs.userId, userId), eq(sleepLogs.date, dateStr))).limit(1),
        db.select().from(breathworkLogs).where(and(eq(breathworkLogs.userId, userId), eq(breathworkLogs.date, dateStr))).limit(1),
        db.select().from(practiceLogs).where(and(eq(practiceLogs.userId, userId), eq(practiceLogs.date, dateStr))).limit(1),
        db.select().from(healthMarkers).where(and(eq(healthMarkers.userId, userId), eq(healthMarkers.date, dateStr))).limit(1),
      ]);

      const daySleep = daySleepRows[0];
      const dayBreath = dayBreathRows[0];
      const dayPractice = dayPracticeRows[0];
      const dayMarker = dayMarkerRows[0];

      const calsIntake = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      const calsBurn = dayActs.reduce((s, a) => s + (a.estCalsBurned || 0), 0) + 1800;
      const activitySummary = dayActs.map(a => `${a.modality} ${a.durationMin}min`).join(", ");
      const recovery = calcRecoveryScore(
        daySleep?.hours ?? null, daySleep?.quality ?? null,
        daySleep?.restingHr ?? null, dayMarker?.mood ?? null, !!dayBreath
      );

      rows.push({
        date: dateStr, dayLabel,
        weight: dayMarker?.morningWeight ?? null,
        calsIntake, calsBurn, deficit: calsBurn - calsIntake,
        sleepHours: daySleep?.hours ?? null,
        sleepQuality: daySleep?.quality ?? null,
        restingHr: daySleep?.restingHr ?? null,
        mood: dayMarker?.mood ?? null,
        activities: activitySummary || "—",
        breathwork: !!dayBreath, practice: !!dayPractice,
        recoveryScore: recovery,
      });
    }

    const since = getDateRange(7, todayW);
    const weekActs = await db.select().from(activities)
      .where(and(eq(activities.userId, userId), gte(activities.date, since)));
    const modalityMap: Record<string, number> = {};
    weekActs.forEach(a => { modalityMap[a.modality] = (modalityMap[a.modality] || 0) + a.durationMin; });
    const modalityBreakdown = Object.entries(modalityMap).map(([modality, minutes]) => ({ modality, minutes }));

    const weights = rows.filter(r => r.weight).map(r => r.weight!);
    const avgWeight = weights.length > 0 ? weights.reduce((s, w) => s + w, 0) / weights.length : null;
    const sleepValues = rows.filter(r => r.sleepHours).map(r => r.sleepHours!);
    const avgSleepHours = sleepValues.length > 0 ? sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length : null;
    const hrValues = rows.filter(r => r.restingHr).map(r => r.restingHr!);
    const avgResting = hrValues.length > 0 ? hrValues.reduce((s, v) => s + v, 0) / hrValues.length : null;
    const moodValues = rows.filter(r => r.mood).map(r => r.mood!);
    const avgMood = moodValues.length > 0 ? moodValues.reduce((s, v) => s + v, 0) / moodValues.length : null;
    const totalCalsBurned = rows.reduce((s, r) => s + r.calsBurn, 0);
    const totalCalsIntake = rows.reduce((s, r) => s + r.calsIntake, 0);

    return {
      rows, modalityBreakdown,
      weekStats: {
        avgWeight: avgWeight ? Math.round(avgWeight * 10) / 10 : null,
        totalCalsBurned, totalCalsIntake, netDeficit: totalCalsBurned - totalCalsIntake,
        avgSleepHours: avgSleepHours ? Math.round(avgSleepHours * 10) / 10 : null,
        avgResting: avgResting ? Math.round(avgResting) : null,
        avgMood: avgMood ? Math.round(avgMood * 10) / 10 : null,
      },
    };
  },

  // ── Correlations ─────────────────────────────────────────────────────────────

  async getCorrelations(userId) {
    const [markersAll, sleepData, runData, breathData] = await Promise.all([
      db.select().from(healthMarkers).where(eq(healthMarkers.userId, userId)).orderBy(healthMarkers.date),
      db.select().from(sleepLogs).where(eq(sleepLogs.userId, userId)).orderBy(sleepLogs.date),
      db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.modality, "running"))).orderBy(activities.date),
      db.select().from(breathworkLogs).where(eq(breathworkLogs.userId, userId)).orderBy(breathworkLogs.date),
    ]);

    const results: CorrelationResult[] = [];

    function pearson(xs: number[], ys: number[]): number {
      const n = Math.min(xs.length, ys.length);
      if (n < 5) return 0;
      const meanX = xs.reduce((s, v) => s + v, 0) / n;
      const meanY = ys.reduce((s, v) => s + v, 0) / n;
      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        denX += (xs[i] - meanX) ** 2;
        denY += (ys[i] - meanY) ** 2;
      }
      return denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
    }
    function sig(r: number) { const a = Math.abs(r); return a > 0.7 ? "strong" : a > 0.4 ? "moderate" : "weak"; }

    if (sleepData.length >= 5 && runData.length >= 5) {
      const sleepMap: Record<string, number> = {};
      sleepData.forEach(s => { sleepMap[s.date] = s.quality; });
      const pairs = runData.filter(r => r.distanceMiles && r.distanceMiles > 0 && sleepMap[r.date])
        .map(r => ({ sleep: sleepMap[r.date], pace: r.durationMin! / r.distanceMiles! }));
      if (pairs.length >= 5) {
        const r = pearson(pairs.map(p => p.sleep), pairs.map(p => p.pace));
        if (Math.abs(r) > 0.3) {
          results.push({ metricA: "Sleep Quality", metricB: "Running Pace", coefficient: Math.round(r * 100) / 100, significance: sig(r), insight: r < 0 ? "Higher sleep quality correlates with faster running pace." : "Lower sleep quality correlates with slower pace." });
        }
      }
    }

    if (breathData.length >= 5 && markersAll.length >= 5) {
      const breathMap: Record<string, boolean> = {};
      breathData.forEach(b => { breathMap[b.date] = true; });
      const pairs = markersAll.filter(m => m.mood && breathMap[m.date] !== undefined);
      if (pairs.length >= 5) {
        const xs = pairs.map(p => breathMap[p.date] ? 1 : 0);
        const ys = pairs.map(p => p.mood!);
        const r = pearson(xs, ys);
        if (Math.abs(r) > 0.25) {
          results.push({ metricA: "Breathwork Practice", metricB: "Mood Score", coefficient: Math.round(r * 100) / 100, significance: sig(r), insight: r > 0 ? "Days with breathwork practice correlate with higher mood scores." : "Unexpected: breathwork days show lower mood — check notes." });
        }
      }
    }

    if (sleepData.length >= 5) {
      const pairs = sleepData.filter(s => s.hours && s.restingHr);
      if (pairs.length >= 5) {
        const r = pearson(pairs.map(p => p.hours), pairs.map(p => p.restingHr!));
        if (Math.abs(r) > 0.3) {
          results.push({ metricA: "Sleep Hours", metricB: "Resting HR", coefficient: Math.round(r * 100) / 100, significance: sig(r), insight: r < 0 ? "More sleep correlates with lower resting HR — keep it up." : "Longer sleep showing elevated HR — monitor for overtraining." });
        }
      }
    }

    if (results.length === 0) {
      results.push({ metricA: "—", metricB: "—", coefficient: 0, significance: "weak", insight: "Log at least 2 weeks of data to unlock correlation insights." });
    }
    return results;
  },
};
