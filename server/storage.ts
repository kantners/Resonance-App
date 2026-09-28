import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, gte, and, isNotNull } from "drizzle-orm";
import {
  users, sleepLogs, breathworkLogs, fastingSessions,
  type User, type InsertUser,
  type SleepLog, type InsertSleep,
  type BreathworkLog, type InsertBreathwork,
  type FastingSession,
} from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  // Auth
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;
  // Sleep
  getSleepLogs(userId: number, days?: number): Promise<SleepLog[]>;
  createSleepLog(userId: number, data: InsertSleep): Promise<SleepLog>;
  updateSleepLog(userId: number, id: number, data: Partial<InsertSleep>): Promise<SleepLog | null>;
  // Breathwork
  getBreathworkLogs(userId: number, days?: number): Promise<BreathworkLog[]>;
  createBreathworkLog(userId: number, data: InsertBreathwork): Promise<BreathworkLog>;
  // Fasting
  getActiveFast(userId: number): Promise<FastingSession | null>;
  getFastingHistory(userId: number, limit?: number): Promise<FastingSession[]>;
  startFast(userId: number, goalHours: number): Promise<FastingSession>;
  endFast(userId: number, id: number, notes?: string): Promise<FastingSession | null>;
  deleteFast(userId: number, id: number): Promise<boolean>;
  updateFastTimes(userId: number, id: number, startedAt?: string, endedAt?: string): Promise<FastingSession | null>;
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
      .where(eq(fastingSessions.userId, userId))
      .orderBy(desc(fastingSessions.id))
      .limit(limit);
  },

  async startFast(userId, goalHours) {
    // End any still-open fast first
    const active = await storage.getActiveFast(userId);
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

  async updateFastTimes(userId, id, startedAt, endedAt) {
    const update: Record<string, any> = {};
    if (startedAt !== undefined) update.startedAt = startedAt;
    if (endedAt   !== undefined) update.endedAt   = endedAt;
    const rows = await db.update(fastingSessions)
      .set(update)
      .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },
};
