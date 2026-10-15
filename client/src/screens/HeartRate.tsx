// Spot heart rate from a Bluetooth sensor, such as a Garmin watch in Broadcast Heart Rate mode.
// A watch sends BPM only, so there is no HRV here. A calm capture can be saved to its own series
// (never mixed into the Resting HR from sleep, which is the watch's overnight figure). The
// beat-by-beat stream stays on this device; only the summary numbers are sent when you tap Save.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpotHrReading } from "@shared/schema";
import { SubScreen } from "@/components/Layout";
import { FormError, PrimaryButton } from "@/components/Fields";
import { errorText, useMe, useSave } from "@/lib/api";
import { addDays, fmtMonthDay, localIsoNow, localToday } from "@/lib/dates";
import { apiRequest } from "@/lib/queryClient";
import { bluetoothSupported, useHeartRateSensor } from "@/hooks/useHeartRateSensor";
import { summarizeCapture, type CaptureSummary, type HrSample } from "@shared/heartRate";

const CAPTURE_S = 300;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export default function HeartRateScreen() {
  const { data: me } = useMe();
  const today = localToday();
  const listKey = `/api/spot-hr?from=${addDays(today, -59)}&to=${today}`;
  const { data: saved } = useQuery<SpotHrReading[]>({ queryKey: [listKey] });
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/spot-hr/${id}`), onSuccess: () => qc.invalidateQueries() });
  const save = useSave<Record<string, unknown>>("POST", "/api/spot-hr");

  const samples = useRef<HrSample[]>([]);
  const startedAt = useRef(0);
  const [capturing, setCapturing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CaptureSummary | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const onSample = useCallback((bpm: number) => {
    if (startedAt.current) samples.current.push({ t: Date.now() - startedAt.current, bpm });
  }, []);
  const hr = useHeartRateSensor(onSample);

  const finish = useCallback(() => {
    startedAt.current = 0; setCapturing(false);
    setResult(summarizeCapture(samples.current));
  }, []);

  function start() {
    samples.current = []; setResult(null); setIsSaved(false); setElapsed(0);
    startedAt.current = Date.now(); setCapturing(true);
  }

  useEffect(() => {
    if (!capturing) return;
    const id = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= CAPTURE_S) finish();
    }, 500);
    return () => window.clearInterval(id);
  }, [capturing, finish]);

  // The capture rides out short drops (the sensor reconnects by itself). It ends only when the
  // reconnect attempts have all failed, keeping whatever was collected.
  useEffect(() => { if (capturing && hr.status === "lost") finish(); }, [capturing, hr.status, finish]);

  async function saveResult() {
    if (!result || (result.lowestSteadyBpm == null && result.meanBpm == null)) return;
    await save.mutateAsync({
      date: today, takenAt: localIsoNow(), kind: "calm",
      lowestSteadyBpm: result.lowestSteadyBpm, meanBpm: result.meanBpm,
      durationS: Math.max(1, result.durationS), sampleCount: Math.max(1, result.count), device: hr.deviceName,
    });
    setIsSaved(true);
  }

  const { baseline, calmN, stillDelta, stillN } = useMemo(() => {
    const calm = (saved ?? []).filter(r => r.kind === "calm" && r.lowestSteadyBpm != null).map(r => r.lowestSteadyBpm as number);
    const still = (saved ?? []).filter(r => r.kind === "stillness" && r.startBpm != null && r.endBpm != null).map(r => (r.endBpm as number) - (r.startBpm as number));
    return {
      calmN: calm.length, baseline: calm.length >= 3 ? median(calm) : null,
      stillN: still.length, stillDelta: still.length >= 3 ? still.reduce((a, b) => a + b, 0) / still.length : null,
    };
  }, [saved]);

  const live = hr.status === "live";
  const reconnecting = hr.status === "reconnecting";
  const connected = live || reconnecting;
  const unsupported = !bluetoothSupported();
  const canSave = !!result && (result.lowestSteadyBpm != null || result.meanBpm != null);

  return (
    <SubScreen back={{ href: "/log", label: "Log" }} title="Heart rate" meta="LIVE · BLUETOOTH" demo={me?.isDemo}>
      <section aria-label="Live heart rate" className="r-card p-4 flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[56px] leading-none" aria-live="polite">{live && hr.bpm != null ? hr.bpm : "--"}</span>
          <span className="text-13 text-muted">bpm</span>
        </div>
        <p className="m-0 text-13 text-ink-soft">
          {hr.status === "idle" && "Not connected."}
          {hr.status === "connecting" && "Connecting…"}
          {live && `Connected to ${hr.deviceName}.`}
          {reconnecting && `Reconnecting to ${hr.deviceName}…${capturing ? " The capture keeps running." : ""}`}
          {hr.status === "lost" && "Connection lost."}
          {hr.status === "error" && "Not connected."}
          {live && hr.contact === "lost" && " No skin contact reported."}
        </p>
        {hr.error && <p role="alert" className="m-0 text-13 text-exposure">{hr.error}</p>}
        {unsupported && <p className="m-0 text-13 text-ink-soft">This browser cannot use Bluetooth. Use Chrome on Android.</p>}
      </section>

      {!connected && !unsupported && (
        <PrimaryButton onClick={hr.status === "lost" ? hr.reconnect : hr.connect} disabled={hr.status === "connecting"}>
          {hr.status === "lost" ? "Reconnect" : "Connect to sensor"}
        </PrimaryButton>
      )}

      {live && !capturing && <PrimaryButton onClick={start}>Start 5-minute capture</PrimaryButton>}

      {capturing && (
        <section aria-label="Capture" className="r-card p-4 flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="text-15 font-medium">Capturing</span>
            <span className="font-mono text-18">{clock(elapsed)} / {clock(CAPTURE_S)}</span>
          </div>
          <p className="m-0 text-13 text-ink-soft">Stay still and breathe normally. The first minute is left out while you settle.</p>
          <button type="button" onClick={finish} className="r-tile self-start min-h-[44px] px-3.5 text-14 font-medium">Stop</button>
        </section>
      )}

      {result && (
        <section aria-label="Capture result" className="r-card p-4 flex flex-col gap-3">
          <span className="text-15 font-semibold">Capture result</span>
          <dl className="m-0 grid grid-cols-2 gap-y-2 text-14">
            <dt className="text-ink-soft">Lowest steady minute</dt>
            <dd className="m-0 font-mono text-right">{result.lowestSteadyBpm != null ? `${Math.round(result.lowestSteadyBpm)} bpm` : "not enough steady data"}</dd>
            <dt className="text-ink-soft">Average after settling</dt>
            <dd className="m-0 font-mono text-right">{result.meanBpm != null ? `${Math.round(result.meanBpm)} bpm` : "n/a"}</dd>
            <dt className="text-ink-soft">Length</dt>
            <dd className="m-0 font-mono text-right">{clock(result.durationS)}</dd>
          </dl>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">
            A spot reading, not your overnight resting HR, so it is not comparable with the Resting HR your watch reports.
            Saved readings go in their own series and never change your sleep entries.
          </p>
          <FormError>{save.error ? errorText(save.error) : null}</FormError>
          {canSave && !isSaved && <PrimaryButton onClick={saveResult} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save this reading"}</PrimaryButton>}
          {isSaved && <p className="m-0 text-13 text-ink-soft">Saved.</p>}
        </section>
      )}

      {connected && (
        <button type="button" onClick={hr.disconnect} className="r-link self-start min-h-[44px] bg-transparent border-0 p-0 text-left">Disconnect</button>
      )}

      <section aria-label="Your readings" className="flex flex-col gap-3">
        <span className="text-15 font-semibold">Your readings</span>
        {baseline != null && (
          <p className="m-0 text-14">
            Calm baseline: <span className="font-mono">{Math.round(baseline)} bpm</span>
            <span className="text-12 text-muted"> · median of your last {calmN} calm captures</span>
          </p>
        )}
        {stillDelta != null && (
          <p className="m-0 text-13 leading-[1.45] text-ink-soft">
            Across {stillN} stillness sessions, your heart rate at the end averaged{" "}
            <span className="font-mono">{Math.abs(Math.round(stillDelta * 10) / 10)} bpm</span> {stillDelta <= 0 ? "lower" : "higher"} than at the start.
            An observation from your own readings, not an explanation.
          </p>
        )}
        {baseline == null && stillDelta == null && (
          <p className="m-0 text-13 text-ink-soft">With three saved calm captures, a baseline appears here. With three stillness sessions measured, so does the start-to-end change.</p>
        )}
        {(saved ?? []).length > 0 && (
          <ul className="r-card m-0 p-0 list-none flex flex-col">
            {[...(saved ?? [])].reverse().slice(0, 14).map((r, i, arr) => (
              <li key={r.id} className={`flex items-center justify-between gap-3 min-h-[52px] px-4 py-2 ${i < arr.length - 1 ? "border-b border-hairline" : ""}`}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-14">
                    {r.kind === "stillness"
                      ? `Stillness · ${r.startBpm != null ? Math.round(r.startBpm) : "?"} → ${r.endBpm != null ? Math.round(r.endBpm) : "?"} bpm`
                      : `Calm · lowest steady ${r.lowestSteadyBpm != null ? Math.round(r.lowestSteadyBpm) : "n/a"} bpm`}
                  </span>
                  <span className="text-12 text-muted">{fmtMonthDay(r.date)} · {clock(r.durationS)}{r.device ? ` · ${r.device}` : ""}</span>
                </span>
                <button type="button" aria-label="Delete this reading" className="min-h-[44px] px-2 bg-transparent border-0 text-13 text-muted"
                  onClick={() => { if (window.confirm("Delete this reading?")) del.mutate(r.id); }}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="m-0 text-12 leading-[1.45] text-ink-soft">
        On a Garmin watch, start Broadcast Heart Rate first (Sensors and Accessories, Wrist Heart Rate). Close Strava and any other app
        using the watch. A watch sends heart rate only, with no beat-to-beat timing, so Resonance cannot compute HRV from it.
        The live stream stays on this device; only the summary numbers are sent when you save.
      </p>
    </SubScreen>
  );
}
