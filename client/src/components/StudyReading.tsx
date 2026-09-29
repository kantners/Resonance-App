import type { PractitionerSessionDto } from "@shared/api";
import { fmt0, fmt1 } from "@/lib/format";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * One study reading on a practitioner view (Session screen, session list).
 * The practitioner is outcome-blind until the protocol is complete: the
 * reading shows as "Recorded ✓" with its time and device, never its values.
 */
export function StudyReading({ session, which }: { session: PractitionerSessionDto; which: "pre" | "post" }) {
  const recorded = which === "pre" ? session.preRecorded : session.postRecorded;
  const takenAt = which === "pre" ? session.preTakenAt : session.postTakenAt;
  const device = which === "pre" ? session.preReadingDevice : session.postReadingDevice;
  if (!recorded || !takenAt) return <span className="font-mono text-13 text-muted">Not yet recorded</span>;

  const meta = [timeOf(takenAt), device].filter(Boolean).join(" · ");
  if (session.valuesLocked) {
    return (
      <span className="font-mono text-13">
        Recorded ✓ <span className="text-muted">· {meta}</span>
      </span>
    );
  }
  const rmssd = which === "pre" ? session.preRmssdMs : session.postRmssdMs;
  const hr = which === "pre" ? session.preHrBpm : session.postHrBpm;
  return (
    <span className="font-mono text-13">
      {fmt1(rmssd)} ms · {fmt0(hr)} bpm <span className="text-muted">· {meta}</span>
    </span>
  );
}
