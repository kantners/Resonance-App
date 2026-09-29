// Role-based concealment for the Session Study (HANDOFF §4.3, amendment A4).
// Every study response passes through one of these allow-list serializers;
// nothing returns a raw row. Fields are picked, never deleted, so a new
// column can't leak by default.
import type { StudyEnrollment, StudyProtocol, StudySession } from "@shared/schema";

const pick = <T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> =>
  Object.fromEntries(keys.map(k => [k, o[k]])) as Pick<T, K>;

const SESSION_COMMON = [
  "id", "enrollmentId", "visitNumber", "conditionRevealedAt",
  "preTakenAt", "prePosture", "preReadingDevice",
  "postTakenAt", "postPosture", "postReadingDevice",
  "completedAt",
] as const satisfies readonly (keyof StudySession)[];

/** Outcome values: readings and the client's relaxation ratings. */
const SESSION_VALUES = [
  "preRmssdMs", "preHrBpm", "preBreathsPerMin",
  "postRmssdMs", "postHrBpm", "postBreathsPerMin",
  "relaxPre", "relaxPost",
] as const satisfies readonly (keyof StudySession)[];

const SESSION_PRACTITIONER_ONLY = [
  "intentionHeldRating", "driftCount", "checklist", "deviations", "stonesNotes", "clientReport", "closingReikiGiven",
] as const satisfies readonly (keyof StudySession)[];

/**
 * Practitioner view: the condition only once /start has revealed it (after
 * the pre-reading), or once the protocol is complete. Never the sequence.
 * The client's guess is shown only after the session is complete, so it
 * can't colour the rest of the session.
 *
 * Outcome-blind (Mark, Sep 29): until the protocol is complete the
 * practitioner sees only that each reading was recorded (time and device via
 * SESSION_COMMON), never its values or the relaxation ratings.
 */
export function toPractitionerSession(s: StudySession, protocol: StudyProtocol, clientCode: string) {
  const revealed = s.conditionRevealedAt != null || protocol.completedAt != null;
  const complete = protocol.completedAt != null;
  return {
    ...pick(s, SESSION_COMMON),
    ...pick(s, SESSION_PRACTITIONER_ONLY),
    clientCode,
    preRecorded: s.preTakenAt != null,
    postRecorded: s.postTakenAt != null,
    valuesLocked: !complete,
    ...(complete ? pick(s, SESSION_VALUES) : {}),
    ...(revealed ? { condition: s.condition } : {}),
    ...(s.completedAt != null || protocol.completedAt != null ? { clientGuess: s.clientGuess } : {}),
  };
}

/** Client view: never the condition or anything derived from it, until the protocol is complete. */
export function toClientSession(s: StudySession, protocol: StudyProtocol) {
  const base = { ...pick(s, SESSION_COMMON), ...pick(s, SESSION_VALUES), clientGuess: s.clientGuess };
  // conditionRevealedAt tells the client when the practitioner looked; harmless, but drop it anyway.
  const { conditionRevealedAt: _hidden, ...rest } = base;
  return protocol.completedAt != null ? { ...rest, condition: s.condition } : rest;
}

const PROTOCOL_PUBLIC = [
  "id", "practitionerId", "version", "supersedesId", "question", "primaryOutcome", "primaryContrast",
  "secondaryContrast", "conditions", "design", "targetClients", "minDaysBetween", "withholdingProcedure",
  "commitmentText", "closingReikiForAll", "consentVersion", "analysisScale", "readingDevice",
  "allocationSha256", "lockedAt", "completedAt", "createdAt",
] as const satisfies readonly (keyof StudyProtocol)[];

/** Practitioner view: the hash always; the list and nonce only after completion. */
export function toPractitionerProtocol(p: StudyProtocol) {
  return {
    ...pick(p, PROTOCOL_PUBLIC),
    conditions: JSON.parse(p.conditions),
    ...(p.completedAt != null ? { allocationList: JSON.parse(p.allocationList ?? "[]"), allocationNonce: p.allocationNonce } : {}),
  };
}

/** What a prospective client sees on the consent screen. */
export function toInviteProtocol(p: StudyProtocol, practitionerDisplayCode: string, practiceName: string | null) {
  const arms = JSON.parse(p.conditions) as { code: string; label: string; touch: boolean }[];
  return {
    id: p.id,
    version: p.version,
    question: p.question,
    consentVersion: p.consentVersion,
    minDaysBetween: p.minDaysBetween,
    visits: arms.length,
    arms: arms.map(a => ({ label: a.label, touch: a.touch })),   // order here is not the client's order
    practitioner: practitionerDisplayCode,
    practiceName,
    open: p.lockedAt != null && p.completedAt == null,
  };
}

/** A client's own enrollment: no sequence, no block, no allocation index. */
export function toClientEnrollment(e: StudyEnrollment) {
  return pick(e, ["id", "protocolId", "clientCode", "consentVersion", "consentedAt", "withdrawnAt", "touchProfile"] as const);
}

/** Practitioner's list of enrollments: codes only, never client identity or sequence. */
export function toPractitionerEnrollment(e: StudyEnrollment) {
  return pick(e, ["id", "clientCode", "consentVersion", "consentedAt", "withdrawnAt", "touchProfile"] as const);
}
