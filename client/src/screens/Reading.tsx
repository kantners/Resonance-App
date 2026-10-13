// Reading log (design/screens/Reading.html). App reading is logged but is never stillness.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReadingLog } from "@shared/schema";
import { DateStepper } from "@/components/DateStepper";
import { Field, FieldLabel, FormError, num, PrimaryButton, UnitInput } from "@/components/Fields";
import { SubScreen } from "@/components/Layout";
import { SessionRows } from "@/components/SessionRows";
import { errorText, useMe, useSave } from "@/lib/api";
import { addDays, localToday } from "@/lib/dates";
import { at, isClock } from "@/lib/sleepTimes";

type Medium = "physical" | "ereader" | "app";
const MEDIA: { id: Medium; title: string; sub: string; tag: string }[] = [
  { id: "physical", title: "Physical book", sub: "Paper. No screen involved.", tag: "SCREEN-FREE" },
  { id: "ereader", title: "E-reader, offline", sub: "E-ink device, no notifications.", tag: "LOW-STIMULUS SCREEN" },
  { id: "app", title: "Phone or tablet app", sub: "Backlit, connected screen.", tag: "COUNTS AS SCREEN TIME" },
];
const LABEL: Record<string, string> = { physical: "Physical book", ereader: "E-reader", app: "App" };

export default function ReadingScreen() {
  const today = localToday();
  const [date, setDate] = useState(today);
  const { data: me } = useMe();
  const listKey = `/api/reading?from=${date}&to=${date}`;
  const { data: rows } = useQuery<ReadingLog[]>({ queryKey: [listKey] });

  const [medium, setMedium] = useState<Medium | null>(null);
  const [mins, setMins] = useState("");
  const [title, setTitle] = useState("");
  const [started, setStarted] = useState("");
  const [touched, setTouched] = useState(false);
  const save = useSave<Record<string, unknown>>("POST", "/api/reading", [listKey]);

  const m = num(mins);
  const bad = { medium: touched && !medium, mins: touched && (m == null || Number.isNaN(m) || m < 1 || m > 1440), time: touched && started !== "" && !isClock(started) };

  async function submit() {
    setTouched(true);
    if (!medium || m == null || Number.isNaN(m) || m < 1 || m > 1440 || (started !== "" && !isClock(started))) return;
    await save.mutateAsync({
      date, medium, durationMin: Math.round(m), title: title.trim() || null,
      startedAt: started ? at(date, started).toISOString() : null,
    });
    setMedium(null); setMins(""); setTitle(""); setStarted(""); setTouched(false);
  }

  return (
    <SubScreen back={{ href: "/log", label: "Log" }} title="Reading"
      meta={<DateStepper date={date} onChange={setDate} max={today} />} demo={me?.isDemo}>
      <section aria-label="What did you read on?" className="flex flex-col gap-2.5">
        <FieldLabel>What did you read on?</FieldLabel>
        <div role="group" aria-label="Reading medium" className="flex flex-col gap-2">
          {MEDIA.map(o => (
            <button key={o.id} type="button" aria-pressed={medium === o.id} onClick={() => setMedium(o.id)}
              className="r-chip !h-auto min-h-[64px] !justify-start !items-start flex-col gap-0.5 px-4 py-3 text-left"
              style={bad.medium ? { borderColor: "rgb(var(--exposure))", borderWidth: 2 } : undefined}>
              <span className="text-15 font-medium">{o.title}</span>
              <span className="text-12 text-ink-soft">{o.sub}</span>
              <span className="font-mono text-10 tracking-badge text-muted">{o.tag}</span>
            </button>
          ))}
        </div>
        {medium === "app" && (
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">Saved to your reading log. Reading on a screen app never counts as stillness.</p>
        )}
      </section>

      <section aria-label="Details" className="r-card p-4 flex flex-col gap-4">
        <Field label="Duration" htmlFor="r-min"><UnitInput id="r-min" value={mins} onChange={setMins} unit="min" invalid={bad.mins} /></Field>
        <Field label="Started" htmlFor="r-start" optional><UnitInput id="r-start" type="time" value={started} onChange={setStarted} invalid={bad.time} /></Field>
        <Field label="Title" htmlFor="r-title" optional><UnitInput id="r-title" value={title} onChange={setTitle} inputMode="text" placeholder="What you read" /></Field>
      </section>

      <FormError>{save.error ? errorText(save.error) : touched && Object.values(bad).some(Boolean) ? "Pick what you read on and enter the minutes." : null}</FormError>
      <PrimaryButton onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save session"}</PrimaryButton>

      <SessionRows heading={date === today ? "Today" : "That day"} totalLabel="Total" url="/api/reading" listKey={listKey} minutesField="durationMin"
        rows={(rows ?? []).map(r => ({ id: r.id, title: r.title || LABEL[r.medium] || r.medium, sub: LABEL[r.medium] || r.medium, minutes: r.durationMin }))} />
    </SubScreen>
  );
}
