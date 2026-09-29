// The day's phone pickups on a strip (design: Main "Quiet" card).
// Layer 0 data is the iOS hourly estimate: each waking hour is either quiet
// (no pickups; a physiology-quiet band) or carries exposure ticks scaled by
// its pickup count. Android per-pickup events arrive with native capture.
export function QuietStrip({ hourly, wakeHour = 7, sleepHour = 24, ariaLabel }: {
  hourly: number[]; wakeHour?: number; sleepHour?: number; ariaLabel: string;
}) {
  const W = 310, H = 40, base = 34;
  const hours = sleepHour - wakeHour;
  const w = W / hours;
  const max = Math.max(1, ...hourly.slice(wakeHour, sleepHour));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className="block">
      {Array.from({ length: hours }, (_, i) => {
        const h = wakeHour + i;
        const n = hourly[h] ?? 0;
        const x = i * w;
        if (n === 0) {
          return <rect key={h} x={x + 0.5} y={2} width={w - 1} height={base - 2} rx={3} className="fill-physiology" fillOpacity={0.24} />;
        }
        // Up to 6 ticks per hour, spread across the hour.
        const ticks = Math.max(1, Math.round((n / max) * 6));
        return (
          <g key={h} className="stroke-exposure" strokeWidth={1.2} strokeOpacity={0.85}>
            {Array.from({ length: ticks }, (_, t) => {
              const tx = x + ((t + 0.5) * w) / ticks;
              return <line key={t} x1={tx} y1={6} x2={tx} y2={base} />;
            })}
          </g>
        );
      })}
      <line x1={0} y1={base} x2={W} y2={base} className="stroke-control" strokeWidth={1} />
    </svg>
  );
}
