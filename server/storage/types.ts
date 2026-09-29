import type {
  User, InsertUser, SleepLog, BreathworkLog, InsertBreathwork, FastingSession,
  DigitalExposure, InsertDigitalExposure, ReadingLog, InsertReadingLog, MorningReading, InsertMorningReading,
  StillnessSession, InsertStillness, PhoneEvent, DailyStatus, InsertDailyStatus,
  Practitioner, StudyProtocol, StudyEnrollment, StudySession, ContextTag,
} from "@shared/schema";

export type SleepPatch = Partial<Pick<SleepLog,
  "hours" | "sleepScore" | "hrv" | "restingHr" | "hrvSource" | "hrvDevice" | "hrvPosture" | "hrvOffPosture"
  | "morningReadingId" | "notes">>;

export type UserSettingsPatch = Partial<Pick<User, "firstName" | "timeZone" | "defaultHrvSource" | "defaultHrvDevice" | "hrvPosture">>;

export type ProtocolInsert = Omit<StudyProtocol, "id" | "createdAt" | "lockedAt" | "completedAt"
  | "allocationList" | "allocationNonce" | "allocationSha256">;
export type ProtocolDraftPatch = Partial<Omit<ProtocolInsert, "practitionerId" | "version" | "supersedesId">>;

export interface ProtocolLock {
  lockedAt: Date;
  allocationList: string;
  allocationNonce: string;
  allocationSha256: string;
}

export type EnrollmentInsert = Omit<StudyEnrollment, "id" | "withdrawnAt">;

export type SessionPatch = Partial<Omit<StudySession, "id" | "enrollmentId" | "visitNumber" | "condition">>;

/** A study session with what the routes need to authorise and serialise it. */
export interface SessionContext {
  session: StudySession;
  enrollment: StudyEnrollment;
  protocol: StudyProtocol;
}

/** Thrown by storage when a unique constraint is violated. */
export class UniqueViolation extends Error {
  constructor(public constraint: string) {
    super(`unique violation: ${constraint}`);
  }
}

/**
 * Everything the routes need. Two implementations: Drizzle/Postgres
 * (server/storage/db.ts) and in-memory (server/storage/memory.ts, for tests).
 * Every per-user method is scoped by userId.
 */
export interface IStorage {
  ping(): Promise<void>;

  // Users
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;
  updateUserSettings(id: number, patch: UserSettingsPatch): Promise<User | null>;
  deleteUser(id: number): Promise<void>;

  // Sleep (one row per wake date)
  listSleep(userId: number, from?: string, to?: string): Promise<SleepLog[]>;   // ascending by date
  getSleep(userId: number, date: string): Promise<SleepLog | null>;
  upsertSleep(userId: number, date: string, patch: SleepPatch): Promise<SleepLog>;

  // Breathwork (KEWT)
  listBreathwork(userId: number, from?: string, to?: string): Promise<BreathworkLog[]>;
  createBreathwork(userId: number, data: InsertBreathwork): Promise<BreathworkLog>;

  // Fasting
  getActiveFast(userId: number): Promise<FastingSession | null>;
  getFastingHistory(userId: number, limit?: number): Promise<FastingSession[]>;
  startFast(userId: number, startedAt: string, goalHours: number): Promise<FastingSession>;
  endFast(userId: number, id: number, endedAt: string, notes?: string): Promise<FastingSession | null>;
  deleteFast(userId: number, id: number): Promise<boolean>;
  updateFastTimes(userId: number, id: number, startedAt?: string, endedAt?: string): Promise<FastingSession | null>;

  // Night context tags
  getNightTags(userId: number, date: string): Promise<ContextTag[]>;
  setNightTags(userId: number, date: string, tags: ContextTag[]): Promise<ContextTag[]>;

  // Morning readings
  createMorningReading(userId: number, data: InsertMorningReading): Promise<MorningReading>;

  // Stillness and reading
  createStillness(userId: number, data: InsertStillness): Promise<StillnessSession>;
  listStillness(userId: number, from?: string, to?: string): Promise<StillnessSession[]>;
  createReading(userId: number, data: InsertReadingLog): Promise<ReadingLog>;
  listReading(userId: number, from?: string, to?: string): Promise<ReadingLog[]>;

  // Digital exposure (one row per day) and phone events
  upsertExposure(userId: number, data: InsertDigitalExposure): Promise<DigitalExposure>;
  getExposure(userId: number, date: string): Promise<DigitalExposure | null>;
  listExposure(userId: number, from?: string, to?: string): Promise<DigitalExposure[]>;
  listPhoneEvents(userId: number, fromIso: string, toIso: string): Promise<PhoneEvent[]>;

  // Daily status (computed)
  upsertDailyStatus(userId: number, values: Omit<InsertDailyStatus, "id" | "userId" | "computedAt">): Promise<DailyStatus>;
  listDailyStatus(userId: number, from: string, to: string, ruleVersion: string, hrvLogScale: boolean): Promise<DailyStatus[]>;

  // Study: practitioners and protocols
  getPractitionerByUserId(userId: number): Promise<Practitioner | null>;
  getPractitioner(id: number): Promise<Practitioner | null>;
  createPractitioner(userId: number, practiceName: string | null): Promise<Practitioner>;
  createProtocol(data: ProtocolInsert): Promise<StudyProtocol>;
  getProtocol(id: number): Promise<StudyProtocol | null>;
  listProtocols(practitionerId: number): Promise<StudyProtocol[]>;
  updateDraftProtocol(id: number, patch: ProtocolDraftPatch): Promise<StudyProtocol | null>;  // null if locked
  lockProtocol(id: number, lock: ProtocolLock): Promise<StudyProtocol | null>;               // null if already locked
  completeProtocol(id: number, completedAt: Date): Promise<StudyProtocol | null>;

  // Study: enrollments and sessions
  listEnrollments(protocolId: number): Promise<StudyEnrollment[]>;
  listEnrollmentsForClient(clientUserId: number): Promise<StudyEnrollment[]>;
  getEnrollment(id: number): Promise<StudyEnrollment | null>;
  /** Inserts the enrollment and one session per visit; throws UniqueViolation on a taken row. */
  createEnrollmentWithSessions(data: EnrollmentInsert, conditions: string[]): Promise<StudyEnrollment>;
  /** Withdrawal: delete the sessions, clear the touch profile, unlink the client, keep the row. */
  withdrawEnrollment(id: number, withdrawnAt: Date): Promise<StudyEnrollment | null>;
  getSessionContext(sessionId: number): Promise<SessionContext | null>;
  listSessionContexts(protocolId: number): Promise<SessionContext[]>;
  updateSession(sessionId: number, patch: SessionPatch): Promise<StudySession | null>;
  /** Sets conditionRevealedAt only if it is still null; returns the row either way. */
  markRevealed(sessionId: number, at: Date): Promise<StudySession | null>;
}
