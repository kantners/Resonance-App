import type { RangeDto, WeekLabel } from "@shared/api";
import { fmt1, pct } from "@/lib/format";

const LABEL_TEXT: Record<Exclude<WeekLabel, "building_baseline">, string> = {
  steady: "Steady",
  drifting_down: "Drifting down",
  recovering: "Recovering",
};

/**
 * The week label. Amendment B7: it is never shown without the number of
 * nights it rests on, so `nights` is required.
 */
export function WeekLabelHeading({ label, nights }: { label: Exclude<WeekLabel, "building_baseline">; nights: number }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="font-serif text-44 font-medium leading-none">{LABEL_TEXT[label]}</span>
      <span className="font-mono text-13 text-muted">· {nights} of 7 nights</span>
    </div>
  );
}

/**
 * A 7-night average against the normal range: track, range band, marker.
 * The visible span is a fixed multiple of the range width, centred on the
 * range, widened if needed so the marker always stays on the track.
 */
export function RangeBar({ value, range, spanFactor, ariaLabel }: {
  value: number; range: RangeDto; spanFactor: number; ariaLabel: string;
}) {
  const mid = (range.low + range.high) / 2;
  const half = Math.max(((range.high - range.low) * spanFactor) / 2, Math.abs(value - mid) * 1.15);
  const lo = mid - half, hi = mid + half;
  const left = pct(range.low, lo, hi);
  const width = pct(range.high, lo, hi) - left;
  return (
    <div role="img" aria-label={ariaLabel} className="relative h-3">
      <div className="absolute inset-x-0 top-1 h-1 rounded-[2px] bg-track" />
      <div
        className="absolute top-px h-2.5 rounded-[3px] box-border bg-physiology-range border border-physiology-range-line"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      <div
        className="absolute top-0 w-3 h-3 rounded-full box-border bg-ink border-2 border-surface"
        style={{ left: `calc(${pct(value, lo, hi)}% - 6px)` }}
      />
    </div>
  );
}

export function rangeText(r: RangeDto, unit: string, digits = 1) {
  const f = (x: number) => (digits ? fmt1(x) : String(Math.round(x)));
  return `${f(r.low)} to ${f(r.high)} ${unit}`;
}
