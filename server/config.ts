// Startup configuration parsed from the environment. Pure: callers pass the
// environment in, so the defaults are testable without touching process.env.

export interface RegistrationPolicy {
  open: boolean;           // anyone can register
  allowlist: string[];     // lower-cased emails that may register while closed
}

const TRUE = ["true", "1", "yes", "on"];
const FALSE = ["false", "0", "no", "off"];

/**
 * REGISTRATION_OPEN defaults to closed in production and open elsewhere; only
 * an explicit true/false value overrides that. REGISTRATION_ALLOWLIST is a
 * comma-separated list of emails that may register while it's closed.
 */
export function parseRegistration(env: Record<string, string | undefined>, isProduction: boolean): RegistrationPolicy {
  const raw = env.REGISTRATION_OPEN?.trim().toLowerCase();
  const open = raw && TRUE.includes(raw) ? true : raw && FALSE.includes(raw) ? false : !isProduction;
  const allowlist = (env.REGISTRATION_ALLOWLIST ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return { open, allowlist };
}

export function mayRegister(policy: RegistrationPolicy | undefined, email: string): boolean {
  if (!policy || policy.open) return true;
  return policy.allowlist.includes(email.trim().toLowerCase());
}
