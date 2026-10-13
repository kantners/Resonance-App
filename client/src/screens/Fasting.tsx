// Fasting: one tap to start, one tap to end. Timer, goal presets, history.
// Deliberately plain: elapsed time only. No phase claims, streaks or badges.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FastingSession } from "@shared/schema";
import { FieldLabel, FormError, PrimaryButton } from "@/components/Fields";
import { SubScreen } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import { errorText, useMe } from "@/lib/api";
import { signalError, signalSaved } from "@/lib/feedback";

const PRESETS = [12, 14, 16, 18, 20, 24, 30, 36, 40, 48];

const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const hm = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const dateInput = "h-12 box-border w-full rounded-control border border-control bg-surface px-3.5 font-mono text-15";

export default function FastingScreen() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: active } = useQuery<FastingSession | null>({ queryKey: ["/api/fasting/active"] });
  const { data: history } = useQuery<FastingSession[]>({ queryKey: ["/api/fasting/history"] });

  const [goal, setGoal] = useState(16);
  const [earlier, setEarlier] = useState(false);
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date()));
  const [editing, setEditing] = useState(false);
  const [editAt, setEditAt] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  // Keep the timer live while a fast is running.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, [active?.id]);

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["/api/fasting/active"] }),
    qc.invalidateQueries({ queryKey: ["/api/fasting/history"] }),
  ]);
  const run = useMutation({
    mutationFn: (a: { method: string; url: string; body?: unknown }) => apiRequest(a.method, a.url, a.body),
    onSuccess: async () => { setError(null); await refresh(); signalSaved(); },
    onError: e => { setError(errorText(e)); signalError(); },
  });

  function start() {
    const at = earlier ? new Date(startAt) : new Date();
    if (Number.isNaN(at.getTime())) return setError("Pick a valid start time.");
    if (at.getTime() > Date.now() + 60_000) return setError("The start time can't be in the future.");
    run.mutate({ method: "POST", url: "/api/fasting/start", body: { goalHours: goal, ...(earlier ? { startedAt: at.toISOString() } : {}) } },
      { onSuccess: () => setEarlier(false) });
  }
  function kitchenClosed() {
    run.mutate({ method: "POST", url: "/api/fasting/start", body: { goalHours: 16 } });
  }
  function end() {
    if (active) run.mutate({ method: "POST", url: "/api/fasting/end", body: { id: active.id } });
  }
  function saveStart() {
    const at = new Date(editAt);
    if (!active || Number.isNaN(at.getTime())) return setError("Pick a valid start time.");
    if (at.getTime() > Date.now()) return setError("The start time can't be in the future.");
    run.mutate({ method: "PATCH", url: `/api/fasting/${active.id}`, body: { startedAt: at.toISOString() } },
      { onSuccess: () => setEditing(false) });
  }

  const done = (history ?? []).filter(s => s.endedAt);
  const hours = done.map(s => (Date.parse(s.endedAt!) - Date.parse(s.startedAt)) / 3_600_000);
  const avg = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
  const longest = hours.length ? Math.max(...hours) : null;

  const elapsedMs = active ? now - Date.parse(active.startedAt) : 0;
  const goalH = active?.goalHours ?? 16;
  const pct = active ? Math.min(100, (elapsedMs / (goalH * 3_600_000)) * 100) : 0;
  const reached = active ? elapsedMs >= goalH * 3_600_000 : false;

  return (
    <SubScreen back={{ href: "/log", label: "Log" }} title="Fasting" demo={me?.isDemo}>
      {active ? (
        <section aria-label="Current fast" className="r-card p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-11 tracking-header text-muted">IN PROGRESS</span>
            <span aria-live="off" className="font-mono text-[44px] leading-none font-medium">{hm(elapsedMs)}</span>
            <span className="text-13 text-ink-soft">
              {reached ? `Goal of ${goalH}h reached` : `${hm(goalH * 3_600_000 - elapsedMs)} to your ${goalH}h goal`}
            </span>
          </div>
          <div role="progressbar" aria-label="Progress to goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            className="h-2 rounded-[4px] bg-track flex">
            <div className="h-2 rounded-[4px] bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between items-center text-13">
            <span className="text-ink-soft">Started {when(active.startedAt)}</span>
            <button type="button" className="r-button-quiet min-h-[44px] px-3 text-13"
              onClick={() => { setEditAt(toLocalInput(new Date(active.startedAt))); setEditing(e => !e); }}>
              {editing ? "Cancel" : "Change start"}
            </button>
          </div>
          {editing && (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="f-edit">Start time</FieldLabel>
              <input id="f-edit" type="datetime-local" value={editAt} max={toLocalInput(new Date())}
                onChange={e => setEditAt(e.target.value)} className={dateInput} />
              <button type="button" className="r-button min-h-[48px]" onClick={saveStart} disabled={run.isPending}>Save start time</button>
            </div>
          )}
          <PrimaryButton onClick={end} disabled={run.isPending}>{run.isPending ? "Saving…" : "End fast"}</PrimaryButton>
        </section>
      ) : (
        <section aria-label="Start a fast" className="r-card p-5 flex flex-col gap-4">
          <button type="button" className="r-button min-h-[52px] text-16 font-semibold" disabled={run.isPending} onClick={kitchenClosed}>
            Kitchen closed
          </button>
          <p className="m-0 -mt-2 text-12 leading-[1.45] text-ink-soft">
            One tap at your last bite: starts a 16 h fast now. Fell-asleep time on the Sleep screen then gives your last-meal gap.
          </p>
          <div className="flex flex-col gap-2">
            <FieldLabel>Goal</FieldLabel>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Goal hours">
              {PRESETS.map(h => (
                <button key={h} type="button" className="r-chip min-h-[44px] px-0 justify-center" aria-pressed={goal === h} onClick={() => setGoal(h)}>{h}h</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-14 min-h-[44px]">
            <input type="checkbox" checked={earlier} onChange={e => setEarlier(e.target.checked)} className="w-5 h-5" />
            I started earlier
          </label>
          {earlier && (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="f-start">Start time</FieldLabel>
              <input id="f-start" type="datetime-local" value={startAt} max={toLocalInput(new Date())}
                onChange={e => setStartAt(e.target.value)} className={dateInput} />
            </div>
          )}
          <PrimaryButton onClick={start} disabled={run.isPending}>{run.isPending ? "Starting…" : `Start ${goal}h fast`}</PrimaryButton>
        </section>
      )}

      <FormError>{error}</FormError>

      {hours.length > 0 && (
        <section aria-label="Summary" className="grid grid-cols-3 gap-2.5">
          {([["FASTS", String(hours.length)], ["AVERAGE", avg != null ? hm(avg * 3_600_000) : "—"], ["LONGEST", longest != null ? hm(longest * 3_600_000) : "—"]] as const).map(([k, v]) => (
            <div key={k} className="r-tile px-3 py-3 flex flex-col gap-1 min-w-0">
              <span className="font-mono text-11 tracking-header text-muted">{k}</span>
              <span className="font-mono text-16 font-medium">{v}</span>
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section aria-label="History" className="r-card px-4 py-2">
          <h2 className="m-0 pt-2 pb-1 text-15 font-semibold">History <span className="font-normal text-13 text-muted">· last 30 days</span></h2>
          <ul className="m-0 p-0 list-none">
            {done.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between min-h-[52px] border-b border-hairline last:border-b-0 text-14">
                <span className="flex flex-col">
                  <span className="font-mono">{hm(hours[i] * 3_600_000)}</span>
                  <span className="text-12 text-muted">{day(s.startedAt)} · goal {s.goalHours ?? 16}h</span>
                </span>
                <button type="button" aria-label={`Delete the fast from ${day(s.startedAt)}`} disabled={run.isPending}
                  onClick={() => { if (window.confirm("Delete this fast?")) run.mutate({ method: "DELETE", url: `/api/fasting/${s.id}` }); }}
                  className="bg-transparent border-0 text-muted text-20 cursor-pointer w-11 h-11">×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!active && done.length === 0 && (
        <p className="m-0 text-13 leading-[1.5] text-ink-soft">
          Fasts you log here appear on the Brief while they run. Resonance records the times only; it makes no claims about what
          happens at each hour.
        </p>
      )}
    </SubScreen>
  );
}
