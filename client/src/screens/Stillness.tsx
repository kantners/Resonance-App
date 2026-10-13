// Log stillness (design/screens/Stillness.html): time you chose to spend without input.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StillnessSession } from "@shared/schema";
import { DateStepper } from "@/components/DateStepper";
import { Field, FieldLabel, FormError, num, PrimaryButton, UnitInput } from "@/components/Fields";
import { SubScreen } from "@/components/Layout";
import { SessionRows } from "@/components/SessionRows";
import { errorText, useMe, useSave } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { at, isClock } from "@/lib/sleepTimes";

const TYPES = [
  { id: "breathwork", title: "Breathwork", sub: "Paced or resonance" },
  { id: "meditation", title: "Meditation", sub: "Any practice" },
  { id: "reiki", title: "Reiki session", sub: "Given or received" },
  { id: "walk", title: "Walk", sub: "No podcast, no calls" },
  { id: "reading", title: "Reading", sub: "Paper or e-reader" },
  { id: "nothing", title: "Nothing at all", sub: "Just sat. It counts." },
] as const;
const PHONE = [
  { id: "another_room", label: "In another room" },
  { id: "nearby_silenced", label: "Nearby, silenced" },
  { id: "with_me_sound_on", label: "With me, sound on" },
] as const;
const TITLE: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.id, t.title]));
const PHONE_LABEL: Record<string, string> = Object.fromEntries(PHONE.map(p => [p.id, p.label]));

export default function StillnessScreen() {
  const today = localToday();
  const [date, setDate] = useState(today);
  const { data: me } = useMe();
  const listKey = `/api/stillness?from=${date}&to=${date}`;
  const { data } = useQuery<{ stillness: StillnessSession[]; breathwork: { id: number; type: string; durationMin: number }[] }>({ queryKey: [listKey] });

  const [type, setType] = useState<(typeof TYPES)[number]["id"] | null>(null);
  const [role, setRole] = useState<"given" | "received" | null>(null);
  const [medium, setMedium] = useState<"physical" | "ereader" | null>(null);
  const [mins, setMins] = useState("");
  const [started, setStarted] = useState("");
  const [phone, setPhone] = useState<(typeof PHONE)[number]["id"] | null>(null);
  const [touched, setTouched] = useState(false);
  const save = useSave<Record<string, unknown>>("POST", "/api/stillness", [listKey]);

  const m = num(mins);
  const bad = {
    type: touched && !type,
    role: touched && type === "reiki" && !role,
    medium: touched && type === "reading" && !medium,
    mins: touched && (m == null || Number.isNaN(m) || m < 1 || m > 1440),
    time: touched && started !== "" && !isClock(started),
    phone: touched && !phone,
  };

  async function submit() {
    setTouched(true);
    const minsOk = m != null && !Number.isNaN(m) && m >= 1 && m <= 1440;
    if (!type || !phone || !minsOk || m == null) return;
    if ((type === "reiki" && !role) || (type === "reading" && !medium) || (started !== "" && !isClock(started))) return;
    const minutes = Math.round(m);
    // Started defaults to "just now" for today (minus the duration), noon for an earlier day.
    const startedAt = started ? at(date, started) : date === today ? new Date(Date.now() - minutes * 60_000) : at(date, "12:00");
    await save.mutateAsync({
      date, startedAt: startedAt.toISOString(), minutes, type, phoneLocation: phone,
      ...(type === "reiki" ? { reikiRole: role } : {}),
      ...(type === "reading" ? { readingMedium: medium } : {}),
    });
    setType(null); setRole(null); setMedium(null); setMins(""); setStarted(""); setPhone(null); setTouched(false);
  }

  const rows = [
    ...(data?.stillness ?? []).map(s => ({ id: s.id, title: TITLE[s.type] ?? s.type, sub: PHONE_LABEL[s.phoneLocation] ?? "", minutes: s.minutes })),
  ];
  const extra = data?.breathwork?.reduce((a, b) => a + b.durationMin, 0) ?? 0;

  return (
    <SubScreen back={{ href: "/log", label: "Log" }} title="Log stillness"
      meta={<DateStepper date={date} onChange={setDate} max={today} />} demo={me?.isDemo}>
      <p className="m-0 text-13 leading-[1.45] text-ink-soft">Time you chose to spend without input. Counted separately from time the phone simply wasn't used.</p>

      <section aria-label="What was it?" className="flex flex-col gap-2.5">
        <FieldLabel>What was it?</FieldLabel>
        <div role="group" aria-label="Type" className="grid grid-cols-2 gap-2">
          {TYPES.map(t => (
            <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}
              className="r-chip flex flex-col items-start justify-start !rounded-control gap-0.5 min-h-[64px] px-3.5 py-3 text-left"
              style={bad.type ? { borderColor: "rgb(var(--exposure))", borderWidth: 2 } : undefined}>
              <span className="text-14 font-medium">{t.title}</span>
              <span className="text-12 text-ink-soft">{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {type === "reiki" && (
        <section aria-label="Your role" className="flex flex-col gap-2">
          <FieldLabel>Your role</FieldLabel>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Role">
            {(["given", "received"] as const).map(r => (
              <button key={r} type="button" className="r-chip min-h-[48px] justify-center" aria-pressed={role === r} onClick={() => setRole(r)}
                style={bad.role ? { borderColor: "rgb(var(--exposure))", borderWidth: 2 } : undefined}>{r === "given" ? "Gave it" : "Received it"}</button>
            ))}
          </div>
        </section>
      )}
      {type === "reading" && (
        <section aria-label="Reading on" className="flex flex-col gap-2">
          <FieldLabel>Reading on</FieldLabel>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Medium">
            {([["physical", "Paper"], ["ereader", "E-reader, offline"]] as const).map(([id, label]) => (
              <button key={id} type="button" className="r-chip min-h-[48px] justify-center" aria-pressed={medium === id} onClick={() => setMedium(id)}
                style={bad.medium ? { borderColor: "rgb(var(--exposure))", borderWidth: 2 } : undefined}>{label}</button>
            ))}
          </div>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">Reading on a phone or tablet app goes in Reading and never counts as stillness.</p>
        </section>
      )}

      <section aria-label="Details" className="r-card p-4 flex flex-col gap-4">
        <Field label="Duration" htmlFor="st-min"><UnitInput id="st-min" value={mins} onChange={setMins} unit="min" invalid={bad.mins} /></Field>
        <Field label="Started" htmlFor="st-start" optional><UnitInput id="st-start" type="time" value={started} onChange={setStarted} invalid={bad.time} /></Field>
      </section>

      <section aria-label="Where was your phone?" className="flex flex-col gap-2">
        <FieldLabel>Where was your phone?</FieldLabel>
        <div role="group" aria-label="Phone location" className="flex flex-col gap-2">
          {PHONE.map(p => (
            <button key={p.id} type="button" className="r-chip min-h-[48px] justify-start px-4" aria-pressed={phone === p.id} onClick={() => setPhone(p.id)}
              style={bad.phone ? { borderColor: "rgb(var(--exposure))", borderWidth: 2 } : undefined}>{p.label}</button>
          ))}
        </div>
        <p className="m-0 text-12 leading-[1.45] text-ink-soft">Whether a nearby phone matters is an open question. This field lets your own data test it.</p>
      </section>

      <FormError>{save.error ? errorText(save.error) : touched && Object.values(bad).some(Boolean) ? "Check the highlighted fields." : null}</FormError>
      <PrimaryButton onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</PrimaryButton>

      <SessionRows heading={date === today ? "Today" : "That day"} totalLabel="Total" url="/api/stillness" listKey={listKey} minutesField="minutes" rows={rows}
        extra={(r, set, patch) => (
          <div className="flex flex-col gap-2" role="group" aria-label="Phone location">
            {PHONE.map(p => (
              <button key={p.id} type="button" className="r-chip min-h-[44px] justify-start px-4" aria-pressed={patch.phoneLocation === p.id} onClick={() => set({ phoneLocation: p.id })}>{p.label}</button>
            ))}
          </div>
        )} />
      {extra > 0 && <p className="m-0 text-12 text-muted">Plus {extra} min of breathwork logged in the older breathwork log.</p>}
    </SubScreen>
  );
}
