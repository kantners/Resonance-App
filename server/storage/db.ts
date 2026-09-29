import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  users, sleepLogs, breathworkLogs, fastingSessions, nightContextTags, morningReadings,
  stillnessSessions, readingLogs, digitalExposure, phoneEvents, dailyStatus,
  practitioners, studyProtocols, studyEnrollments, studySessions, type ContextTag,
} from "@shared/schema";
import { type IStorage, type SessionContext, UniqueViolation } from "./types";

function dateRange(col: any, from?: string, to?: string): SQL[] {
  const conds: SQL[] = [];
  if (from) conds.push(gte(col, from));
  if (to) conds.push(lte(col, to));
  return conds;
}

function rethrowUnique(e: any): never {
  // node-postgres: 23505 = unique_violation
  if (e?.code === "23505") throw new UniqueViolation(e.constraint ?? "unique");
  throw e;
}

export function createDbStorage(db: NodePgDatabase): IStorage {
  async function sessionContexts(where: SQL): Promise<SessionContext[]> {
    const rows = await db.select({ session: studySessions, enrollment: studyEnrollments, protocol: studyProtocols })
      .from(studySessions)
      .innerJoin(studyEnrollments, eq(studySessions.enrollmentId, studyEnrollments.id))
      .innerJoin(studyProtocols, eq(studyEnrollments.protocolId, studyProtocols.id))
      .where(where)
      .orderBy(asc(studyEnrollments.id), asc(studySessions.visitNumber));
    return rows;
  }

  const storage: IStorage = {
    async ping() {
      await db.execute(sql`select 1`);
    },

    // ── Users ────────────────────────────────────────────────────────────────
    async getUserByEmail(email) {
      const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      return rows[0] ?? null;
    },
    async getUserById(id) {
      const rows = await db.select().from(users).where(eq(users.id, id));
      return rows[0] ?? null;
    },
    async createUser(data) {
      try {
        const rows = await db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning();
        return rows[0];
      } catch (e) { rethrowUnique(e); }
    },
    async updateUserSettings(id, patch) {
      if (!Object.keys(patch).length) return storage.getUserById(id);
      const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      return rows[0] ?? null;
    },
    async deleteUser(id) {
      await db.delete(users).where(eq(users.id, id));
    },

    // ── Sleep ────────────────────────────────────────────────────────────────
    async listSleep(userId, from, to) {
      return db.select().from(sleepLogs)
        .where(and(eq(sleepLogs.userId, userId), ...dateRange(sleepLogs.date, from, to)))
        .orderBy(asc(sleepLogs.date));
    },
    async getSleep(userId, date) {
      const rows = await db.select().from(sleepLogs).where(and(eq(sleepLogs.userId, userId), eq(sleepLogs.date, date)));
      return rows[0] ?? null;
    },
    async upsertSleep(userId, date, patch) {
      // An empty patch still needs a SET clause for RETURNING to yield the row.
      const set = Object.keys(patch).length ? patch : { date };
      const rows = await db.insert(sleepLogs).values({ userId, date, ...patch })
        .onConflictDoUpdate({ target: [sleepLogs.userId, sleepLogs.date], set })
        .returning();
      return rows[0];
    },

    // ── Breathwork ───────────────────────────────────────────────────────────
    async listBreathwork(userId, from, to) {
      return db.select().from(breathworkLogs)
        .where(and(eq(breathworkLogs.userId, userId), ...dateRange(breathworkLogs.date, from, to)))
        .orderBy(asc(breathworkLogs.date));
    },
    async createBreathwork(userId, data) {
      const rows = await db.insert(breathworkLogs).values({ ...data, userId }).returning();
      return rows[0];
    },

    // ── Fasting ──────────────────────────────────────────────────────────────
    async getActiveFast(userId) {
      const rows = await db.select().from(fastingSessions)
        .where(and(eq(fastingSessions.userId, userId), isNotNull(fastingSessions.startedAt)))
        .orderBy(desc(fastingSessions.id)).limit(1);
      const row = rows[0];
      return row && !row.endedAt ? row : null;
    },
    async getFastingHistory(userId, limit = 30) {
      return db.select().from(fastingSessions).where(eq(fastingSessions.userId, userId))
        .orderBy(desc(fastingSessions.id)).limit(limit);
    },
    async startFast(userId, startedAt, goalHours) {
      const active = await storage.getActiveFast(userId);
      if (active) await db.update(fastingSessions).set({ endedAt: startedAt }).where(eq(fastingSessions.id, active.id));
      const rows = await db.insert(fastingSessions).values({ userId, startedAt, goalHours }).returning();
      return rows[0];
    },
    async endFast(userId, id, endedAt, notes) {
      const rows = await db.update(fastingSessions).set({ endedAt, notes: notes ?? null })
        .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId))).returning();
      return rows[0] ?? null;
    },
    async deleteFast(userId, id) {
      const r = await db.delete(fastingSessions).where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId)));
      return (r.rowCount ?? 0) > 0;
    },
    async updateFastTimes(userId, id, startedAt, endedAt) {
      const update: Record<string, string> = {};
      if (startedAt !== undefined) update.startedAt = startedAt;
      if (endedAt !== undefined) update.endedAt = endedAt;
      if (!Object.keys(update).length) return null;
      const rows = await db.update(fastingSessions).set(update)
        .where(and(eq(fastingSessions.id, id), eq(fastingSessions.userId, userId))).returning();
      return rows[0] ?? null;
    },

    // ── Tags ─────────────────────────────────────────────────────────────────
    async getNightTags(userId, date) {
      const rows = await db.select().from(nightContextTags)
        .where(and(eq(nightContextTags.userId, userId), eq(nightContextTags.date, date)));
      return rows.map(r => r.tag as ContextTag);
    },
    async setNightTags(userId, date, tags) {
      await db.transaction(async tx => {
        await tx.delete(nightContextTags).where(and(eq(nightContextTags.userId, userId), eq(nightContextTags.date, date)));
        if (tags.length) await tx.insert(nightContextTags).values(tags.map(tag => ({ userId, date, tag })));
      });
      return storage.getNightTags(userId, date);
    },

    // ── Morning readings, stillness, reading ─────────────────────────────────
    async createMorningReading(userId, data) {
      const rows = await db.insert(morningReadings).values({ ...data, userId }).returning();
      return rows[0];
    },
    async createStillness(userId, data) {
      const rows = await db.insert(stillnessSessions).values({ ...data, userId }).returning();
      return rows[0];
    },
    async listStillness(userId, from, to) {
      return db.select().from(stillnessSessions)
        .where(and(eq(stillnessSessions.userId, userId), ...dateRange(stillnessSessions.date, from, to)))
        .orderBy(asc(stillnessSessions.date), asc(stillnessSessions.startedAt));
    },
    async createReading(userId, data) {
      const rows = await db.insert(readingLogs).values({ ...data, userId }).returning();
      return rows[0];
    },
    async listReading(userId, from, to) {
      return db.select().from(readingLogs)
        .where(and(eq(readingLogs.userId, userId), ...dateRange(readingLogs.date, from, to)))
        .orderBy(asc(readingLogs.date));
    },

    // ── Exposure ─────────────────────────────────────────────────────────────
    async upsertExposure(userId, data) {
      const { date, ...rest } = data;
      const rows = await db.insert(digitalExposure).values({ ...data, userId })
        .onConflictDoUpdate({ target: [digitalExposure.userId, digitalExposure.date], set: { ...rest, date } })
        .returning();
      return rows[0];
    },
    async getExposure(userId, date) {
      const rows = await db.select().from(digitalExposure)
        .where(and(eq(digitalExposure.userId, userId), eq(digitalExposure.date, date)));
      return rows[0] ?? null;
    },
    async listExposure(userId, from, to) {
      return db.select().from(digitalExposure)
        .where(and(eq(digitalExposure.userId, userId), ...dateRange(digitalExposure.date, from, to)))
        .orderBy(asc(digitalExposure.date));
    },
    async listPhoneEvents(userId, fromIso, toIso) {
      return db.select().from(phoneEvents)
        .where(and(eq(phoneEvents.userId, userId), gte(phoneEvents.at, fromIso), lte(phoneEvents.at, toIso)))
        .orderBy(asc(phoneEvents.at));
    },

    // ── Daily status ─────────────────────────────────────────────────────────
    async upsertDailyStatus(userId, values) {
      const set = { ...values, computedAt: new Date() };
      const rows = await db.insert(dailyStatus).values({ ...values, userId })
        .onConflictDoUpdate({
          target: [dailyStatus.userId, dailyStatus.date, dailyStatus.ruleVersion, dailyStatus.hrvLogScale],
          set,
        })
        .returning();
      return rows[0];
    },
    async listDailyStatus(userId, from, to, ruleVersion, hrvLogScale) {
      return db.select().from(dailyStatus)
        .where(and(eq(dailyStatus.userId, userId), gte(dailyStatus.date, from), lte(dailyStatus.date, to),
          eq(dailyStatus.ruleVersion, ruleVersion), eq(dailyStatus.hrvLogScale, hrvLogScale)))
        .orderBy(asc(dailyStatus.date));
    },

    // ── Study ────────────────────────────────────────────────────────────────
    async getPractitionerByUserId(userId) {
      const rows = await db.select().from(practitioners).where(eq(practitioners.userId, userId));
      return rows[0] ?? null;
    },
    async getPractitioner(id) {
      const rows = await db.select().from(practitioners).where(eq(practitioners.id, id));
      return rows[0] ?? null;
    },
    async createPractitioner(userId, practiceName) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(practitioners);
      const displayCode = `Practitioner ${String.fromCharCode(65 + (n % 26))}${n >= 26 ? Math.floor(n / 26) : ""}`;
      try {
        const rows = await db.insert(practitioners).values({ userId, displayCode, practiceName }).returning();
        return rows[0];
      } catch (e) { rethrowUnique(e); }
    },
    async createProtocol(data) {
      const rows = await db.insert(studyProtocols).values(data).returning();
      return rows[0];
    },
    async getProtocol(id) {
      const rows = await db.select().from(studyProtocols).where(eq(studyProtocols.id, id));
      return rows[0] ?? null;
    },
    async listProtocols(practitionerId) {
      return db.select().from(studyProtocols).where(eq(studyProtocols.practitionerId, practitionerId))
        .orderBy(desc(studyProtocols.id));
    },
    async updateDraftProtocol(id, patch) {
      const rows = await db.update(studyProtocols).set(patch)
        .where(and(eq(studyProtocols.id, id), isNull(studyProtocols.lockedAt))).returning();
      return rows[0] ?? null;
    },
    async lockProtocol(id, lock) {
      const rows = await db.update(studyProtocols).set(lock)
        .where(and(eq(studyProtocols.id, id), isNull(studyProtocols.lockedAt))).returning();
      return rows[0] ?? null;
    },
    async completeProtocol(id, completedAt) {
      const rows = await db.update(studyProtocols).set({ completedAt })
        .where(and(eq(studyProtocols.id, id), isNotNull(studyProtocols.lockedAt), isNull(studyProtocols.completedAt)))
        .returning();
      return rows[0] ?? null;
    },
    async listEnrollments(protocolId) {
      return db.select().from(studyEnrollments).where(eq(studyEnrollments.protocolId, protocolId))
        .orderBy(asc(studyEnrollments.allocationIndex));
    },
    async listEnrollmentsForClient(clientUserId) {
      return db.select().from(studyEnrollments).where(eq(studyEnrollments.clientUserId, clientUserId))
        .orderBy(asc(studyEnrollments.id));
    },
    async getEnrollment(id) {
      const rows = await db.select().from(studyEnrollments).where(eq(studyEnrollments.id, id));
      return rows[0] ?? null;
    },
    async createEnrollmentWithSessions(data, conditions) {
      try {
        return await db.transaction(async tx => {
          const [enrollment] = await tx.insert(studyEnrollments).values(data).returning();
          await tx.insert(studySessions).values(conditions.map((condition, i) => ({
            enrollmentId: enrollment.id, visitNumber: i + 1, condition,
          })));
          return enrollment;
        });
      } catch (e) { rethrowUnique(e); }
    },
    async withdrawEnrollment(id, withdrawnAt) {
      return db.transaction(async tx => {
        await tx.delete(studySessions).where(eq(studySessions.enrollmentId, id));
        const rows = await tx.update(studyEnrollments)
          .set({ withdrawnAt, clientUserId: null, touchProfile: "{}" })
          .where(eq(studyEnrollments.id, id)).returning();
        return rows[0] ?? null;
      });
    },
    async getSessionContext(sessionId) {
      const rows = await sessionContexts(eq(studySessions.id, sessionId));
      return rows[0] ?? null;
    },
    async listSessionContexts(protocolId) {
      return sessionContexts(eq(studyEnrollments.protocolId, protocolId));
    },
    async updateSession(sessionId, patch) {
      if (!Object.keys(patch).length) {
        const ctx = await storage.getSessionContext(sessionId);
        return ctx?.session ?? null;
      }
      const rows = await db.update(studySessions).set(patch).where(eq(studySessions.id, sessionId)).returning();
      return rows[0] ?? null;
    },
    async markRevealed(sessionId, at) {
      await db.update(studySessions).set({ conditionRevealedAt: at })
        .where(and(eq(studySessions.id, sessionId), isNull(studySessions.conditionRevealedAt)));
      const rows = await db.select().from(studySessions).where(eq(studySessions.id, sessionId));
      return rows[0] ?? null;
    },
  };

  return storage;
}
