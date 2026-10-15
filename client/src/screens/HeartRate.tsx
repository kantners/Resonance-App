// Live heart rate from a Bluetooth sensor, such as a Garmin watch in Broadcast Heart Rate mode.
// A spot capture: it shows the numbers and stores nothing. A watch sends BPM only, so there is no HRV here.
import { useCallback, useEffect, useRef, useState } from "react";
import { SubScreen } from "@/components/Layout";
import { PrimaryButton } from "@/components/Fields";
import { useMe } from "@/lib/api";
import { bluetoothSupported, useHeartRateSensor } from "@/hooks/useHeartRateSensor";
import { summarizeCapture, type CaptureSummary, type HrSample } from "@shared/heartRate";

const CAPTURE_S = 300;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function HeartRateScreen() {
  const { data: me } = useMe();
  const samples = useRef<HrSample[]>([]);
  const startedAt = useRef(0);
  const [capturing, setCapturing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CaptureSummary | null>(null);

  const onSample = useCallback((bpm: number) => {
    if (startedAt.current) samples.current.push({ t: Date.now() - startedAt.current, bpm });
  }, []);
  const hr = useHeartRateSensor(onSample);

  const finish = useCallback(() => {
    startedAt.current = 0; setCapturing(false);
    setResult(summarizeCapture(samples.current));
  }, []);

  function start() {
    samples.current = []; setResult(null); setElapsed(0);
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

  // A dropped connection ends the capture with whatever was collected.
  useEffect(() => { if (capturing && hr.status === "lost") finish(); }, [capturing, hr.status, finish]);

  const live = hr.status === "live";
  const unsupported = !bluetoothSupported();

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
          {hr.status === "lost" && "Connection lost."}
          {hr.status === "error" && "Not connected."}
          {live && hr.contact === "lost" && " No skin contact reported."}
        </p>
        {hr.error && <p role="alert" className="m-0 text-13 text-exposure">{hr.error}</p>}
        {unsupported && <p className="m-0 text-13 text-ink-soft">This browser cannot use Bluetooth. Use Chrome on Android.</p>}
      </section>

      {!live && !unsupported && (
        <PrimaryButton onClick={hr.status === "lost" ? hr.reconnect : hr.connect} disabled={hr.status === "connecting"}>
          {hr.status === "lost" ? "Reconnect" : "Connect to sensor"}
        </PrimaryButton>
      )}

      {live && !capturing && (
        <PrimaryButton onClick={start}>Start 5-minute capture</PrimaryButton>
      )}

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
            A spot reading from today, not your overnight resting HR, so it is not comparable with the Resting HR your watch reports.
            This capture is not saved.
          </p>
        </section>
      )}

      {live && (
        <button type="button" onClick={hr.disconnect} className="r-link self-start min-h-[44px] bg-transparent border-0 p-0 text-left">Disconnect</button>
      )}

      <p className="m-0 text-12 leading-[1.45] text-ink-soft">
        On a Garmin watch, start Broadcast Heart Rate first (Sensors and Accessories, Wrist Heart Rate). Close Strava and any other app
        using the watch. A watch sends heart rate only, with no beat-to-beat timing, so Resonance cannot compute HRV from it.
        Heart rate data stays on this device.
      </p>
    </SubScreen>
  );
}
