import { addDays, fmtHeaderDate } from "@/lib/dates";
import { BackIcon, ChevronIcon } from "./Icons";

/** "‹ THU · SEP 24 ›": step the day being logged; never past `max`. */
export function DateStepper({ date, onChange, max, prefix }: {
  date: string; onChange: (d: string) => void; max: string; prefix?: string;
}) {
  const atMax = date >= max;
  return (
    <span className="flex items-center gap-0.5 font-mono text-12 tracking-header text-muted">
      <button type="button" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}
        className="w-9 h-9 flex items-center justify-center bg-transparent border-0 text-muted cursor-pointer"><BackIcon size={16} /></button>
      <span aria-live="polite">{prefix}{fmtHeaderDate(date)}</span>
      <button type="button" aria-label="Next day" disabled={atMax} onClick={() => onChange(addDays(date, 1))}
        className="w-9 h-9 flex items-center justify-center bg-transparent border-0 text-muted cursor-pointer disabled:opacity-30 disabled:cursor-default"><ChevronIcon size={16} /></button>
    </span>
  );
}
