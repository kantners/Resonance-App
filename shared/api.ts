// Response shapes shared by the server routes and the client screens.
// The server annotates its responses with these types, so a change on
// either side fails `npm run check`.
import type { ContextTag } from "./schema";

export type Posture = "seated" | "face_up" | "face_down";
export type WeekLabel = "building_baseline" | "steady" | "drifting_down" | "recovering";
export type NightState = "in_range" | "one_out" | "both_out";

export interface RangeDto { mean: number; sd: number; low: number; high: number }
export interface MessageDto { title: string; body: string }

export interface LongGameDto {
  sinceDate: string;
  hrv: { then: number; now: number; direction: "up" | "down" | "holding_steady" };
  rhr: { then: number; now: number; direction: "up" | "down" | "holding_steady" } | null;
}

export interface PatternDto {
  triggered: boolean;
  yesterdayMin: number | null;
  averageMin: number | null;
  hrvDiffFromBaselineMs: number | null;
  seenAfter: number;
  highExposureDays: number;
  caveat: string;
}

export interface BriefResponse {
  date: string;
  ruleVersion: string;
  hrvLogScale: boolean;
  isDemo: boolean;
  firstRun: {
    nightsLogged: number;
    baselineNights: number;
    baselineNeeded: number;
    hrvDevice: string | null;
    hrvPosture: Posture | null;
    timeZone: string | null;
  };
  week: {
    label: WeekLabel;
    nights: number;                 // B7: the label is never shown without this
    hrv7Avg: number | null;
    rhr7Avg: number | null;
    hrvRange: RangeDto | null;
    rhrRange: RangeDto | null;
    hrvStrained: boolean;
    rhrStrained: boolean;
    bars: { date: string; hrv: number | null; rhr: number | null; state: NightState | null }[];
    message: MessageDto | null;
  };
  lastNight: {
    date: string;
    hrv: number | null;
    rhr: number | null;
    sleepScore: number | null;
    hours: number | null;
    hrvDevice: string | null;
    hrvPosture: Posture | null;
    /** The reading was off the set posture: shown with a note, not judged or averaged. */
    offPosture: boolean;
    state: NightState | "no_data";
    consecutiveOut: number;
    tags: ContextTag[];
    message: MessageDto | null;
  };
  escalationLevel: number;
  consistency: { inRange: number; logged: number };
  longGame: LongGameDto | null;
  yesterday: {
    date: string;
    exposure: {
      totalMin: number;
      pickups: number | null;
      notifications: number | null;
      pickupsAfter21: number | null;
      longestQuietMin: number | null;
      quietSource: string | null;
      source: string;
    } | null;
    stillnessMin: number;
  };
  pattern: PatternDto;
}

export interface MeResponse {
  id: number;
  email: string;
  firstName: string | null;
  isDemo: boolean;
  timeZone: string | null;
  defaultHrvSource: string | null;
  defaultHrvDevice: string | null;
  hrvPosture: Posture | null;
  isPractitioner: boolean;
}

export interface ContrastDto {
  contrast: string;
  exploratory: boolean;
  pairs: number[];
  ci: { n: number; mean: number; sd: number | null; low: number | null; high: number | null } | null;
  rose: number; unchanged: number; fell: number;
  /** "results_locked" only while running; a completed study never says "too early to tell". */
  verdict: "results_locked" | "no_difference" | "observed_positive" | "observed_negative";
  verdictText: string;
}

export interface StudyResultsDto {
  protocolId: number;
  version: number;
  analysisScale: "linear" | "ln";
  readingDevice: string | null;
  allocationSha256: string | null;
  ruleVersion: string;
  isDemo: boolean;
  progress: { clientsEnrolled: number; clientsComplete: number; targetClients: number; sessionsComplete: number; targetSessions: number };
  /** True until the protocol is complete: no contrasts, deltas or verdicts are sent (no interim peeking). */
  resultsLocked: boolean;
  primary: ContrastDto | null;
  secondary: ContrastDto | null;
  exploratory: ContrastDto[];
  quality: {
    blinding: { correct: number; guesses: number; chance: number };
    meanIntentionHeld: number | null;
    totalDrift: number;
    sessionsWithDeviations: number;
    totalSessions: number;
    deviceMismatches: { sessionId: number; clientCode: string; preReadingDevice: string | null; postReadingDevice: string | null }[];
  };
  perPractitionerVisible: boolean;
  clientDeltas: { clientCode: string; deltas: Record<string, number> }[];
}

/**
 * A session as the practitioner sees it. Outcome-blind until the protocol is
 * complete: `valuesLocked` is true and the reading values and relaxation
 * ratings are absent; only `pre/postRecorded` with time and device are sent.
 */
export interface PractitionerSessionDto {
  id: number;
  enrollmentId: number;
  clientCode: string;
  visitNumber: number;
  conditionRevealedAt: string | null;
  condition?: string;
  preRecorded: boolean;
  preTakenAt: string | null;
  prePosture: string | null;
  preReadingDevice: string | null;
  postRecorded: boolean;
  postTakenAt: string | null;
  postPosture: string | null;
  postReadingDevice: string | null;
  valuesLocked: boolean;
  preRmssdMs?: number | null; preHrBpm?: number | null; preBreathsPerMin?: number | null;
  postRmssdMs?: number | null; postHrBpm?: number | null; postBreathsPerMin?: number | null;
  relaxPre?: number | null; relaxPost?: number | null;
  clientGuess?: string | null;
  completedAt: string | null;
}

export interface StudyArmDto { code: string; label: string; touch: boolean; intention: boolean; breathPacing: boolean; optional?: boolean }

export interface ProtocolDto {
  id: number;
  version: number;
  question: string;
  primaryOutcome: string;
  primaryContrast: string;
  secondaryContrast: string | null;
  conditions: StudyArmDto[];
  targetClients: number;
  minDaysBetween: number | null;
  withholdingProcedure: string;
  commitmentText: string;
  closingReikiForAll: boolean;
  consentVersion: string;
  analysisScale: "linear" | "ln";
  readingDevice: string | null;
  allocationSha256: string | null;
  lockedAt: string | null;
  completedAt: string | null;
}
