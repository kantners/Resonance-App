// Sleep entry (design/screens/Sleep.html). The row is keyed by the WAKE date:
// "Night of Thu · Sep 24" is saved under Fri, Sep 25 (HANDOFF §0).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { SleepLog } from "@shared/schema";
import { DateStepper } from "@/components/DateStepper";
import { Field, FieldLabel, FormError, num, PrimaryButton, UnitInput } from "@/components/Fields";
import { SubScreen } from "@/components/Layout";
import { errorText, useMe, useSave } from "@/lib/api";
import { addDays, localToday } from "@/lib/dates";

export default function SleepScreen() {
  const [, navigate] = useLocation();
  const today = localToday();
  const [wakeDate, setWakeDate] = useState(today);
  const { data: me } = useMe();
  const { data: rows } = useQuery<SleepLog[]>({ queryKey: [`/api/sleep?from=${wakeDate}&to=${wakeDate}`] });
  const existing = rows?.[0] ?? null;

  const [h, setH] = useState(""), [m, setM] = useState(""), [score, setScore] = useState("");
  const [hrv, setHrv] = useState(""), [rhr, setRhr] = useState(""), [notes, setNotes] = useState("");
  const [device, setDevice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const save = useSave<Record<string, unknown>>("POST", "/api/sleep");

  // Prefill from an existing entry for this night.
  useEffect(() => {
    const e = existing;
    const total = e?.hours != null ? Math.round(e.hours * 60) : null;
    setH(total != null ? String(Math.floor(total / 60)) : "");
    setM(total != null ? String(total % 60) : "");
    setScore(e?.sleepScore != null ? String(e.sleepScore) : "");
    setHrv(e?.hrv != null ? String(e.hrv) : "");
    setRhr(e?.restingHr != null ? String(e.restingHr) : "");
    setNotes(e?.notes ?? "");
    setDevice(null);
    setTouched(false);
  }, [existing?.id, wakeDate]);

  const hours = num(h), mins = num(m), sc = num(score), hv = num(hrv), rh = num(rhr);
  const deviceValue = device ?? existing?.hrvDevice ?? me?.defaultHrvDevice ?? "";
  const bad = {
    time: touched && ((hours != null && (Number.isNaN(hours) || hours < 0 || hours > 24)) || (mins != null && (Number.isNaN(mins) || mins < 0 || mins > 59))),
    score: touched && sc != null && (Number.isNaN(sc) || sc < 0 || sc > 100),
    hrv: touched && hv != null && (Number.isNaN(hv) || hv <= 0 || hv > 400),
    rhr: touched && rh != null && (Number.isNaN(rh) || rh < 20 || rh > 200),
    device: touched && hv != null && !deviceValue.trim(),
  };

  async function submit() {
    setTouched(true);
    const anyBad = [bad.time, bad.score, bad.hrv, bad.rhr].some(Boolean)
      || (hours != null && Number.isNaN(hours)) || (hv != null && !deviceValue.trim());
    if (anyBad) return;
    const total = hours != null || mins != null ? (hours ?? 0) + (mins ?? 0) / 60 : null;
    await save.mutateAsync({
      date: wakeDate,
      hours: total,
      sleepScore: sc,
      hrv: hv,
      restingHr: rh != null ? Math.round(rh) : null,
      notes: notes.trim() || null,
      ...(hv != null ? { hrvDevice: deviceValue.trim() } : {}),
    });
    navigate("/");
  }

  return (
    <SubScreen
      back={{ href: "/", label: "Brief" }}
      title="Sleep"
      meta={<DateStepper date={addDays(wakeDate, -1)} onChange={d => setWakeDate(addDays(d, 1))} max={addDays(today, -1)} prefix="NIGHT OF " />}
      demo={me?.isDemo}
    >
      <section aria-label="Sleep values" className="r-card p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Time asleep</FieldLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <UnitInput value={h} onChange={setH} unit="h" label="Hours asleep" invalid={bad.time} />
            <UnitInput value={m} onChange={setM} unit="m" label="Minutes asleep" invalid={bad.time} />
          </div>
        </div>
        <Field label="Sleep score" htmlFor="s-score">
          <UnitInput id="s-score" value={score} onChange={setScore} unit="/ 100" invalid={bad.score} />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="HRV" htmlFor="s-hrv"><UnitInput id="s-hrv" value={hrv} onChange={setHrv} unit="ms" inputMode="decimal" invalid={bad.hrv} /></Field>
          <Field label="Resting HR" htmlFor="s-rhr"><UnitInput id="s-rhr" value={rhr} onChange={setRhr} unit="bpm" invalid={bad.rhr} /></Field>
        </div>
        {hv != null && (
          <Field label="HRV source: device and app" htmlFor="s-device">
            <UnitInput id="s-device" value={deviceValue} onChange={setDevice} inputMode="text" placeholder="e.g. Garmin overnight" invalid={bad.device} />
          </Field>
        )}
        <p className="m-0 text-12 leading-[1.45] text-ink-soft">
          Enter HRV exactly as your device reports it. Devices measure it differently, so Resonance compares you only to
          your own baseline, never to population norms.
        </p>
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="s-notes" className="text-15 font-semibold">Notes <span className="font-normal text-13 text-muted">· optional</span></label>
        <textarea id="s-notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Anything that might explain the night"
          className="box-border border border-control rounded-control px-3.5 py-3 bg-surface text-15 leading-[1.45] resize-none" />
      </div>

      <FormError>{save.error ? errorText(save.error) : touched && Object.values(bad).some(Boolean) ? "Check the highlighted values." : null}</FormError>
      <PrimaryButton onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save night"}</PrimaryButton>
    </SubScreen>
  );
}
