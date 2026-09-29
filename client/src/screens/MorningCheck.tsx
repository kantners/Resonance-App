// Morning reading (design/screens/Morning-Check.html), Layer 0 version:
// manual entry from a named device + app. Camera PPG is deferred to Layer 1
// (with chest-strap RR) and must be validated before any study uses it, so
// the canvas's fingertip/camera instructions are replaced (Mark, Sep 28).
import { useState } from "react";
import { useLocation } from "wouter";
import { SubScreen } from "@/components/Layout";
import { Field, FormError, num, PrimaryButton, UnitInput } from "@/components/Fields";
import { errorText, useMe, useSave } from "@/lib/api";
import { localIsoNow, localToday } from "@/lib/dates";

const POSTURES = [
  { value: "seated", label: "Seated" },
  { value: "face_up", label: "Lying face-up" },
] as const;

export default function MorningCheckScreen() {
  const [, navigate] = useLocation();
  const { data: me } = useMe();
  const [rmssd, setRmssd] = useState("");
  const [hr, setHr] = useState("");
  const [device, setDevice] = useState<string | null>(null);
  const [posture, setPosture] = useState<(typeof POSTURES)[number]["value"]>("seated");
  const [touched, setTouched] = useState(false);
  const save = useSave<Record<string, unknown>>("POST", "/api/morning-readings");

  const deviceValue = device ?? me?.defaultHrvDevice ?? "";
  const r = num(rmssd), h = num(hr);
  const rBad = touched && (r == null || Number.isNaN(r) || r <= 0 || r > 400);
  const hBad = touched && (h == null || Number.isNaN(h) || h < 20 || h > 220);
  const dBad = touched && !deviceValue.trim();

  async function submit() {
    setTouched(true);
    if (r == null || Number.isNaN(r) || r <= 0 || r > 400 || h == null || Number.isNaN(h) || h < 20 || h > 220 || !deviceValue.trim()) return;
    await save.mutateAsync({
      date: localToday(), takenAt: localIsoNow(), rmssdMs: r, heartRateBpm: h, posture, hrvDevice: deviceValue.trim(),
    });
    navigate("/");
  }

  return (
    <SubScreen back={{ href: "/", label: "Brief" }} title="Morning reading" meta="60 SECONDS · SEATED · BEFORE COFFEE" demo={me?.isDemo}>
      <section aria-label="Your reading" className="r-card p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="HRV (rMSSD)" htmlFor="m-rmssd">
            <UnitInput id="m-rmssd" value={rmssd} onChange={setRmssd} unit="ms" inputMode="decimal" invalid={rBad} />
          </Field>
          <Field label="Heart rate" htmlFor="m-hr">
            <UnitInput id="m-hr" value={hr} onChange={setHr} unit="bpm" inputMode="decimal" invalid={hBad} />
          </Field>
        </div>
        <Field label="Source: device and app" htmlFor="m-device">
          <UnitInput id="m-device" value={deviceValue} onChange={setDevice} inputMode="text"
            placeholder="e.g. Polar H10 + Elite HRV" invalid={dBad} />
        </Field>
        <div role="radiogroup" aria-label="Posture" className="flex flex-wrap gap-1.5">
          {POSTURES.map(p => (
            <button key={p.value} type="button" role="radio" aria-checked={posture === p.value}
              className="r-chip" onClick={() => setPosture(p.value)}>{p.label}</button>
          ))}
        </div>
        {me?.defaultHrvDevice && deviceValue.trim() && deviceValue.trim() !== me.defaultHrvDevice && (
          <p className="m-0 text-12 leading-[1.45] text-alert">
            This differs from your usual source ({me.defaultHrvDevice}). A new source restarts your baseline.
          </p>
        )}
      </section>

      <section aria-label="How to measure" className="flex flex-col gap-2.5">
        <h2 className="m-0 text-15 font-semibold">How to take it</h2>
        <ol className="m-0 p-0 list-none flex flex-col gap-2.5 text-14 leading-[1.45]">
          {[
            "Sit up, same spot, soon after waking.",
            "Take a 60-second reading with your usual device and app.",
            "Breathe normally. Don't pace it for the reading.",
          ].map((t, i) => (
            <li key={i} className="grid grid-cols-[24px_1fr] gap-2"><span className="font-mono text-muted">{i + 1}</span><span>{t}</span></li>
          ))}
        </ol>
      </section>

      <p className="m-0 px-3.5 py-3 rounded-control bg-track text-12 leading-[1.5] text-ink-soft">
        Use the same device and app every morning. Readings from different devices aren't comparable, so your baseline
        restarts if the source changes. Resonance's own camera reading comes later, once it has been checked against a
        reference recording.
      </p>

      <FormError>{save.error ? errorText(save.error) : (touched && (rBad || hBad || dBad)) ? "Enter the HRV, the heart rate and the device and app they came from." : null}</FormError>
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save reading"}</PrimaryButton>
        <button type="button" className="r-button-quiet" onClick={() => navigate("/")}>Cancel</button>
      </div>
    </SubScreen>
  );
}
