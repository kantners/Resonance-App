// Trends (design/screens/Trends.html): a week of screen time against the
// next morning's recovery, an observation that never claims more than the
// data supports, and this week against last. Built on GET /api/trends.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eyebrow, TabHeader, TabScreen } from "@/components/Layout";
import { errorText, useMe } from "@/lib/api";
import { addDays, fmtMonthDay, fmtWeekday, localToday } from "@/lib/dates";
import { fmt0, fmtMinutes, fmtSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TrendDay {
  date: string;
  screenMin: number | null;
  pickups: number | null;
  source: string | null;
  nextMorningHrv: number | null;
  nextSleepScore: number | null;
}
interface WeekSummary { screenMin: number | null; pickups: number | null; hrv: number | null; sleepScore: number | null }
interface TrendsResponse {
  from: string;
  to: string;
  days: TrendDay[];
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
  loggedNights: number;
  nightsForAssociation: number;
  association: { pairs: number; r: number | null } | null;
}

type Metric = "hrv" | "sleep";

export default function TrendsScreen() {
  // Seven complete days ending yesterday; today's screen time is still accruing.
  const to = addDays(localToday(), -1);
  const from = addDays(to, -6);
  const { data, isLoading, error } = useQuery<TrendsResponse>({ queryKey: [`/api/trends?from=${from}&to=${to}`], staleTime: 0 });
  const { data: me } = useMe();
  const [metric, setMetric] = useState<Metric>("hrv");

  const hasAny = !!data && data.days.some(d => d.screenMin != null || d.nextMorningHrv != null || d.nextSleepScore != null);

  return (
    <TabScreen label="Trends">
      <TabHeader kicker="RESONANCE" meta={`${fmtMonthDay(from)} – ${fmtMonthDay(to)}`.toUpperCase()} title="Trends" demo={me?.isDemo} />
      {isLoading && <p className="text-14 text-muted m-0">Loading…</p>}
      {error && <p role="alert" className="text-14 text-alert m-0">{errorText(error)}</p>}
      {data && !hasAny && (
        <section className="r-card px-5 py-4 flex flex-col gap-2">
          <h2 className="m-0 text-15 font-semibold">Nothing to chart yet</h2>
          <p className="m-0 text-14 leading-[1.5] text-ink-soft">
            Trends pairs each day's screen time with the next morning's recovery. Log screen time and a night's sleep and the week fills in here.
          </p>
        </section>
      )}
      {data && hasAny && (
        <>
          <ExposureCard data={data} metric={metric} setMetric={setMetric} />
          <ObservationCard data={data} />
          <WeekOverWeek data={data} />
        </>
      )}
    </TabScreen>
  );
}

// ─── Charts ─────────────────────────────────────────────────────────────────
const W = 310, X0 = 30, SLOT = (W - X0) / 7;
const cx = (i: number) => X0 + SLOT * i + SLOT / 2;

function ExposureCard({ data, metric, setMetric }: { data: TrendsResponse; metric: Metric; setMetric: (m: Metric) => void }) {
  const days = data.days;
  const screen = days.map(d => d.screenMin);
  const have = screen.filter((x): x is number => x != null);
  const avgScreen = have.length ? have.reduce((p, c) => p + c, 0) / have.length : null;
  const topHours = Math.max(3, Math.ceil(Math.max(0, ...have) / 60));
  const topMin = topHours * 60;
  const topOne = have.length ? Math.max(...have) : null;
  const barY = (m: number) => 110 - (m / topMin) * 100;

  const ys = days.map(d => (metric === "hrv" ? d.nextMorningHrv : d.nextSleepScore));
  const yHave = ys.filter((x): x is number => x != null);
  const yAvg = yHave.length ? yHave.reduce((p, c) => p + c, 0) / yHave.length : null;
  const pad = metric === "hrv" ? 5 : 4;
  const yLo = yHave.length ? Math.floor(Math.min(...yHave) - pad) : 0;
  const yHi = yHave.length ? Math.ceil(Math.max(...yHave) + pad) : 100;
  const lineY = (v: number) => 100 - ((v - yLo) / Math.max(1, yHi - yLo)) * 90;
  const unit = metric === "hrv" ? "HRV (ms)" : "sleep score";
  const lowIdx = yHave.length ? ys.indexOf(Math.min(...yHave)) : -1;
  const hiScreenIdx = topOne != null ? screen.indexOf(topOne) : -1;

  // Break the line where a morning is missing rather than draw across it.
  const segments: { x: number; y: number }[][] = [];
  ys.forEach((v, i) => {
    if (v == null) { segments.push([]); return; }
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push({ x: cx(i), y: lineY(v) });
  });

  const dayLabels = (
    <g className="font-mono" fontSize="10" fill="rgb(var(--muted))" textAnchor="middle">
      {days.map((d, i) => (
        <g key={d.date}>
          <text x={cx(i)} y="120">{fmtWeekday(d.date).slice(0, 2)}</text>
          <text x={cx(i)} y="134">{d.date.slice(8)}</text>
        </g>
      ))}
    </g>
  );

  return (
    <section aria-label="Exposure against recovery" className="r-card px-4 py-4 flex flex-col gap-2.5">
      <h2 className="m-0 text-15 font-semibold">Screen time vs. the next morning</h2>
      <div className="flex items-center gap-2 text-12 text-ink-soft">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-[rgb(var(--exposure))]" />
        <span>Screen time per day</span>
      </div>
      <svg viewBox="0 0 310 120" className="w-full h-auto block" role="img"
        aria-label={`Daily screen time, ${fmtMonthDay(data.from)} to ${fmtMonthDay(data.to)}.${topOne != null && hiScreenIdx >= 0 ? ` Highest ${fmtWeekday(days[hiScreenIdx].date)}, ${fmtMinutes(topOne)}.` : ""}`}>
        {[10, 60].map(y => <line key={y} x1={X0} y1={y} x2={W} y2={y} stroke="rgb(var(--line))" strokeWidth="1" />)}
        <line x1={X0} y1="110" x2={W} y2="110" stroke="rgb(var(--line))" strokeWidth="1.5" />
        <g className="font-mono" fontSize="10" fill="rgb(var(--muted))">
          <text x="0" y="14">{topHours}h</text>
          <text x="0" y="64">{topHours % 2 === 0 ? `${topHours / 2}h` : `${(topHours / 2).toFixed(1)}h`}</text>
          <text x="0" y="114">0</text>
        </g>
        {screen.map((m, i) => m == null ? null : (
          <rect key={days[i].date} x={cx(i) - 9} y={barY(m)} width="18" height={Math.max(1, 110 - barY(m))} rx="3"
            fill="rgb(var(--exposure))" fillOpacity={i === hiScreenIdx ? 1 : 0.4} />
        ))}
        {avgScreen != null && (
          <>
            <line x1={X0} y1={barY(avgScreen)} x2={W} y2={barY(avgScreen)} stroke="rgb(var(--ink))" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.55" />
            <text x="0" y={barY(avgScreen) + 4} className="font-mono" fontSize="10" fill="rgb(var(--ink))">avg</text>
          </>
        )}
      </svg>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line">
        <div className="flex items-center gap-2 text-12 text-ink-soft">
          <span className="w-3.5 h-[2px] bg-physiology" />
          <span>Next morning</span>
        </div>
        <div role="group" aria-label="Recovery metric" className="flex gap-1.5">
          {([["hrv", "HRV"], ["sleep", "Sleep score"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}
              className={cn("min-h-[44px] px-3.5 rounded-full border text-13 font-medium cursor-pointer",
                metric === k ? "bg-ink text-surface border-ink" : "bg-surface text-ink border-ink")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 310 140" className="w-full h-auto block" role="img"
        aria-label={`Next-morning ${unit}.${lowIdx >= 0 ? ` Lowest, ${fmt0(ys[lowIdx])}, on the morning after ${fmtWeekday(days[lowIdx].date)}.` : " No readings this week."}`}>
        <line x1={X0} y1="10" x2={W} y2="10" stroke="rgb(var(--line))" strokeWidth="1" />
        <line x1={X0} y1="100" x2={W} y2="100" stroke="rgb(var(--line))" strokeWidth="1.5" />
        {yAvg != null && <line x1={X0} y1={lineY(yAvg)} x2={W} y2={lineY(yAvg)} stroke="rgb(var(--physiology))" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6" />}
        <g className="font-mono" fontSize="10">
          <text x="0" y="14" fill="rgb(var(--muted))">{yHi}</text>
          {yAvg != null && <text x="0" y={lineY(yAvg) + 4} fill="rgb(var(--physiology))">{fmt0(yAvg)}</text>}
          <text x="0" y="104" fill="rgb(var(--muted))">{yLo}</text>
        </g>
        {segments.filter(s => s.length > 1).map((s, k) => (
          <polyline key={k} points={s.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="rgb(var(--physiology))" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {ys.map((v, i) => v == null ? null : (
          <circle key={days[i].date} cx={cx(i)} cy={lineY(v)} r={i === lowIdx ? 4.5 : 4}
            fill={i === lowIdx ? "rgb(var(--physiology))" : "rgb(var(--surface))"} stroke="rgb(var(--physiology))" strokeWidth="2" />
        ))}
        {lowIdx >= 0 && (
          <text x={cx(lowIdx)} y={lineY(ys[lowIdx] as number) + 18} textAnchor="middle" className="font-mono" fontSize="10" fill="rgb(var(--physiology))">{fmt0(ys[lowIdx])}</text>
        )}
        {dayLabels}
      </svg>
      <p className="m-0 text-12 leading-[1.45] text-ink-soft">
        Each point is the morning after that day's screen time. Dashed lines are your averages for the week.
        {yHave.length < 7 && " Gaps are mornings with no reading."}
      </p>
    </section>
  );
}

// ─── Observation ────────────────────────────────────────────────────────────
function describeStrength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.2) return "little to no association between screen time and next-morning HRV";
  const dir = r < 0 ? "higher screen time with lower HRV" : "higher screen time with higher HRV";
  const size = a < 0.4 ? "a weak" : a < 0.6 ? "a moderate" : "a strong";
  return `${size} association: ${dir}`;
}

function observation(days: TrendDay[]): string | null {
  const paired = days.filter(d => d.screenMin != null && d.nextMorningHrv != null);
  if (paired.length < 5) return null;
  const byScreen = [...paired].sort((a, b) => (b.screenMin as number) - (a.screenMin as number));
  const byHrv = [...paired].sort((a, b) => (a.nextMorningHrv as number) - (b.nextMorningHrv as number));
  const topTwo = byScreen.slice(0, 2).map(d => d.date).sort();
  const lowTwo = byHrv.slice(0, 2).map(d => d.date).sort();
  const [a, b] = byScreen.slice(0, 2).map(d => fmtWeekday(d.date)); // keep order high → lower
  if (topTwo[0] === lowTwo[0] && topTwo[1] === lowTwo[1]) {
    return `Your two highest-exposure days, ${a} and ${b}, were followed by your two lowest HRV readings.`;
  }
  const top = byScreen[0];
  const avg = paired.reduce((p, c) => p + (c.nextMorningHrv as number), 0) / paired.length;
  const diff = (top.nextMorningHrv as number) - avg;
  if (Math.abs(diff) < 1) return `${fmtWeekday(top.date)}, your highest-exposure day, was followed by an HRV right at your weekly average.`;
  return `${fmtWeekday(top.date)}, your highest-exposure day, was followed by an HRV ${fmt0(Math.abs(diff))} ms ${diff < 0 ? "below" : "above"} your weekly average.`;
}

function ObservationCard({ data }: { data: TrendsResponse }) {
  const { loggedNights, nightsForAssociation: need, association } = data;
  const text = observation(data.days);
  const progress = Math.min(100, (loggedNights / need) * 100);
  return (
    <section aria-label="Observation" className="r-card px-[18px] py-4 flex flex-col gap-2.5">
      {text
        ? <p className="m-0 text-16 leading-[1.4] font-medium">{text}</p>
        : <p className="m-0 text-16 leading-[1.4] font-medium">Not enough paired days this week to point to a pattern.</p>}
      {association && association.r != null ? (
        <>
          <Eyebrow>STRENGTH OF ASSOCIATION</Eyebrow>
          <p className="m-0 text-14 leading-[1.45]">
            Across {association.pairs} paired days: {describeStrength(association.r)}{" "}
            <span className="font-mono text-12 text-muted">(r = {association.r.toFixed(2).replace("-", "−")})</span>
          </p>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">An association, not a diagnosis. Many things move HRV besides screen time.</p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-12 text-ink-soft">
              <span>Nights logged toward a reliable read</span>
              <span className="font-mono">{Math.min(loggedNights, need)} / {need}</span>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(loggedNights, need)}
              aria-label="Nights logged" className="h-1.5 rounded-[3px] bg-track flex">
              <div className="h-1.5 rounded-[3px] bg-ink" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">
            One week can suggest a pattern but not confirm one. Resonance reports strength of association after {need} logged nights.
          </p>
        </>
      )}
    </section>
  );
}

// ─── Week over week ────────────────────────────────────────────────────────
function WeekOverWeek({ data }: { data: TrendsResponse }) {
  const { thisWeek: t, lastWeek: l } = data;
  const rows: { label: string; a: number | null; b: number | null; show: (x: number) => string; delta: (d: number) => string }[] = [
    { label: "Screen time", a: t.screenMin, b: l.screenMin, show: x => fmtMinutes(x), delta: d => `${d < 0 ? "−" : "+"}${fmtMinutes(Math.abs(d))}` },
    { label: "Pickups", a: t.pickups, b: l.pickups, show: x => fmt0(x), delta: d => fmtSigned(d) },
    { label: "HRV (ms)", a: t.hrv, b: l.hrv, show: x => fmt0(x), delta: d => fmtSigned(d) },
    { label: "Sleep score", a: t.sleepScore, b: l.sleepScore, show: x => fmt0(x), delta: d => fmtSigned(d) },
  ];
  const grid = "grid grid-cols-[1.5fr_1fr_1fr_0.9fr] gap-2";
  return (
    <section aria-label="Week over week" className="r-card px-[18px] py-4 flex flex-col">
      <h2 className="m-0 mb-1.5 text-15 font-semibold">Week over week</h2>
      <div className={cn(grid, "font-mono text-11 tracking-eyebrow text-muted pb-1.5 border-b border-line")}>
        <span>DAILY AVG</span><span className="text-right">THIS</span><span className="text-right">LAST</span><span className="text-right">Δ</span>
      </div>
      {rows.map((r, i) => {
        const d = r.a != null && r.b != null ? r.a - r.b : null;
        const small = d != null && Math.abs(Math.round(d)) < 1 && r.label !== "Screen time";
        return (
          <div key={r.label} className={cn(grid, "text-14 py-2", i < rows.length - 1 && "border-b border-line")}>
            <span>{r.label}</span>
            <span className="text-right font-mono">{r.a == null ? "—" : r.show(r.a)}</span>
            <span className="text-right font-mono text-muted">{r.b == null ? "—" : r.show(r.b)}</span>
            <span className="text-right font-mono">{d == null ? "—" : small ? "0" : r.delta(d)}</span>
          </div>
        );
      })}
      <p className="m-0 pt-2 text-12 leading-[1.45] text-ink-soft">
        HRV and sleep score are the mornings after each of the seven days, not the nights of those dates.
      </p>
    </section>
  );
}
