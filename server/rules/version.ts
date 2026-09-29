// The rule version recorded with every computed value (HANDOFF §3).
// Bump it whenever any rule in server/rules changes what it outputs.
export const RULE_VERSION = "2026.09-r3";

/**
 * Parses the HRV_LOG_SCALE flag. Default on (HANDOFF §8.1); only an explicit
 * "false"/"0"/"off"/"no" turns it off. The rules never read the environment
 * themselves: callers pass the parsed value in, so every function stays pure
 * and the value used is stored next to RULE_VERSION (amendment B5).
 */
export function parseHrvLogScale(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  return !["false", "0", "off", "no"].includes(raw.trim().toLowerCase());
}
