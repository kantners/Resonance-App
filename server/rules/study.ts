// Session Study rules (HANDOFF §4, §9.1; amendments A1–A3). Pure functions:
// randomness is injected, nothing touches the database or the environment.
import { createHash } from "node:crypto";
import type { AnalysisScale } from "@shared/schema";
import { meanCI95, type MeanCI } from "./stats";

// ─── Allocation (A1: the whole list is generated once, at protocol lock) ─────

/** Returns a uniformly random integer in [0, n). Production uses crypto.randomInt. */
export type Rng = (n: number) => number;

export interface AllocationRow {
  index: number;          // 0-based position; enrollment takes the lowest unused index
  block: number;          // 0-based block number
  sequence: string[];     // condition codes in visit order
}

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));
}

// Williams design for 4 treatments: each ordered pair appears exactly once as
// consecutive visits, balancing first-order carryover.
const WILLIAMS_4 = [[0, 1, 3, 2], [1, 2, 0, 3], [2, 3, 1, 0], [3, 0, 2, 1]];

/**
 * The orderings that make up one block:
 *   2 arms → AB, BA; 3 arms → all 6 orderings; 4 arms → a balanced Latin square.
 */
export function blockSequences(codes: readonly string[]): string[][] {
  if (codes.length === 2 || codes.length === 3) return permutations(codes);
  if (codes.length === 4) return WILLIAMS_4.map(row => row.map(i => codes[i]));
  throw new Error(`a study needs 2 to 4 arms, got ${codes.length}`);
}

function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error("rng out of range");
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffled blocks covering `targetClients`, rounded up to whole blocks. */
export function buildAllocationList(codes: readonly string[], targetClients: number, rng: Rng): AllocationRow[] {
  if (!Number.isInteger(targetClients) || targetClients < 1) throw new Error("targetClients must be a positive integer");
  const perBlock = blockSequences(codes);
  const blocks = Math.ceil(targetClients / perBlock.length);
  const rows: AllocationRow[] = [];
  for (let b = 0; b < blocks; b++) {
    for (const sequence of shuffle(perBlock, rng)) {
      rows.push({ index: rows.length, block: b, sequence });
    }
  }
  return rows;
}

/** JSON with object keys sorted at every level, so the hash is reproducible. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().filter(k => obj[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * SHA-256 over the canonical {nonce, list}. The nonce stops anyone from
 * recovering the order by brute force before the study completes; publishing
 * the nonce and list afterwards lets anyone check the hash.
 */
export function allocationHash(nonce: string, list: readonly AllocationRow[]): string {
  return createHash("sha256").update(canonicalJson({ nonce, list })).digest("hex");
}

export function verifyAllocation(nonce: string, list: readonly AllocationRow[], expectedHash: string): boolean {
  return allocationHash(nonce, list) === expectedHash;
}

/** The next unused row, or null when the list is used up (the route returns 409). */
export function nextAllocationRow(list: readonly AllocationRow[], usedIndexes: ReadonlySet<number>): AllocationRow | null {
  return list.find(r => !usedIndexes.has(r.index)) ?? null;
}

// ─── Analysis (§4.5; the scale comes from the locked protocol, A2) ───────────

export interface SessionRecord {
  id: number;
  enrollmentId: number;
  clientCode: string;
  practitionerId: number;
  condition: string;
  preRmssdMs: number | null;
  postRmssdMs: number | null;
  preReadingDevice: string | null;
  postReadingDevice: string | null;
  clientGuess: string | null;        // an arm code or "not_sure"
  intentionHeldRating: number | null;
  driftCount: number;
  deviations: string | null;
  withdrawn: boolean;                // withdrawn clients are excluded from analysis
}

/** delta = post − pre, on the ln scale when the protocol says so. */
export function sessionDelta(s: Pick<SessionRecord, "preRmssdMs" | "postRmssdMs">, scale: AnalysisScale): number | null {
  const { preRmssdMs: pre, postRmssdMs: post } = s;
  if (pre == null || post == null || pre <= 0 || post <= 0) return null;
  return scale === "ln" ? Math.log(post) - Math.log(pre) : post - pre;
}

export interface Contrast {
  contrast: string;                  // "A-B"
  exploratory: boolean;              // involves an optional arm (e.g. the factorial's rest arm)
  pairs: number[];                   // d_i per client
  ci: MeanCI | null;                 // null when no client has both conditions
  rose: number; unchanged: number; fell: number;
  verdict: StudyVerdict;
  verdictText: string;
}

/**
 * The verdict depends on the study's status (Mark, Sep 29):
 *   running → results locked (no interim peeking);
 *   completed, likely range includes zero → no measurable difference;
 *   completed, likely range excludes zero → the observed direction and size.
 * A completed study never says "too early to tell".
 */
export type StudyVerdict = "results_locked" | "no_difference" | "observed_positive" | "observed_negative";

export const RESULTS_LOCKED_TEXT = "Results unlock when the study is complete (prevents interim peeking).";
export const NO_DIFFERENCE_TEXT = "No measurable difference in this study: the likely range includes zero.";
/** Fewer than 2 clients with both conditions: no range can be estimated, so nothing was measured. */
export const NO_RANGE_TEXT = "No measurable difference in this study: fewer than 2 clients had both conditions, so there is no likely range.";

/** Size without sign: "2.1 ms" or "5.2%". */
function formatSize(x: number, scale: AnalysisScale): string {
  return scale === "ln" ? `${Math.abs((Math.exp(x) - 1) * 100).toFixed(1)}%` : `${Math.abs(x).toFixed(1)} ms`;
}

export function studyVerdict(
  ci: MeanCI | null, scale: AnalysisScale, completed: boolean, exploratory = false,
): { verdict: StudyVerdict; verdictText: string } {
  if (!completed) return { verdict: "results_locked", verdictText: RESULTS_LOCKED_TEXT };
  const prefix = exploratory ? "Exploratory. " : "";
  if (!ci || ci.low === null || ci.high === null) return { verdict: "no_difference", verdictText: prefix + NO_RANGE_TEXT };
  if (ci.low <= 0 && ci.high >= 0) return { verdict: "no_difference", verdictText: prefix + NO_DIFFERENCE_TEXT };
  const up = ci.mean > 0;
  return {
    verdict: up ? "observed_positive" : "observed_negative",
    verdictText: `${prefix}Observed in our sessions: ${up ? "an increase" : "a decrease"} of ${formatSize(ci.mean, scale)} `
      + `(likely range ${formatEffect(ci.low, scale)} to ${formatEffect(ci.high, scale)}).`,
  };
}

/** "A-B" → ["A", "B"] */
export function parseContrast(c: string): [string, string] {
  const m = /^([A-D])-([A-D])$/.exec(c);
  if (!m || m[1] === m[2]) throw new Error(`invalid contrast "${c}"`);
  return [m[1], m[2]];
}

export function formatEffect(x: number, scale: AnalysisScale): string {
  if (scale === "ln") {
    const pct = (Math.exp(x) - 1) * 100;
    return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
  }
  return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)} ms`;
}

/**
 * Within-client paired contrast: for each client with both conditions,
 * d_i = delta_x − delta_y. Mean, 95% CI from t (df = n − 1), n.
 * The verdict follows the study's status (see studyVerdict).
 */
export function pairedContrast(
  sessions: readonly SessionRecord[], contrast: string, scale: AnalysisScale, completed: boolean, exploratory = false,
): Contrast {
  const [x, y] = parseContrast(contrast);
  const byClient = new Map<number, { x?: number; y?: number }>();
  for (const s of sessions) {
    if (s.withdrawn || (s.condition !== x && s.condition !== y)) continue;
    const d = sessionDelta(s, scale);
    if (d == null) continue;
    const entry = byClient.get(s.enrollmentId) ?? {};
    if (s.condition === x) entry.x = d; else entry.y = d;
    byClient.set(s.enrollmentId, entry);
  }
  const pairs = [...byClient.values()]
    .filter(e => e.x !== undefined && e.y !== undefined)
    .map(e => e.x! - e.y!);
  return contrastFromPairs(contrast, pairs, scale, completed, exploratory);
}

// ─── Verdict lines: one per contrast; the headline is the primary's ─────────

export const PRIMARY_LABEL = "Primary (headline)";
/** So the secondary can't be read as the main finding (Mark, Sep 29). */
export const SECONDARY_LABEL = "Secondary (exploratory for the headline)";
export const EXPLORATORY_LABEL = "Exploratory";

export interface VerdictLine {
  role: "primary" | "secondary" | "exploratory";
  label: string;
  contrast: string;
  verdict: StudyVerdict;
  verdictText: string;
}

export interface Verdicts {
  headline: VerdictLine;   // always the primary contrast, whatever the others show
  lines: VerdictLine[];    // primary, then secondary, then exploratory contrasts
}

export function verdictLines(primary: Contrast, secondary: Contrast | null, exploratory: readonly Contrast[] = []): Verdicts {
  const line = (role: VerdictLine["role"], label: string, c: Contrast): VerdictLine =>
    ({ role, label, contrast: c.contrast, verdict: c.verdict, verdictText: c.verdictText });
  const headline = line("primary", PRIMARY_LABEL, primary);
  return {
    headline,
    lines: [
      headline,
      ...(secondary ? [line("secondary", SECONDARY_LABEL, secondary)] : []),
      ...exploratory.map(c => line("exploratory", EXPLORATORY_LABEL, c)),
    ],
  };
}

/** A contrast is exploratory when it involves an optional arm. */
export function isExploratoryContrast(contrast: string, optionalCodes: ReadonlySet<string>): boolean {
  const [x, y] = parseContrast(contrast);
  return optionalCodes.has(x) || optionalCodes.has(y);
}

export function contrastFromPairs(
  contrast: string, pairs: number[], scale: AnalysisScale, completed: boolean, exploratory = false,
): Contrast {
  const ci = pairs.length ? meanCI95(pairs) : null;
  const eps = 1e-9;
  const rose = pairs.filter(d => d > eps).length;
  const fell = pairs.filter(d => d < -eps).length;
  return {
    contrast, exploratory, pairs, ci, rose, unchanged: pairs.length - rose - fell, fell,
    ...studyVerdict(ci, scale, completed, exploratory),
  };
}

export interface DeviceMismatch {
  sessionId: number;
  clientCode: string;
  preReadingDevice: string | null;
  postReadingDevice: string | null;
}

export interface QualityPanel {
  blinding: { correct: number; guesses: number; chance: number };
  meanIntentionHeld: number | null;
  totalDrift: number;
  sessionsWithDeviations: number;
  totalSessions: number;
  deviceMismatches: DeviceMismatch[];   // A3: flagged, still analysed
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

export function qualityPanel(
  sessions: readonly SessionRecord[], primaryContrast: string, protocolReadingDevice: string | null,
): QualityPanel {
  const [x, y] = parseContrast(primaryContrast);
  const active = sessions.filter(s => !s.withdrawn);
  const guessed = active.filter(s => (s.condition === x || s.condition === y) && s.clientGuess != null);
  const ratings = active.map(s => s.intentionHeldRating).filter((r): r is number => r != null);
  const deviceMismatches = protocolReadingDevice == null ? [] : active
    .filter(s => (s.preReadingDevice != null && norm(s.preReadingDevice) !== norm(protocolReadingDevice))
      || (s.postReadingDevice != null && norm(s.postReadingDevice) !== norm(protocolReadingDevice)))
    .map(s => ({ sessionId: s.id, clientCode: s.clientCode, preReadingDevice: s.preReadingDevice, postReadingDevice: s.postReadingDevice }));
  return {
    blinding: {
      correct: guessed.filter(s => s.clientGuess === s.condition).length,
      guesses: guessed.length,
      chance: 0.5,
    },
    meanIntentionHeld: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    totalDrift: active.reduce((a, s) => a + (s.driftCount ?? 0), 0),
    sessionsWithDeviations: active.filter(s => (s.deviations ?? "").trim() !== "").length,
    totalSessions: active.length,
    deviceMismatches,
  };
}

export const PER_PRACTITIONER_MIN_SESSIONS = 10;

/** Per-practitioner results stay hidden until each has ≥ 10 sessions in each compared condition. */
export function practitionerResultsVisible(sessions: readonly SessionRecord[], contrast: string): boolean {
  const [x, y] = parseContrast(contrast);
  const counts = new Map<number, { x: number; y: number }>();
  for (const s of sessions) {
    if (s.withdrawn) continue;
    const c = counts.get(s.practitionerId) ?? { x: 0, y: 0 };
    if (s.condition === x) c.x++;
    if (s.condition === y) c.y++;
    counts.set(s.practitionerId, c);
  }
  if (counts.size === 0) return false;
  return [...counts.values()].every(c => c.x >= PER_PRACTITIONER_MIN_SESSIONS && c.y >= PER_PRACTITIONER_MIN_SESSIONS);
}
