// Fasting visuals. Plain facts only: times and counts, never phase claims.
// FastRuler: the current fast on a clock-time ruler, with your sleep shaded.
// OwnFasts: this fast against your own past fasts.
const H = 3_600_000;
const C = { fast: "rgb(var(--physiology))", ink: "rgb(var(--ink))", muted: "rgb(var(--muted))", line: "rgb(var(--line))", track: "rgb(var(--track))", dot: "rgb(var(--neutral))" };
const HATCH = "repeating-linear-gradient(45deg, rgb(var(--neutral)) 0 3px, rgb(var(--track)) 3px 6px)";
const mono = "font-mono";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const hourLabel = (ms: number) => { const h = new Date(ms).getHours(); return `${h % 12 || 12}${h < 12 ? "A" : "P"}`; };

export type SleepWindow = { sleepOnset: string | null; wakeTime: string | null };

export function FastRuler({ startedAt, goalHours, now, sleeps }: { startedAt: string; goalHours: number; now: number; sleeps: SleepWindow[] }) {
  const s = Date.parse(startedAt);
  const goalEnd = s + goalHours * H;
  const rs = Math.floor((s - H) / H) * H;
  const re = Math.ceil((Math.max(goalEnd, now) + H) / H) * H;
  const span = (re - rs) / H;
  const step = [1, 2, 3, 4, 6, 12].find(x => span / x <= 6) ?? 12;
  const pos = (t: number) => `${(Math.min(Math.max(t, rs), re) - rs) / (re - rs) * 100}%`;
  const w = (a: number, b: number) => `${(Math.max(b - a, 0)) / (re - rs) * 100}%`;

  const ticks: number[] = [];
  for (let t = rs; t <= re; t += H) if (new Date(t).getHours() % step === 0) ticks.push(t);

  const asleep = sleeps
    .map(x => ({ a: x.sleepOnset ? Date.parse(x.sleepOnset) : NaN, b: x.wakeTime ? Date.parse(x.wakeTime) : NaN }))
    .filter(x => Number.isFinite(x.a) && Number.isFinite(x.b))
    .map(x => ({ a: Math.max(x.a, s), b: Math.min(x.b, now), raw: x }))
    .filter(x => x.b > x.a);

  return (
    <div className="flex flex-col gap-2" role="img"
      aria-label={`Clock view: fast started ${clock(s)}, now ${clock(now)}, goal reached ${clock(goalEnd)}${asleep.length ? ", with your sleep shaded" : ""}`}>
      <div className="relative h-[84px]">
        <span className={`absolute top-0 text-11 ${mono}`} style={{ left: pos(s), color: C.ink, whiteSpace: "nowrap" }}>last bite {clock(s)}</span>
        <span className={`absolute top-0 text-11 ${mono}`} style={{ right: `calc(100% - ${pos(goalEnd)})`, color: C.muted, whiteSpace: "nowrap", visibility: (goalEnd - s) / H > 7 ? "visible" : "hidden" }}>goal {goalHours}h</span>
        <div className="absolute left-0 right-0 rounded-[6px] box-border" style={{ top: 24, height: 28, background: C.track, border: `1px solid ${C.line}` }} />
        <div className="absolute rounded-l-[6px]" style={{ top: 24, height: 28, left: pos(s), width: w(s, Math.min(now, re)), background: C.fast }} />
        {asleep.map((x, i) => (
          <div key={i} className="absolute box-border" style={{ top: 24, height: 28, left: pos(x.a), width: w(x.a, x.b), background: HATCH, borderLeft: "2px solid rgb(var(--surface))", borderRight: "2px solid rgb(var(--surface))" }} />
        ))}
        <div className="absolute" style={{ top: 18, left: pos(s), width: 2, height: 40, background: C.ink }} />
        <div className="absolute" style={{ top: 18, left: `calc(${pos(Math.min(now, re))} - 2px)`, width: 2, height: 40, background: C.ink }} />
        <div className="absolute" style={{ top: 20, left: pos(goalEnd), height: 36, borderLeft: `2px dashed ${C.muted}` }} />
        <span className={`absolute text-11 ${mono}`} style={{ top: 60, left: pos(Math.min(now, re)), transform: "translateX(-50%)", color: C.ink, whiteSpace: "nowrap" }}>now {clock(now)}</span>
      </div>
      <div className="relative h-4">
        {ticks.map(t => (
          <span key={t} className={`absolute text-10 ${mono}`} style={{ left: pos(t), transform: "translateX(-50%)", color: C.muted }}>{hourLabel(t)}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-12" style={{ color: C.muted }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-2.5 rounded-[2px]" style={{ background: C.fast }} />Fasted</span>
        {asleep.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-2.5 rounded-[2px]" style={{ background: HATCH }} />
            Asleep {clock(asleep[0].raw.a)} to {clock(asleep[asleep.length - 1].raw.b)}</span>
        )}
      </div>
    </div>
  );
}

const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

export function OwnFasts({ pastHours, currentHours, goalHours }: { pastHours: number[]; currentHours: number; goalHours: number }) {
  if (pastHours.length < 3) return null;
  const max = Math.max(48, Math.ceil(Math.max(...pastHours, currentHours, goalHours) / 12) * 12);
  const pct = (h: number) => `${Math.min(h, max) / max * 100}%`;
  const sorted = [...pastHours].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const longer = sorted.filter(h => currentHours > h).length;
  const bins = new Map<number, number>();
  const dots = sorted.map(h => { const b = Math.round(h); const k = bins.get(b) ?? 0; bins.set(b, k + 1); return { h, k: Math.min(k, 5) }; });
  const axis = Array.from({ length: max / 12 + 1 }, (_, i) => i * 12);
  return (
    <section aria-label="This fast against your own fasts" className="r-card p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className={`text-11 tracking-header ${mono}`} style={{ color: C.muted }}>YOUR LAST {pastHours.length} FASTS</span>
        <span className="text-14 font-medium">Longer than {longer} of {pastHours.length}</span>
      </div>
      <div role="img" aria-label={`Past fasts range from ${hm(sorted[0])} to ${hm(sorted[sorted.length - 1])}, median ${hm(median)}. This fast is ${hm(currentHours)}.`}
        className="relative h-[120px]">
        <div className="absolute left-0 right-0" style={{ top: 96, height: 1, background: C.line }} />
        {axis.map(a => (
          <span key={a} className={`absolute text-10 ${mono}`} style={{ top: 100, left: pct(a), transform: a === 0 ? "none" : a === max ? "translateX(-100%)" : "translateX(-50%)", color: C.muted }}>{a}h</span>
        ))}
        {dots.map((d, i) => (
          <div key={i} className="absolute rounded-full" style={{ width: 10, height: 10, left: pct(d.h), bottom: 24 + d.k * 12, transform: "translateX(-50%)", background: C.dot }} />
        ))}
        <div className="absolute" style={{ top: 18, left: pct(currentHours), width: 2, height: 74, background: C.fast, transform: "translateX(-1px)" }} />
        <span className={`absolute text-11 font-medium ${mono}`} style={{ top: 0, left: pct(currentHours), transform: "translateX(-50%)", color: C.fast, whiteSpace: "nowrap" }}>now {hm(currentHours)}</span>
        <div className="absolute" style={{ top: 30, left: pct(goalHours), height: 62, borderLeft: `2px dashed ${C.muted}` }} />
      </div>
      <div className="flex justify-between text-13" style={{ color: C.muted }}>
        <span>Median <span className={mono} style={{ color: C.ink }}>{hm(median)}</span></span>
        <span>Longest <span className={mono} style={{ color: C.ink }}>{hm(sorted[sorted.length - 1])}</span></span>
      </div>
    </section>
  );
}
