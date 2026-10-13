// Clock times <-> ISO instants for the sleep window. The row is keyed by WAKE date D:
// wake = D at HH:MM local; fell asleep = D at HH:MM, or D-1 when that is not before wake.
import { addDays } from "@/lib/dates";

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isClock = (v: string) => CLOCK.test(v);

function at(date: string, clock: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = clock.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function windowToInstants(wakeDate: string, bed: string, wake: string): { sleepOnset: string | null; wakeTime: string | null } {
  const w = isClock(wake) ? at(wakeDate, wake) : null;
  let o = isClock(bed) ? at(wakeDate, bed) : null;
  if (o && w && o >= w) o = at(addDays(wakeDate, -1), bed);
  if (o && !w && o.getHours() >= 12) o = at(addDays(wakeDate, -1), bed); // evening bedtime with no wake time
  return { sleepOnset: o ? o.toISOString() : null, wakeTime: w ? w.toISOString() : null };
}

export function instantToClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
