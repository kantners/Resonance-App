// Daily Brief (design/screens/Main.html), plus the first-run and
// building-baseline state (amendment B8), which the canvas doesn't cover.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BriefResponse } from "@shared/api";
import type { ContextTag } from "@shared/schema";
import { Eyebrow, TabHeader, TabScreen } from "@/components/Layout";
import { PulseIcon } from "@/components/Icons";
import { QuietStrip } from "@/components/QuietStrip";
import { RangeBar, rangeText, WeekLabelHeading } from "@/components/Signals";
import { errorText, useBrief, useMe, useSave } from "@/lib/api";
import { deviceTimeZone, fmtHeaderDate, fmtMonth, fmtWeekday, localToday } from "@/lib/dates";
import { fmt0, fmt1, fmtHours, fmtMinutes } from "@/lib/format";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const TAGS: { tag: ContextTag; label: string }[] = [
  { tag: "alcohol", label: "Alcohol" },
  { tag: "late_meal", label: "Late meal" },
  { tag: "hard_workout", label: "Hard workout" },
  { tag: "illness", label: "Illness" },
  { tag: "travel", label: "Travel" },
];

export default function BriefScreen() {
  const today = localToday();
  const { data: brief, isLoading, error } = useBrief(today);

  return (
    <TabScreen label="Daily Brief">
      <TabHeader kicker="RESONANCE" meta={fmtHeaderDate(today)} title="Daily Brief" demo={brief?.isDemo} />
      {isLoading && <p className="text-14 text-muted m-0">Loading…</p>}
      {error && <p role="alert" className="text-14 text-alert m-0">{errorText(error)}</p>}
      {brief && (
        brief.week.label === "building_baseline"
          ? <BuildingBaseline brief={brief} />
          : <>
            <WeekCard brief={brief} />
            <LastNightTiles brief={brief} />
            <QuietCard brief={brief} />
            {brief.pattern.triggered && <PatternCard brief={brief} />}
            {brief.longGame && <LongGameCard brief={brief} />}
          </>
      )}
      <FastingCard />
    </TabScreen>
  );
}

// ─── First run / building the baseline (B8) ─────────────────────────────────
function BuildingBaseline({ brief }: { brief: BriefResponse }) {
  const { firstRun: f, week } = brief;
  const baselineDone = f.baselineNights >= f.baselineNeeded;
  return (
    <>
      <section aria-label="Baseline" className="r-card px-5 py-[18px] flex flex-col gap-3">
        <Eyebrow>YOUR BASELINE</Eyebrow>
        <p className="m-0 font-serif text-26 font-medium leading-[1.2]">
          {baselineDone
            ? `Baseline ready. ${week.nights} of 7 nights this week; the label needs 5.`
            : "Resonance is learning your baseline."}
        </p>
        {!baselineDone && (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-14">Nights logged</span>
              <span className="font-mono text-15 font-medium">{Math.min(f.nightsLogged, f.baselineNeeded)} of {f.baselineNeeded}</span>
            </div>
            <div className="h-1.5 rounded-[3px] bg-track flex" aria-hidden>
              <div className="h-1.5 rounded-[3px] bg-ink" style={{ width: `${(Math.min(f.nightsLogged, f.baselineNeeded) / f.baselineNeeded) * 100}%` }} />
            </div>
          </>
        )}
        <p className="m-0 text-13 leading-[1.45] text-ink-soft">
          Resonance compares your HRV and resting heart rate only with your own recent nights. After 14 nights it knows
          your normal range; from then on, a week with at least 5 logged nights gets a label.
        </p>
        <div className="flex gap-4 flex-wrap">
          <Link href="/log/sleep" className="r-link">Log last night →</Link>
          <Link href="/log/morning" className="r-link">Morning reading →</Link>
        </div>
      </section>
      <SourceQuestion brief={brief} />
      <TimeZoneCheck brief={brief} />
    </>
  );
}

/** The HRV source question: every reading needs a device + app. */
function SourceQuestion({ brief }: { brief: BriefResponse }) {
  const [device, setDevice] = useState(brief.firstRun.hrvDevice ?? "");
  const save = useSave<{ defaultHrvDevice: string }>("PATCH", "/api/settings", ["/api/me"]);
  const saved = brief.firstRun.hrvDevice;
  return (
    <section aria-label="HRV source" className="r-card px-5 py-4 flex flex-col gap-2.5">
      <Eyebrow>HRV SOURCE</Eyebrow>
      <label htmlFor="hrv-device" className="text-15 font-medium">Where does your HRV come from?</label>
      <p className="m-0 text-13 leading-[1.45] text-ink-soft">
        The device and the app, e.g. "Polar H10 + Elite HRV", "HRV4Training" or "Garmin overnight". Use the same one
        every morning: readings from different devices aren't comparable, so the baseline restarts if it changes.
      </p>
      <div className="flex gap-2">
        <input
          id="hrv-device" value={device} onChange={e => setDevice(e.target.value)} placeholder="Device + app"
          className="flex-1 min-w-0 h-12 box-border px-3.5 rounded-control border border-control bg-surface text-15"
        />
        <button
          type="button" className="r-button min-h-[48px]"
          disabled={!device.trim() || device.trim() === saved || save.isPending}
          onClick={() => save.mutate({ defaultHrvDevice: device.trim() })}
        >Save</button>
      </div>
      {saved && <p className="m-0 text-12 text-muted">Saved: {saved}</p>}
      {save.error && <p role="alert" className="m-0 text-13 text-alert">{errorText(save.error)}</p>}
    </section>
  );
}

/** Dates come from this device (B6); make sure the saved time zone matches it. */
function TimeZoneCheck({ brief }: { brief: BriefResponse }) {
  const tz = deviceTimeZone();
  const save = useSave<{ timeZone: string }>("PATCH", "/api/settings", ["/api/me"]);
  if (brief.firstRun.timeZone === tz) return null;
  return (
    <section aria-label="Time zone" className="r-tile px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-13 text-ink-soft">
        Time zone: <span className="font-mono text-ink">{tz}</span>
        {brief.firstRun.timeZone && <> (saved: {brief.firstRun.timeZone})</>}
      </span>
      <button type="button" className="r-button-quiet min-h-[44px] px-3 text-13" disabled={save.isPending}
        onClick={() => save.mutate({ timeZone: tz })}>Use this</button>
    </section>
  );
}

// ─── Your week ───────────────────────────────────────────────────────────────
function WeekCard({ brief }: { brief: BriefResponse }) {
  const { week, consistency } = brief;
  const label = week.label as Exclude<typeof week.label, "building_baseline">;
  return (
    <section aria-label="Recovery" className="r-card px-5 py-[18px] flex flex-col gap-3">
      <div className="flex justify-between items-baseline">
        <Eyebrow>YOUR WEEK</Eyebrow>
        <span className="text-12 text-muted">7-night average vs. your baseline</span>
      </div>
      <WeekLabelHeading label={label} nights={week.nights} />
      {week.message && (
        <div className={cn("flex flex-col gap-1", brief.escalationLevel === 4 && "rounded-control bg-exposure-wash px-3 py-2.5")}>
          {brief.escalationLevel === 4 && <span className="text-14 font-semibold text-exposure-strong">{week.message.title}</span>}
          <p className="m-0 text-14 leading-[1.45]">{week.message.body}</p>
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {week.hrv7Avg != null && week.hrvRange && (
          <SignalRow
            name="HRV, 7 nights" value={`${fmt1(week.hrv7Avg)} ms`} valueClass="text-physiology"
            status={week.hrvStrained ? "Below range" : "In range"}
          >
            <RangeBar value={week.hrv7Avg} range={week.hrvRange} spanFactor={7}
              ariaLabel={`HRV 7-night average ${fmt1(week.hrv7Avg)} ms, ${week.hrvStrained ? "below" : "inside"} normal range of ${rangeText(week.hrvRange, "ms")}`} />
          </SignalRow>
        )}
        {week.rhr7Avg != null && week.rhrRange && (
          <SignalRow
            name="Resting HR, 7 nights" value={`${fmt1(week.rhr7Avg)} bpm`}
            status={week.rhrStrained ? "Above range" : "In range"}
          >
            <RangeBar value={week.rhr7Avg} range={week.rhrRange} spanFactor={5}
              ariaLabel={`Resting heart rate 7-night average ${fmt1(week.rhr7Avg)} bpm, ${week.rhrStrained ? "above" : "inside"} normal range of ${rangeText(week.rhrRange, "bpm", 0)}`} />
          </SignalRow>
        )}
      </div>

      <LastNight brief={brief} />

      {consistency.logged > 0 && (
        <div className="flex justify-between items-center px-3 py-2.5 rounded-control bg-ground">
          <span className="text-13">Nights in range, last 30</span>
          <span className="font-mono text-15 font-medium">{consistency.inRange} / {consistency.logged}</span>
        </div>
      )}
      <Link href="/how" className="r-link self-start -mt-1.5 -mb-2">How this works →</Link>
    </section>
  );
}

function SignalRow({ name, value, valueClass, status, children }: {
  name: string; value: string; valueClass?: string; status: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-14 font-medium">{name}</span>
        <span className="flex items-baseline gap-2">
          <span className={cn("font-mono text-15 font-medium", valueClass)}>{value}</span>
          <span className="text-12 font-semibold">{status}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function LastNight({ brief }: { brief: BriefResponse }) {
  const { lastNight: n } = brief;
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(tag: ContextTag) {
    const next = n.tags.includes(tag) ? n.tags.filter(t => t !== tag) : [...n.tags, tag];
    setPending(true); setErr(null);
    try {
      await apiRequest("POST", `/api/nights/${n.date}/tags`, { tags: next });
      await qc.invalidateQueries({ queryKey: [`/api/brief/${brief.date}`] });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setPending(false);
    }
  }

  const status = n.message?.title ?? (n.state === "in_range" ? "In range" : n.state === "no_data" ? "Not logged" : "");
  return (
    <div className="flex flex-col gap-2 pt-3.5 border-t border-track">
      <div className="flex justify-between items-baseline">
        <Eyebrow>LAST NIGHT</Eyebrow>
        <span className="text-12 font-semibold">{status}</span>
      </div>
      {n.state === "no_data" ? (
        <p className="m-0 text-14 leading-[1.45]">
          No HRV for last night yet. <Link href="/log/morning">Take a morning reading</Link> or <Link href="/log/sleep">log the night</Link>.
        </p>
      ) : (
        <>
          {n.message
            ? <p className="m-0 text-14 leading-[1.45]">{n.message.body}</p>
            : <p className="m-0 text-14 leading-[1.45]">HRV {fmt0(n.hrv)} ms{n.rhr != null && <>, resting HR {fmt0(n.rhr)} bpm</>}. Both inside your range.</p>}
          <div role="group" aria-labelledby="ctx-label" className="flex flex-col gap-1.5">
            <span id="ctx-label" className="text-12 text-ink-soft">Anything that explains it?</span>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(t => (
                <button key={t.tag} type="button" className="r-chip" aria-pressed={n.tags.includes(t.tag)}
                  disabled={pending} onClick={() => toggle(t.tag)}>{t.label}</button>
              ))}
            </div>
            {err && <p role="alert" className="m-0 text-13 text-alert">{err}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tiles, quiet, pattern, long game ────────────────────────────────────────
function LastNightTiles({ brief }: { brief: BriefResponse }) {
  const { lastNight: n, yesterday: y } = brief;
  return (
    <section aria-label="Last night" className="grid grid-cols-2 gap-2.5">
      <div className="r-tile p-3.5 flex flex-col gap-1">
        <span className="text-12 text-muted">Sleep score</span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-28 font-medium">{n.sleepScore ?? "—"}</span>
          <span className="text-13 text-muted">/ 100</span>
        </div>
        <span className="text-12 text-ink-soft">{n.hours != null ? `${fmtHours(n.hours)} · ` : ""}not in the label</span>
      </div>
      <div className="r-tile p-3.5 flex flex-col gap-1">
        <span className="text-12 text-muted">Screen time · {fmtWeekday(y.date)}</span>
        {y.exposure ? (
          <>
            <span className="font-mono text-28 font-medium text-exposure">{fmtMinutes(y.exposure.totalMin)}</span>
            <span className="text-12 text-ink-soft">{y.exposure.pickups != null ? `${y.exposure.pickups} pickups` : "Pickups not logged"}</span>
          </>
        ) : (
          <Link href="/log/exposure" className="r-link text-13 min-h-0">Log {fmtWeekday(y.date)} →</Link>
        )}
      </div>
    </section>
  );
}

function QuietCard({ brief }: { brief: BriefResponse }) {
  const { yesterday: y } = brief;
  const day = fmtWeekday(y.date).toUpperCase();
  const quiet = useQuery<{ hourlyPickups: number[] | null }>({ queryKey: [`/api/quiet/${y.date}`], enabled: !!y.exposure });
  const e = y.exposure;
  const estimated = e?.quietSource === "hourly_estimate";
  return (
    <section aria-label="Quiet" className="r-card px-[18px] py-4 flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <Eyebrow>QUIET · {day}</Eyebrow>
        <span className="text-12 text-muted">time without the phone</span>
      </div>
      {e?.longestQuietMin != null ? (
        <div className="flex justify-between items-baseline">
          <span className="text-14 font-medium">Longest quiet stretch{estimated && <span className="font-normal text-muted"> · estimated</span>}</span>
          <span className="font-mono text-22 font-medium">{fmtMinutes(e.longestQuietMin)}</span>
        </div>
      ) : (
        <p className="m-0 text-14 text-ink-soft">
          {e ? "Quiet stretches need the hourly pickups from a Screen Time screenshot." : `No screen time logged for ${fmtWeekday(y.date)}.`}
        </p>
      )}
      {quiet.data?.hourlyPickups && (
        <QuietStrip hourly={quiet.data.hourlyPickups} ariaLabel={`Pickups across ${fmtWeekday(y.date)}, by hour (estimated)`} />
      )}
      <p className="m-0 text-13 leading-[1.45] text-ink-soft">
        {e && <>Pulls: {[
          e.pickups != null && `${e.pickups} pickups`,
          e.notifications != null && `${e.notifications} notifications`,
          e.pickupsAfter21 != null && `${e.pickupsAfter21} pickups after 9 PM`,
        ].filter(Boolean).join(" · ") || "not logged"}. </>}
        Stillness you chose: {y.stillnessMin} min.
      </p>
      <Link href={`/quiet/${y.date}`} className="r-link self-start -mt-1 -mb-2">See the day →</Link>
    </section>
  );
}

function PatternCard({ brief }: { brief: BriefResponse }) {
  const p = brief.pattern;
  // The callout only triggers on a below-range night, so this is a drop; guard anyway.
  const down = p.hrvDiffFromBaselineMs != null ? -Math.round(p.hrvDiffFromBaselineMs) : null;
  return (
    <section aria-label="Pattern" className="r-card px-[18px] py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <PulseIcon className="text-exposure" />
        <Eyebrow>PATTERN NOTED</Eyebrow>
      </div>
      {/* Leads with the pattern, not last night (Mark, Sep 29). */}
      <p className="m-0 text-17 leading-[1.35] font-medium">
        Lower HRV followed {p.seenAfter} of your last {p.highExposureDays} high-screen days.
      </p>
      <p className="m-0 text-13 leading-[1.45] text-ink-soft">
        {/* Yesterday as the latest instance of the pattern (Mark, Sep 29). */}
        Yesterday fits it: {fmtMinutes(p.yesterdayMin)} of screen time against your {fmtMinutes(p.averageMin)} average
        {down != null && down > 0 && <>, and HRV {down} ms below your average last night</>}. {p.caveat}
      </p>
      <Link href="/trends" className="r-link self-start">See the week →</Link>
    </section>
  );
}

function LongGameCard({ brief }: { brief: BriefResponse }) {
  const lg = brief.longGame!;
  const weeks = 12;
  const hrvGood = lg.hrv.direction === "up";
  const rhrGood = lg.rhr?.direction === "down";
  const words = (d: string, up: string, down: string) => (d === "up" ? up : d === "down" ? down : "holding steady");
  const summary = hrvGood && rhrGood
    ? `Both moving the right way over ${weeks} weeks.`
    : `HRV baseline ${words(lg.hrv.direction, "up", "down")}${lg.rhr ? `; resting HR baseline ${words(lg.rhr.direction, "up", "down")}` : ""} over ${weeks} weeks.`;
  return (
    <section aria-label="Long game" className="r-card px-[18px] py-4 flex flex-col gap-2.5">
      <Eyebrow>LONG GAME · SINCE {fmtMonth(lg.sinceDate).toUpperCase()}</Eyebrow>
      <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline text-14">
        <span>HRV baseline</span>
        <span className="font-mono text-16">{fmt0(lg.hrv.then)} → <strong className="font-medium text-physiology">{fmt0(lg.hrv.now)} ms</strong></span>
      </div>
      {lg.rhr && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline text-14">
          <span>Resting HR baseline</span>
          <span className="font-mono text-16">{fmt0(lg.rhr.then)} → <strong className="font-medium">{fmt0(lg.rhr.now)} bpm</strong></span>
        </div>
      )}
      <p className="m-0 text-13 leading-[1.45] text-ink-soft">{summary} This is the trend to watch.</p>
    </section>
  );
}

// ─── Fasting (kept from KEWT) ────────────────────────────────────────────────
function FastingCard() {
  const { data: fast } = useQuery<{ id: number; startedAt: string; goalHours: number | null } | null>({ queryKey: ["/api/fasting/active"] });
  if (!fast) return null;
  const elapsedMin = Math.max(0, (Date.now() - Date.parse(fast.startedAt)) / 60000);
  const goal = fast.goalHours ?? 16;
  return (
    <Link href="/log/fasting" className="r-tile px-4 py-3 flex flex-col gap-2 no-underline text-ink hover:text-ink">
      <div className="flex justify-between items-baseline">
        <span className="text-13 font-medium">Fasting · in progress</span>
        <span className="font-mono text-13">{fmtMinutes(elapsedMin)} <span className="text-muted">/ {goal}h</span></span>
      </div>
      <div className="h-1.5 rounded-[3px] bg-track flex">
        <div className="h-1.5 rounded-[3px] bg-ink" style={{ width: `${Math.min(100, (elapsedMin / (goal * 60)) * 100)}%` }} />
      </div>
    </Link>
  );
}
