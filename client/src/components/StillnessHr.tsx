// Optional heart rate around a stillness session, from a Bluetooth sensor (a Garmin watch in
// Broadcast Heart Rate mode, for example). 30 seconds of "before" while you get still, then the
// timed session; the last minute is the "after". Only the summary numbers leave this component.
import { useCallback, useEffect, useRef, useState } from "react";
import { bluetoothHelp, bluetoothSupported, useHeartRateSensor } from "@/hooks/useHeartRateSensor";
import { summarizeSession, type HrSample, type SessionHr } from "@shared/heartRate";

export const PRE_ROLL_S = 30;
export interface StillnessHrResult extends SessionHr { startedAt: Date; minutes: number; device: string | null }

type Phase = "idle" | "preroll" | "running" | "done";
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const btn = "r-tile min-h-[48px] px-3.5 text-14 font-medium";

export function StillnessHr({ onResult, resetToken }: { onResult: (r: StillnessHrResult | null) => void; resetToken: number }) {
  const samples = useRef<HrSample[]>([]);
  const t0 = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<StillnessHrResult | null>(null);

  const onSample = useCallback((bpm: number) => {
    if (t0.current) samples.current.push({ t: Date.now() - t0.current, bpm });
  }, []);
  const hr = useHeartRateSensor(onSample);

  useEffect(() => { setPhase("idle"); setDone(null); setNote(null); t0.current = 0; }, [resetToken]);

  useEffect(() => {
    if (phase !== "preroll" && phase !== "running") return;
    const id = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0.current) / 1000);
      setElapsed(s);
      if (s >= PRE_ROLL_S) setPhase("running");
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  function begin() {
    samples.current = []; setNote(null); setDone(null); onResult(null);
    t0.current = Date.now(); setElapsed(0); setPhase("preroll");
  }

  function end() {
    const endMs = Date.now() - t0.current;
    const r = summarizeSession(samples.current, endMs, PRE_ROLL_S);
    t0.current = 0;
    if (r.durationS < 60) { setPhase("idle"); setNote("That was under a minute, too short to measure."); onResult(null); return; }
    if (r.startBpm == null && r.endBpm == null) { setPhase("idle"); setNote("Not enough heart rate data came through (the sensor may have dropped). Nothing is attached."); onResult(null); return; }
    const out: StillnessHrResult = { ...r, startedAt: new Date(Date.now() - r.durationS * 1000), minutes: Math.max(1, Math.round(r.durationS / 60)), device: hr.deviceName };
    setDone(out); setPhase("done"); onResult(out);
  }

  function discard() { setPhase("idle"); setDone(null); setNote(null); onResult(null); }

  if (!bluetoothSupported()) {
    return (
      <section aria-label="Heart rate" className="r-card p-4 flex flex-col gap-2">
        <span className="text-15 font-semibold">Heart rate <span className="font-normal text-13 text-muted">· optional</span></span>
        <p className="m-0 text-13 leading-[1.45] text-ink-soft">{bluetoothHelp()}</p>
      </section>
    );
  }
  const connected = hr.status === "live" || hr.status === "reconnecting";
  const timing = phase === "preroll" || phase === "running";

  return (
    <section aria-label="Heart rate" className="r-card p-4 flex flex-col gap-3">
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-15 font-semibold">Heart rate <span className="font-normal text-13 text-muted">· optional</span></span>
        {connected && <span className="font-mono text-18" aria-live="polite">{hr.status === "live" && hr.bpm != null ? `${hr.bpm} bpm` : "--"}</span>}
      </div>

      {!connected && !timing && phase !== "done" && (
        <>
          <p className="m-0 text-13 leading-[1.45] text-ink-soft">
            Connect a Bluetooth sensor, such as a Garmin watch in Broadcast Heart Rate mode, to record your heart rate at the start and end of a session.
          </p>
          <button type="button" className={btn} onClick={hr.status === "lost" ? hr.reconnect : hr.connect} disabled={hr.status === "connecting"}>
            {hr.status === "connecting" ? "Connecting…" : hr.status === "lost" ? "Reconnect" : "Connect sensor"}
          </button>
          {hr.error && <p role="alert" className="m-0 text-13 text-exposure">{hr.error}</p>}
        </>
      )}

      {connected && phase === "idle" && (
        <>
          <p className="m-0 text-13 text-ink-soft">{hr.status === "reconnecting" ? `Reconnecting to ${hr.deviceName}…` : `Connected to ${hr.deviceName}.`} Get comfortable, then begin. The first 30 seconds are your starting value.</p>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={begin} disabled={hr.status !== "live"}>Begin timed session</button>
            <button type="button" className="r-link min-h-[48px] px-2 bg-transparent border-0" onClick={hr.disconnect}>Disconnect</button>
          </div>
        </>
      )}

      {timing && (
        <>
          <div className="flex justify-between items-baseline">
            <span className="text-14 font-medium">{phase === "preroll" ? "Settling in…" : "In session"}</span>
            <span className="font-mono text-18">{phase === "preroll" ? `0:${String(Math.max(0, PRE_ROLL_S - elapsed)).padStart(2, "0")}` : clock(Math.max(0, elapsed - PRE_ROLL_S))}</span>
          </div>
          {hr.status === "reconnecting" && <p className="m-0 text-13 text-ink-soft">Reconnecting to the sensor. The session keeps running.</p>}
          {hr.status === "lost" && <p className="m-0 text-13 text-exposure">The sensor was lost. You can still end the session; any heart rate gap is left out.</p>}
          <button type="button" className={btn} onClick={end}>End session</button>
        </>
      )}

      {phase === "done" && done && (
        <>
          <p className="m-0 text-14">
            Start <span className="font-mono">{done.startBpm != null ? Math.round(done.startBpm) : "?"}</span> →
            end <span className="font-mono">{done.endBpm != null ? Math.round(done.endBpm) : "?"}</span> bpm over {done.minutes} min.
          </p>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">The duration is filled in below. Pick what it was and where your phone was, then save. These numbers are saved with the session.</p>
          <button type="button" className="r-link self-start min-h-[44px] bg-transparent border-0 p-0" onClick={discard}>Discard heart rate</button>
        </>
      )}

      {note && <p className="m-0 text-13 text-ink-soft">{note}</p>}
    </section>
  );
}
