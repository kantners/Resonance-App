// In-memory IStorage for tests. Mirrors the unique constraints and
// cascades the routes rely on; not used in production.
import type {
  User, SleepLog, BreathworkLog, FastingSession, DigitalExposure, ReadingLog, MorningReading,
  StillnessSession, PhoneEvent, DailyStatus, Practitioner, StudyProtocol, StudyEnrollment, StudySession, ContextTag,
} from "@shared/schema";
import { type IStorage, type SessionContext, UniqueViolation } from "./types";

const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);
const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function createMemoryStorage(): IStorage & { phoneEvents: PhoneEvent[] } {
  let seq = 0;
  const id = () => ++seq;
  const usersT: User[] = [];
  const sleep: SleepLog[] = [];
  const breath: BreathworkLog[] = [];
  const fasts: FastingSession[] = [];
  const tags: { userId: number; date: string; tag: ContextTag }[] = [];
  const readings: MorningReading[] = [];
  const stillness: StillnessSession[] = [];
  const reading: ReadingLog[] = [];
  const exposure: DigitalExposure[] = [];
  const phoneEvents: PhoneEvent[] = [];
  const statuses: DailyStatus[] = [];
  const practitionersT: Practitioner[] = [];
  const protocols: StudyProtocol[] = [];
  const enrollments: StudyEnrollment[] = [];
  const sessions: StudySession[] = [];

  function ctx(s: StudySession): SessionContext {
    const enrollment = enrollments.find(e => e.id === s.enrollmentId)!;
    const protocol = protocols.find(p => p.id === enrollment.protocolId)!;
    return { session: { ...s }, enrollment: { ...enrollment }, protocol: { ...protocol } };
  }

  const storage: IStorage & { phoneEvents: PhoneEvent[] } = {
    phoneEvents,
    async ping() {},

    async getUserByEmail(email) { return usersT.find(u => u.email === email.toLowerCase()) ?? null; },
    async getUserById(uid) { return usersT.find(u => u.id === uid) ?? null; },
    async createUser(data) {
      if (usersT.some(u => u.email === data.email.toLowerCase())) throw new UniqueViolation("users_email_unique");
      const u: User = {
        id: id(), email: data.email.toLowerCase(), passwordHash: data.passwordHash, firstName: data.firstName ?? null,
        isDemo: data.isDemo ?? false, timeZone: data.timeZone ?? null,
        defaultHrvSource: data.defaultHrvSource ?? null, defaultHrvDevice: data.defaultHrvDevice ?? null, createdAt: new Date(),
      };
      usersT.push(u);
      return u;
    },
    async updateUserSettings(uid, patch) {
      const u = usersT.find(x => x.id === uid);
      if (!u) return null;
      Object.assign(u, patch);
      return u;
    },
    async deleteUser(uid) {
      const i = usersT.findIndex(u => u.id === uid);
      if (i >= 0) usersT.splice(i, 1);
      for (const e of enrollments) if (e.clientUserId === uid) e.clientUserId = null;   // ON DELETE SET NULL
    },

    async listSleep(userId, from, to) { return sleep.filter(s => s.userId === userId && inRange(s.date, from, to)).sort(byDate); },
    async getSleep(userId, date) { return sleep.find(s => s.userId === userId && s.date === date) ?? null; },
    async upsertSleep(userId, date, patch) {
      let row = sleep.find(s => s.userId === userId && s.date === date);
      if (!row) {
        row = {
          id: id(), userId, date, hours: null, quality: null, sleepScore: null, restingHr: null, hrv: null,
          hrvSource: "device_manual", hrvDevice: null, morningReadingId: null, notes: null,
        };
        sleep.push(row);
      }
      Object.assign(row, patch);
      return row;
    },

    async listBreathwork(userId, from, to) { return breath.filter(b => b.userId === userId && inRange(b.date, from, to)).sort(byDate); },
    async createBreathwork(userId, data) {
      const row = { id: id(), userId, quality: null, perceivedEffect: null, notes: null, ...data } as BreathworkLog;
      breath.push(row);
      return row;
    },

    async getActiveFast(userId) {
      const mine = fasts.filter(f => f.userId === userId).sort((a, b) => b.id - a.id);
      return mine[0] && !mine[0].endedAt ? mine[0] : null;
    },
    async getFastingHistory(userId, limit = 30) { return fasts.filter(f => f.userId === userId).sort((a, b) => b.id - a.id).slice(0, limit); },
    async startFast(userId, startedAt, goalHours) {
      const active = await storage.getActiveFast(userId);
      if (active) active.endedAt = startedAt;
      const row: FastingSession = { id: id(), userId, startedAt, endedAt: null, goalHours, notes: null };
      fasts.push(row);
      return row;
    },
    async endFast(userId, fid, endedAt, notes) {
      const f = fasts.find(x => x.id === fid && x.userId === userId);
      if (!f) return null;
      f.endedAt = endedAt; f.notes = notes ?? null;
      return f;
    },
    async deleteFast(userId, fid) {
      const i = fasts.findIndex(x => x.id === fid && x.userId === userId);
      if (i < 0) return false;
      fasts.splice(i, 1);
      return true;
    },
    async updateFastTimes(userId, fid, startedAt, endedAt) {
      const f = fasts.find(x => x.id === fid && x.userId === userId);
      if (!f) return null;
      if (startedAt !== undefined) f.startedAt = startedAt;
      if (endedAt !== undefined) f.endedAt = endedAt;
      return f;
    },

    async getNightTags(userId, date) { return tags.filter(t => t.userId === userId && t.date === date).map(t => t.tag); },
    async setNightTags(userId, date, newTags) {
      for (let i = tags.length - 1; i >= 0; i--) if (tags[i].userId === userId && tags[i].date === date) tags.splice(i, 1);
      for (const tag of new Set(newTags)) tags.push({ userId, date, tag });
      return storage.getNightTags(userId, date);
    },

    async createMorningReading(userId, data) {
      const row = { id: id(), userId, durationSec: 60, signalQuality: null, posture: "seated", hrvSource: "device_manual", ...data } as MorningReading;
      readings.push(row);
      return row;
    },
    async createStillness(userId, data) {
      const row = {
        id: id(), userId, reikiRole: null, readingMedium: null, breathsPerMin: null, rmssdDuringMs: null,
        breathMethod: null, hrSource: null, postureStyle: null, notes: null, ...data,
      } as StillnessSession;
      stillness.push(row);
      return row;
    },
    async listStillness(userId, from, to) { return stillness.filter(s => s.userId === userId && inRange(s.date, from, to)).sort(byDate); },
    async createReading(userId, data) {
      const row = { id: id(), userId, startedAt: null, title: null, createdAt: new Date(), ...data } as ReadingLog;
      reading.push(row);
      return row;
    },
    async listReading(userId, from, to) { return reading.filter(r => r.userId === userId && inRange(r.date, from, to)).sort(byDate); },

    async upsertExposure(userId, data) {
      const i = exposure.findIndex(e => e.userId === userId && e.date === data.date);
      const blank = {
        platform: null, pickups: null, notifications: null, socialMin: null, entertainmentMin: null, productivityMin: null,
        otherMin: null, topApps: null, hourlyPickups: null, pickupsAfter21: null, longestQuietMin: null, quietStretches30: null,
        quietMinutes30Total: null, lastPickupAt: null, quietSource: null, lowConfidenceFields: null,
      };
      const row = { ...blank, ...data, id: i >= 0 ? exposure[i].id : id(), userId, createdAt: new Date() } as DigitalExposure;
      if (i >= 0) exposure[i] = row; else exposure.push(row);
      return row;
    },
    async getExposure(userId, date) { return exposure.find(e => e.userId === userId && e.date === date) ?? null; },
    async listExposure(userId, from, to) { return exposure.filter(e => e.userId === userId && inRange(e.date, from, to)).sort(byDate); },
    async listPhoneEvents(userId, fromIso, toIso) {
      return phoneEvents.filter(p => p.userId === userId && p.at >= fromIso && p.at <= toIso).sort((a, b) => (a.at < b.at ? -1 : 1));
    },

    async upsertDailyStatus(userId, values) {
      const i = statuses.findIndex(s => s.userId === userId && s.date === values.date
        && s.ruleVersion === values.ruleVersion && s.hrvLogScale === values.hrvLogScale);
      const row = { ...values, id: i >= 0 ? statuses[i].id : id(), userId, computedAt: new Date() } as DailyStatus;
      if (i >= 0) statuses[i] = row; else statuses.push(row);
      return row;
    },
    async listDailyStatus(userId, from, to, ruleVersion, hrvLogScale) {
      return statuses.filter(s => s.userId === userId && inRange(s.date, from, to)
        && s.ruleVersion === ruleVersion && s.hrvLogScale === hrvLogScale).sort(byDate);
    },

    async getPractitionerByUserId(userId) { return practitionersT.find(p => p.userId === userId) ?? null; },
    async getPractitioner(pid) { return practitionersT.find(p => p.id === pid) ?? null; },
    async createPractitioner(userId, practiceName) {
      if (practitionersT.some(p => p.userId === userId)) throw new UniqueViolation("practitioners_user_id_unique");
      const p: Practitioner = { id: id(), userId, displayCode: `Practitioner ${String.fromCharCode(65 + practitionersT.length)}`, practiceName };
      practitionersT.push(p);
      return p;
    },
    async createProtocol(data) {
      const p = { ...data, id: id(), createdAt: new Date(), lockedAt: null, completedAt: null,
        allocationList: null, allocationNonce: null, allocationSha256: null } as StudyProtocol;
      protocols.push(p);
      return { ...p };
    },
    async getProtocol(pid) { const p = protocols.find(x => x.id === pid); return p ? { ...p } : null; },
    async listProtocols(practitionerId) { return protocols.filter(p => p.practitionerId === practitionerId).map(p => ({ ...p })).reverse(); },
    async updateDraftProtocol(pid, patch) {
      const p = protocols.find(x => x.id === pid);
      if (!p || p.lockedAt) return null;
      Object.assign(p, patch);
      return { ...p };
    },
    async lockProtocol(pid, lock) {
      const p = protocols.find(x => x.id === pid);
      if (!p || p.lockedAt) return null;
      Object.assign(p, lock);
      return { ...p };
    },
    async completeProtocol(pid, completedAt) {
      const p = protocols.find(x => x.id === pid);
      if (!p || !p.lockedAt || p.completedAt) return null;
      p.completedAt = completedAt;
      return { ...p };
    },

    async listEnrollments(protocolId) {
      return enrollments.filter(e => e.protocolId === protocolId).sort((a, b) => a.allocationIndex - b.allocationIndex).map(e => ({ ...e }));
    },
    async listEnrollmentsForClient(clientUserId) { return enrollments.filter(e => e.clientUserId === clientUserId).map(e => ({ ...e })); },
    async getEnrollment(eid) { const e = enrollments.find(x => x.id === eid); return e ? { ...e } : null; },
    async createEnrollmentWithSessions(data, conditions) {
      const same = enrollments.filter(e => e.protocolId === data.protocolId);
      if (same.some(e => e.allocationIndex === data.allocationIndex)) throw new UniqueViolation("enrollment_protocol_allocation");
      if (same.some(e => e.clientCode === data.clientCode)) throw new UniqueViolation("enrollment_protocol_code");
      if (data.clientUserId != null && same.some(e => e.clientUserId === data.clientUserId)) throw new UniqueViolation("enrollment_protocol_client");
      const e: StudyEnrollment = { ...data, id: id(), withdrawnAt: null };
      enrollments.push(e);
      conditions.forEach((condition, i) => sessions.push({
        id: id(), enrollmentId: e.id, visitNumber: i + 1, condition, conditionRevealedAt: null,
        preTakenAt: null, preRmssdMs: null, preHrBpm: null, prePosture: null, preBreathsPerMin: null, preReadingDevice: null,
        postTakenAt: null, postRmssdMs: null, postHrBpm: null, postPosture: null, postBreathsPerMin: null, postReadingDevice: null,
        relaxPre: null, relaxPost: null, clientGuess: null, intentionHeldRating: null, driftCount: 0, checklist: null,
        deviations: null, stonesNotes: null, clientReport: null, closingReikiGiven: null, completedAt: null,
      }));
      return { ...e };
    },
    async withdrawEnrollment(eid, withdrawnAt) {
      const e = enrollments.find(x => x.id === eid);
      if (!e) return null;
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].enrollmentId === eid) sessions.splice(i, 1);
      Object.assign(e, { withdrawnAt, clientUserId: null, touchProfile: "{}" });
      return { ...e };
    },
    async getSessionContext(sid) { const s = sessions.find(x => x.id === sid); return s ? ctx(s) : null; },
    async listSessionContexts(protocolId) {
      return sessions.map(ctx).filter(c => c.protocol.id === protocolId)
        .sort((a, b) => a.enrollment.id - b.enrollment.id || a.session.visitNumber - b.session.visitNumber);
    },
    async updateSession(sid, patch) {
      const s = sessions.find(x => x.id === sid);
      if (!s) return null;
      Object.assign(s, patch);
      return { ...s };
    },
    async markRevealed(sid, at) {
      const s = sessions.find(x => x.id === sid);
      if (!s) return null;
      if (!s.conditionRevealedAt) s.conditionRevealedAt = at;
      return { ...s };
    },
  };
  return storage;
}
