// Assembles one morning's Brief from raw rows. Pure: the route loads the
// rows, calls computeBrief, and stores `dailyStatus` (with RULE_VERSION and
// the HRV_LOG_SCALE value used).
import type { ContextTag } from "@shared/schema";
import type { NightInput } from "./baseline";
import { briefMessages, type BriefMessages } from "./messages";
import { type ExposureDay, outNightsFollowedHighExposure, patternCallout, type PatternCallout } from "./pattern";
import { computeStatus, longGame, type LongGame, type PriorLabel, type Status } from "./status";
import { RULE_VERSION } from "./version";

export interface BriefInput {
  date: string;
  nights: readonly NightInput[];
  priorLabels: readonly PriorLabel[];
  tags: readonly ContextTag[];          // tags on last night
  exposure: readonly ExposureDay[];
  hrvLogScale: boolean;
}

/** The daily_status row (minus id, userId and computedAt). */
export interface DailyStatusValues {
  date: string;
  ruleVersion: string;
  hrvLogScale: boolean;
  hrvSourceUsed: string;
  hrvBaselineMean: number | null;
  hrvBaselineSd: number | null;
  rhrBaselineMean: number | null;
  rhrBaselineSd: number | null;
  hrvRangeLow: number | null;
  hrvRangeHigh: number | null;
  rhrRangeLow: number | null;
  rhrRangeHigh: number | null;
  hrv7Avg: number | null;
  rhr7Avg: number | null;
  weekNights: number;
  baselineNights: number;
  weekLabel: Status["weekLabel"];
  nightState: Status["nightState"];
  consecutiveNightsOut: number;
  escalationLevel: number;
  nightsInRangeLast30: number;
  nightsLoggedLast30: number;
}

export interface BriefResult {
  status: Status;
  messages: BriefMessages;
  pattern: PatternCallout;
  longGame: LongGame | null;
  dailyStatus: DailyStatusValues;
}

export function computeBrief(input: BriefInput): BriefResult {
  const { date, nights, priorLabels, tags, exposure, hrvLogScale } = input;
  const status = computeStatus({ date, nights, priorLabels, hrvLogScale });
  const { baseline: b, lastNight } = status;

  const hrvOut = !!lastNight && !!b.hrv && lastNight.hrv! < b.hrv.low;
  const messages = briefMessages(status, tags, {
    hrvOut,
    followedHighExposure: outNightsFollowedHighExposure(exposure, date, status.consecutiveNightsOut),
  });

  const sourceNight = lastNight ?? b.week[b.week.length - 1] ?? b.base[b.base.length - 1] ?? null;

  return {
    status,
    messages,
    pattern: patternCallout(exposure, nights, date, hrvLogScale),
    longGame: longGame(nights, date, hrvLogScale),
    dailyStatus: {
      date,
      ruleVersion: RULE_VERSION,
      hrvLogScale,
      hrvSourceUsed: sourceNight?.hrvSource ?? "device_manual",
      hrvBaselineMean: b.hrv?.mean ?? null,
      hrvBaselineSd: b.hrv?.sd ?? null,
      rhrBaselineMean: b.rhr?.mean ?? null,
      rhrBaselineSd: b.rhr?.sd ?? null,
      hrvRangeLow: b.hrv?.low ?? null,
      hrvRangeHigh: b.hrv?.high ?? null,
      rhrRangeLow: b.rhr?.low ?? null,
      rhrRangeHigh: b.rhr?.high ?? null,
      hrv7Avg: status.hrv7Avg,
      rhr7Avg: status.rhr7Avg,
      weekNights: status.weekNights,
      baselineNights: b.base.length,
      weekLabel: status.weekLabel,
      nightState: status.nightState,
      consecutiveNightsOut: status.consecutiveNightsOut,
      escalationLevel: status.escalationLevel,
      nightsInRangeLast30: status.consistency.inRange,
      nightsLoggedLast30: status.consistency.logged,
    },
  };
}
