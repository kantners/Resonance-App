/**
 * KEWT DatePicker
 * Tap-to-open calendar popover, warm linen + emerald design.
 * Features: quick chips (Today/Yesterday/etc), tracking start lock (Apr 13 2026),
 * month grid navigation, smooth animation.
 *
 * Usage:
 *   <DatePicker value="2026-04-26" onChange={v => setDate(v)} color="#065f46" />
 *
 * value / onChange use YYYY-MM-DD strings, same as <input type="date">.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TRACKING_START = new Date(2026, 3, 13); // Apr 13 2026 — no entries before this
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const DP_CSS = `
.dp-wrap { position: relative; display: block; }

.dp-trigger {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--color-border, rgba(0,0,0,0.12));
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 150ms, box-shadow 150ms;
  -webkit-tap-highlight-color: transparent;
}
.dp-trigger:focus { outline: none; }
.dp-trigger--open {
  border-color: var(--dp-color, #065f46);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-color, #065f46) 15%, transparent);
}
.dp-trigger-icon { opacity: 0.45; flex-shrink: 0; }
.dp-trigger-val { flex: 1; }
.dp-trigger-placeholder { color: var(--color-text-muted); }

/* Popover */
.dp-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 9999;
  width: 296px;
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, rgba(0,0,0,0.10));
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.14);
  overflow: hidden;
  animation: dp-in 160ms cubic-bezier(0.22,1,0.36,1);
  transform-origin: top left;
}
@keyframes dp-in {
  from { opacity: 0; transform: scale(0.94) translateY(-6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Quick chips */
.dp-chips {
  display: flex;
  gap: 5px;
  padding: 12px 12px 8px;
  flex-wrap: wrap;
}
.dp-chip {
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--color-border, rgba(0,0,0,0.10));
  background: var(--color-bg);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 130ms;
  white-space: nowrap;
}
.dp-chip:hover { border-color: var(--dp-color, #065f46); color: var(--dp-color, #065f46); }
.dp-chip--active { background: var(--dp-color, #065f46); color: #fff; border-color: var(--dp-color, #065f46); }

/* Month nav */
.dp-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
}
.dp-nav-btn {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: background 130ms;
}
.dp-nav-btn:hover { background: var(--color-bg); color: var(--color-text); }
.dp-nav-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.dp-nav-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

/* Day grid */
.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 0 8px 12px;
}
.dp-dow {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dp-day {
  height: 36px;
  width: 36px;
  margin: 0 auto;
  border-radius: 50%;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms, color 120ms;
  -webkit-tap-highlight-color: transparent;
}
.dp-day:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-color, #065f46) 12%, transparent); color: var(--dp-color, #065f46); }
.dp-day--today {
  font-weight: 800;
  color: var(--dp-color, #065f46);
}
.dp-day--selected {
  background: var(--dp-color, #065f46) !important;
  color: #fff !important;
  font-weight: 700;
}
.dp-day--outside { color: var(--color-text-muted); opacity: 0.35; }
.dp-day--locked { opacity: 0.2; cursor: not-allowed; }
.dp-day--empty { pointer-events: none; }

/* Dark mode */
[data-theme="dark"] .dp-popover {
  background: #1e2025;
  border-color: rgba(255,255,255,0.10);
  box-shadow: 0 8px 40px rgba(0,0,0,0.45);
}
[data-theme="dark"] .dp-trigger { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .dp-chip { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); }
`;

let dpCssInjected = false;
function injectDpCss() {
  if (dpCssInjected || typeof document === "undefined") return;
  dpCssInjected = true;
  const el = document.createElement("style");
  el.id = "kewt-dp-css";
  el.textContent = DP_CSS;
  document.head.appendChild(el);
}

// ── Quick chip helpers ────────────────────────────────────────────────────────
function buildChips(): { label: string; date: Date }[] {
  const t = today();
  const chips: { label: string; date: Date }[] = [
    { label: "Today",     date: t },
    { label: "Yesterday", date: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1) },
    { label: "2 days ago", date: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2) },
  ];
  // This morning (6am) -- useful for sleep/activity
  return chips.filter(c => c.date >= TRACKING_START);
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

// ── DatePicker component ──────────────────────────────────────────────────────
interface DatePickerProps {
  value: string;           // YYYY-MM-DD
  onChange: (v: string) => void;
  color?: string;
  placeholder?: string;
  minDate?: Date;          // defaults to TRACKING_START
  maxDate?: Date;          // defaults to today
  disabled?: boolean;
  "data-testid"?: string;
}

export function DatePicker({
  value,
  onChange,
  color = "#065f46",
  placeholder = "Select date",
  minDate = TRACKING_START,
  maxDate,
  disabled = false,
  "data-testid": testId,
}: DatePickerProps) {
  injectDpCss();

  const max = maxDate ?? today();
  const selected = value ? fromYMD(value) : null;

  // View month — start at selected or today
  const initView = selected ?? today();
  const [viewYear, setViewYear]   = useState(initView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initView.getMonth());
  const [open, setOpen]           = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const selectDate = useCallback((d: Date) => {
    onChange(toYMD(d));
    setOpen(false);
  }, [onChange]);

  const chips = buildChips();

  // Month grid
  const firstDow  = firstDayOfWeek(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const canPrevMonth = () => {
    const first = new Date(viewYear, viewMonth, 1);
    const minFirst = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    return first > minFirst;
  };
  const canNextMonth = () => {
    const first = new Date(viewYear, viewMonth, 1);
    const maxFirst = new Date(max.getFullYear(), max.getMonth(), 1);
    return first < maxFirst;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const displayValue = selected
    ? selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";

  return (
    <div
      className="dp-wrap"
      ref={wrapRef}
      style={{ "--dp-color": color } as React.CSSProperties}
    >
      {/* Trigger */}
      <button
        type="button"
        className={`dp-trigger${open ? " dp-trigger--open" : ""}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        disabled={disabled}
        data-testid={testId}
        style={{ borderColor: open ? color : undefined }}
      >
        <Calendar size={15} className="dp-trigger-icon" />
        <span className={`dp-trigger-val${!displayValue ? " dp-trigger-placeholder" : ""}`}>
          {displayValue || placeholder}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="dp-popover">
          {/* Quick chips */}
          <div className="dp-chips">
            {chips.map(c => (
              <button
                key={c.label}
                type="button"
                className={`dp-chip${selected && isSameDay(selected, c.date) ? " dp-chip--active" : ""}`}
                onClick={() => selectDate(c.date)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="dp-nav">
            <button type="button" className="dp-nav-btn" onClick={prevMonth} disabled={!canPrevMonth()}>
              <ChevronLeft size={16} />
            </button>
            <span className="dp-nav-label">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className="dp-nav-btn" onClick={nextMonth} disabled={!canNextMonth()}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Grid */}
          <div className="dp-grid">
            {/* Day-of-week headers */}
            {DAYS.map(d => <div key={d} className="dp-dow">{d}</div>)}

            {/* Day cells */}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="dp-day dp-day--empty" />;

              const cellDate  = new Date(viewYear, viewMonth, day);
              const isLocked  = cellDate < minDate || cellDate > max;
              const isSel     = selected ? isSameDay(cellDate, selected) : false;
              const isTod     = isSameDay(cellDate, today());

              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "dp-day",
                    isSel    ? "dp-day--selected" : "",
                    isTod && !isSel ? "dp-day--today" : "",
                    isLocked ? "dp-day--locked"   : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => !isLocked && selectDate(cellDate)}
                  disabled={isLocked}
                  tabIndex={isLocked ? -1 : 0}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
