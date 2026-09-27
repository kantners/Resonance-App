import { localToday, localDate, fmtLocalDate, isToday } from "@/lib/dateUtils";
import { useState, useEffect } from "react";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Moon, Sun, Heart, Wind, Zap, Activity, Brain,
  TrendingUp, Plus, ChevronDown, ChevronUp, ChevronRight, Star
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

/* ─── Types ──────────────────────────────────────────────────── */
interface SleepLog {
  id: number; date: string; hours: number; quality: number;
  sleepScore?: number; restingHr?: number; avgOvernightHr?: number;
  deepMin?: number; lightMin?: number; remMin?: number; awakeMin?: number;
  restlessMoments?: number; hrv?: number; spo2Avg?: number; spo2Low?: number;
  respirationAvg?: number; respirationLow?: number; stress?: number;
  bodyBatteryChange?: number; hrvStatus?: string; moodMorning?: number; notes?: string;
  fellAsleep?: string; wokeUp?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmtHM = (min?: number) => {
  if (!min) return "--";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtHours = (h: number) => {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};
const scoreColor = (s?: number) => {
  if (!s) return "#6b7280";
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
};
const scoreLabel = (s?: number) => {
  if (!s) return "No data";
  if (s >= 90) return "Excellent";
  if (s >= 80) return "Good";
  if (s >= 60) return "Fair";
  return "Poor";
};
const qualityBadgeColor = (q: string) => {
  if (q === "Excellent") return { bg: "#d1fae5", text: "#065f46" };
  if (q === "Good")      return { bg: "#dbeafe", text: "#1e40af" };
  if (q === "Fair")      return { bg: "#fef3c7", text: "#92400e" };
  return { bg: "#fee2e2", text: "#991b1b" };
};

/* ─── CSS ─────────────────────────────────────────────────────── */
const CSS = `
@keyframes sd-rise { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes sd-score-fill { from { stroke-dashoffset: 603; } to { stroke-dashoffset: var(--target-offset); } }

.sd-page { min-height: 100%; font-family: 'Inter', system-ui, sans-serif; }

.sd-hero {
  position: relative; overflow: hidden;
  background: linear-gradient(160deg, #0c1445 0%, #0f2057 30%, #1a1040 60%, #0c2340 100%);
  padding: 36px 24px 30px;
  text-align: center;
  filter: brightness(1.10);

}
.sd-hero::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.3) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.15) 0%, transparent 50%);
  pointer-events: none;
}
.sd-star { position: absolute; border-radius: 50%; background: #fff; animation: sd-twinkle 3s ease-in-out infinite; }
@keyframes sd-twinkle { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.4)} }

.sd-score-ring-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
.sd-score-ring { transform: rotate(-90deg); }
.sd-score-ring-track { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 10; stroke-linecap: round; }
.sd-score-ring-fill  { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1); }
.sd-score-inner { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0; }
.sd-score-num { font-size: 86px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -3px; }
.sd-score-sub { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 6px; }

.sd-total-sleep { font-size: 28px; font-weight: 700; color: #fff; letter-spacing: -0.5px; margin-bottom: 4px; }
.sd-sleep-label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; }
.sd-date-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 99px; padding: 5px 14px; font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500; margin-top: 12px; }

.sd-stage-pills { display: flex; justify-content: center; gap: 16px; margin-top: 24px; flex-wrap: wrap; }
.sd-stage-pill { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.sd-stage-dot { width: 10px; height: 10px; border-radius: 50%; margin-bottom: 2px; }
.sd-stage-time { font-size: 16px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px; }
.sd-stage-name { font-size: 10px; color: rgba(0,0,0,0.4); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
[data-theme='dark'] .sd-stage-time { color: #fff; }
[data-theme='dark'] .sd-stage-name { color: rgba(255,255,255,0.45); }

.sd-body { background: hsl(36 20% 97%); padding: 0 16px 60px; }
.sd-section { animation: sd-rise 0.5s ease both; }
.sd-section + .sd-section { margin-top: 8px; }

.sd-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 12px;
  position: relative;
}
.sd-card-header { padding: 16px 18px 0; display: flex; align-items: center; gap: 8px; }
.sd-card-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }

.sd-vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #f1f5f9; }
.sd-vital { background: #fff; padding: 16px 18px; }
.sd-vital-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.sd-vital-val { font-size: 24px; font-weight: 700; color: #111827; line-height: 1; letter-spacing: -0.5px; }
.sd-vital-unit { font-size: 11px; color: #9ca3af; font-weight: 500; margin-left: 2px; }
.sd-vital-label { font-size: 11px; color: #9ca3af; font-weight: 500; margin-top: 2px; }
.sd-vital-sub { font-size: 10px; color: #d1d5db; margin-top: 1px; }

.sd-factor { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid #f1f5f9; }
.sd-factor:last-child { border-bottom: none; }
.sd-factor-left { display: flex; flex-direction: column; gap: 2px; }
.sd-factor-name { font-size: 13px; font-weight: 600; color: #374151; }
.sd-factor-val  { font-size: 11px; color: #9ca3af; font-weight: 500; }
.sd-factor-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }

.sd-bar-wrap { padding: 0 18px 18px; }
.sd-bar-track { height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
.sd-bar-fill { height: 100%; border-radius: 99px; transition: width 1s cubic-bezier(0.4,0,0.2,1); }
.sd-bar-labels { display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; font-weight: 500; }

.sd-trend-wrap { padding: 12px 0 4px; }

.sd-add-btn {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  width: 100%; padding: 14px;
  background: linear-gradient(135deg, #0f2057, #1a1040);
  color: #fff; border: none; border-radius: 14px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  margin-top: 4px; letter-spacing: 0.01em;
  box-shadow: 0 4px 20px rgba(15,32,87,0.3);
}

.sd-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 14px 14px; }
.sd-form-full { grid-column: 1 / -1; }
.sd-form-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; display: block; }
.sd-form-input {
  width: 100%; padding: 7px 10px; font-size: 13px; font-weight: 500;
  border: 1.5px solid #e5e7eb; border-radius: 8px; color: #111827;
  background: #fafafa; outline: none; box-sizing: border-box;
  transition: border-color 0.15s;
}
.sd-form-input:focus { border-color: #6366f1; background: #fff; }

@media (max-width: 767px) {
  .sd-hero { filter: brightness(1.2); }
}
@media (min-width: 768px) {
  .sd-body { padding: 0 28px 100px; }
  .sd-cards-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .sd-vitals-grid { grid-template-columns: repeat(3, 1fr); }
  .sd-form-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1024px) {
  .sd-hero { padding: 60px 40px 52px; }
  .sd-body { max-width: var(--page-max, 1120px); margin: 0 auto; }
  .sd-cards-row { grid-template-columns: 1fr 1fr 1fr; }
  .sd-vitals-grid { grid-template-columns: repeat(6, 1fr); }
}

/* ─── Morning Interpretation (Hybrid Night Report) ───────────────────────────
   Deterministic, scientifically careful copy. Theme-aware: warm-linen
   surface in light, dark-linen in dark with an emerald/teal left rail.
   Collapsed by default. */
.sd-mi {
  position: relative;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-left: 3px solid #14b8a6;
  border-radius: 18px;
  margin-bottom: 12px;
  overflow: hidden;
}
[data-theme='dark'] .sd-mi {
  background: #15171c;
  border-color: rgba(255,255,255,0.06);
  border-left-color: #2dd4bf;
}
.sd-mi-header {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 14px 16px;
  background: none; border: none; cursor: pointer;
  text-align: left; font-family: inherit;
  color: #1a1a1a;
}
[data-theme='dark'] .sd-mi-header { color: #f5f7fa; }
.sd-mi-title {
  font-size: 13px; font-weight: 700; letter-spacing: -0.01em;
  flex-shrink: 0;
}
.sd-mi-summary {
  font-size: 11px; color: #6b7280;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 500;
}
[data-theme='dark'] .sd-mi-summary { color: rgba(255,255,255,0.7); }
.sd-mi-chev { color: #94a3b8; flex-shrink: 0; }
[data-theme='dark'] .sd-mi-chev { color: rgba(255,255,255,0.55); }
.sd-mi-body { padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.sd-mi-section { padding: 10px 12px; background: rgba(20,184,166,0.05); border-radius: 12px; }
[data-theme='dark'] .sd-mi-section { background: rgba(45,212,191,0.07); }
.sd-mi-sub {
  font-size: 11px; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: #d97706; margin-bottom: 5px;
}
[data-theme='dark'] .sd-mi-sub { color: #fbbf24; }
.sd-mi-text {
  font-size: 13px; line-height: 1.5; color: #1f2937;
}
[data-theme='dark'] .sd-mi-text { color: #f1f5f9; }

/* ─── Sleep page dark-theme rendering ──────────────────────────────────────
   Scoped overrides under .sd-page so light theme is byte-equivalent to
   before. Card surfaces become deep slate, body becomes near-black/navy,
   text becomes warm-white with silver muted, while the existing cyan +
   lavender Sleep accents stay loud against the dark surface. */
[data-theme='dark'] .sd-page                 { background: #0b0f17; }
[data-theme='dark'] .sd-body                 { background: #0b0f17; }
[data-theme='dark'] .sd-card                 { background: #15171c; box-shadow: 0 1px 4px rgba(0,0,0,0.45); }
[data-theme='dark'] .sd-card-title           { color: #fbbf24; }
[data-theme='dark'] .sd-vitals-grid          { background: rgba(255,255,255,0.06); }
[data-theme='dark'] .sd-vital                { background: #15171c; }
[data-theme='dark'] .sd-vital-val            { color: #f5f7fa; }
[data-theme='dark'] .sd-vital-unit           { color: rgba(255,255,255,0.55); }
[data-theme='dark'] .sd-vital-label          { color: rgba(255,255,255,0.65); }
[data-theme='dark'] .sd-vital-sub            { color: rgba(255,255,255,0.50); }
[data-theme='dark'] .sd-factor               { border-bottom-color: rgba(255,255,255,0.06); }
[data-theme='dark'] .sd-factor-name          { color: #f1f5f9; }
[data-theme='dark'] .sd-factor-val           { color: rgba(255,255,255,0.62); }
[data-theme='dark'] .sd-bar-track            { background: rgba(255,255,255,0.08); }
[data-theme='dark'] .sd-bar-labels           { color: rgba(255,255,255,0.55); }

/* ─── 14-Day Recovery Pattern card + status chips ──────────────────────── */
.sd-rp {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-left: 3px solid #14b8a6;
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
[data-theme='dark'] .sd-rp {
  background: #15171c;
  border-color: rgba(255,255,255,0.06);
  border-left-color: #2dd4bf;
}
.sd-rp-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #d97706;
  margin-bottom: 6px;
}
[data-theme='dark'] .sd-rp-head { color: #fbbf24; }
.sd-rp-summary {
  font-size: 13px; line-height: 1.5;
  color: #1f2937;
  margin-bottom: 8px;
}
[data-theme='dark'] .sd-rp-summary { color: #f1f5f9; }
.sd-rp-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 6px;
}
.sd-chip {
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 99px;
  display: inline-flex; align-items: center;
}
.sd-chip--stable    { background: rgba(16,185,129,0.14); color: #065f46; }
.sd-chip--watch     { background: rgba(245,158,11,0.18); color: #92400e; }
.sd-chip--strained  { background: rgba(239,68,68,0.16);  color: #991b1b; }
.sd-chip--muted     { background: rgba(100,116,139,0.16); color: #475569; }
[data-theme='dark'] .sd-chip--stable    { color: #6ee7b7; }
[data-theme='dark'] .sd-chip--watch     { color: #fbbf24; }
[data-theme='dark'] .sd-chip--strained  { color: #fca5a5; }
[data-theme='dark'] .sd-chip--muted     { color: #cbd5e1; }

/* ─── Metric Insight Drawer (bottom sheet) ─────────────────────────────── */
.sd-mid-backdrop {
  position: fixed; inset: 0; z-index: 4000;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: flex-end; justify-content: center;
  animation: sd-mid-fade 160ms ease;
}
@keyframes sd-mid-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sd-mid-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
.sd-mid-sheet {
  width: 100%; max-width: 540px;
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 14px 18px 24px;
  box-shadow: 0 -8px 32px rgba(0,0,0,0.16);
  max-height: 86vh; overflow-y: auto;
  animation: sd-mid-slide 220ms cubic-bezier(0.22,1,0.36,1);
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}
[data-theme='dark'] .sd-mid-sheet { background: #15171c; box-shadow: 0 -8px 32px rgba(0,0,0,0.55); }
.sd-mid-handle {
  width: 38px; height: 4px; border-radius: 99px;
  background: rgba(0,0,0,0.15);
  margin: 2px auto 12px;
}
[data-theme='dark'] .sd-mid-handle { background: rgba(255,255,255,0.18); }
.sd-mid-header {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  margin-bottom: 12px;
}
[data-theme='dark'] .sd-mid-header { border-bottom-color: rgba(255,255,255,0.06); }
.sd-mid-title {
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  color: #1a1a1a; flex: 1;
}
[data-theme='dark'] .sd-mid-title { color: #f5f7fa; }
.sd-mid-close {
  background: rgba(0,0,0,0.06); border: none; cursor: pointer;
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #475569; line-height: 1;
}
[data-theme='dark'] .sd-mid-close { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.78); }
.sd-mid-body { display: flex; flex-direction: column; gap: 12px; }
.sd-mid-body section { padding: 10px 12px; background: rgba(20,184,166,0.06); border-radius: 12px; }
[data-theme='dark'] .sd-mid-body section { background: rgba(45,212,191,0.07); }
.sd-mid-sub {
  font-size: 10px; font-weight: 800; letter-spacing: 0.10em; text-transform: uppercase;
  color: #d97706; margin-bottom: 5px;
}
[data-theme='dark'] .sd-mid-sub { color: #fbbf24; }
.sd-mid-text { font-size: 13px; line-height: 1.5; color: #1f2937; }
[data-theme='dark'] .sd-mid-text { color: #f1f5f9; }

/* Tappable trend row affordance */
.sd-trend-row {
  cursor: pointer;
  border-radius: 10px;
  transition: background 140ms;
  -webkit-tap-highlight-color: transparent;
}
.sd-trend-row:hover { background: rgba(20,184,166,0.05); }
[data-theme='dark'] .sd-trend-row:hover { background: rgba(45,212,191,0.07); }
.sd-trend-row:focus-visible { outline: 2px solid #14b8a6; outline-offset: 2px; }
`;

/* ─── Score Ring ──────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const R = 96, C = 2 * Math.PI * R;
  const pct = Math.min(score, 100) / 100;
  const offset = C * (1 - pct);
  const color = scoreColor(score);
  return (
    <div className="sd-score-ring-wrap" style={{ width: 260, height: 260 }}>
      <svg className="sd-score-ring" width={260} height={260} viewBox="0 0 260 260">
        <circle className="sd-score-ring-track" cx={130} cy={130} r={R} />
        <circle
          className="sd-score-ring-fill"
          cx={130} cy={130} r={R}
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="sd-score-inner">
        <span className="sd-score-num" style={{ color }}>{score}</span>
        <span className="sd-score-sub">Sleep Score</span>
      </div>
    </div>
  );
}

/* ─── Stage Bar Chart ─────────────────────────────────────────── */
function StageBar({ entry }: { entry: SleepLog }) {
  const total = (entry.deepMin || 0) + (entry.lightMin || 0) + (entry.remMin || 0) + (entry.awakeMin || 0);
  if (!total) return null;
  const stages = [
    { label: "Deep",  min: entry.deepMin  || 0, color: "#4f46e5" },
    { label: "Light", min: entry.lightMin || 0, color: "#7dd3fc" },
    { label: "REM",   min: entry.remMin   || 0, color: "#e879f9" },
    { label: "Awake", min: entry.awakeMin || 0, color: "#fbbf24" },
  ];
  return (
    <div style={{ padding: "14px 18px 18px" }}>
      {/* Stacked bar */}
      <div style={{ height: 14, borderRadius: 99, overflow: "hidden", display: "flex", marginBottom: 14 }}>
        {stages.map(s => (
          <div key={s.label} style={{ width: `${(s.min / total) * 100}%`, background: s.color, transition: "width 1s ease" }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        {stages.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", lineHeight: 1 }}>{fmtHM(s.min)}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Vital Tile ──────────────────────────────────────────────── */
function Vital({ icon, iconBg, val, unit, label, sub }: {
  icon: React.ReactNode; iconBg: string;
  val: string | number; unit?: string; label: string; sub?: string;
}) {
  return (
    <div className="sd-vital">
      <div className="sd-vital-icon" style={{ background: iconBg }}>{icon}</div>
      <div>
        <span className="sd-vital-val">{val}</span>
        {unit && <span className="sd-vital-unit">{unit}</span>}
      </div>
      <div className="sd-vital-label">{label}</div>
      {sub && <div className="sd-vital-sub">{sub}</div>}
    </div>
  );
}

/* ─── Trend Sparkline ─────────────────────────────────────────── */
function TrendLine({ data, color, dataKey }: { data: any[]; color: string; dataKey: string }) {
  if (!data.length) return <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-text-faint)" }}>No Recovery history yet</div>;
  return (
    <div style={{ height: 70 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#sg-${dataKey})`} dot={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }} labelStyle={{ display: "none" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Score Factor Row ────────────────────────────────────────── */
function Factor({ name, value, rating }: { name: string; value: string; rating: string }) {
  const { bg, text } = qualityBadgeColor(rating);
  return (
    <div className="sd-factor">
      <div className="sd-factor-left">
        <span className="sd-factor-name">{name}</span>
        <span className="sd-factor-val">{value}</span>
      </div>
      <span className="sd-factor-badge" style={{ background: bg, color: text }}>{rating}</span>
    </div>
  );
}

/* ─── Add Entry Form ──────────────────────────────────────────── */
function AddEntryForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: localToday(),
    hours: "", quality: "7", sleepScore: "",
    deepMin: "", lightMin: "", remMin: "", awakeMin: "",
    restingHr: "", avgOvernightHr: "", hrv: "",
    spo2Avg: "", spo2Low: "", respirationAvg: "", respirationLow: "",
    stress: "", bodyBatteryChange: "", hrvStatus: "", restlessMoments: "",
    fellAsleep: "", wokeUp: "", moodMorning: "", notes: "",
  });

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const n = (v: string) => v ? parseFloat(v) : undefined;
  const i = (v: string) => v ? parseInt(v) : undefined;

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sleep", data),
    onSuccess: () => { toast({ title: "Sleep logged to KEWT Recovery" }); qc.invalidateQueries({ queryKey: ["/api/sleep"] }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="sd-card" style={{ margin: "12px 0" }}>
      <div className="sd-card-header" style={{ paddingBottom: 0 }}>
        <Moon size={14} color="#6366f1" />
        <span className="sd-card-title">Log Sleep from Garmin Screenshots</span>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        mut.mutate({
          date: form.date, hours: parseFloat(form.hours), quality: parseInt(form.quality),
          sleepScore: i(form.sleepScore), deepMin: i(form.deepMin), lightMin: i(form.lightMin),
          remMin: i(form.remMin), awakeMin: i(form.awakeMin),
          restingHr: i(form.restingHr), avgOvernightHr: i(form.avgOvernightHr),
          hrv: n(form.hrv), spo2Avg: n(form.spo2Avg), spo2Low: n(form.spo2Low),
          respirationAvg: n(form.respirationAvg), respirationLow: n(form.respirationLow),
          stress: i(form.stress), bodyBatteryChange: i(form.bodyBatteryChange),
          hrvStatus: form.hrvStatus || undefined, restlessMoments: i(form.restlessMoments),
          fellAsleep: form.fellAsleep || undefined, wokeUp: form.wokeUp || undefined,
          moodMorning: i(form.moodMorning), notes: form.notes || undefined,
        });
      }}>
        <div className="sd-form-grid">
          <div><label className="sd-form-label">Date *</label>
            <DatePicker value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} color="#6366f1" />
          </div>
          <div><label className="sd-form-label">Total Hours *</label><input className="sd-form-input" type="number" step="0.1" required placeholder="10.9" value={form.hours} onChange={f("hours")} /></div>
          <div><label className="sd-form-label">Sleep Score</label><input className="sd-form-input" type="number" placeholder="88" value={form.sleepScore} onChange={f("sleepScore")} /></div>
          <div><label className="sd-form-label">Quality (1-10) *</label><input className="sd-form-input" type="number" min="1" max="10" required value={form.quality} onChange={f("quality")} /></div>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sleep Stages</span>
          </div>
          <div><label className="sd-form-label">Deep (min)</label><input className="sd-form-input" type="number" placeholder="115" value={form.deepMin} onChange={f("deepMin")} /></div>
          <div><label className="sd-form-label">Light (min)</label><input className="sd-form-input" type="number" placeholder="325" value={form.lightMin} onChange={f("lightMin")} /></div>
          <div><label className="sd-form-label">REM (min)</label><input className="sd-form-input" type="number" placeholder="214" value={form.remMin} onChange={f("remMin")} /></div>
          <div><label className="sd-form-label">Awake (min)</label><input className="sd-form-input" type="number" placeholder="7" value={form.awakeMin} onChange={f("awakeMin")} /></div>
          <div><label className="sd-form-label">Restless Moments</label><input className="sd-form-input" type="number" placeholder="30" value={form.restlessMoments} onChange={f("restlessMoments")} /></div>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Vitals</span>
          </div>
          <div><label className="sd-form-label">Resting HR</label><input className="sd-form-input" type="number" placeholder="45" value={form.restingHr} onChange={f("restingHr")} /></div>
          <div><label className="sd-form-label">Avg Overnight HR</label><input className="sd-form-input" type="number" placeholder="49" value={form.avgOvernightHr} onChange={f("avgOvernightHr")} /></div>
          <div><label className="sd-form-label">Avg HRV (ms)</label><input className="sd-form-input" type="number" step="0.1" placeholder="47" value={form.hrv} onChange={f("hrv")} /></div>
          <div><label className="sd-form-label">Avg SpO2 (%)</label><input className="sd-form-input" type="number" step="0.1" placeholder="95" value={form.spo2Avg} onChange={f("spo2Avg")} /></div>
          <div><label className="sd-form-label">Low SpO2 (%)</label><input className="sd-form-input" type="number" step="0.1" placeholder="83" value={form.spo2Low} onChange={f("spo2Low")} /></div>
          <div><label className="sd-form-label">Avg Respiration</label><input className="sd-form-input" type="number" step="0.1" placeholder="14" value={form.respirationAvg} onChange={f("respirationAvg")} /></div>
          <div><label className="sd-form-label">Low Respiration</label><input className="sd-form-input" type="number" step="0.1" placeholder="8" value={form.respirationLow} onChange={f("respirationLow")} /></div>
          <div><label className="sd-form-label">Stress Score</label><input className="sd-form-input" type="number" placeholder="17" value={form.stress} onChange={f("stress")} /></div>
          <div><label className="sd-form-label">Body Battery</label><input className="sd-form-input" type="number" placeholder="+57" value={form.bodyBatteryChange} onChange={f("bodyBatteryChange")} /></div>
          <div><label className="sd-form-label">HRV Status</label><input className="sd-form-input" type="text" placeholder="Balanced" value={form.hrvStatus} onChange={f("hrvStatus")} /></div>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Context</span>
          </div>
          <div><label className="sd-form-label">Fell Asleep</label>
            <TimePicker
              value={form.fellAsleep}
              onChange={v => setForm(p => ({ ...p, fellAsleep: v }))}
              color="#6366f1"
              quickChips={[
                { label: "9 PM",  getValue: () => "21:00" },
                { label: "10 PM", getValue: () => "22:00" },
                { label: "11 PM", getValue: () => "23:00" },
                { label: "Mid",   getValue: () => "00:00" },
              ]}
            />
          </div>
          <div><label className="sd-form-label">Woke Up</label>
            <TimePicker
              value={form.wokeUp}
              onChange={v => setForm(p => ({ ...p, wokeUp: v }))}
              color="#6366f1"
              quickChips={[
                { label: "5 AM", getValue: () => "05:00" },
                { label: "6 AM", getValue: () => "06:00" },
                { label: "7 AM", getValue: () => "07:00" },
                { label: "8 AM", getValue: () => "08:00" },
              ]}
            />
          </div>
          <div><label className="sd-form-label">Morning Mood (1-10)</label><input className="sd-form-input" type="number" min="1" max="10" placeholder="8" value={form.moodMorning} onChange={f("moodMorning")} /></div>
          <div className="sd-form-full"><label className="sd-form-label">Notes</label><input className="sd-form-input" type="text" placeholder="Notes from Garmin or observations" value={form.notes} onChange={f("notes")} /></div>

          <div className="sd-form-full" style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={mut.isPending} style={{ flex: 1, padding: "12px 0", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", opacity: mut.isPending ? 0.7 : 1 }}>
              {mut.isPending ? "Saving…" : "Log Sleep"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "12px 20px", fontSize: 13, color: "var(--color-text-faint)", background: "#f3f4f6", border: "none", borderRadius: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ─── Quick Times Entry ──────────────────────────────────────── */
function QuickTimesEntry({ entry }: { entry: SleepLog }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [fellAsleep, setFellAsleep] = useState(entry.fellAsleep || "");
  const [wokeUp, setWokeUp] = useState(entry.wokeUp || "");
  const [saving, setSaving] = useState(false);

  const hasTimes = !!(entry.fellAsleep && entry.wokeUp);
  const changed = fellAsleep !== (entry.fellAsleep || "") || wokeUp !== (entry.wokeUp || "");

  const save = async () => {
    if (!fellAsleep && !wokeUp) return;
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/sleep/${entry.id}`, { fellAsleep: fellAsleep || undefined, wokeUp: wokeUp || undefined });
      await qc.invalidateQueries({ queryKey: ["/api/sleep"] });
      toast({ title: "Sleep times saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sd-card sd-section">
      <div className="sd-card-header">
        <Moon size={14} color="#6366f1" />
        <span className="sd-card-title">Sleep Times</span>
        {hasTimes && !changed && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#10b981", fontWeight: 600 }}>Logged</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 14px" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Fell Asleep</div>
          <input
            type="time"
            value={fellAsleep}
            onChange={e => setFellAsleep(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${fellAsleep ? "#6366f1" : "rgba(0,0,0,0.12)"}`,
              background: "#faf9f6", color: "#111827",
              fontSize: 14, fontFamily: "inherit", fontWeight: 600,
              outline: "none", cursor: "pointer",
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Woke Up</div>
          <input
            type="time"
            value={wokeUp}
            onChange={e => setWokeUp(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${wokeUp ? "#6366f1" : "rgba(0,0,0,0.12)"}`,
              background: "#faf9f6", color: "#111827",
              fontSize: 14, fontFamily: "inherit", fontWeight: 600,
              outline: "none", cursor: "pointer",
            }}
          />
        </div>
      </div>
      {(changed || (!hasTimes && (fellAsleep || wokeUp))) && (
        <div style={{ padding: "0 16px 14px" }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff",
              border: "none", borderRadius: 10, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Times"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Morning Interpretation (Hybrid Night Report, Option A) ──────────────
   Collapsed-by-default expandable card with three subsections:
   Interpretation, Diet Watch, Recovery Action. Copy is deterministic and
   guarded: no claims that cortisol or any specific hormone is directly
   measured; phrases like "may suggest", "can contribute", "pattern is
   consistent with", and "watch ... if hunger or cravings rise" only. */
function MorningInterpretation({ entry }: { entry: SleepLog }) {
  const [open, setOpen] = useState(false);

  // Deterministic interpretive rules. All thresholds map to mainstream
  // sleep-science guidance; copy uses cautious language only.
  const hours = entry.hours ?? 0;
  const deep = entry.deepMin ?? 0;
  const rem = entry.remMin ?? 0;
  const restless = entry.restlessMoments ?? 0;
  const hrv = entry.hrv;
  const score = entry.sleepScore;

  // Posture flags. REM and light-sleep are evaluated as fractions of total
  // sleep so the language matches the Score Factor ratings on the same
  // page. They are tracked INDEPENDENTLY so the narrative can never say
  // REM was less ideal when the REM factor is Good/Excellent. Same for
  // light sleep.
  const durationTag: "short" | "supportive" | "strong" =
    hours < 6.5 ? "short" : hours >= 8 ? "strong" : "supportive";
  const remPct  = hours > 0 ? rem / (hours * 60) : 0;
  const lightPct = hours > 0 ? (entry.lightMin ?? 0) / (hours * 60) : 0;
  const remKnown = rem > 0;
  const lightKnown = (entry.lightMin ?? 0) > 0;
  // Thresholds mirror the Score Factor row exactly: REM Fair/Poor when
  // pct < 20%, light Fair when pct >= 60%.
  const remLessIdeal   = remKnown   && remPct < 0.20;
  const lightHeavy     = lightKnown && lightPct >= 0.60;
  const remSupported   = remKnown   && remPct >= 0.22;
  const lightSupported = lightKnown && lightPct < 0.55;
  const balanceStrong  = remSupported && lightSupported;
  const balanceIntact  = !remLessIdeal && !lightHeavy && (remKnown || lightKnown);
  const deepLow = deep > 0 && deep < 60;
  const restlessHigh = restless > 30;

  // Recovery posture (drives the collapsed summary tag and Recovery Action copy)
  let recoveryTag: "stable" | "softer" | "low" = "stable";
  if (score != null) {
    if (score >= 80) recoveryTag = "stable";
    else if (score >= 65) recoveryTag = "softer";
    else recoveryTag = "low";
  } else if (hours >= 7.5 && deep >= 60) recoveryTag = "stable";
  else if (hours < 6 || deep < 40) recoveryTag = "low";
  else recoveryTag = "softer";

  // Diet Watch posture: short-sleep nights and high restlessness can
  // contribute to hunger and craving signals, per published cohort studies.
  let dietTag: "calm" | "moderate" | "elevated" = "calm";
  if (hours < 6 || restlessHigh) dietTag = "elevated";
  else if (hours < 7 || restless > 18 || deepLow) dietTag = "moderate";

  const summary = `Recovery ${recoveryTag} · diet watch ${dietTag}`;

  // Interpretation paragraph - the duration lead is followed by a stage
  // balance clause that names only the stage that actually triggered, so
  // the narrative never contradicts the Score Factor row above it.
  let durationLead = "";
  if (durationTag === "strong")          durationLead = "Total sleep was strong";
  else if (durationTag === "supportive") durationLead = "Your sleep duration was supportive";
  else                                    durationLead = "Sleep was short";

  // Stage clause is one of: REM-only watch, light-only watch, both watch,
  // strong, intact, or unknown.
  let stageClause = "";
  if (!remKnown && !lightKnown) {
    stageClause = ""; // unknown - skip
  } else if (remLessIdeal && lightHeavy) {
    stageClause = ", though REM ran on the light side and light sleep ran higher than ideal";
  } else if (remLessIdeal) {
    stageClause = ", though REM ran on the light side";
  } else if (lightHeavy && remSupported) {
    stageClause = " and REM was well supported, while light sleep ran higher than ideal";
  } else if (lightHeavy) {
    stageClause = ", though light sleep ran higher than ideal";
  } else if (balanceStrong) {
    stageClause = " and stage balance looks supported";
  } else if (balanceIntact) {
    stageClause = " and stage balance looks intact";
  }

  // Closing line varies by duration so the sentence still reads cleanly.
  let closingLine = "";
  if (durationTag === "strong") {
    closingLine = stageClause && (remLessIdeal || lightHeavy)
      ? ". Recovery appears functional; physical restoration looks adequate even with the stage note."
      : ". The pattern is consistent with a recovered body and a settled mental-restoration window.";
  } else if (durationTag === "supportive") {
    closingLine = stageClause && (remLessIdeal || lightHeavy)
      ? ". Recovery may be supportive but not fully optimized; a steadier morning rhythm still helps the day land smoothly."
      : ". The pattern is consistent with a body that recovered for normal movement; a steadier morning rhythm still helps the day land smoothly.";
  } else {
    closingLine = ". This pattern can carry forward as sleep debt and mild stress reactivity through the day; treat morning cues with extra patience.";
  }

  let interpretationText = `${durationLead}${stageClause}${closingLine}`;
  if (deepLow) interpretationText += ` Deep sleep of ${fmtHM(deep)} is on the lower side; this can shift night to night.`;
  if (hrv != null) interpretationText += ` HRV around ${hrv} ms is one signal in a broader recovery picture, not a verdict.`;
  if (!remKnown && !lightKnown && hrv == null && !deepLow) {
    interpretationText = "Limited overnight data tonight. Trends across several nights tell a clearer story than a single number.";
  }

  // Diet Watch paragraph
  let dietText = "";
  if (dietTag === "elevated") {
    dietText = "If hunger or cravings rise today, avoid assuming it is lack of discipline. Poor or uneven sleep can increase stress signaling and appetite pressure. Lean on protein and water before reaching for sugar.";
  } else if (dietTag === "moderate") {
    dietText = "If hunger or cravings rise today, avoid assuming it is lack of discipline. Poor or uneven sleep can increase stress signaling and appetite pressure.";
  } else {
    dietText = "Sleep duration and continuity look supportive of stable appetite cues. Eat normally; no specific extra precaution suggested by tonight's numbers.";
  }

  // Recovery Action paragraph
  let recoveryText = "";
  if (recoveryTag === "low") {
    recoveryText = "Choose moderate movement, prioritize hydration and protein, and avoid judging body weight from a single morning reading.";
  } else if (recoveryTag === "softer") {
    recoveryText = "Choose moderate movement, prioritize hydration and protein, and avoid judging body weight from a single morning reading.";
  } else {
    recoveryText = "Recovery looks intact. Train as planned, prioritize hydration and protein, and avoid judging body weight from a single morning reading.";
  }

  return (
    <div className="sd-mi sd-section">
      <button type="button" className="sd-mi-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Brain size={14} color="#14b8a6" />
        <span className="sd-mi-title">Morning Interpretation</span>
        <span className="sd-mi-summary">{summary}</span>
        {open ? <ChevronUp size={16} className="sd-mi-chev" /> : <ChevronDown size={16} className="sd-mi-chev" />}
      </button>
      {open && (
        <div className="sd-mi-body">
          <div className="sd-mi-section">
            <div className="sd-mi-sub">Interpretation</div>
            <div className="sd-mi-text">{interpretationText}</div>
          </div>
          <div className="sd-mi-section">
            <div className="sd-mi-sub">Diet Watch</div>
            <div className="sd-mi-text">{dietText}</div>
          </div>
          <div className="sd-mi-section">
            <div className="sd-mi-sub">Recovery Action</div>
            <div className="sd-mi-text">{recoveryText}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 14-Day Recovery Pattern ─────────────────────────────────────────────
   Reads recent SleepLog rows and produces a posture chip per metric plus a
   short cautious summary paragraph. Used both inline in the section card
   and to label each chart in the Trend block. */
type ChipStatus = "stable" | "watch" | "strained" | "muted";
interface MetricStatuses {
  duration: ChipStatus;
  score:    ChipStatus;
  hrv:      ChipStatus;
  spo2:     ChipStatus;
  deep:     ChipStatus;
  overall:  ChipStatus;
}
const STATUS_LABEL: Record<ChipStatus, string> = {
  stable: "Stable", watch: "Watch", strained: "Strained", muted: "Limited",
};
function avgDefined(arr: (number | null | undefined)[]): number | null {
  const xs = arr.filter((x): x is number => typeof x === "number" && isFinite(x));
  if (!xs.length) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
interface PatternStats {
  shortNights: number;
  inBandNights: number;
  recScore: number | null; priorScore: number | null; lowScoreNights: number;
  recHrv: number | null;   priorHrv: number | null;
  recSpo2: number | null;  lowSpo2Nights: number;
  recDeep: number | null;  lowDeepNights: number;
}
interface PatternResult { statuses: MetricStatuses; summary: string; nights: number; stats: PatternStats; }
function computeRecoveryPattern(sortedDesc: SleepLog[]): PatternResult | null {
  const window = sortedDesc.slice(0, 14);
  const nights = window.length;
  if (nights < 3) {
    return {
      nights,
      statuses: { duration: "muted", score: "muted", hrv: "muted", spo2: "muted", deep: "muted", overall: "muted" },
      summary: "More nights needed to index the pattern. Three or more logged nights will let KEWT read the trend with confidence.",
      stats: {
        shortNights: 0, inBandNights: 0,
        recScore: null, priorScore: null, lowScoreNights: 0,
        recHrv: null, priorHrv: null,
        recSpo2: null, lowSpo2Nights: 0,
        recDeep: null, lowDeepNights: 0,
      },
    };
  }

  const recent3 = window.slice(0, 3);
  const prior   = window.slice(3, 10); // up to 7 prior nights, gives a comparison baseline

  // ── Duration ──────────────────────────────────────────────────────────
  const hours = window.map(n => n.hours).filter((x): x is number => typeof x === "number");
  const shortNights = hours.filter(h => h < 7).length;
  const inBand = hours.filter(h => h >= 7 && h <= 9.5).length;
  const durationStatus: ChipStatus =
    inBand >= Math.ceil(nights * 0.7) && shortNights <= 1 ? "stable"
    : shortNights >= 5 ? "strained"
    : (shortNights >= 2 || inBand < nights * 0.5) ? "watch"
    : "stable";

  // ── Sleep score (recent 3 vs prior window) ───────────────────────────
  const recScore   = avgDefined(recent3.map(n => n.sleepScore));
  const priorScore = avgDefined(prior.map(n => n.sleepScore));
  const lowScoreNights = window.filter(n => typeof n.sleepScore === "number" && n.sleepScore! < 65).length;
  const scoreStatus: ChipStatus =
    recScore == null ? "muted"
    : lowScoreNights >= Math.ceil(nights / 2) ? "strained"
    : (priorScore != null && recScore < priorScore - 5) ? "watch"
    : recScore >= 75 ? "stable"
    : "watch";

  // ── HRV (recent 3 vs prior) ──────────────────────────────────────────
  const recHrv   = avgDefined(recent3.map(n => n.hrv));
  const priorHrv = avgDefined(prior.map(n => n.hrv));
  const hrvStatus: ChipStatus =
    recHrv == null ? "muted"
    : (priorHrv != null && recHrv < priorHrv - 5) ? "watch"
    : "stable";

  // ── SpO2 ─────────────────────────────────────────────────────────────
  const recSpo2 = avgDefined(window.map(n => n.spo2Avg));
  const lowSpo2 = window.filter(n => typeof n.spo2Avg === "number" && n.spo2Avg! < 92).length;
  const spo2Status: ChipStatus =
    recSpo2 == null ? "muted"
    : lowSpo2 >= 2 ? "watch"
    : recSpo2 < 94 ? "watch"
    : "stable";

  // ── Deep sleep (minutes) ─────────────────────────────────────────────
  const recDeep   = avgDefined(recent3.map(n => n.deepMin));
  const lowDeepNights = window.filter(n => typeof n.deepMin === "number" && n.deepMin! < 60).length;
  const deepStatus: ChipStatus =
    recDeep == null ? "muted"
    : lowDeepNights >= Math.ceil(nights / 2) ? "watch"
    : recDeep >= 60 ? "stable"
    : "watch";

  // ── Overall posture ──────────────────────────────────────────────────
  const flags = [durationStatus, scoreStatus, hrvStatus, spo2Status, deepStatus];
  const strainedCount = flags.filter(s => s === "strained").length;
  const watchCount    = flags.filter(s => s === "watch").length;
  const overall: ChipStatus =
    strainedCount >= 1 ? "strained"
    : watchCount   >= 2 ? "watch"
    : "stable";

  // ── Summary copy ─────────────────────────────────────────────────────
  const parts: string[] = [];
  if (overall === "stable") {
    parts.push("Recent recovery pattern looks stable.");
  } else if (overall === "watch") {
    parts.push("Recent recovery pattern is worth a watch.");
  } else {
    parts.push("Recent recovery pattern reads as strained.");
  }
  if (durationStatus === "strained") parts.push("Sleep duration has been short across most nights.");
  else if (durationStatus === "watch") parts.push("Duration is mixed; a few short nights are pulling the average.");
  else parts.push("Duration looks supported.");

  if (scoreStatus === "watch" && recScore != null && priorScore != null && recScore < priorScore - 5) {
    parts.push("Sleep score has slipped versus the prior window.");
  }
  if (hrvStatus === "watch") parts.push("HRV is trending below the prior window; consider easing intensity.");
  if (deepStatus === "watch") parts.push("Deep sleep is on the low side recently; REM and light-sleep balance may need attention.");
  if (spo2Status === "watch") parts.push("Overnight SpO2 looks a touch low; not a verdict, but worth tracking.");

  if (overall === "stable" && watchCount === 0) {
    parts.push("Recovery appears functional and broadly on track.");
  } else if (overall === "stable") {
    parts.push("Recovery appears functional but not fully optimized.");
  }

  return {
    nights,
    statuses: { duration: durationStatus, score: scoreStatus, hrv: hrvStatus, spo2: spo2Status, deep: deepStatus, overall },
    summary: parts.join(" "),
    stats: {
      shortNights, inBandNights: inBand,
      recScore, priorScore, lowScoreNights,
      recHrv, priorHrv,
      recSpo2, lowSpo2Nights: lowSpo2,
      recDeep, lowDeepNights,
    },
  };
}
function StatusChip({ status }: { status: ChipStatus }) {
  return <span className={`sd-chip sd-chip--${status}`}>{STATUS_LABEL[status]}</span>;
}

/* ─── Metric Insight Drawer ──────────────────────────────────────────────
   Bottom-sheet that explains a single 14-day metric using the existing
   pattern stats. Avoids medical or cortisol claims; surfaces only what the
   logged data shows. */
type MetricKey = "score" | "duration" | "hrv" | "spo2" | "deep";

interface MetricCopy {
  title: string;
  unit: string;
  meaning: string;
  why: string;
  watch: string;
  action: string;
}
function round1(n: number | null): string {
  return n == null ? "n/a" : (Math.round(n * 10) / 10).toString();
}
function metricCopy(key: MetricKey, status: ChipStatus, pattern: PatternResult): MetricCopy {
  const s = pattern.stats;
  const N = pattern.nights;

  if (status === "muted" || N < 3) {
    const titles: Record<MetricKey, string> = {
      score: "Sleep Score", duration: "Total Hours", hrv: "HRV", spo2: "Avg SpO2", deep: "Deep Sleep",
    };
    const units: Record<MetricKey, string> = { score: "pts", duration: "hrs", hrv: "ms", spo2: "%", deep: "hrs" };
    return {
      title: titles[key], unit: units[key],
      meaning: "Not enough nights on file yet to interpret this metric. KEWT prefers at least three logged nights before drawing trend conclusions.",
      why: `Only ${N} ${N === 1 ? "night" : "nights"} of data are available right now.`,
      watch: "Log a few more nights from Garmin so the pattern can settle.",
      action: "Open the Add chip on the date selector and import recent Garmin sleep screenshots.",
    };
  }

  switch (key) {
    case "duration": {
      const meaning = "Total nightly sleep over the last 14 nights. The protective adult band is roughly 7 to 9.5 hours; consistent shortfalls accumulate as sleep debt.";
      const why = `${s.inBandNights} of ${N} nights landed in the 7 to 9.5 hour band, and ${s.shortNights} ${s.shortNights === 1 ? "night was" : "nights were"} under 7 hours.`;
      let watch: string; let action: string;
      if (status === "stable") {
        watch  = "Watch for sudden short nights stacking up; one is noise, three in a row is signal.";
        action = "Hold the routine. Protect a consistent wake time and the rest tends to follow.";
      } else if (status === "watch") {
        watch  = "Watch the next two nights; further short nights move the pattern toward strained.";
        action = "Add 30 to 45 minutes to the sleep window tonight. Protein-forward dinner and a lower-stress morning rhythm tend to support a longer night.";
      } else {
        watch  = "Cumulative sleep debt is the main concern; expect appetite cues and stress reactivity to run hotter.";
        action = "Prioritize one or two recovery-leaning days, shift training intensity down by about ten percent, and protect tonight's sleep window aggressively.";
      }
      return { title: "Total Hours", unit: "hrs", meaning, why, watch, action };
    }
    case "score": {
      const meaning = "Garmin's overall sleep score (0 to 100) blends duration, stages, restlessness, and stress into one number. KEWT reads recent-3 against the prior-7 to spot drift.";
      const why = (s.recScore != null && s.priorScore != null)
        ? `Recent 3-night average ${round1(s.recScore)} vs prior window ${round1(s.priorScore)}; ${s.lowScoreNights} ${s.lowScoreNights === 1 ? "night" : "nights"} below 65 in this window.`
        : (s.recScore != null)
          ? `Recent 3-night average ${round1(s.recScore)}; ${s.lowScoreNights} ${s.lowScoreNights === 1 ? "night" : "nights"} below 65.`
          : `Not enough sleep-score samples to compare windows.`;
      let watch: string; let action: string;
      if (status === "stable") {
        watch  = "Watch for a five-point or larger drop versus the prior window.";
        action = "Hold the routine. Protect wake time and continue what is working.";
      } else if (status === "watch") {
        watch  = "Watch the next two nights; if the dip continues, the pattern is moving toward strained.";
        action = "Train moderately for a day or two, prioritize hydration and protein, and avoid late caffeine.";
      } else {
        watch  = "Repeated low scores can compound; treat morning cues with extra patience.";
        action = "Choose a recovery-leaning day. Walks and breathwork are reasonable substitutes for hard intervals.";
      }
      return { title: "Sleep Score", unit: "pts", meaning, why, watch, action };
    }
    case "hrv": {
      const meaning = "Heart-rate variability tracks parasympathetic tone. It is one signal in a broader recovery picture, not a verdict.";
      const why = (s.recHrv != null && s.priorHrv != null)
        ? `Recent 3-night average ${round1(s.recHrv)} ms vs prior window ${round1(s.priorHrv)} ms.`
        : (s.recHrv != null)
          ? `Recent 3-night average ${round1(s.recHrv)} ms.`
          : `Not enough HRV samples to compare windows.`;
      let watch: string; let action: string;
      if (status === "stable") {
        watch  = "Watch for a drop of 5 ms or more relative to baseline; that is the threshold KEWT flags.";
        action = "Hold training intensity. Slow-paced breathwork at 5 to 6 breaths per minute can support baseline over weeks.";
      } else if (status === "watch") {
        watch  = "Sustained drops with elevated resting heart rate would shift the pattern further; track for two more nights.";
        action = "Trim today's intensity by about ten percent. Hydration, protein, and a shorter session beat pushing through.";
      } else {
        watch  = "Strained HRV reads as system load; treat training and life stressors as additive.";
        action = "Recovery-leaning day. Reduce caffeine, train light, and protect the next sleep window.";
      }
      return { title: "HRV", unit: "ms", meaning, why, watch, action };
    }
    case "spo2": {
      const meaning = "Overnight blood oxygen average. Healthy adults typically run 94% or higher overnight; occasional dips are normal.";
      const why = s.recSpo2 != null
        ? `14-night average ${round1(s.recSpo2)} percent, with ${s.lowSpo2Nights} ${s.lowSpo2Nights === 1 ? "night" : "nights"} below 92 percent.`
        : "Not enough SpO2 samples to interpret.";
      let watch: string; let action: string;
      if (status === "stable") {
        watch  = "Watch for repeated dips below 92 percent; one night is noise, two or more begins a pattern.";
        action = "Hold the routine. Side sleeping and a cool bedroom often support overnight oxygenation.";
      } else if (status === "watch") {
        watch  = "Persistent low values combined with daytime fatigue would be worth raising with a clinician.";
        action = "Protect sleep position and ventilation tonight. If the pattern continues for a week, share with a provider.";
      } else {
        watch  = "Strained SpO2 patterns can shift recovery; treat as a real signal, not a verdict.";
        action = "Review bedroom environment and sleep position. Persistent low readings are worth a clinical conversation.";
      }
      return { title: "Avg SpO2", unit: "%", meaning, why, watch, action };
    }
    case "deep": {
      const meaning = "Slow-wave (deep) sleep drives physical recovery and glymphatic clearance. Less than 60 minutes per night on a regular basis correlates with reduced recovery signals.";
      const why = s.recDeep != null
        ? `Recent 3-night average ${round1(s.recDeep)} minutes, with ${s.lowDeepNights} ${s.lowDeepNights === 1 ? "night" : "nights"} below 60 minutes in the window.`
        : "Not enough deep-sleep samples to interpret.";
      let watch: string; let action: string;
      if (status === "stable") {
        watch  = "Watch for clusters of short deep-sleep nights; one is noise, several is worth investigating.";
        action = "Hold the routine. Late alcohol and heavy late meals tend to chip away at deep sleep.";
      } else if (status === "watch") {
        watch  = "Persistent low deep sleep can pair with reduced morning resilience; track for several more nights.";
        action = "Cut late alcohol, eat the last meal earlier, and lower bedroom temperature a couple of degrees tonight.";
      } else {
        watch  = "Strained deep sleep often follows accumulated stress or training load; the body needs space.";
        action = "Recovery-leaning day; protect a longer sleep window and avoid caffeine after early afternoon.";
      }
      return { title: "Deep Sleep", unit: "hrs", meaning, why, watch, action };
    }
  }
}

function MetricInsightDrawer({
  open, metric, status, pattern, onClose,
}: {
  open: boolean;
  metric: MetricKey | null;
  status: ChipStatus | null;
  pattern: PatternResult | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !metric || !status || !pattern) return null;
  const copy = metricCopy(metric, status, pattern);

  return (
    <div
      className="sd-mid-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.title} insight`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sd-mid-sheet" onClick={e => e.stopPropagation()}>
        <div className="sd-mid-handle" />
        <div className="sd-mid-header">
          <span className="sd-mid-title">{copy.title}
            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 6, color: "var(--color-text-faint)" }}>{copy.unit}</span>
          </span>
          <StatusChip status={status} />
          <button type="button" className="sd-mid-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sd-mid-body">
          <section>
            <div className="sd-mid-sub">Meaning</div>
            <div className="sd-mid-text">{copy.meaning}</div>
          </section>
          <section>
            <div className="sd-mid-sub">Why KEWT labeled it this way</div>
            <div className="sd-mid-text">{copy.why}</div>
          </section>
          <section>
            <div className="sd-mid-sub">Watch</div>
            <div className="sd-mid-text">{copy.watch}</div>
          </section>
          <section>
            <div className="sd-mid-sub">Recovery Action</div>
            <div className="sd-mid-text">{copy.action}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function SleepDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(localToday());

  const { data: logs = [] } = useQuery<SleepLog[]>({ queryKey: ["/api/sleep"] });

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const entry = sorted.find(l => l.date === selectedDate) || latest;

  // Trend data (last 14 nights)
  const trendData = sorted.slice(0, 14).reverse().map(l => ({
    date: l.date.slice(5),
    hours: l.hours,
    score: l.sleepScore ?? null,
    hrv: l.hrv ?? null,
    spo2: l.spo2Avg ?? null,
    deep: l.deepMin ? +(l.deepMin / 60).toFixed(1) : null,
  }));

  // Recovery pattern card + per-graph chips read from the same 14-day
  // window. Always returns a structure (limited-data fallback included),
  // so the card and chips render in a graceful state when there are
  // fewer than 3 nights on file.
  const recoveryPattern = computeRecoveryPattern(sorted);

  // Metric Insight Drawer state. Single drawer instance shared by all
  // five trend rows; click a row to open with its metric key.
  const [insightMetric, setInsightMetric] = useState<MetricKey | null>(null);

  return (
    <div className="sd-page">
      <style>{CSS}</style>

      {/* Cinematic Hero — score ring embedded */}
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 28px 28px", marginBottom: 0 }}>
        <img
          src="/hero_sleep.jpg"
          alt=""
          className="kewt-cin-hero__img"
          // +15% brightness applied only to the Sleep page hero; Daily Log
          // and other pages that share the kewt-cin-hero__img class are
          // unaffected.
          style={{ objectPosition: "center 60%", height: entry ? 380 : 240, filter: "brightness(1.15)" }}
        />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(6,13,26)" } as React.CSSProperties} />
        {/* Score content. paddingTop respects the device safe-area inset
            so the ring never sits behind a notch or status bar even on
            devices with deep top insets. */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 4,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: 20,
        }}>
          {entry ? (
            <>
              <div style={{ transform: "scale(0.78)", transformOrigin: "center top", marginBottom: -58 }}>
                <ScoreRing score={entry.sleepScore ?? Math.round((entry.quality / 10) * 100)} />
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#818cf8", opacity: 0.9, marginBottom: 6 }}>
                Blue Ember · Recovery Intelligence
              </div>
              <div className="sd-total-sleep" style={{ color: "#fff" }}>{fmtHours(entry.hours)}</div>
              <div className="sd-sleep-label" style={{ color: "rgba(255,255,255,0.55)" }}>Total Sleep</div>
              <div className="sd-date-badge" style={{ marginTop: 10, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <Moon size={11} />
                {fmtLocalDate(entry.date)}
                {entry.hrvStatus && <span style={{ marginLeft: 6, color: "#a5f3fc", fontWeight: 700 }}>{entry.hrvStatus} HRV</span>}
              </div>

            </>
          ) : (
            <>
              <div className="kewt-cin-hero__title" style={{ textAlign: "center" }}>Sleep.</div>
              <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#818cf8,#06b6d4)", margin: "8px auto" }} />
              <div className="kewt-cin-hero__sub" style={{ textAlign: "center" }}>Deep · REM · HRV · SpO₂</div>
              <div style={{ marginTop: 16, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                Log your first night to begin.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stage pills — outside hero to avoid border-radius clip */}
      {entry && (entry.deepMin || entry.lightMin || entry.remMin) && (
        <div className="sd-stage-pills" style={{ marginTop: 0, paddingTop: 14, paddingBottom: 4, background: "transparent" }}>
          {[
            { label: "Deep",  min: entry.deepMin,  color: "#818cf8" },
            { label: "Light", min: entry.lightMin, color: "#7dd3fc" },
            { label: "REM",   min: entry.remMin,   color: "#e879f9" },
            { label: "Awake", min: entry.awakeMin, color: "#fbbf24" },
          ].map(s => s.min ? (
            <div key={s.label} className="sd-stage-pill">
              <div className="sd-stage-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
              <div className="sd-stage-time">{fmtHM(s.min)}</div>
              <div className="sd-stage-name">{s.label}</div>
            </div>
          ) : null)}
        </div>
      )}

      {/* ── Body ── */}
      <div className="sd-body">

        {/* Date selector row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0 8px", overflowX: "auto" }}>
          {sorted.slice(0, 7).map(l => {
            const active = l.date === selectedDate;
            const d = localDate(l.date);
            return (
              <button key={l.date} onClick={() => setSelectedDate(l.date)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 99, border: "none",
                background: active ? "#1a1040" : "#f3f4f6", color: active ? "#fff" : "#6b7280",
                fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
                <span>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                {l.sleepScore && <span style={{ fontSize: 11, color: active ? scoreColor(l.sleepScore) : "#9ca3af", fontWeight: 700 }}>{l.sleepScore}</span>}
              </button>
            );
          })}
          <button onClick={() => setShowForm(!showForm)} style={{
            flexShrink: 0, padding: "6px 14px", borderRadius: 99, border: "1.5px dashed #d1d5db",
            background: "transparent", color: "var(--color-text-faint)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Plus size={12} /> Add
          </button>
        </div>

        {showForm && <AddEntryForm onClose={() => setShowForm(false)} />}

        {entry && (
          <>
            {/* Sleep Stages card */}
            <div className="sd-card sd-section">
              <div className="sd-card-header">
                <Moon size={14} color="#818cf8" />
                <span className="sd-card-title">Sleep Stages</span>
              </div>
              <StageBar entry={entry} />
            </div>

            {/* Vitals grid */}
            <div className="sd-card sd-section" style={{ overflow: "hidden" }}>
              <div className="sd-card-header" style={{ paddingBottom: 10 }}>
                <Heart size={14} color="#ef4444" />
                <span className="sd-card-title">Overnight Vitals</span>
              </div>
              <div className="sd-vitals-grid">
                {entry.hrv != null && (
                  <Vital icon={<Brain size={15} color="#8b5cf6" />} iconBg="#f5f3ff"
                    val={entry.hrv} unit="ms" label="Avg HRV" sub={entry.hrvStatus || undefined} />
                )}
                {entry.spo2Avg != null && (
                  <Vital icon={<Activity size={15} color="#06b6d4" />} iconBg="#ecfeff"
                    val={entry.spo2Avg} unit="%" label="Avg SpO2" sub={entry.spo2Low ? `Low: ${entry.spo2Low}%` : undefined} />
                )}
                {entry.restingHr != null && (
                  <Vital icon={<Heart size={15} color="#ef4444" />} iconBg="#fef2f2"
                    val={entry.restingHr} unit="bpm" label="Resting HR" sub={entry.avgOvernightHr ? `Avg: ${entry.avgOvernightHr} bpm` : undefined} />
                )}
                {entry.respirationAvg != null && (
                  <Vital icon={<Wind size={15} color="#10b981" />} iconBg="#f0fdf4"
                    val={entry.respirationAvg} unit="brpm" label="Avg Respiration" sub={entry.respirationLow ? `Low: ${entry.respirationLow} brpm` : undefined} />
                )}
                {entry.bodyBatteryChange != null && (
                  <Vital icon={<Zap size={15} color="#f59e0b" />} iconBg="#fffbeb"
                    val={entry.bodyBatteryChange > 0 ? `+${entry.bodyBatteryChange}` : entry.bodyBatteryChange}
                    label="Body Battery" sub="overnight change" />
                )}
                {entry.stress != null && (
                  <Vital icon={<TrendingUp size={15} color="#6366f1" />} iconBg="#eef2ff"
                    val={entry.stress} label="Avg Stress" sub="lower is better" />
                )}
              </div>
            </div>

            {/* Morning Interpretation - collapsible Hybrid Night Report */}
            <MorningInterpretation entry={entry} />

            {/* Quick Times Entry */}
            <QuickTimesEntry entry={entry} />

            {/* Score Factors */}
            <div className="sd-card sd-section">
              <div className="sd-card-header">
                <Star size={14} color="#f59e0b" />
                <span className="sd-card-title">Score Factors</span>
              </div>
              <div>
                {/* Factor ratings calibrated to be Garmin-compatible and
                    conservative. Duration is absolute hours. Stress is
                    Garmin's sleep stress score (lower is calmer; mid-teens
                    are not yet "Excellent" in Garmin's own labeling).
                    Light and REM are evaluated as fractions of total sleep
                    so the same minute count is read in context: 5h27 of
                    light in an 8h24 night is 65% of sleep (Fair), not
                    "Excellent" the way a raw-minute threshold would say. */}
                <Factor name="Duration" value={fmtHours(entry.hours)}
                  rating={entry.hours >= 8 ? "Excellent" : entry.hours >= 7 ? "Good" : entry.hours >= 6 ? "Fair" : "Poor"} />
                {entry.stress != null && <Factor name="Stress" value={`${entry.stress} avg`}
                  rating={entry.stress < 10 ? "Excellent" : entry.stress < 15 ? "Good" : entry.stress < 25 ? "Fair" : "Poor"} />}
                {entry.deepMin != null && <Factor name="Deep Sleep" value={fmtHM(entry.deepMin)}
                  rating={entry.deepMin >= 90 ? "Excellent" : entry.deepMin >= 60 ? "Good" : entry.deepMin >= 40 ? "Fair" : "Poor"} />}
                {entry.lightMin != null && entry.hours > 0 && (() => {
                  const pct = entry.lightMin / (entry.hours * 60);
                  const rating = pct < 0.50 ? "Excellent" : pct < 0.60 ? "Good" : pct < 0.70 ? "Fair" : "Poor";
                  return <Factor name="Light Sleep" value={fmtHM(entry.lightMin)} rating={rating} />;
                })()}
                {entry.remMin != null && entry.hours > 0 && (() => {
                  const pct = entry.remMin / (entry.hours * 60);
                  const rating = pct >= 0.22 ? "Excellent" : pct >= 0.20 ? "Good" : pct >= 0.15 ? "Fair" : "Poor";
                  return <Factor name="REM" value={fmtHM(entry.remMin)} rating={rating} />;
                })()}
                {entry.awakeMin != null && <Factor name="Awake / Restlessness" value={`${fmtHM(entry.awakeMin)}${entry.restlessMoments ? ` · ${entry.restlessMoments} restless` : ""}`}
                  rating={entry.awakeMin <= 10 && (entry.restlessMoments ?? 0) <= 15 ? "Excellent"
                       : entry.awakeMin <= 20 && (entry.restlessMoments ?? 0) <= 30 ? "Good"
                       : entry.awakeMin <= 40 && (entry.restlessMoments ?? 0) <= 50 ? "Fair"
                       : "Poor"} />}
              </div>
            </div>
          </>
        )}

        {/* 14-Day Recovery Pattern card — interpretive context above the
            raw charts. Always renders when at least one entry exists, with
            a "limited-data" fallback under three nights. */}
        {recoveryPattern && sorted.length > 0 && (
          <div className="sd-rp sd-section">
            <div className="sd-rp-head">
              <Brain size={13} />
              <span>14-Day Recovery Pattern</span>
              <span style={{ marginLeft: "auto" }}><StatusChip status={recoveryPattern.statuses.overall} /></span>
            </div>
            <div className="sd-rp-summary">{recoveryPattern.summary}</div>
            <div className="sd-rp-chips">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-faint)", display: "inline-flex", alignItems: "center", marginRight: 4 }}>
                {recoveryPattern.nights} nights on file
              </span>
            </div>
          </div>
        )}

        {/* Trend charts */}
        {trendData.length > 1 && (
          <div className="sd-card sd-section">
            <div className="sd-card-header" style={{ paddingBottom: 4 }}>
              <TrendingUp size={14} color="#10b981" />
              <span className="sd-card-title">14-Day Trends</span>
            </div>

            {([
              { label: "Sleep Score",   dataKey: "score",  metric: "score"    as MetricKey, color: "#10b981", unit: "pts", chip: recoveryPattern?.statuses.score    },
              { label: "Total Hours",   dataKey: "hours",  metric: "duration" as MetricKey, color: "#818cf8", unit: "hrs", chip: recoveryPattern?.statuses.duration },
              { label: "HRV",           dataKey: "hrv",    metric: "hrv"      as MetricKey, color: "#8b5cf6", unit: "ms",  chip: recoveryPattern?.statuses.hrv      },
              { label: "Avg SpO2",      dataKey: "spo2",   metric: "spo2"     as MetricKey, color: "#06b6d4", unit: "%",   chip: recoveryPattern?.statuses.spo2     },
              { label: "Deep Sleep",    dataKey: "deep",   metric: "deep"     as MetricKey, color: "#4f46e5", unit: "hrs", chip: recoveryPattern?.statuses.deep     },
            ]).map(({ label, dataKey, metric, color, unit, chip }) => (
              <div
                key={dataKey}
                className="sd-trend-row"
                role="button"
                tabIndex={0}
                aria-label={`Open ${label} insight`}
                onClick={() => setInsightMetric(metric)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInsightMetric(metric); } }}
                style={{ padding: "10px 18px 4px" }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{unit}</span>
                  {chip && <span style={{ marginLeft: "auto" }}><StatusChip status={chip} /></span>}
                  <ChevronRight size={13} style={{ color: "var(--color-text-faint)", flexShrink: 0 }} />
                </div>
                <TrendLine data={trendData} color={color} dataKey={dataKey} />
              </div>
            ))}
          </div>
        )}

        {/* Bottom "Log Sleep from Garmin" CTA removed per user request. The
            manual-entry form is still reachable via the small "+ Add" chip
            in the date-selector strip near the top of the Sleep page. */}

        <div style={{ height: 32 }} />
      </div>

      {/* Metric Insight Drawer (bottom sheet) shared by all trend rows */}
      <MetricInsightDrawer
        open={insightMetric != null}
        metric={insightMetric}
        status={insightMetric && recoveryPattern ? recoveryPattern.statuses[insightMetric] : null}
        pattern={recoveryPattern}
        onClose={() => setInsightMetric(null)}
      />
    </div>
  );
}
