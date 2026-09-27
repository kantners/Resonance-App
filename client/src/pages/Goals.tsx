import { daysUntil } from "@/lib/dateUtils";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Target, TrendingUp, Scale, Wind, Plus, CheckCircle2, Sparkles, Pencil, Trash2, X, Check } from "lucide-react";

/* ─── Design tokens ──────────────────────────────────────────── */
const GOAL_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  weight:             { color: "#10b981", bg: "rgba(16,185,129,0.10)",  label: "Weight" },
  distance:           { color: "#f97316", bg: "rgba(249,115,22,0.10)",  label: "Distance" },
  performance:        { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   label: "Performance" },
  habit_streak:       { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  label: "Habit / Streak" },
  event:              { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  label: "Event" },
  body_composition:   { color: "#06b6d4", bg: "rgba(6,182,212,0.10)",   label: "Body Composition" },
  recovery_wellness:  { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)",  label: "Recovery / Wellness" },
  // legacy keys kept for back-compat
  pace:               { color: "#f97316", bg: "rgba(249,115,22,0.10)",  label: "Pace" },
  breathwork_streak:  { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  label: "Breathwork" },
  practice_streak:    { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  label: "Practice" },
  volume:             { color: "#f97316", bg: "rgba(249,115,22,0.10)",  label: "Volume" },
  business_revenue:   { color: "#10b981", bg: "rgba(16,185,129,0.10)",  label: "Revenue" },
  other:              { color: "var(--color-text-faint)", bg: "rgba(100,116,139,0.10)", label: "Other" },
  default:            { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", label: "Custom" },
};

function goalColor(type: string) {
  return GOAL_COLORS[type] ?? GOAL_COLORS.default;
}

/* ─── Goal type catalogue ─────────────────────────────────────── */
const GOAL_TYPE_OPTIONS = [
  { value: "weight",            label: "Weight",              emoji: "⚖️" },
  { value: "distance",          label: "Distance",            emoji: "📍" },
  { value: "performance",       label: "Performance",         emoji: "⚡" },
  { value: "habit_streak",      label: "Habit / Streak",      emoji: "🔥" },
  { value: "event",             label: "Event",               emoji: "🏁" },
  { value: "body_composition",  label: "Body Composition",    emoji: "📐" },
  { value: "recovery_wellness", label: "Recovery / Wellness", emoji: "💤" },
  { value: "other",             label: "Other",               emoji: "🎯" },
];

/* ─── Dynamic field definitions per goal type ────────────────── */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string;
}

const ACTIVITY_OPTS = [
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "hiking",  label: "Hiking" },
  { value: "walking", label: "Walking" },
  { value: "swimming",label: "Swimming" },
  { value: "other",   label: "Other" },
];

const GOAL_FIELDS: Record<string, FieldDef[]> = {
  weight: [
    { key: "label",        label: "Goal Name",      type: "text",   placeholder: "Race weight · Lean season", required: true },
    { key: "direction",    label: "Direction",      type: "select", options: [{ value: "lose", label: "Lose" }, { value: "gain", label: "Gain" }], required: true },
    { key: "startValue",   label: "Starting Weight",type: "number", placeholder: "185", required: true, step: "0.1" },
    { key: "targetValue",  label: "Target Weight",  type: "number", placeholder: "170", required: true, step: "0.1" },
    { key: "currentValue", label: "Current Weight", type: "number", placeholder: "186", required: true, step: "0.1" },
    { key: "unit",         label: "Unit",           type: "select", options: [{ value: "lbs", label: "lbs" }, { value: "kg", label: "kg" }] },
    { key: "targetDate",   label: "Target Date",    type: "date",   required: true },
    { key: "notes",        label: "Notes",          type: "text",   placeholder: "Optional" },
  ],
  distance: [
    { key: "label",        label: "Goal Name",       type: "text",   placeholder: "Bike 500 miles · Run a marathon", required: true },
    { key: "activityType", label: "Activity",        type: "select", options: ACTIVITY_OPTS, required: true },
    { key: "targetValue",  label: "Target Distance", type: "number", placeholder: "26.2", required: true, step: "0.1" },
    { key: "currentValue", label: "Current Distance",type: "number", placeholder: "0",    required: true, step: "0.1" },
    { key: "unit",         label: "Unit",            type: "select", options: [{ value: "miles", label: "miles" }, { value: "km", label: "km" }] },
    { key: "targetDate",   label: "Target Date",     type: "date",   required: true },
    { key: "notes",        label: "Notes",           type: "text",   placeholder: "Optional" },
  ],
  performance: [
    { key: "label",        label: "Goal Name",     type: "text",   placeholder: "Sub-8 pace · 300W FTP", required: true },
    { key: "metric",       label: "Metric",        type: "select", options: [
      { value: "pace",     label: "Pace (min/mi)" },
      { value: "power",    label: "Avg Power (W)" },
      { value: "vo2max",   label: "VO2 Max" },
      { value: "hr_max",   label: "Max HR" },
      { value: "other",    label: "Other" },
    ], required: true },
    { key: "activityType", label: "Activity",      type: "select", options: ACTIVITY_OPTS },
    { key: "startValue",   label: "Current Value", type: "number", placeholder: "8.5",  required: true, step: "0.01" },
    { key: "targetValue",  label: "Target Value",  type: "number", placeholder: "7.59", required: true, step: "0.01" },
    { key: "unit",         label: "Unit",          type: "text",   placeholder: "min/mi, W, bpm" },
    { key: "targetDate",   label: "Target Date",   type: "date",   required: true },
    { key: "notes",        label: "Notes",         type: "text",   placeholder: "Optional" },
  ],
  habit_streak: [
    { key: "label",        label: "Goal Name",     type: "text",   placeholder: "30 days breathwork · Daily Zone 2", required: true },
    { key: "habitType",    label: "Habit",         type: "select", options: [
      { value: "breathwork",  label: "Breathwork" },
      { value: "meditation",  label: "Meditation" },
      { value: "zone2",       label: "Zone 2 Training" },
      { value: "strength",    label: "Strength" },
      { value: "sleep",       label: "Sleep Target" },
      { value: "other",       label: "Other" },
    ], required: true },
    { key: "targetValue",  label: "Target Days",   type: "number", placeholder: "30", required: true, step: "1" },
    { key: "currentValue", label: "Current Streak",type: "number", placeholder: "0",  required: true, step: "1" },
    { key: "frequency",    label: "Frequency",     type: "select", options: [
      { value: "daily",       label: "Daily" },
      { value: "5x_week",     label: "5x / week" },
      { value: "3x_week",     label: "3x / week" },
    ]},
    { key: "targetDate",   label: "Target Date",   type: "date",   required: true },
    { key: "notes",        label: "Notes",         type: "text",   placeholder: "Optional" },
  ],
  event: [
    { key: "label",        label: "Event Name",    type: "text",   placeholder: "Boston Marathon · Gran Fondo", required: true },
    { key: "activityType", label: "Event Type",    type: "select", options: [
      { value: "running",    label: "Running" },
      { value: "cycling",    label: "Cycling" },
      { value: "triathlon",  label: "Triathlon" },
      { value: "hiking",     label: "Hiking" },
      { value: "swimming",   label: "Swimming" },
      { value: "other",      label: "Other" },
    ], required: true },
    { key: "targetValue",  label: "Distance",      type: "number", placeholder: "26.2", step: "0.1" },
    { key: "unit",         label: "Unit",          type: "select", options: [{ value: "miles", label: "miles" }, { value: "km", label: "km" }] },
    { key: "targetDate",   label: "Event Date",    type: "date",   required: true },
    { key: "notes",        label: "Notes",         type: "text",   placeholder: "Location, bib number, etc." },
  ],
  body_composition: [
    { key: "label",        label: "Goal Name",     type: "text",   placeholder: "Drop to 12% BF · Add 5lbs muscle", required: true },
    { key: "metric",       label: "Metric",        type: "select", options: [
      { value: "body_fat",   label: "Body Fat %" },
      { value: "muscle_mass",label: "Muscle Mass" },
      { value: "waist",      label: "Waist (in)" },
      { value: "other",      label: "Other" },
    ], required: true },
    { key: "startValue",   label: "Starting Value",type: "number", placeholder: "18",  required: true, step: "0.1" },
    { key: "targetValue",  label: "Target Value",  type: "number", placeholder: "12",  required: true, step: "0.1" },
    { key: "currentValue", label: "Current Value", type: "number", placeholder: "17",  required: true, step: "0.1" },
    { key: "unit",         label: "Unit",          type: "text",   placeholder: "%, lbs, in" },
    { key: "targetDate",   label: "Target Date",   type: "date",   required: true },
    { key: "notes",        label: "Notes",         type: "text",   placeholder: "Optional" },
  ],
  recovery_wellness: [
    { key: "label",        label: "Goal Name",       type: "text",   placeholder: "HRV 65+ · Resting HR under 48", required: true },
    { key: "metric",       label: "Metric",          type: "select", options: [
      { value: "hrv",         label: "Avg HRV" },
      { value: "resting_hr",  label: "Resting HR" },
      { value: "sleep_hours", label: "Sleep Hours / Night" },
      { value: "other",       label: "Other" },
    ], required: true },
    { key: "startValue",   label: "Baseline Value",  type: "number", placeholder: "52", required: true, step: "0.1" },
    { key: "targetValue",  label: "Target Value",    type: "number", placeholder: "65", required: true, step: "0.1" },
    { key: "currentValue", label: "Current Value",   type: "number", placeholder: "54", required: true, step: "0.1" },
    { key: "window",       label: "Measurement Window", type: "select", options: [
      { value: "7day",  label: "Rolling 7-day" },
      { value: "30day", label: "Rolling 30-day" },
    ]},
    { key: "targetDate",   label: "Target Date",     type: "date",   required: true },
    { key: "notes",        label: "Notes",           type: "text",   placeholder: "Optional" },
  ],
  other: [
    { key: "label",        label: "Goal Name",     type: "text",   placeholder: "Describe your goal", required: true },
    { key: "startValue",   label: "Start Value",   type: "number", placeholder: "0",   step: "0.01" },
    { key: "targetValue",  label: "Target Value",  type: "number", placeholder: "100", required: true, step: "0.01" },
    { key: "currentValue", label: "Current Value", type: "number", placeholder: "0",   step: "0.01" },
    { key: "unit",         label: "Unit",          type: "text",   placeholder: "lbs, miles, reps…" },
    { key: "targetDate",   label: "Target Date",   type: "date",   required: true },
    { key: "notes",        label: "Notes",         type: "text",   placeholder: "Optional" },
  ],
};
// Fall back to "other" fields for any legacy types
function getFields(type: string): FieldDef[] {
  return GOAL_FIELDS[type] ?? GOAL_FIELDS.other;
}

/* ─── Dynamic field renderer ─────────────────────────────────── */
function GoalField({ def, value, onChange, isMobile, visible }: {
  def: FieldDef; value: string; onChange: (v: string) => void;
  isMobile: boolean; visible: boolean;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
    marginBottom: 4, display: "block",
    textTransform: "uppercase", letterSpacing: "0.06em",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 14,
    border: "1.5px solid var(--color-border)",
    borderRadius: 10, background: "var(--color-bg)",
    color: "var(--color-text)", outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  };

  // Mobile: stepped reveal via opacity+height animation
  const wrapStyle: React.CSSProperties = isMobile ? {
    overflow: "hidden",
    maxHeight: visible ? 90 : 0,
    opacity: visible ? 1 : 0,
    transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease",
    marginBottom: visible ? 12 : 0,
  } : { marginBottom: 12 };

  return (
    <div style={wrapStyle}>
      <label style={labelStyle}>{def.label}{def.required && <span style={{ color: "#ef4444" }}> *</span>}</label>
      {def.type === "select" ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          required={def.required}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">Select…</option>
          {def.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : def.type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          required={def.required}
          min={new Date().toISOString().slice(0, 10)}
          max="2028-12-31"
          style={inputStyle}
        />
      ) : (
        <input
          type={def.type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={def.placeholder}
          required={def.required}
          step={def.step}
          style={inputStyle}
        />
      )}
    </div>
  );
}

function goalIcon(type: string) {
  const sz = 16;
  switch (type) {
    case "weight":            return <Scale size={sz} />;
    case "pace":              return <TrendingUp size={sz} />;
    case "breathwork_streak": return <Wind size={sz} />;
    default:                  return <Target size={sz} />;
  }
}

/* ─── Business logic (preserved exactly) ────────────────────── */
function progressPct(g: any): number {
  const range = g.startValue - g.targetValue;
  if (range === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((g.startValue - g.currentValue) / range) * 100)));
}

function projectGoal(g: any): string {
  const daysLeft = daysUntil(g.targetDate);
  if (daysLeft <= 0) return "Target date reached.";
  const remaining = g.currentValue - g.targetValue;
  if (remaining <= 0) return "Goal achieved!";

  if (g.type === "weight") {
    const weeksLeft = daysLeft / 7;
    const projLoss = weeksLeft * 0.6;
    const projWeight = Math.round((g.currentValue - projLoss) * 10) / 10;
    return `At 300 cal/day deficit: projected ${projWeight} lbs by ${g.targetDate}. ${projWeight <= g.targetValue ? "On track ✓" : `Need ${((remaining / weeksLeft) * 7 / 3500 * 1000).toFixed(0)} cal/day deficit.`}`;
  }
  if (g.type === "breathwork_streak") {
    return `${daysLeft} days remaining. Log daily to build your streak.`;
  }
  return `${daysLeft} days remaining to reach target.`;
}

/* ─── Animated SVG ring ──────────────────────────────────────── */
function ProgressRing({ pct, color, current, unit }: { pct: number; color: string; current: number; unit: string }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const displayPct = animated ? pct : 0;
  const R = 68;
  const circumference = 2 * Math.PI * R;
  const offset = circumference - (displayPct / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ overflow: "visible" }}>
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${color.replace("#","")}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx="80" cy="80" r={R}
          fill="none"
          stroke="rgba(0,0,0,0.07)"
          strokeWidth="10"
        />

        {/* Progress arc */}
        <circle
          cx="80" cy="80" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 80 80)"
          filter={`url(#glow-${color.replace("#","")})`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
        />

        {/* Center pct */}
        <text x="80" y="76" textAnchor="middle" dominantBaseline="middle"
          className="g-ring-pct"
          style={{ fontSize: 24, fontWeight: 700, fill: "#0f172a", fontFamily: "inherit" }}>
          {displayPct}%
        </text>

        {/* Center sub-label */}
        <text x="80" y="97" textAnchor="middle" dominantBaseline="middle"
          className="g-ring-sub"
          style={{ fontSize: 12, fill: "#94a3b8", fontFamily: "inherit", fontWeight: 500 }}>
          complete
        </text>
      </svg>

      {/* Current value below ring */}
      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)" }}>{current}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-faint)", marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

/* ─── Goal Card ──────────────────────────────────────────────── */
const CSS = `
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes modalIn {
  from { opacity: 0; transform: translateY(40px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.goal-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  backdrop-filter: blur(4px);
}
.goal-modal-sheet {
  background: #fff;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 20px 20px 28px;
  animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
  box-shadow: 0 -8px 48px rgba(0,0,0,0.18);
}
.goal-modal-handle {
  width: 40px;
  height: 4px;
  background: #e2e8f0;
  border-radius: 99px;
  margin: 0 auto 20px;
}
.gcard {
  animation: fadeSlideUp 0.5s ease both;
  animation-delay: calc(var(--i) * 120ms);
}
.gcard:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06) !important;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.gcard-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 28px;
  width: 100%;
}
.gbar-fill {
  transition: width 1.3s cubic-bezier(0.34,1.56,0.64,1);
}
.gedit-btn:hover {
  background: rgba(0,0,0,0.04) !important;
}
.ginput {
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  color: #0f172a;
  width: 100%;
  box-sizing: border-box;
}
.ginput:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
}
.ginput-sm {
  width: 100px !important;
  padding: 7px 10px !important;
  font-size: 13px !important;
}
/* ── Mobile: stack ring above content ── */
@media (max-width: 540px) {
  .gcard-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  .gcard-ring {
    align-self: center;
  }
  .gcard-content {
    width: 100%;
  }
  .goals-page-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  .goals-page-header h1 {
    font-size: 24px !important;
  }
}

/* ─── Your Goals dark-theme rendering ──────────────────────────────────────
   Scoped overrides under .goals-page-root so light theme is unchanged.
   Each goal card carries an inline background gradient ending in #fff;
   in dark theme we override that with !important to land on a deep slate
   surface while keeping the per-goal accent tint as a soft wash. The
   modal sheet, ginput field, and surrounding labels follow the same
   warm-white-on-deep-slate pattern. */
[data-theme='dark'] .goals-page-root .gcard {
  background: linear-gradient(135deg, rgba(16,185,129,0.10) 0%, transparent 60%), #15171c !important;
  border-color: rgba(255,255,255,0.06) !important;
  box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.30) !important;
}
[data-theme='dark'] .goals-page-root .gcard:hover {
  box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35) !important;
}
[data-theme='dark'] .goals-page-root .ginput {
  background: #1f232b;
  color: #f5f7fa;
  border-color: rgba(255,255,255,0.10);
}
[data-theme='dark'] .goals-page-root .gedit-btn:hover {
  background: rgba(255,255,255,0.06) !important;
}
[data-theme='dark'] .goal-modal-sheet {
  background: #15171c;
  box-shadow: 0 -8px 48px rgba(0,0,0,0.55);
  color: #f5f7fa;
}
[data-theme='dark'] .goal-modal-handle {
  background: rgba(255,255,255,0.18);
}
/* Goal ring percent + sub-label are SVG <text> elements with hardcoded
   fill colors; override via class so the percent reads white on the dark
   card surface. !important is required to beat the inline style fill. */
[data-theme='dark'] .goals-page-root .g-ring-pct {
  fill: #ffffff !important;
}
[data-theme='dark'] .goals-page-root .g-ring-sub {
  fill: rgba(255,255,255,0.65) !important;
}
`;

function GoalCard({ goal, onUpdate, onDelete, onFullEdit, index }: {
  goal: any;
  onUpdate: (id: number, val: number) => void;
  onDelete: (id: number) => void;
  onFullEdit: (goal: any) => void;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [val, setVal] = useState(goal.currentValue);
  const pct = progressPct(goal);
  const { color, bg } = goalColor(goal.type);
  const projection = projectGoal(goal);
  const achieved = pct >= 100;

  return (
    <div
      className="gcard"
      data-testid={`goal-card-${goal.id}`}
      style={{
        "--i": index,
        background: `linear-gradient(135deg, ${bg} 0%, transparent 60%), #fff`,
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderTop: `3px solid ${color}`,
        padding: "28px 28px",
        marginBottom: 16,
        position: "relative",
        overflow: "hidden",
      } as any}
    >
      <div className="gcard-inner">
      {/* Left: Ring */}
      <div className="gcard-ring">
        <ProgressRing pct={pct} color={color} current={goal.currentValue} unit={goal.unit} />
      </div>

      {/* Right: Content */}
      <div className="gcard-content" style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color, display: "flex", alignItems: "center" }}>{goalIcon(goal.type)}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.3px" }}>{goal.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {achieved && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#10b981", background: "rgba(16,185,129,0.1)", borderRadius: 20, padding: "3px 10px" }}>
                <CheckCircle2 size={12} /> Achieved
              </span>
            )}
            <button
              onClick={() => onFullEdit(goal)}
              title="Edit goal"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--color-text-faint)" }}
              data-testid={`button-full-edit-goal-${goal.id}`}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete goal"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center", color: "#ef4444" }}
              data-testid={`button-delete-goal-${goal.id}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "10px 12px", background: "rgba(239,68,68,0.06)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>
            <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-faint)" }}>Delete this goal?</span>
            <button onClick={() => { onDelete(goal.id); setConfirmDelete(false); }}
              style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)}
              style={{ padding: "5px 10px", fontSize: 12, color: "var(--color-text-faint)", background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}

        {/* Current / Target */}
        <div style={{ fontSize: 13, color: "var(--color-text-faint)", marginBottom: 10, fontWeight: 500 }}>
          Current: <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>{goal.currentValue} {goal.unit}</span>
          <span style={{ margin: "0 8px", color: "var(--color-text-faint)" }}>·</span>
          Target: <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>{goal.targetValue} {goal.unit}</span>
          {goal.targetDate && (
            <>
              <span style={{ margin: "0 8px", color: "var(--color-text-faint)" }}>·</span>
              <span style={{ color: "var(--color-text-faint)" }}>Due {goal.targetDate}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 99, height: 6, width: "100%", marginBottom: 10, overflow: "hidden" }}>
          <div
            className="gbar-fill"
            style={{
              height: "100%",
              borderRadius: 99,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              width: `${pct}%`,
              boxShadow: `0 0 8px ${color}66`,
            }}
          />
        </div>

        {/* Projection */}
        <p style={{ fontSize: 12, color: "var(--color-text-faint)", fontStyle: "italic", margin: "0 0 14px", lineHeight: 1.5 }}>
          {projection}
        </p>

        {goal.notes && (
          <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: "0 0 12px" }}>{goal.notes}</p>
        )}

        {/* Edit inline */}
        {editing ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              step="0.1"
              className="ginput ginput-sm"
              value={val}
              onChange={e => setVal(parseFloat(e.target.value))}
              data-testid={`input-update-goal-${goal.id}`}
            />
            <button
              style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: color, color: "#fff", borderRadius: 10, border: "none", cursor: "pointer" }}
              onClick={() => { onUpdate(goal.id, val); setEditing(false); }}
              data-testid={`button-save-goal-${goal.id}`}
            >
              Save
            </button>
            <button
              style={{ padding: "7px 12px", fontSize: 13, color: "var(--color-text-faint)", background: "transparent", border: "1px solid #e2e8f0", borderRadius: 10, cursor: "pointer" }}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <button
              className="gedit-btn"
              style={{ padding: "7px 16px", fontSize: 13, fontWeight: 500, color: "var(--color-text-faint)", background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, cursor: "pointer", transition: "background 0.2s" }}
              onClick={() => setEditing(true)}
              data-testid={`button-edit-goal-${goal.id}`}
            >
              Update Value
            </button>
          </div>
        )}
      </div>
      </div>{/* end gcard-inner */}
    </div>
  );
}

const BLANK_FORM = { type: "weight", label: "", startValue: "", targetValue: "", currentValue: "", targetDate: "", unit: "", notes: "" };

/* ─── Add Goal Form (modal bottom sheet) ───────────────────── */
const BLANK_DYNAMIC: Record<string, string> = {};

function AddGoalForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState("weight");
  const [values, setValues] = useState<Record<string, string>>(BLANK_DYNAMIC);
  const [apiError, setApiError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  // Mobile stepped reveal: track how many fields are visible
  const [visibleCount, setVisibleCount] = useState(1);
  const isMobile = window.innerWidth < 768;

  const fields = getFields(type);
  const { color } = goalColor(type);

  // When type changes, reset values and restart stepped reveal
  useEffect(() => {
    setValues({});
    setVisibleCount(1);
  }, [type]);

  // On mobile, reveal next field when current one has a value
  useEffect(() => {
    if (!isMobile) return;
    const filled = fields.slice(0, visibleCount).every(f => values[f.key]?.trim());
    if (filled && visibleCount < fields.length) {
      const t = setTimeout(() => setVisibleCount(c => c + 1), 120);
      return () => clearTimeout(t);
    }
  }, [values, visibleCount, fields, isMobile]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const set = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }));

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/goals", data),
    onSuccess: (_res, vars: any) => {
      qc.invalidateQueries({ queryKey: ["/api/goals"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      setLastAdded(vars.label);
      setAddedCount(c => c + 1);
      setValues({});
      setVisibleCount(1);
      setApiError(null);
    },
    onError: (e: any) => setApiError(e?.message || "Could not save."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const payload: any = { type, status: "active" };
    fields.forEach(f => {
      const v = values[f.key] ?? "";
      if (f.key === "startValue" || f.key === "targetValue" || f.key === "currentValue") {
        payload[f.key] = v ? parseFloat(v) : undefined;
      } else {
        payload[f.key] = v || undefined;
      }
    });
    // Ensure label is set
    if (!payload.label) return;
    // Fallback: if startValue not in this goal type's fields, seed from currentValue or 0
    if (payload.startValue === undefined) payload.startValue = payload.currentValue ?? 0;
    // Fallback: if currentValue not in fields, seed from startValue
    if (payload.currentValue === undefined) payload.currentValue = payload.startValue ?? 0;
    mut.mutate(payload);
  };

  return ReactDOM.createPortal(
    <div className="goal-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="goal-modal-sheet">
        <div className="goal-modal-handle" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color={color} />
            <span style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.3px" }}>New Goal</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--color-text-faint)" }}>&#x2715;</button>
        </div>

        {/* Goal type picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {GOAL_TYPE_OPTIONS.map(opt => {
            const active = type === opt.value;
            const { color: c, bg } = goalColor(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 20,
                  border: active ? `1.5px solid ${c}` : "1.5px solid var(--color-border)",
                  background: active ? bg : "transparent",
                  color: active ? c : "var(--color-text-muted)",
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: "pointer", transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{opt.emoji}</span> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Running count banner */}
        {addedCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 10 }}>
            <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--color-primary)", flex: 1 }}><strong>{lastAdded}</strong> added.</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.14)", borderRadius: 20, padding: "2px 10px" }}>{addedCount} added</span>
          </div>
        )}

        {apiError && (
          <div style={{ background: "#fff1f2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            <strong>Save failed:</strong> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Desktop: two-column grid, all fields visible at once */}
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 16 }}>
              {fields.map(f => (
                <div key={f.key} style={f.key === "label" || f.key === "notes" ? { gridColumn: "1 / -1" } : {}}>
                  <GoalField def={f} value={values[f.key] ?? ""} onChange={v => set(f.key, v)} isMobile={false} visible={true} />
                </div>
              ))}
            </div>
          )}

          {/* Mobile: stepped reveal */}
          {isMobile && (
            <div style={{ marginBottom: 16 }}>
              {fields.map((f, i) => (
                <GoalField key={f.key} def={f} value={values[f.key] ?? ""} onChange={v => set(f.key, v)} isMobile={true} visible={i < visibleCount} />
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={mut.isPending}
              data-testid="button-create-goal"
              style={{ flex: 1, padding: "13px 0", fontSize: 15, fontWeight: 700, background: color, color: "#fff", borderRadius: 12, border: "none", cursor: mut.isPending ? "not-allowed" : "pointer", opacity: mut.isPending ? 0.7 : 1, letterSpacing: "0.01em", boxShadow: `0 4px 16px ${color}55`, transition: "opacity 0.2s" }}
            >
              {mut.isPending ? "Saving…" : "Add Goal"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "13px 20px", fontSize: 14, color: "var(--color-text-faint)", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, cursor: "pointer" }}>
              {addedCount > 0 ? "Done" : "Cancel"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Edit Goal Form (modal bottom sheet) ──────────────────── */
function EditGoalForm({ goal, onClose }: { goal: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState(goal.type ?? "weight");
  // Pre-populate from existing goal data
  const [values, setValues] = useState<Record<string, string>>({
    label:        String(goal.label        ?? ""),
    startValue:   String(goal.startValue   ?? ""),
    targetValue:  String(goal.targetValue  ?? ""),
    currentValue: String(goal.currentValue ?? ""),
    targetDate:   String(goal.targetDate   ?? ""),
    unit:         String(goal.unit         ?? ""),
    notes:        String(goal.notes        ?? ""),
    metric:       String(goal.metric       ?? ""),
    activityType: String(goal.activityType ?? ""),
    direction:    String(goal.direction    ?? ""),
    habitType:    String(goal.habitType    ?? ""),
    frequency:    String(goal.frequency    ?? ""),
    window:       String(goal.window       ?? ""),
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const isMobile = window.innerWidth < 768;
  const fields = getFields(type);
  const { color } = goalColor(type);
  const set = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/goals/${goal.id}`, data),
    onSuccess: () => {
      toast({ title: "Goal updated" });
      qc.invalidateQueries({ queryKey: ["/api/goals"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      onClose();
    },
    onError: (e: any) => setApiError(e?.message || "Could not save."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const payload: any = { type };
    fields.forEach(f => {
      const v = values[f.key] ?? "";
      if (f.key === "startValue" || f.key === "targetValue" || f.key === "currentValue") {
        payload[f.key] = v ? parseFloat(v) : undefined;
      } else {
        payload[f.key] = v || undefined;
      }
    });
    if (payload.startValue === undefined) payload.startValue = payload.currentValue ?? 0;
    if (payload.currentValue === undefined) payload.currentValue = payload.startValue ?? 0;
    mut.mutate(payload);
  };

  return ReactDOM.createPortal(
    <div className="goal-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="goal-modal-sheet">
        <div className="goal-modal-handle" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil size={18} color={color} />
            <span style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.3px" }}>Edit Goal</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--color-text-faint)" }}>&#x2715;</button>
        </div>

        {/* Goal type picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {GOAL_TYPE_OPTIONS.map(opt => {
            const active = type === opt.value;
            const { color: c, bg } = goalColor(opt.value);
            return (
              <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: active ? `1.5px solid ${c}` : "1.5px solid var(--color-border)", background: active ? bg : "transparent", color: active ? c : "var(--color-text-muted)", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
              >
                <span>{opt.emoji}</span> {opt.label}
              </button>
            );
          })}
        </div>

        {apiError && (
          <div style={{ background: "#fff1f2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            <strong>Save failed:</strong> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 16 }}>
              {fields.map(f => (
                <div key={f.key} style={f.key === "label" || f.key === "notes" ? { gridColumn: "1 / -1" } : {}}>
                  <GoalField def={f} value={values[f.key] ?? ""} onChange={v => set(f.key, v)} isMobile={false} visible={true} />
                </div>
              ))}
            </div>
          )}
          {isMobile && (
            <div style={{ marginBottom: 16 }}>
              {fields.map(f => (
                <GoalField key={f.key} def={f} value={values[f.key] ?? ""} onChange={v => set(f.key, v)} isMobile={false} visible={true} />
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={mut.isPending} data-testid="button-save-edit-goal"
              style={{ flex: 1, padding: "13px 0", fontSize: 15, fontWeight: 700, background: color, color: "#fff", borderRadius: 12, border: "none", cursor: mut.isPending ? "not-allowed" : "pointer", opacity: mut.isPending ? 0.7 : 1, letterSpacing: "0.01em", boxShadow: `0 4px 16px ${color}55`, transition: "opacity 0.2s" }}
            >
              {mut.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "13px 20px", fontSize: 14, color: "var(--color-text-faint)", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Empty State ────────────────────────────────────────────── */
function EmptyGoals({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ marginBottom: 24 }}>
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="8" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 50 * 0.3} ${2 * Math.PI * 50 * 0.7}`}
          transform="rotate(-90 60 60)"
          style={{ opacity: 0.7 }} />
        <circle cx="60" cy="60" r="18" fill="rgba(16,185,129,0.1)" />
        <line x1="60" y1="51" x2="60" y2="69" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
        <line x1="51" y1="60" x2="69" y2="60" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", marginBottom: 10, letterSpacing: "-0.4px" }}>
        Set your first goal
      </h3>
      <p style={{ fontSize: 15, color: "var(--color-text-faint)", maxWidth: 340, lineHeight: 1.6, marginBottom: 28 }}>
        Set your first goal to begin tracking your progress
      </p>
      <button
        onClick={onAdd}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 15, fontWeight: 700, background: "#10b981", color: "#fff", borderRadius: 99, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }}
      >
        <Plus size={18} /> Add First Goal
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function GoalsPage() {
  const { data: goals, isLoading } = useQuery<any[]>({ queryKey: ["/api/goals"] });
  const [showAdd, setShowAdd] = useState(false);
  const [editGoal, setEditGoal] = useState<any | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: ({ id, currentValue }: { id: number; currentValue: number }) =>
      apiRequest("PATCH", `/api/goals/${id}`, { currentValue }),
    onSuccess: () => {
      toast({ title: "Goal updated" });
      qc.invalidateQueries({ queryKey: ["/api/goals"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/goals/${id}`),
    onSuccess: () => {
      toast({ title: "Goal deleted" });
      qc.invalidateQueries({ queryKey: ["/api/goals"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
    },
  });

  const hasGoals = goals && goals.length > 0;

  return (
    <div className="goals-page-root">
      {/* Inject CSS */}
      <style>{CSS}</style>

      {/* Cinematic Hero — full bleed, outside padded wrapper */}
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 0 }}>
          <img
            src="/hero_goals.jpg"
            alt=""
            className="kewt-cin-hero__img"
            style={{ objectPosition: "center 55%" }}
          />
          <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,15)" } as React.CSSProperties} />
          <div className="kewt-cin-hero__content">
            <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>
              {goals && goals.length > 0 ? `${goals.length} active goal${goals.length !== 1 ? "s" : ""}` : "No goals set yet"}
            </div>
            <div className="kewt-cin-hero__title">Your<br/>Goals.</div>
            <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
            <div className="kewt-cin-hero__sub">Track progress against your targets.</div>
          </div>
        </div>

      {/* Padded content wrapper */}
      <div style={{ maxWidth: "var(--page-max, 1120px)", margin: "0 auto", padding: "0 20px 24px" }}>
        {/* BEW restore callout - clean, no image */}
        <div style={{
          borderRadius: 16,
          marginBottom: 16,
          padding: "14px 18px",
          background: "linear-gradient(135deg, rgba(13,39,68,0.07) 0%, rgba(91,200,216,0.08) 100%)",
          border: "1px solid rgba(91,200,216,0.18)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔥</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5bc8d8", marginBottom: 4 }}>
              Blue Ember Wellness · Restore
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", fontStyle: "italic", lineHeight: 1.4 }}>
              Small, sustainable habits beat all-or-nothing.
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "var(--color-text-faint)", fontSize: 15 }}>
            Loading goals…
          </div>
        )}

        {/* Add Goal button — always visible when goals exist */}
        {!isLoading && hasGoals && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--color-primary)",
                color: "#fff",
                border: "none", borderRadius: 12,
                padding: "10px 20px",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em",
              }}
            >
              + Add Goal
            </button>
          </div>
        )}

        {/* Goal cards */}
        {!isLoading && hasGoals && (
          <div>
            {goals.map((g: any, i: number) => (
              <GoalCard
                key={g.id}
                goal={g}
                index={i}
                onUpdate={(id, val) => updateMut.mutate({ id, currentValue: val })}
                onDelete={(id) => deleteMut.mutate(id)}
                onFullEdit={(goal) => setEditGoal(goal)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasGoals && (
          <EmptyGoals onAdd={() => setShowAdd(true)} />
        )}

        {/* Add Goal Form */}
        {showAdd && <AddGoalForm onClose={() => setShowAdd(false)} />}

        {/* Edit Goal Form */}
        {editGoal && <EditGoalForm goal={editGoal} onClose={() => setEditGoal(null)} />}
      </div>
    </div>
  );
}
