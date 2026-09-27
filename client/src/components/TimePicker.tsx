/**
 * KEWT TimePicker
 * Tap-to-open time popover with scrollable hour + minute drums.
 * AM/PM toggle, quick chips (Now, This morning, Noon, etc).
 *
 * Usage:
 *   <TimePicker value="22:30" onChange={v => setTime(v)} color="#065f46" />
 *
 * value / onChange: "HH:MM" 24-hour strings (same as <input type="time">).
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Clock } from "lucide-react";

// ── CSS ───────────────────────────────────────────────────────────────────────
const TP_CSS = `
.tp-wrap { position: relative; display: block; }

.tp-trigger {
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
.tp-trigger:focus { outline: none; }
.tp-trigger--open {
  border-color: var(--tp-color, #065f46);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tp-color, #065f46) 15%, transparent);
}
.tp-trigger-icon { opacity: 0.45; flex-shrink: 0; }
.tp-trigger-val { flex: 1; }
.tp-trigger-placeholder { color: var(--color-text-muted); }

/* Popover — portalled to body, position set via JS */
.tp-popover {
  position: fixed;
  z-index: 99999;
  width: 260px;
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, rgba(0,0,0,0.10));
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.14);
  overflow: hidden;
  animation: tp-in 160ms cubic-bezier(0.22,1,0.36,1);
  transform-origin: top left;
}
@keyframes tp-in {
  from { opacity: 0; transform: scale(0.94) translateY(-6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Quick chips */
.tp-chips {
  display: flex;
  gap: 5px;
  padding: 12px 12px 8px;
  flex-wrap: wrap;
}
.tp-chip {
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
.tp-chip:hover { border-color: var(--tp-color, #065f46); color: var(--tp-color, #065f46); }
.tp-chip--active { background: var(--tp-color, #065f46); color: #fff; border-color: var(--tp-color, #065f46); }

/* Drum container */
.tp-drums {
  display: flex;
  align-items: stretch;
  padding: 0 12px 4px;
  gap: 6px;
}
.tp-drum-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.tp-drum-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}
.tp-drum {
  width: 100%;
  height: 160px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border: 1.5px solid var(--color-border, rgba(0,0,0,0.10));
  border-radius: 12px;
  background: var(--color-bg);
  position: relative;
}
.tp-drum::-webkit-scrollbar { display: none; }
.tp-drum-item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: start;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 120ms, background 120ms;
  border-radius: 8px;
  margin: 0 3px;
}
.tp-drum-item--selected {
  color: var(--tp-color, #065f46);
  background: color-mix(in srgb, var(--tp-color, #065f46) 10%, transparent);
}
/* Highlight rail */
.tp-drum::before, .tp-drum::after {
  content: "";
  display: block;
  height: 60px;
  flex-shrink: 0;
}

/* AM/PM toggle */
.tp-ampm-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 50px;
  flex-shrink: 0;
}
.tp-ampm-btn {
  width: 100%;
  height: 72px;
  border-radius: 10px;
  border: 1.5px solid var(--color-border, rgba(0,0,0,0.10));
  background: var(--color-bg);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 150ms;
}
.tp-ampm-btn--active {
  background: var(--tp-color, #065f46);
  color: #fff;
  border-color: var(--tp-color, #065f46);
}

/* Confirm row */
.tp-confirm-row {
  display: flex;
  gap: 6px;
  padding: 10px 12px 14px;
}
.tp-confirm-btn {
  flex: 1;
  padding: 10px;
  border-radius: 12px;
  border: none;
  background: var(--tp-color, #065f46);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 150ms;
}
.tp-confirm-btn:hover { opacity: 0.88; }

/* Large preview */
.tp-preview {
  text-align: center;
  font-size: 32px;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
  padding: 8px 0 4px;
  font-variant-numeric: tabular-nums;
}
.tp-preview-ampm {
  font-size: 14px;
  font-weight: 700;
  color: var(--tp-color, #065f46);
  margin-left: 4px;
}

/* Divider */
.tp-divider {
  height: 1px;
  background: var(--color-border, rgba(0,0,0,0.07));
  margin: 4px 12px;
}

/* Dark mode */
[data-theme="dark"] .tp-popover {
  background: #1e2025;
  border-color: rgba(255,255,255,0.10);
  box-shadow: 0 8px 40px rgba(0,0,0,0.45);
}
[data-theme="dark"] .tp-trigger { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .tp-chip { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); }
[data-theme="dark"] .tp-drum { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); }
[data-theme="dark"] .tp-ampm-btn { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); }
`;

let tpCssInjected = false;
function injectTpCss() {
  if (tpCssInjected || typeof document === "undefined") return;
  tpCssInjected = true;
  const el = document.createElement("style");
  el.id = "kewt-tp-css";
  el.textContent = TP_CSS;
  document.head.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function padZ(n: number) { return String(n).padStart(2, "0"); }

function parseHHMM(val: string): { h: number; m: number } {
  if (!val) {
    const now = new Date();
    return { h: now.getHours(), m: now.getMinutes() };
  }
  const [h, m] = val.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

function toHHMM(h: number, m: number): string {
  return `${padZ(h)}:${padZ(m)}`;
}

function formatDisplay(val: string): string {
  if (!val) return "";
  const { h, m } = parseHHMM(val);
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${padZ(m)} ${ampm}`;
}

// Quick time chips
const TIME_CHIPS = [
  { label: "Now",    getValue: () => { const n = new Date(); return toHHMM(n.getHours(), Math.round(n.getMinutes() / 5) * 5 % 60); } },
  { label: "6 AM",   getValue: () => "06:00" },
  { label: "8 AM",   getValue: () => "08:00" },
  { label: "Noon",   getValue: () => "12:00" },
  { label: "10 PM",  getValue: () => "22:00" },
  { label: "11 PM",  getValue: () => "23:00" },
];

// ── Drum component (scrollable list) ─────────────────────────────────────────
function Drum({
  items,
  selected,
  onSelect,
  color,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM_H = 40;

  // Scroll to selected on mount + when selected changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) {
      el.scrollTop = idx * ITEM_H;
    }
  }, [selected, items]);

  return (
    <div className="tp-drum" ref={ref}>
      {/* Top spacer for centering */}
      <div style={{ height: 60 }} />
      {items.map(v => (
        <div
          key={v}
          className={`tp-drum-item${v === selected ? " tp-drum-item--selected" : ""}`}
          onClick={() => onSelect(v)}
          style={v === selected ? { color } : {}}
        >
          {padZ(v)}
        </div>
      ))}
      {/* Bottom spacer */}
      <div style={{ height: 60 }} />
    </div>
  );
}

// ── TimePicker ────────────────────────────────────────────────────────────────
interface TimePickerProps {
  value: string;           // "HH:MM" 24h
  onChange: (v: string) => void;
  color?: string;
  placeholder?: string;
  disabled?: boolean;
  quickChips?: { label: string; getValue: () => string }[];
  "data-testid"?: string;
}

export function TimePicker({
  value,
  onChange,
  color = "#065f46",
  placeholder = "Select time",
  disabled = false,
  quickChips = TIME_CHIPS,
  "data-testid": testId,
}: TimePickerProps) {
  injectTpCss();

  const parsed  = parseHHMM(value || "");
  const initH12 = parsed.h % 12 === 0 ? 12 : parsed.h % 12;
  const initAm  = parsed.h < 12;

  const [open, setOpen]   = useState(false);
  const [hour, setHour]   = useState(value ? initH12 : new Date().getHours() % 12 || 12);
  const [min, setMin]     = useState(value ? parsed.m : Math.round(new Date().getMinutes() / 5) * 5 % 60);
  const [isAm, setIsAm]   = useState(value ? initAm : new Date().getHours() < 12);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const wrapRef    = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync state when value prop changes
  useEffect(() => {
    if (!value) return;
    const p = parseHHMM(value);
    setHour(p.h % 12 === 0 ? 12 : p.h % 12);
    setMin(p.m);
    setIsAm(p.h < 12);
  }, [value]);

  // Measure trigger position when opening
  const openPicker = useCallback(() => {
    if (disabled) return;
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popH = 420; // approx popover height
      const top = spaceBelow >= popH ? rect.bottom + 6 : rect.top - popH - 6;
      const left = Math.min(rect.left, window.innerWidth - 268);
      setPopoverPos({ top, left });
    }
    setOpen(o => !o);
  }, [disabled, open]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapRef.current && !wrapRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler as any);
    document.addEventListener("touchstart", handler as any);
    return () => {
      document.removeEventListener("mousedown", handler as any);
      document.removeEventListener("touchstart", handler as any);
    };
  }, [open]);

  const to24h = useCallback((h12: number, am: boolean): number => {
    if (am)  return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  }, []);

  const confirm = () => {
    onChange(toHHMM(to24h(hour, isAm), min));
    setOpen(false);
  };

  const applyChip = (val: string) => {
    onChange(val);
    const p = parseHHMM(val);
    setHour(p.h % 12 === 0 ? 12 : p.h % 12);
    setMin(p.m);
    setIsAm(p.h < 12);
    setOpen(false);
  };

  const hours   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  // Live preview
  const previewH = hour;
  const previewAmpm = isAm ? "AM" : "PM";

  return (
    <div
      className="tp-wrap"
      ref={wrapRef}
      style={{ "--tp-color": color } as React.CSSProperties}
    >
      <button
        type="button"
        className={`tp-trigger${open ? " tp-trigger--open" : ""}`}
        onClick={openPicker}
        disabled={disabled}
        data-testid={testId}
        style={{ borderColor: open ? color : undefined }}
      >
        <Clock size={15} className="tp-trigger-icon" />
        <span className={`tp-trigger-val${!value ? " tp-trigger-placeholder" : ""}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {open && popoverPos && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          className="tp-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          {/* Quick chips */}
          <div className="tp-chips">
            {quickChips.map(c => {
              const chipVal = c.getValue();
              return (
                <button
                  key={c.label}
                  type="button"
                  className={`tp-chip${value === chipVal ? " tp-chip--active" : ""}`}
                  onClick={() => applyChip(chipVal)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="tp-divider" />

          {/* Live preview */}
          <div className="tp-preview">
            {padZ(previewH)}:{padZ(min)}
            <span className="tp-preview-ampm">{previewAmpm}</span>
          </div>

          {/* Drums */}
          <div className="tp-drums">
            <div className="tp-drum-col">
              <div className="tp-drum-label">Hour</div>
              <Drum items={hours} selected={hour} onSelect={setHour} color={color} />
            </div>
            <div className="tp-drum-col">
              <div className="tp-drum-label">Min</div>
              <Drum items={minutes} selected={min} onSelect={v => setMin(v)} color={color} />
            </div>
            <div className="tp-ampm-col">
              <div className="tp-drum-label">&#8203;</div>
              <button
                type="button"
                className={`tp-ampm-btn${isAm ? " tp-ampm-btn--active" : ""}`}
                onClick={() => setIsAm(true)}
                style={isAm ? { background: color, borderColor: color } : {}}
              >AM</button>
              <button
                type="button"
                className={`tp-ampm-btn${!isAm ? " tp-ampm-btn--active" : ""}`}
                onClick={() => setIsAm(false)}
                style={!isAm ? { background: color, borderColor: color } : {}}
              >PM</button>
            </div>
          </div>

          {/* Confirm */}
          <div className="tp-confirm-row">
            <button type="button" className="tp-confirm-btn" style={{ background: color }} onClick={confirm}>
              Set {padZ(previewH)}:{padZ(min)} {previewAmpm}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default TimePicker;
