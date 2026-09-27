import React, { useState, useEffect, useRef, useCallback } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { FastedActivityPanel } from "@/components/FastedActivityPanel";
import { ActivityEnrichmentPanel } from "@/components/ActivityEnrichmentPanel";
import { StravaSyncButton } from "@/components/StravaSyncButton";
import { FastingCrossroads } from "@/components/FastingCrossroads";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, UtensilsCrossed, Moon, Wind, AlignCenter, Briefcase, Sparkles,
  Bike, PersonStanding, Footprints, Mountain, Waves, Dumbbell, Flower2, CircleEllipsis, Shovel, Brain,
  Scale, Timer, AlertTriangle, CheckCircle2, Zap, Trophy, Snowflake,
  ChevronDown, ChevronRight, Apple, Trash2, Upload as UploadIcon,
} from "lucide-react";

// ── Utilities ─────────────────────────────────────────────────────────────────────────────
// Always use America/New_York (EST/EDT) for all date/time defaults
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone; // device-local timezone

// Returns YYYY-MM-DD in Eastern time
const localDateStr = (d: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const today = () => localDateStr();

// Returns YYYY-MM-DDTHH:MM string in Eastern time (for datetime-local inputs)
const localDateTimeStr = (d: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const hh = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}`;
};

const formatDateDisplay = () => {
  return new Date().toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// ── Design Tokens ─────────────────────────────────────────────────────────────────────────────
const ACCENT = {
  weight:     "#10b981",
  activity:   "#34d399",
  meal:       "#f97316",
  food:       "#14b8a6",
  sleep:      "#6366f1",
  breathwork: "#06b6d4",
  posture:    "#f59e0b",
  work:       "#8b5cf6",
  practice:   "#ec4899",
  fasting:    "#0059C9",
} as const;

type TabId = keyof typeof ACCENT;

// ── Shared Styles ─────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #f8fafc 0%, #f0f4ff 100%)",
    padding: "0 0 60px 0",
  } as React.CSSProperties,

  header: {
    padding: "16px 20px 0",
    marginBottom: "4px",
  } as React.CSSProperties,

  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--color-text)",
    letterSpacing: "-0.5px",
    lineHeight: 1.1,
    margin: 0,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 14,
    color: "var(--color-text-faint)",
    marginTop: 4,
    fontWeight: 400,
  } as React.CSSProperties,

  progressRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
    borderRadius: 12,
    width: "fit-content",
    border: "1px solid rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  progressLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-faint)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  },

  tabRow: {
    display: "flex",
    gap: 6,
    padding: "20px 0 0",
    paddingLeft: 4,
    paddingRight: 80,
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    msOverflowStyle: "none",
    flexWrap: "nowrap" as const,
    scrollPaddingLeft: 80,
    scrollPaddingRight: 80,
  } as React.CSSProperties,

  panel: (color: string) => ({
    background: "var(--color-surface, #ffffff)",
    borderRadius: 16,
    boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
    margin: "12px 6px 0",
    borderTop: `3px solid ${color}`,
    animation: "panelFadeIn 180ms ease",
  } as React.CSSProperties),

  panelInner: {
    padding: "14px 14px 18px",
  } as React.CSSProperties,

  sectionTitle: (color: string) => ({
    fontSize: 16,
    fontWeight: 700,
    color,
    marginBottom: 12,
    letterSpacing: "-0.2px",
  } as React.CSSProperties),

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  activityGrid: {
    display: "grid",
    gridTemplateColumns: "100px 80px 100px 100px 90px 1fr",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  grid2: {
    display: "grid",
    gridTemplateColumns: "100px 1fr",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  grid3: {
    display: "grid",
    gridTemplateColumns: "100px 1fr 80px",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  nutritionGrid: {
    display: "grid",
    gridTemplateColumns: "100px 1fr 90px",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  macrosGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px 14px",
    marginBottom: 8,
  } as React.CSSProperties,

  fullWidth: {
    gridColumn: "1 / -1",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--color-text-faint)",
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  } as React.CSSProperties,

  input: (color?: string) => ({
    width: "100%",
    borderRadius: 8,
    border: `1.5px solid rgba(0,0,0,0.08)`,
    padding: "7px 10px",
    fontSize: 13,
    color: "#111827",
    background: "#fafafa",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 140ms, box-shadow 140ms",
    "--focus-color": color || "#6366f1",
  } as React.CSSProperties),

  select: (color?: string) => ({
    width: "100%",
    borderRadius: 8,
    border: `1.5px solid rgba(0,0,0,0.08)`,
    padding: "7px 10px",
    fontSize: 13,
    color: "#111827",
    background: "#fafafa",
    outline: "none",
    boxSizing: "border-box" as const,
    cursor: "pointer",
    transition: "border-color 140ms, box-shadow 140ms",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
    "--focus-color": color || "#6366f1",
  } as React.CSSProperties),

  hint: {
    fontSize: 12,
    color: "var(--color-text-faint)",
    marginBottom: 16,
    lineHeight: 1.5,
  } as React.CSSProperties,

  btn: (color: string, isPending: boolean) => ({
    width: "100%",
    padding: "11px 0",
    borderRadius: 100,
    border: "none",
    background: isPending ? `${color}99` : color,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: isPending ? "not-allowed" : "pointer",
    marginTop: 14,
    transition: "transform 120ms, box-shadow 120ms",
    boxShadow: isPending ? "none" : `0 4px 14px ${color}40`,
    letterSpacing: "0.01em",
  } as React.CSSProperties),

  rangeWrapper: {
    position: "relative" as const,
  },

  rangeLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#b0bec5",
    marginTop: 3,
    fontWeight: 500,
  } as React.CSSProperties,
};

// ── Tab Pill ───────────────────────────────────────────────────────────────────
function TabPill({
  id, label, Icon, active, color, onClick,
}: {
  id: string; label: string; Icon: React.FC<any>; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`tab-${id}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 100,
        border: active ? "none" : "1.5px solid rgba(0,0,0,0.08)",
        background: active ? color : "rgba(255,255,255,0.85)",
        color: active ? "#fff" : "#64748b",
        fontWeight: active ? 600 : 500,
        fontSize: 12,
        cursor: "pointer",
        transition: "all 180ms ease",
        whiteSpace: "nowrap",
        boxShadow: active ? `0 3px 10px ${color}40` : "none",
        backdropFilter: "blur(8px)",
        flexShrink: 0,
      }}
    >
      <Icon size={12} color={active ? "#fff" : color} />
      {label}
    </button>
  );
}

// ── Custom Range Slider ────────────────────────────────────────────────────────
function RangeSlider({
  value, min = 1, max = 10, onChange, color, lowLabel, highLabel,
}: {
  value: number; min?: number; max?: number;
  onChange: (v: number) => void; color: string;
  lowLabel?: string; highLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcValue = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pctRaw = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, pctRaw));
    const stepped = Math.round(clamped * (max - min) + min);
    onChange(stepped);
  }, [min, max, onChange]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    calcValue(e.clientX);
  }, [calcValue]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    calcValue(e.clientX);
  }, [calcValue]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={styles.rangeWrapper}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ position: "relative", height: 44, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
      >
        <div style={{
          position: "absolute", left: 0, right: 0, height: 4,
          borderRadius: 4, background: "#e2e8f0", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: 0, height: 4,
          borderRadius: 4, background: color,
          width: `${pct}%`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          left: `calc(${pct}% - 12px)`,
          width: 24, height: 24,
          borderRadius: "50%",
          background: "#fff",
          border: `2.5px solid ${color}`,
          boxShadow: `0 2px 8px ${color}60`,
          pointerEvents: "none",
        }} />
      </div>
      {(lowLabel || highLabel) && (
        <div style={styles.rangeLabels}>
          <span>{lowLabel}</span>
          <span style={{ fontWeight: 600, color }}>{value}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── FocusInput helpers ──────────────────────────────────────────────────────
function FInput({
  color, style: extraStyle, onChange, value, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { color: string; style?: React.CSSProperties }) {

  if (props.type === "date") {
    return (
      <div style={extraStyle}>
        <DatePicker
          value={String(value ?? "")}
          onChange={v => onChange?.({ target: { value: v } } as any)}
          color={color}
          data-testid={props["data-testid" as keyof typeof props] as string}
        />
      </div>
    );
  }

  if (props.type === "time") {
    return (
      <div style={extraStyle}>
        <TimePicker
          value={String(value ?? "")}
          onChange={v => onChange?.({ target: { value: v } } as any)}
          color={color}
          data-testid={props["data-testid" as keyof typeof props] as string}
        />
      </div>
    );
  }

  const [localFocused, setLocalFocused] = React.useState(false);
  return (
    <input
      {...props}
      value={value}
      onChange={onChange}
      onFocus={e => { setLocalFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setLocalFocused(false); props.onBlur?.(e); }}
      style={{
        ...styles.input(color),
        ...(localFocused ? { borderColor: color, boxShadow: `0 0 0 3px ${color}20` } : {}),
        ...extraStyle,
      }}
    />
  );
}

function FSelect({
  color, style: extraStyle, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { color: string; style?: React.CSSProperties }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...styles.select(color),
        ...(focused ? { borderColor: color, boxShadow: `0 0 0 3px ${color}20` } : {}),
        ...extraStyle,
      }}
    >
      {children}
    </select>
  );
}

// ── Activity Taxonomy (25 activities, 6 categories) ─────────────────────────

type ChipField = { id: string; label: string; type: "chips"; options: string[] };
type NumField  = { id: string; label: string; type: "number"; placeholder: string; unit: string };
type TxtField  = { id: string; label: string; type: "text";   placeholder: string };
type ExtraField = ChipField | NumField | TxtField;

interface ModalityConfig {
  showDistance: boolean;
  distanceLabel: string;
  distanceUnit: string;
  distanceStep: string;
  distancePlaceholder: string;
  showElevation: boolean;
  showAvgHr: boolean;
  showIntensity: boolean;
  showEnvironment: boolean;
  extraFields: ExtraField[];
}

interface ActivityDef {
  id: string;
  label: string;
  config: ModalityConfig;
}

interface ActivityGroup {
  id: string;
  label: string;
  icon: React.FC<any>;
  activities: ActivityDef[];
}

const mkRun = (extra: ExtraField[] = []): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.01", distancePlaceholder: "5",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "runType", label: "Run Type", type: "chips", options: ["Easy", "Tempo", "Intervals", "Long Run", "Race"] },
    ...extra,
  ],
});

const mkBike = (extra: ExtraField[] = []): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "25",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "bikeType", label: "Bike Type", type: "chips", options: ["Road / Gravel", "MTB", "Indoor", "eBike", "Other"] },
    ...extra,
  ],
});

const mkWalk = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "2.5",
  showElevation: false, showAvgHr: true, showIntensity: false, showEnvironment: true,
  extraFields: [
    { id: "steps", label: "Steps", type: "number", placeholder: "8000", unit: "steps" },
  ],
});

const mkHike = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "6",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: false,
  extraFields: [
    { id: "trailSurface", label: "Terrain", type: "chips", options: ["Paved", "Dirt", "Rocky", "Snow", "Mixed"] },
  ],
});

const mkRuck = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "4",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "ruckWeightLb", label: "Ruck Weight", type: "number", placeholder: "30", unit: "lb" },
  ],
});

const mkSwim = (): ModalityConfig => ({
  showDistance: false, distanceLabel: "", distanceUnit: "", distanceStep: "1", distancePlaceholder: "",
  showElevation: false, showAvgHr: true, showIntensity: true, showEnvironment: false,
  extraFields: [
    { id: "swimEnv",      label: "Environment",    type: "chips",  options: ["Pool", "Open Water"] },
    { id: "swimUnit",     label: "Distance Unit",  type: "chips",  options: ["Yards", "Meters"] },
    { id: "swimDistance", label: "Distance",       type: "number", placeholder: "1500", unit: "" },
    { id: "stroke",       label: "Primary Stroke", type: "chips",  options: ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Mixed"] },
  ],
});

const mkWater = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "5",
  showElevation: false, showAvgHr: true, showIntensity: true, showEnvironment: false,
  extraFields: [
    { id: "waterActivity", label: "Activity", type: "chips", options: ["Kayak", "SUP", "Row", "Surf", "Canoe", "Wakeboard", "Other"] },
  ],
});

const mkStrength = (): ModalityConfig => ({
  showDistance: false, distanceLabel: "", distanceUnit: "", distanceStep: "1", distancePlaceholder: "",
  showElevation: false, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "focusArea", label: "Focus", type: "chips", options: ["Full Body", "Upper Body", "Lower Body", "Core", "Push", "Pull", "Legs"] },
    { id: "totalSets", label: "Total Sets", type: "number", placeholder: "15", unit: "sets" },
  ],
});

const mkCardio = (): ModalityConfig => ({
  showDistance: false, distanceLabel: "", distanceUnit: "", distanceStep: "1", distancePlaceholder: "",
  showElevation: false, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "cardioType", label: "Type", type: "chips", options: ["HIIT", "Cardio", "Elliptical", "Stair Stepper", "Row Indoor", "Jump Rope", "Boxing", "MMA"] },
  ],
});

const mkMind = (extra: ExtraField[]): ModalityConfig => ({
  showDistance: false, distanceLabel: "", distanceUnit: "", distanceStep: "1", distancePlaceholder: "",
  showElevation: false, showAvgHr: false, showIntensity: false, showEnvironment: false,
  extraFields: extra,
});

const mkOutdoor = (extra: ExtraField[] = []): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "5",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: extra,
});

const mkSport = (extra: ExtraField[] = []): ModalityConfig => ({
  showDistance: false, distanceLabel: "", distanceUnit: "", distanceStep: "1", distancePlaceholder: "",
  showElevation: false, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: extra,
});

const mkWinter = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "20",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: false,
  extraFields: [
    { id: "winterType", label: "Activity", type: "chips", options: ["Ski", "Snowboard", "XC Ski", "Backcountry", "Snowshoe", "Ice Skate", "Snowmobile"] },
  ],
});

const mkOther = (): ModalityConfig => ({
  showDistance: true, distanceLabel: "Distance", distanceUnit: "mi", distanceStep: "0.1", distancePlaceholder: "",
  showElevation: true, showAvgHr: true, showIntensity: true, showEnvironment: true,
  extraFields: [
    { id: "activityName", label: "Activity Name", type: "text", placeholder: "e.g. Motocross, Pickleball, Tactical..." },
  ],
});

const ACTIVITY_GROUPS: ActivityGroup[] = [
  {
    id: "run_walk", label: "Run & Walk", icon: Footprints,
    activities: [
      { id: "run",       label: "Run",       config: mkRun() },
      { id: "trail_run", label: "Trail Run",  config: mkRun([{ id: "trailSurface", label: "Terrain", type: "chips", options: ["Dirt", "Rocky", "Snow", "Mixed"] }]) },
      { id: "treadmill", label: "Treadmill",  config: mkRun() },
      { id: "walk",      label: "Walk",       config: mkWalk() },
      { id: "hiking",    label: "Hike",       config: mkHike() },
      { id: "rucking",   label: "Ruck",       config: mkRuck() },
    ],
  },
  {
    id: "cycling", label: "Cycling", icon: Bike,
    activities: [
      { id: "road_gravel", label: "Road / Gravel", config: mkBike([{ id: "rideType",  label: "Ride Type", type: "chips", options: ["Easy", "Tempo", "Race", "Group Ride", "Bikepacking"] }]) },
      { id: "mtb",         label: "MTB",           config: mkBike([{ id: "trailType", label: "Trail",     type: "chips", options: ["XC", "Trail", "Enduro", "DH", "Flow"] }]) },
      { id: "bike_indoor", label: "Indoor Bike",   config: mkBike([{ id: "rideType",  label: "Ride Type", type: "chips", options: ["Easy", "Tempo", "Intervals", "ERG", "Group Ride"] }]) },
      { id: "ebike",       label: "eBike",         config: mkBike() },
    ],
  },
  {
    id: "water", label: "Water", icon: Waves,
    activities: [
      { id: "swimming",     label: "Swim",          config: mkSwim() },
      { id: "water_sports", label: "Paddle / Water", config: mkWater() },
    ],
  },
  {
    id: "gym", label: "Gym & Fitness", icon: Dumbbell,
    activities: [
      { id: "strength",    label: "Strength",      config: mkStrength() },
      { id: "hiit_cardio", label: "HIIT / Cardio", config: mkCardio() },
      { id: "yoga",        label: "Yoga / Pilates", config: mkMind([
          { id: "yogaStyle", label: "Style",  type: "chips", options: ["Hatha", "Vinyasa", "Yin", "Restorative", "Ashtanga", "Hot", "Pilates", "Other"] },
          { id: "guided",    label: "Format", type: "chips", options: ["Self-led", "Instructor", "App / Video"] },
        ]) },
      { id: "mobility",    label: "Mobility",      config: mkMind([
          { id: "focus", label: "Focus", type: "chips", options: ["Hips", "Shoulders", "Spine", "Ankles", "Full Body"] },
        ]) },
      { id: "breathwork",  label: "Breathwork",    config: mkMind([
          { id: "technique",   label: "Technique", type: "chips", options: ["Box Breathing", "Wim Hof", "4-7-8", "Diaphragmatic", "Alt. Nostril"] },
          { id: "sessionGoal", label: "Goal",      type: "chips", options: ["Calm", "Energize", "Focus", "Recovery", "Sleep"] },
        ]) },
      { id: "meditation",  label: "Meditation",    config: mkMind([
          { id: "meditationType", label: "Type",   type: "chips", options: ["Mindfulness", "Body Scan", "Visualization", "Mantra", "Loving-Kindness"] },
          { id: "guided",         label: "Format", type: "chips", options: ["Self-led", "App / Audio", "Instructor"] },
        ]) },
    ],
  },
  {
    id: "outdoor_sports", label: "Outdoor & Sports", icon: Trophy,
    activities: [
      { id: "climb",        label: "Climb",         config: mkOutdoor([{ id: "climbType", label: "Style",  type: "chips", options: ["Sport", "Trad", "Bouldering", "Indoor", "Mountaineering"] }]) },
      { id: "golf",         label: "Golf",          config: mkSport([{ id: "format",    label: "Format", type: "chips", options: ["18 Holes", "9 Holes", "Range", "Disc Golf"] }]) },
      { id: "winter",       label: "Winter Sports", config: mkWinter() },
      { id: "team_sport",   label: "Team Sport",    config: mkSport([{ id: "sport", label: "Sport", type: "chips", options: ["Soccer", "Basketball", "Baseball", "Volleyball", "Hockey", "Rugby", "Other"] }]) },
      { id: "racket_sport", label: "Racket Sport",  config: mkSport([{ id: "sport", label: "Sport", type: "chips", options: ["Tennis", "Pickleball", "Badminton", "Squash", "Racquetball", "Table Tennis"] }]) },
      { id: "yard_work",    label: "Yard Work",     config: mkSport([{ id: "taskType", label: "Task", type: "chips", options: ["Mowing", "Digging", "Hauling", "Trimming", "Planting", "Raking"] }]) },
    ],
  },
  {
    id: "other_group", label: "Other", icon: CircleEllipsis,
    activities: [
      { id: "multisport", label: "Multisport", config: mkOutdoor([{ id: "msType", label: "Type", type: "chips", options: ["Triathlon", "Duathlon", "Swimrun", "Brick", "Other"] }]) },
      { id: "other",      label: "Other",      config: mkOther() },
    ],
  },
];

const ACTIVITY_CONFIG: Record<string, ModalityConfig> = {};
const ACTIVITY_LABELS: Record<string, string> = {};
for (const grp of ACTIVITY_GROUPS) {
  for (const act of grp.activities) {
    ACTIVITY_CONFIG[act.id] = act.config;
    ACTIVITY_LABELS[act.id] = act.label;
  }
}

const MODALITY_CONFIG = ACTIVITY_CONFIG;

const FLAT_ACTIVITIES: { id: string; label: string; emoji: string }[] = [
  { id: "run",          label: "Run",           emoji: "🏃" },
  { id: "trail_run",    label: "Trail Run",      emoji: "🌲" },
  { id: "walk",         label: "Walk",           emoji: "🚶" },
  { id: "hiking",       label: "Hike",           emoji: "⛰️" },
  { id: "rucking",      label: "Ruck",           emoji: "🎒" },
  { id: "road_gravel",  label: "Road / Gravel",  emoji: "🚴" },
  { id: "mtb",          label: "MTB",            emoji: "🚵" },
  { id: "bike_indoor",  label: "Indoor Bike",    emoji: "🏠" },
  { id: "ebike",        label: "eBike",          emoji: "⚡" },
  { id: "swimming",     label: "Swim",           emoji: "🏊" },
  { id: "water_sports", label: "Paddle / Water", emoji: "🚣" },
  { id: "strength",     label: "Strength",       emoji: "🏋️" },
  { id: "hiit_cardio",  label: "HIIT / Cardio",  emoji: "🔥" },
  { id: "yoga",         label: "Yoga / Pilates", emoji: "🧘" },
  { id: "mobility",     label: "Mobility",       emoji: "🤸" },
  { id: "breathwork",   label: "Breathwork",     emoji: "💨" },
  { id: "meditation",   label: "Meditation",     emoji: "🧠" },
  { id: "climb",        label: "Climb",          emoji: "🧗" },
  { id: "golf",         label: "Golf",           emoji: "⛳" },
  { id: "winter",       label: "Winter Sports",  emoji: "⛷️" },
  { id: "team_sport",   label: "Team Sport",     emoji: "🏅" },
  { id: "racket_sport", label: "Racket Sport",   emoji: "🎾" },
  { id: "multisport",   label: "Multisport",     emoji: "🏆" },
  { id: "yard_work",    label: "Yard Work",      emoji: "🌿" },
  { id: "other",        label: "Other",          emoji: "＋" },
];

const QUICK_PICK_IDS = ["run", "road_gravel", "walk", "strength", "breathwork", "swimming", "hiking", "other"];

function ActivityPicker({ value, onChange, color }: { value: string; onChange: (id: string) => void; color: string }) {
  const isQuickPick = QUICK_PICK_IDS.includes(value);
  const [expanded, setExpanded] = React.useState(!isQuickPick);

  React.useEffect(() => {
    if (!QUICK_PICK_IDS.includes(value)) setExpanded(true);
  }, [value]);

  const tileBase: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 3, padding: "7px 4px", borderRadius: 10, fontSize: 10, fontWeight: 600,
    cursor: "pointer", transition: "all 130ms", border: "1.5px solid rgba(0,0,0,0.07)",
    background: "#fff", color: "#6b7280", lineHeight: 1.2, textAlign: "center",
    minHeight: 54, userSelect: "none",
  };
  const tileActive: React.CSSProperties = {
    border: `1.5px solid ${color}`,
    background: color, color: "#fff",
    boxShadow: `0 2px 8px ${color}45`,
    transform: "scale(1.04)",
  };
  const emojiStyle: React.CSSProperties = { fontSize: 16, lineHeight: 1 };

  const quickPicks = FLAT_ACTIVITIES.filter(a => QUICK_PICK_IDS.includes(a.id));
  const rest = FLAT_ACTIVITIES.filter(a => !QUICK_PICK_IDS.includes(a.id));

  const Tile = ({ act }: { act: typeof FLAT_ACTIVITIES[0] }) => {
    const active = act.id === value;
    return (
      <button key={act.id} type="button"
        onClick={() => onChange(act.id)}
        style={{ ...tileBase, ...(active ? tileActive : {}) }}
      >
        <span style={emojiStyle}>{act.emoji}</span>
        <span>{act.label}</span>
      </button>
    );
  };

  return (
    <div style={{ borderRadius: 14, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: "10px 10px 6px" }}>
        {quickPicks.map(act => <Tile key={act.id} act={act} />)}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", padding: "6px 10px", background: "none", border: "none",
          borderTop: "1px solid rgba(0,0,0,0.06)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 10, fontWeight: 700, color: expanded ? "#065f46" : "#6b7280",
          letterSpacing: "0.04em", transition: "color 0.15s",
        }}
      >
        <span style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}>▾</span>
        {expanded ? "Show less" : `All activities · ${FLAT_ACTIVITIES.length} total`}
      </button>
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: "6px 10px 10px", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
          {rest.map(act => <Tile key={act.id} act={act} />)}
        </div>
      )}
    </div>
  );
}

// ── Serialize / deserialize extra fields via notes JSON prefix ─────────────
function serializeExtras(extras: Record<string, string>, userNotes: string): string {
  const clean = Object.fromEntries(Object.entries(extras).filter(([, v]) => v && v.trim()));
  if (!Object.keys(clean).length) return userNotes;
  return `__kewt__:${JSON.stringify(clean)}\n${userNotes}`;
}
function deserializeExtras(notes: string): { extras: Record<string, string>; userNotes: string } {
  if (!notes || !notes.startsWith("__kewt__:")) return { extras: {}, userNotes: notes || "" };
  const nl = notes.indexOf("\n");
  try {
    const json = notes.slice(9, nl === -1 ? undefined : nl);
    const extras = JSON.parse(json);
    const userNotes = nl === -1 ? "" : notes.slice(nl + 1);
    return { extras, userNotes };
  } catch {
    return { extras: {}, userNotes: notes };
  }
}

function MiniChips({ options, value, onChange, color }: { options: string[]; value: string; onChange: (v: string) => void; color: string }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt} type="button"
            onClick={() => onChange(active ? "" : opt)}
            style={{
              padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: active ? 700 : 500,
              border: active ? "none" : "1.5px solid rgba(0,0,0,0.08)",
              background: active ? color : "#f8fafc",
              color: active ? "#fff" : "#64748b",
              cursor: "pointer", transition: "all 120ms",
              boxShadow: active ? `0 2px 6px ${color}40` : "none",
            }}
          >{opt}</button>
        );
      })}
    </div>
  );
}

function ExtraFields({
  modality, extras, setExtras, color,
}: {
  modality: string;
  extras: Record<string, string>;
  setExtras: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  color: string;
}) {
  const cfg = MODALITY_CONFIG[modality] ?? MODALITY_CONFIG["other"];
  if (!cfg.extraFields.length) return null;
  const set = (id: string, val: string) => setExtras(prev => ({ ...prev, [id]: val }));

  return (
    <>
      {cfg.extraFields.map(field => {
        let label = field.label;
        if (modality === "swimming" && field.id === "swimDistance") {
          const unit = extras["swimUnit"] || "Yards";
          label = `Distance (${unit === "Meters" ? "m" : "yd"})`;
        }
        return (
          <div key={field.id} style={{ marginBottom: 14 }}>
            <label style={styles.label}>{label}</label>
            {field.type === "chips" ? (
              <MiniChips
                options={(field as ChipField).options}
                value={extras[field.id] || ""}
                onChange={val => set(field.id, val)}
                color={color}
              />
            ) : field.type === "number" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FInput
                  type="number" color={color}
                  value={extras[field.id] || ""}
                  onChange={e => set(field.id, e.target.value)}
                  placeholder={(field as NumField).placeholder}
                  style={{ maxWidth: 130 }}
                />
                {(field as NumField).unit && (
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>
                    {modality === "swimming" && field.id === "swimDistance"
                      ? (extras["swimUnit"] === "Meters" ? "m" : "yd")
                      : (field as NumField).unit}
                  </span>
                )}
              </div>
            ) : (
              <FInput
                type="text" color={color}
                value={extras[field.id] || ""}
                onChange={e => set(field.id, e.target.value)}
                placeholder={(field as TxtField).placeholder}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Activity Form ─────────────────────────────────────────────────────────────
function ActivityForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.activity;
  const [form, setForm] = useState({
    date: today(), modality: "run", environment: "outdoor", durationMin: "",
    distanceMiles: "", elevationFt: "", avgHr: "", intensity: "moderate",
    perceivedEffort: 6, notes: "",
  });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [crossroads, setCrossroads] = useState<{ activityId: number; fastHours: number; activityType: string; durationMin: number } | null>(null);

  const cfg = MODALITY_CONFIG[form.modality] ?? MODALITY_CONFIG["other"];
  const intensities = ["easy", "moderate", "hard", "mixed"];

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/activities", data),
    onSuccess: async (savedActivity: any) => {
      const label = form.modality === "other" ? (extras["activityName"] || "Other") : (ACTIVITY_LABELS[form.modality] ?? form.modality);
      toast({ title: "Activity logged to KEWT", description: `${label} · ${form.durationMin}min · Kinetic system updated.` });
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
      try {
        if (savedActivity?.id) {
          const report = await apiRequest("GET", `/api/fasting/activity-report/${savedActivity.id}`);
          if (report?.fasted && report?.hoursAtStart > 0) {
            setCrossroads({
              activityId: savedActivity.id,
              fastHours: report.hoursAtStart,
              activityType: form.modality,
              durationMin: parseInt(form.durationMin) || 30,
            });
          }
        }
      } catch (_) {}
      setForm(f => ({ ...f, durationMin: "", distanceMiles: "", elevationFt: "", avgHr: "", notes: "" }));
      setExtras({});
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <>
    {crossroads && (
      <FastingCrossroads
        activityId={crossroads.activityId}
        fastHours={crossroads.fastHours}
        activityType={crossroads.activityType}
        durationMin={crossroads.durationMin}
        onClose={() => setCrossroads(null)}
      />
    )}
    <form
      onSubmit={e => {
        e.preventDefault();
        const MODALITY_NORMALIZE: Record<string, string> = {
          road_gravel: "cycling", bike_indoor: "cycling", ebike: "cycling", mtb: "cycling",
          gravel: "cycling", road_bike: "cycling",
          run: "running", walk: "walking", hike: "hiking",
        };
        const canonicalModality = MODALITY_NORMALIZE[form.modality] ?? form.modality;
        const subTypeExtras = canonicalModality !== form.modality
          ? { ...extras, subType: form.modality }
          : extras;
        const finalNotes = serializeExtras(subTypeExtras, form.notes);
        mut.mutate({
          ...form,
          modality: canonicalModality,
          notes: finalNotes,
          durationMin: parseInt(form.durationMin),
          distanceMiles: cfg.showDistance && form.distanceMiles ? parseFloat(form.distanceMiles) : null,
          elevationFt: cfg.showElevation && form.elevationFt ? parseInt(form.elevationFt) : null,
          avgHr: cfg.showAvgHr && form.avgHr ? parseInt(form.avgHr) : null,
          perceivedEffort: form.perceivedEffort,
        });
      }}
    >
      <div style={styles.sectionTitle(color)}>Log to Kinetic System</div>
      <div style={{ marginBottom: 18 }}>
        <label style={styles.label}>Modality</label>
        <ActivityPicker value={form.modality} onChange={m => { setForm(f => ({ ...f, modality: m })); setExtras({}); }} color={color} />
      </div>
      <ExtraFields modality={form.modality} extras={extras} setExtras={setExtras} color={color} />
      {cfg.showEnvironment && (
        <div style={{ marginBottom: 18 }}>
          <label style={styles.label}>Environment</label>
          <div className="kewt-orb-clearance" style={{ display: "flex", gap: 8 }}>
            {(["indoor", "outdoor", "virtual"] as const).map(env => {
              const envIcon = env === "indoor" ? "🏠" : env === "outdoor" ? "🌿" : "💻";
              const active = form.environment === env;
              return (
                <button
                  key={env} type="button"
                  onClick={() => setForm(f => ({ ...f, environment: env }))}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10,
                    border: `1.5px solid ${active ? color : "var(--color-border)"}`,
                    background: active ? `${color}18` : "transparent",
                    color: active ? color : "var(--color-text-muted)",
                    fontWeight: active ? 700 : 500, fontSize: 12,
                    cursor: "pointer", transition: "all 150ms",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{envIcon}</span>
                  <span style={{ textTransform: "capitalize" }}>{env}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="kewt-form-grid-activity" style={styles.activityGrid}>
        <div>
          <label style={styles.label}>Date</label>
          <FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="input-activity-date" />
        </div>
        <div>
          <label style={styles.label}>Duration (min) *</label>
          <FInput type="number" color={color} required min={1} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} placeholder="60" data-testid="input-duration" />
        </div>
        {cfg.showDistance && (
          <div>
            <label style={styles.label}>{cfg.distanceLabel} ({cfg.distanceUnit})</label>
            <FInput type="number" step={cfg.distanceStep} color={color} value={form.distanceMiles} onChange={e => setForm(f => ({ ...f, distanceMiles: e.target.value }))} placeholder={cfg.distancePlaceholder} data-testid="input-distance" />
          </div>
        )}
        {cfg.showElevation && (
          <div>
            <label style={styles.label}>Elev (ft)</label>
            <FInput type="number" color={color} value={form.elevationFt} onChange={e => setForm(f => ({ ...f, elevationFt: e.target.value }))} placeholder="800" data-testid="input-elevation" />
          </div>
        )}
        {cfg.showAvgHr && (
          <div>
            <label style={styles.label}>Avg HR</label>
            <FInput type="number" color={color} value={form.avgHr} onChange={e => setForm(f => ({ ...f, avgHr: e.target.value }))} placeholder="142" data-testid="input-avg-hr" />
          </div>
        )}
        {cfg.showIntensity && (
          <div>
            <label style={styles.label}>Intensity</label>
            <FSelect color={color} value={form.intensity} onChange={e => setForm(f => ({ ...f, intensity: e.target.value }))} data-testid="select-intensity">
              {intensities.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
            </FSelect>
          </div>
        )}
        <div style={styles.fullWidth}>
          <label style={styles.label}>Perceived Effort</label>
          <RangeSlider value={form.perceivedEffort} onChange={v => setForm(f => ({ ...f, perceivedEffort: v }))} color={color} lowLabel="Easy 1" highLabel="Max 10" />
        </div>
        <div style={styles.fullWidth}>
          <label style={styles.label}>Notes</label>
          <FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Fasted morning ride, felt strong" data-testid="input-activity-notes" />
        </div>
      </div>
      <p style={styles.hint}>Calories auto-calculated from modality, duration, and body weight (185 lbs).</p>
      <button
        type="submit" disabled={mut.isPending} data-testid="button-log-activity"
        style={styles.btn(color, mut.isPending)}
        onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}
      >
        {mut.isPending ? "Saving…" : "Log Activity"}
      </button>
    </form>
    </>
  );
}

// ── Activity Log ──────────────────────────────────────────────────────────────
function ActivityLog({ color }: { color: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useHashLocation();
  const { data: activities = [] } = useQuery<any[]>({ queryKey: ["/api/activities"] });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editExtras, setEditExtras] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [highlightId,  setHighlightId]  = useState<number | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      setRecentOpen(true);
      setHighlightId(id);
      setTimeout(() => {
        const el = document.querySelector(`[data-activity-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => setHighlightId(null), 2500);
      }, 200);
    };
    window.addEventListener("kewt:highlight-activity", handler);
    return () => window.removeEventListener("kewt:highlight-activity", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ids: number[] = (e as CustomEvent).detail?.ids ?? [];
      setRecentOpen(true);
      setHighlightIds(new Set(ids));
      setTimeout(() => {
        if (ids.length > 0) {
          const el = document.querySelector(`[data-activity-id="${ids[0]}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTimeout(() => setHighlightIds(new Set()), 2500);
      }, 200);
    };
    window.addEventListener("kewt:highlight-week", handler);
    return () => window.removeEventListener("kewt:highlight-week", handler);
  }, []);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/activities/${id}`),
    onSuccess: () => {
      toast({ title: "Entry deleted" });
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
    },
    onError: (e: any) => {
      setConfirmDeleteId(null);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/activities/${id}`, data),
    onSuccess: () => {
      toast({ title: "Entry updated" });
      setEditId(null);
      setEditForm({});
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const recent = activities.slice(0, 10);
  if (!recent.length) {
    return (
      <div style={{
        marginTop: 8,
        background: "var(--color-surface, #ffffff)",
        border: "1.5px dashed var(--color-border)",
        borderRadius: 14,
        padding: "20px 16px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(217,122,77,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 2,
        }}>
          <Activity size={20} color="#d97a4d" />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-text)" }}>Nothing logged for this day</div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-faint)", maxWidth: 240, lineHeight: 1.4 }}>
          If you have a Garmin file, GPX, or a screenshot from this day, bring it in.
        </div>
        <button
          type="button"
          onClick={() => navigate("/upload")}
          data-testid="button-empty-activity-upload"
          style={{
            marginTop: 6, display: "flex", alignItems: "center", gap: 6,
            fontSize: 12.5, fontWeight: 700, color: "#fff",
            background: "#d97a4d", border: "none", cursor: "pointer",
            padding: "9px 18px", borderRadius: 10,
          }}
        >
          <UploadIcon size={14} /> Upload your data
        </button>
      </div>
    );
  }

  const modalityIcon: Record<string, string> = {
    run: "🏃", trail_run: "🏔️", treadmill: "🏃", walk: "🚶", hiking: "🥾", rucking: "🎒",
    cycling: "🚴", road_gravel: "🚴", mtb: "🚵", bike_indoor: "🚴", ebike: "⚡🚴",
    swimming: "🏊", water_sports: "🚣",
    strength: "🏋️", hiit_cardio: "⚡", yoga: "🧘", mobility: "🤸", breathwork: "🌬️", meditation: "🧠",
    climb: "🧗", golf: "⛳", winter: "⛷️", team_sport: "🏅", racket_sport: "🎾", yard_work: "🌱",
    multisport: "🏅", other: "⚡",
  };

  const previousCount = Math.max(0, recent.length - 1);
  const itemsToRender = recentOpen ? recent : recent.slice(0, 1);

  return (
    <div style={{
      marginTop: 8,
      background: "var(--color-surface, #ffffff)",
      borderRadius: 16,
      boxShadow: recentOpen ? "0 2px 20px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
      borderTop: `3px solid ${color}`,
      transition: "box-shadow 180ms ease, border-color 180ms ease",
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em", flex: 1 }}>
          Recent Activity
        </span>
        <StravaSyncButton />
        {previousCount > 0 && (
          <button
            type="button"
            onClick={() => setRecentOpen(o => !o)}
            aria-expanded={recentOpen}
            data-testid="recent-activity-toggle"
            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            {recentOpen ? "Hide previous" : `Show previous (${previousCount})`}
            <span style={{ fontSize: 11, transition: "transform 200ms", display: "inline-block", transform: recentOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {itemsToRender.map((a: any) => (
          <div
            key={a.id}
            data-activity-id={a.id}
            style={{
              background: "var(--color-surface)",
              border: highlightId === a.id
                ? "2px solid #0ea5e9"
                : highlightIds.has(a.id)
                ? "2px solid #f59e0b"
                : editId === a.id
                ? `1.5px solid ${color}`
                : confirmDeleteId === a.id
                ? "1.5px solid #ef4444"
                : "1px solid var(--color-border)",
              borderRadius: 14,
              padding: "14px 16px",
              transition: "border-color 200ms, box-shadow 200ms",
              boxShadow: highlightId === a.id
                ? "0 0 0 3px rgba(14,165,233,0.18)"
                : highlightIds.has(a.id)
                ? "0 0 0 3px rgba(245,158,11,0.15)"
                : "none",
            }}
          >
            {confirmDeleteId === a.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>Delete this entry?</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {modalityIcon[a.modality] || "⚡"} {ACTIVITY_LABELS[a.modality] ?? a.modality} on {a.date}
                  {a.durationMin ? ` · ${a.durationMin} min` : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(a.id)}
                    disabled={deleteMut.isPending}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {deleteMut.isPending ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--color-text-muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editId === a.id ? (
              (() => {
                const eMod = editForm.modality ?? a.modality;
                const eCfg = MODALITY_CONFIG[eMod] ?? MODALITY_CONFIG["other"];
                const { userNotes: eUserNotes } = deserializeExtras(a.notes || "");
                const elabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={elabel}>Modality</label>
                    <ActivityPicker value={eMod} onChange={m => { setEditForm((f: any) => ({ ...f, modality: m })); setEditExtras({}); }} color={color} />
                  </div>
                  <ExtraFields modality={eMod} extras={editExtras} setExtras={setEditExtras} color={color} />
                  {eCfg.showEnvironment && (
                    <div>
                      <label style={elabel}>Environment</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["indoor", "outdoor", "virtual"] as const).map(env => {
                          const envIcon = env === "indoor" ? "🏠" : env === "outdoor" ? "🌿" : "💻";
                          const active = (editForm.environment ?? a.environment ?? "outdoor") === env;
                          return (
                            <button key={env} type="button"
                              onClick={() => setEditForm((f: any) => ({ ...f, environment: env }))}
                              style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${active ? color : "var(--color-border)"}`, background: active ? `${color}18` : "transparent", color: active ? color : "var(--color-text-muted)", fontWeight: active ? 700 : 500, fontSize: 11, cursor: "pointer", transition: "all 150ms", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                            >
                              <span style={{ fontSize: 15 }}>{envIcon}</span>
                              <span style={{ textTransform: "capitalize" }}>{env}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={elabel}>Date</label>
                      <FInput type="date" color={color} value={editForm.date ?? a.date} onChange={e => setEditForm((f: any) => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={elabel}>Duration (min)</label>
                      <FInput type="number" color={color} value={editForm.durationMin ?? a.durationMin} onChange={e => setEditForm((f: any) => ({ ...f, durationMin: parseInt(e.target.value) }))} />
                    </div>
                    {eCfg.showDistance && (
                      <div>
                        <label style={elabel}>{eCfg.distanceLabel} ({eCfg.distanceUnit})</label>
                        <FInput type="number" step={eCfg.distanceStep} color={color} value={editForm.distanceMiles ?? (a.distanceMiles || "")} onChange={e => setEditForm((f: any) => ({ ...f, distanceMiles: parseFloat(e.target.value) }))} />
                      </div>
                    )}
                    {eCfg.showElevation && (
                      <div>
                        <label style={elabel}>Elev (ft)</label>
                        <FInput type="number" color={color} value={editForm.elevationFt ?? (a.elevationFt || "")} onChange={e => setEditForm((f: any) => ({ ...f, elevationFt: parseInt(e.target.value) }))} />
                      </div>
                    )}
                    {eCfg.showAvgHr && (
                      <div>
                        <label style={elabel}>Avg HR</label>
                        <FInput type="number" color={color} value={editForm.avgHr ?? (a.avgHr || "")} onChange={e => setEditForm((f: any) => ({ ...f, avgHr: parseInt(e.target.value) }))} />
                      </div>
                    )}
                    <div>
                      <label style={elabel}>Calories Burned</label>
                      <FInput type="number" color={color} value={editForm.estCalsBurned ?? (a.estCalsBurned || "")} onChange={e => setEditForm((f: any) => ({ ...f, estCalsBurned: parseInt(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <label style={elabel}>Notes</label>
                    <FInput type="text" color={color} value={editForm.notes ?? eUserNotes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const finalNotes = serializeExtras(editExtras, editForm.notes ?? eUserNotes);
                        updateMut.mutate({ id: a.id, data: { ...a, ...editForm, notes: finalNotes } });
                      }}
                      disabled={updateMut.isPending}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: color, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      {updateMut.isPending ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditId(null); setEditForm({}); setEditExtras({}); }}
                      style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--color-text-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                );
              })()
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{modalityIcon[a.modality] || "⚡"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)", textTransform: "capitalize" }}>
                      {(() => { if (a.modality === "other") { const { extras: tEx } = deserializeExtras(a.notes || ""); return tEx["activityName"] || "Other"; } return ACTIVITY_LABELS[a.modality] ?? (a.modality.charAt(0).toUpperCase() + a.modality.slice(1)); })()}
                    </span>
                    {a.modality === "other" && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Other</span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{a.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {a.durationMin && <span>{a.durationMin} min</span>}
                    {a.distanceMiles && <span>{a.distanceMiles} mi</span>}
                    {a.estCalsBurned && <span style={{ color }}>{a.estCalsBurned} kcal</span>}
                    {a.avgHr && <span>{a.avgHr} bpm</span>}
                    {a.environment && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6,
                        background: a.environment === "indoor" ? "#e0f2fe" : a.environment === "virtual" ? "#ede9fe" : "#d1fae5",
                        color: a.environment === "indoor" ? "#0369a1" : a.environment === "virtual" ? "#6d28d9" : "#065f46",
                      }}>
                        {a.environment === "indoor" ? "🏠" : a.environment === "virtual" ? "💻" : "🌿"}{" "}
                        {a.environment.charAt(0).toUpperCase() + a.environment.slice(1)}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const { extras: vExtras, userNotes: vNotes } = deserializeExtras(a.notes || "");
                    const extraTags = Object.entries(vExtras).filter(([k]) => k !== "activityName").map(([, v]) => v).filter(Boolean);
                    return (
                      <>
                        {extraTags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                            {extraTags.map((tag, i) => (
                              <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: `${color}15`, color: color }}>
                                {String(tag)}
                              </span>
                            ))}
                          </div>
                        )}
                        {vNotes && <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 3, fontStyle: "italic" }}>{vNotes}</div>}
                      </>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => { const { extras: initExtras } = deserializeExtras(a.notes || ""); setEditId(a.id); setEditExtras(initExtras); setEditForm({ date: a.date, durationMin: a.durationMin, distanceMiles: a.distanceMiles, elevationFt: a.elevationFt, avgHr: a.avgHr, estCalsBurned: a.estCalsBurned, notes: "", environment: a.environment ?? "outdoor", modality: a.modality }); }}
                    title="Edit"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 14 }}
                  >✏️</button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(a.id)}
                    title="Delete"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fca5a5", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 14 }}
                  >🗑️</button>
                </div>
              </div>
            )}
            <FastedActivityPanel activityId={a.id} />
            <ActivityEnrichmentPanel activityId={a.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Food Form ─────────────────────────────────────────────────────────────────
function FoodForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.food;
  const todayStr = today();
  const [form, setForm] = useState({
    date: todayStr, time: "", mealType: "snack", portion: "moderate", description: "",
  });
  const [tags, setTags] = useState<Set<string>>(new Set());

  const TAG_OPTIONS = [
    { id: "protein",     label: "Protein" },
    { id: "carbs",       label: "Carbs" },
    { id: "caffeine",    label: "Caffeine" },
    { id: "hydration",   label: "Hydration" },
    { id: "alcohol",     label: "Alcohol" },
    { id: "high_sodium", label: "High sodium" },
    { id: "sugar",       label: "Sugar" },
    { id: "processed",   label: "Processed" },
  ];
  const MEAL_TYPES = [
    { id: "breakfast",    label: "Breakfast" },
    { id: "lunch",        label: "Lunch" },
    { id: "dinner",       label: "Dinner" },
    { id: "snack",        label: "Snack" },
    { id: "coffee",       label: "Coffee" },
    { id: "hydration",    label: "Water" },
    { id: "alcohol",      label: "Alcohol" },
    { id: "post_workout", label: "Post-workout" },
    { id: "other",        label: "Other" },
  ];

  const toggleTag = (id: string) => {
    setTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: entries = [] } = useQuery<any[]>({ queryKey: ["/api/foods"] });
  const todays = entries.filter((e: any) => e.date === todayStr);

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/foods", data),
    onSuccess: () => {
      toast({ title: "Logged to KEWT Food Signal" });
      setForm(f => ({ ...f, description: "", time: "" }));
      setTags(new Set());
      qc.invalidateQueries({ queryKey: ["/api/foods"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/foods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/foods"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
    },
  });

  return (
    <>
      <div style={styles.sectionTitle(color)}>Food Signal · Low-friction Log</div>
      <form onSubmit={(e) => {
        e.preventDefault();
        mut.mutate({
          date: form.date, time: form.time || undefined, mealType: form.mealType,
          portion: form.portion || undefined, description: form.description || undefined,
          tags: tags.size > 0 ? Array.from(tags).join(",") : undefined,
        });
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={styles.label as React.CSSProperties}>Date</label>
            <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} color={color} />
          </div>
          <div>
            <label style={styles.label as React.CSSProperties}>Time</label>
            <TimePicker value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} color={color} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label as React.CSSProperties}>Type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MEAL_TYPES.map(mt => {
              const active = form.mealType === mt.id;
              return (
                <button key={mt.id} type="button"
                  onClick={() => setForm(f => ({ ...f, mealType: mt.id }))}
                  style={{ padding: "5px 11px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: active ? "none" : "1.5px solid rgba(0,0,0,0.08)", background: active ? color : "transparent", color: active ? "#fff" : "var(--color-text-muted)", cursor: "pointer" }}
                >{mt.label}</button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label as React.CSSProperties}>Portion</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["light", "moderate", "heavy"].map(p => {
              const active = form.portion === p;
              return (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, portion: p }))}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, border: active ? `1.5px solid ${color}` : "1.5px solid rgba(0,0,0,0.08)", background: active ? `${color}18` : "transparent", color: active ? color : "var(--color-text-muted)", textTransform: "capitalize", cursor: "pointer" }}
                >{p}</button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label as React.CSSProperties}>What did you eat or drink? (optional)</label>
          <input type="text" maxLength={200} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Eggs and toast, large iced coffee, two beers..." style={{ ...styles.input(color), width: "100%" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label as React.CSSProperties}>Tags</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TAG_OPTIONS.map(t => {
              const active = tags.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                  style={{ padding: "5px 11px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: active ? `1.5px solid ${color}` : "1.5px solid rgba(0,0,0,0.08)", background: active ? `${color}18` : "transparent", color: active ? color : "var(--color-text-muted)", cursor: "pointer" }}
                >{t.label}</button>
              );
            })}
          </div>
        </div>
        <button type="submit" disabled={mut.isPending} style={styles.btn(color, mut.isPending)}>
          {mut.isPending ? "Saving…" : "Log Food Signal"}
        </button>
      </form>
      {todays.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>Today</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todays.map((f: any) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                    {f.mealType.replace(/_/g, " ")}{f.time ? ` · ${f.time}` : ""}{f.portion ? ` · ${f.portion}` : ""}
                  </div>
                  {f.description && <div style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</div>}
                  {f.tags && <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 2 }}>{f.tags.split(",").join(" · ")}</div>}
                </div>
                <button type="button" onClick={() => { if (confirm("Delete this food entry?")) delMut.mutate(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-faint)", padding: 4 }} aria-label="Delete food entry">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Meal Form ─────────────────────────────────────────────────────────────────
function MealForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.meal;
  const [form, setForm] = useState({
    date: today(), mealType: "breakfast", calories: "", proteinG: "", carbsG: "", fatG: "", foods: "", notes: "",
  });
  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/meals", data),
    onSuccess: () => {
      toast({ title: "Meal logged" });
      qc.invalidateQueries({ queryKey: ["/api/meals"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
      setForm(f => ({ ...f, calories: "", proteinG: "", carbsG: "", fatG: "", foods: "", notes: "" }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const mealTypes = ["breakfast", "lunch", "dinner", "snack", "other"];
  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, calories: parseInt(form.calories), proteinG: form.proteinG ? parseFloat(form.proteinG) : 0, carbsG: form.carbsG ? parseFloat(form.carbsG) : 0, fatG: form.fatG ? parseFloat(form.fatG) : 0 }); }}>
      <div style={styles.sectionTitle(color)}>Log to Metabolic System</div>
      <div className="kewt-form-grid-nutrition" style={styles.nutritionGrid}>
        <div>
          <label style={styles.label}>Date</label>
          <FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={styles.label}>Meal Type</label>
          <FSelect color={color} value={form.mealType} onChange={e => setForm(f => ({ ...f, mealType: e.target.value }))} data-testid="select-meal-type">
            {mealTypes.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </FSelect>
        </div>
        <div>
          <label style={styles.label}>Calories *</label>
          <FInput type="number" color={color} required min={0} value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} placeholder="310" data-testid="input-calories" />
        </div>
      </div>
      <div className="kewt-form-grid-macros" style={styles.macrosGrid}>
        <div><label style={styles.label}>Protein (g)</label><FInput type="number" step="0.1" color={color} value={form.proteinG} onChange={e => setForm(f => ({ ...f, proteinG: e.target.value }))} placeholder="28" /></div>
        <div><label style={styles.label}>Carbs (g)</label><FInput type="number" step="0.1" color={color} value={form.carbsG} onChange={e => setForm(f => ({ ...f, carbsG: e.target.value }))} placeholder="35" /></div>
        <div><label style={styles.label}>Fat (g)</label><FInput type="number" step="0.1" color={color} value={form.fatG} onChange={e => setForm(f => ({ ...f, fatG: e.target.value }))} placeholder="12" /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
        <div><label style={styles.label}>Foods (comma-separated)</label><FInput type="text" color={color} value={form.foods} onChange={e => setForm(f => ({ ...f, foods: e.target.value }))} placeholder="Eggs, Greek yogurt, blueberries" data-testid="input-foods" /></div>
        <div><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Pre-ride fasted coffee + LMNT" /></div>
      </div>
      <button type="submit" disabled={mut.isPending} data-testid="button-log-meal" style={styles.btn(color, mut.isPending)} onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {mut.isPending ? "Saving…" : "Log Meal"}
      </button>
    </form>
  );
}

// ── Weight Form ───────────────────────────────────────────────────────────────
function WeightForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.weight;
  const [form, setForm] = useState({ date: today(), weight: "", notes: "" });
  const [justSaved, setJustSaved] = useState(false);
  const [userEdited, setUserEdited] = useState(false);

  const { data: latest } = useQuery<any>({ queryKey: ["/api/health-markers/latest"] });

  useEffect(() => {
    if (latest?.morningWeight && latest.date === today() && !userEdited) {
      setForm(f => ({ ...f, weight: String(latest.morningWeight) }));
    }
  }, [latest]);

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/health-markers", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/health-markers"] });
      qc.invalidateQueries({ queryKey: ["/api/health-markers/latest"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
      toast({ title: "Weight logged", description: `${form.weight} lbs saved for today.` });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    },
    onError: () => toast({ title: "Could not save weight", variant: "destructive" }),
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!form.weight) return;
    mut.mutate({ date: form.date, morningWeight: parseFloat(form.weight) });
  };

  const currentVal = parseFloat(form.weight);
  const lastWeight = latest?.morningWeight;
  const isToday = latest?.date === today();
  const delta = lastWeight && !isNaN(currentVal) && currentVal !== lastWeight ? (currentVal - lastWeight) : null;

  return (
    <form onSubmit={handleSubmit}>
      <div style={styles.sectionTitle(color)}>Morning Weight · Kinetic Baseline</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0 20px", gap: 6 }}>
        {lastWeight && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100, background: isToday ? `rgba(16,185,129,0.10)` : `rgba(100,116,139,0.07)`, border: isToday ? `1px solid rgba(16,185,129,0.25)` : `1px solid rgba(100,116,139,0.14)`, fontSize: 11, fontWeight: 600, color: isToday ? color : "var(--color-text-faint)", letterSpacing: "0.04em", marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isToday ? color : "var(--color-text-faint)", display: "inline-block" }} />
            {isToday ? `Updated today` : `Last: ${lastWeight} lbs · ${latest?.date}`}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color, textTransform: "uppercase", marginBottom: 8 }}>Today's Weight</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <input
            type="number" step="0.1" min="50" max="500"
            value={form.weight}
            onChange={e => { setUserEdited(true); setForm(f => ({ ...f, weight: e.target.value })); }}
            placeholder={lastWeight ? String(lastWeight) : "182.0"}
            data-testid="input-weight-log"
            autoFocus
            style={{ width: 140, fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", color: justSaved ? color : "var(--color-text)", background: "transparent", border: "none", borderBottom: `2.5px solid ${color}`, outline: "none", textAlign: "center", padding: "4px 0", caretColor: color, transition: "color 400ms" }}
          />
          <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-muted)" }}>lbs</span>
        </div>
        {delta !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 13, fontWeight: 700, color: delta < 0 ? "#10b981" : delta > 0 ? "#ef4444" : "#94a3b8" }}>
            <span style={{ fontSize: 16 }}>{delta < 0 ? "↓" : delta > 0 ? "↑" : ""}</span>
            <span>{delta < 0 ? "-" : "+"}{Math.abs(delta).toFixed(1)} lbs vs last entry</span>
          </div>
        )}
      </div>
      <div className="kewt-form-grid2" style={styles.grid2}>
        <div>
          <label style={styles.label}>Date</label>
          <FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={styles.label}>Notes</label>
          <FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Post-ride, fasted, etc." />
        </div>
      </div>
      <div style={{ margin: "20px 0", padding: "14px 16px", background: `rgba(16,185,129,0.06)`, border: `1px solid rgba(16,185,129,0.18)`, borderRadius: 12, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color }}>Science note:</span> Daily weigh-ins at the same time each morning (post-void, pre-breakfast) reduce variability by up to 60%. Your 7-day rolling average is the most reliable indicator of true fat loss progress.
      </div>
      <button type="submit" disabled={mut.isPending || !form.weight} data-testid="btn-log-weight" style={{ width: "100%", padding: "16px", background: form.weight ? color : "var(--color-border)", color: form.weight ? "#fff" : "var(--color-text-muted)", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: form.weight ? "pointer" : "not-allowed", letterSpacing: "-0.01em", transition: "background 200ms", boxShadow: form.weight ? `0 4px 16px ${color}40` : "none" }}>
        {mut.isPending ? "Saving..." : justSaved ? "Saved" : "Log Weight"}
      </button>
    </form>
  );
}

// ── Sleep + Vitals Form ────────────────────────────────────────────────────────
function SleepForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.sleep;
  const todayStr = today();
  const [prefilled, setPrefilled] = useState(false);
  const [form, setForm] = useState({
    date: todayStr, hours: "", quality: 7, restingHr: "", fellAsleep: "",
    wokeUp: "", moodMorning: 7, notes: "", morningWeight: "", energyLevel: 7, hydrationOz: "",
  });

  const { data: sleepLogs } = useQuery<any[]>({ queryKey: ["/api/sleep"], staleTime: 30_000 });
  const { data: latestMarker } = useQuery<any>({ queryKey: ["/api/health-markers/latest"], staleTime: 30_000 });

  useEffect(() => {
    if (!sleepLogs) return;
    const rec = sleepLogs.find((s: any) => s.date === todayStr);
    if (!rec) return;
    setPrefilled(true);
    setForm(f => ({ ...f, date: rec.date ?? f.date, hours: rec.hours != null ? String(rec.hours) : f.hours, quality: rec.quality ?? f.quality, restingHr: rec.restingHr != null ? String(rec.restingHr) : f.restingHr, fellAsleep: rec.fellAsleep ?? f.fellAsleep, wokeUp: rec.wokeUp ?? f.wokeUp, moodMorning: rec.moodMorning ?? f.moodMorning, notes: rec.notes ?? f.notes }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepLogs]);

  useEffect(() => {
    if (!latestMarker) return;
    if (latestMarker.date !== todayStr) return;
    setForm(f => ({ ...f, morningWeight: latestMarker.morningWeight != null ? String(latestMarker.morningWeight) : f.morningWeight, energyLevel: latestMarker.energyLevel ?? f.energyLevel, hydrationOz: latestMarker.hydrationOz != null ? String(latestMarker.hydrationOz) : f.hydrationOz }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMarker]);

  const sleepMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sleep", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sleep"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false }); qc.invalidateQueries({ queryKey: ["/api/weekly"] }); },
  });
  const markerMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/health-markers", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/health-markers"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false }); },
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const promises = [];
    if (form.hours) {
      promises.push(sleepMut.mutateAsync({ date: form.date, hours: parseFloat(form.hours), quality: form.quality, restingHr: form.restingHr ? parseInt(form.restingHr) : null, fellAsleep: form.fellAsleep || null, wokeUp: form.wokeUp || null, moodMorning: form.moodMorning, notes: form.notes }));
    }
    if (form.morningWeight || form.energyLevel || form.hydrationOz) {
      promises.push(markerMut.mutateAsync({ date: form.date, morningWeight: form.morningWeight ? parseFloat(form.morningWeight) : null, energyLevel: form.energyLevel, mood: form.moodMorning, hydrationOz: form.hydrationOz ? parseInt(form.hydrationOz) : null }));
    }
    await Promise.all(promises);
    toast({ title: "Sleep & vitals logged" });
    setForm(f => ({ ...f, hours: "", restingHr: "", fellAsleep: "", wokeUp: "", notes: "", morningWeight: "", hydrationOz: "" }));
  };

  const isPending = sleepMut.isPending || markerMut.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ ...styles.sectionTitle(color), marginBottom: 0 }}>Sleep & Vitals · Recovery System</div>
        {prefilled && (
          <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.04em", color: color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>Auto-filled from Garmin</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "140px 80px", gap: "10px 14px", marginBottom: 10 }}>
        <div><label style={styles.label}>Date</label><FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div><label style={styles.label}>Hours Slept</label><FInput type="number" step="0.25" color={color} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="7.5" data-testid="input-sleep-hours" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "90px 110px 110px", gap: "10px 14px", marginBottom: 10 }}>
        <div><label style={styles.label}>Resting HR (bpm)</label><FInput type="number" color={color} value={form.restingHr} onChange={e => setForm(f => ({ ...f, restingHr: e.target.value }))} placeholder="56" data-testid="input-resting-hr" /></div>
        <div><label style={styles.label}>Fell Asleep</label><FInput type="time" color={color} value={form.fellAsleep} onChange={e => setForm(f => ({ ...f, fellAsleep: e.target.value }))} /></div>
        <div><label style={styles.label}>Woke Up</label><FInput type="time" color={color} value={form.wokeUp} onChange={e => setForm(f => ({ ...f, wokeUp: e.target.value }))} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "130px 90px", gap: "10px 14px", marginBottom: 10 }}>
        <div><label style={styles.label}>Morning Weight (lbs)</label><FInput type="number" step="0.1" color={color} value={form.morningWeight} onChange={e => setForm(f => ({ ...f, morningWeight: e.target.value }))} placeholder="184.5" data-testid="input-weight" /></div>
        <div><label style={styles.label}>Hydration (oz)</label><FInput type="number" color={color} value={form.hydrationOz} onChange={e => setForm(f => ({ ...f, hydrationOz: e.target.value }))} placeholder="80" /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
        <div><label style={styles.label}>Sleep Quality</label><RangeSlider value={form.quality} onChange={v => setForm(f => ({ ...f, quality: v }))} color={color} lowLabel="Poor 1" highLabel="Perfect 10" /></div>
        <div><label style={styles.label}>Morning Mood</label><RangeSlider value={form.moodMorning} onChange={v => setForm(f => ({ ...f, moodMorning: v }))} color={color} lowLabel="Low 1" highLabel="Great 10" /></div>
        <div><label style={styles.label}>Energy Level</label><RangeSlider value={form.energyLevel} onChange={v => setForm(f => ({ ...f, energyLevel: v }))} color={color} lowLabel="Depleted 1" highLabel="Energized 10" /></div>
        <div><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Took melatonin, late screen time, etc." /></div>
      </div>
      <button type="submit" disabled={isPending} data-testid="button-log-sleep" style={styles.btn(color, isPending)} onMouseEnter={e => { if (!isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {isPending ? "Saving…" : "Log Sleep & Vitals"}
      </button>
    </form>
  );
}

// ── Breathwork Form ────────────────────────────────────────────────────────────
function BreathworkForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.breathwork;
  const [form, setForm] = useState({
    date: today(), type: "box_breathing", durationMin: "",
    quality: 7, perceivedEffect: 7, notes: "", otherDesc: "",
  });

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breathwork", data),
    onSuccess: () => {
      toast({ title: "Breathwork logged" });
      qc.invalidateQueries({ queryKey: ["/api/breathwork"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
      setForm(f => ({ ...f, durationMin: "", notes: "", otherDesc: "" }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const types = [
    { value: "box_breathing",      label: "Box Breathing" },
    { value: "4-7-8",              label: "4-7-8" },
    { value: "holotropic",         label: "Holotropic" },
    { value: "alternate_nostril",  label: "Alternate Nostril" },
    { value: "wim_hof",            label: "Wim Hof" },
    { value: "ujjayi",             label: "Ujjayi Technique" },
    { value: "diaphragmatic",      label: "Diaphragmatic Breathing" },
    { value: "transpersonal",      label: "Transpersonal Breathwork" },
    { value: "nadi_shodhana",      label: "Nadi Shodhana" },
    { value: "kapalabhati",        label: "Kapalabhati (Breath of Fire)" },
    { value: "pursed_lip",         label: "Pursed Lip Breathing" },
    { value: "coordinated",        label: "Coordinated Breathing" },
    { value: "physiological_sigh", label: "Physiological Sigh" },
    { value: "other",              label: "Other" },
  ];

  return (
    <form onSubmit={e => {
      e.preventDefault();
      const notesWithDesc = form.type === "other" && form.otherDesc.trim()
        ? `${form.otherDesc.trim()}${form.notes.trim() ? ` - ${form.notes.trim()}` : ""}`
        : form.notes;
      mut.mutate({ ...form, durationMin: parseInt(form.durationMin), quality: form.quality, perceivedEffect: form.perceivedEffect, notes: notesWithDesc });
    }}>
      <a href="https://www.blueemberwellnessrva.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 20, textDecoration: "none", minHeight: 240 }}>
        <img src="./bew_paddleboard.png" alt="Blue Ember Wellness" style={{ width: "100%", height: 240, objectFit: "cover", objectPosition: "center top", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,30,56,0.2) 0%, rgba(10,30,56,0.75) 100%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "16px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f8f5ee", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Breathe. Reset. Return.</div>
          <div style={{ fontSize: 11, color: "rgba(248,245,238,0.7)", fontStyle: "italic" }}>"Each breath is a spark." &rarr; BlueEmberWellnessRVA.com</div>
        </div>
      </a>
      <div style={styles.sectionTitle(color)}>Breathwork · Respiratory System</div>
      <div className="kewt-form-grid3" style={styles.grid3}>
        <div><label style={styles.label}>Date</label><FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div>
          <label style={styles.label}>Technique</label>
          <FSelect color={color} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, otherDesc: "" }))} data-testid="select-breathwork-type">
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FSelect>
        </div>
        {form.type === "other" && (
          <div style={styles.fullWidth}>
            <label style={styles.label}>Describe your technique *</label>
            <FInput type="text" color={color} required value={form.otherDesc} onChange={e => setForm(f => ({ ...f, otherDesc: e.target.value }))} placeholder="e.g. Tummo, Buteyko, resonance breathing…" />
          </div>
        )}
        <div><label style={styles.label}>Duration (min) *</label><FInput type="number" color={color} required min={1} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} placeholder="10" data-testid="input-breathwork-duration" /></div>
        {form.type === "physiological_sigh" && (
          <div style={{ ...styles.fullWidth, background: "#f0fdf4", border: "1.5px solid #6ee7b7", borderRadius: 14, padding: "16px 18px", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Wind size={15} color="#059669" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", letterSpacing: "0.07em", textTransform: "uppercase" }}>Detailed Method - 15 Cycles Protocol</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: "Inhale 1", desc: "Take a deep, full breath in through your nose." },
                { step: "Inhale 2", desc: "Without exhaling, take a second, shorter sip of air through your nose to fully fill the lungs." },
                { step: "Exhale",   desc: "Perform a long, slow sighing exhale through your mouth until the lungs are completely empty." },
              ].map(({ step, desc }) => (
                <div key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ minWidth: 64, fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: 1 }}>{step}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #a7f3d0", fontSize: 12, color: "#047857", lineHeight: 1.6 }}>
              <strong>Duration:</strong> Repeat for 3&ndash;5 cycles (quick reset) or <strong>15 cycles</strong> for a full session. Calms the autonomic nervous system rapidly.
            </div>
          </div>
        )}
        <div style={styles.fullWidth}><label style={styles.label}>Quality</label><RangeSlider value={form.quality} onChange={v => setForm(f => ({ ...f, quality: v }))} color={color} lowLabel="Scattered 1" highLabel="Deep 10" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Perceived Effect</label><RangeSlider value={form.perceivedEffect} onChange={v => setForm(f => ({ ...f, perceivedEffect: v }))} color={color} lowLabel="None 1" highLabel="Profound 10" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Morning pre-ride session" /></div>
      </div>
      <button type="submit" disabled={mut.isPending} data-testid="button-log-breathwork" style={styles.btn(color, mut.isPending)} onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {mut.isPending ? "Saving…" : "Log Breathwork"}
      </button>
    </form>
  );
}

// ── Posture Form ───────────────────────────────────────────────────────────────
function PostureForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.posture;
  const tightAreas = ["hip", "shoulder", "neck", "back", "knee", "ankle"];
  const [form, setForm] = useState({ date: today(), alignment: 7, tightAreas: [] as string[], painPresent: false, painLocation: "", painSeverity: 3, notes: "" });

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/posture", data),
    onSuccess: () => {
      toast({ title: "Posture check logged" });
      qc.invalidateQueries({ queryKey: ["/api/posture"] });
      setForm(f => ({ ...f, tightAreas: [], painLocation: "", notes: "" }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleArea = (area: string) => setForm(f => ({ ...f, tightAreas: f.tightAreas.includes(area) ? f.tightAreas.filter(a => a !== area) : [...f.tightAreas, area] }));

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, tightAreas: JSON.stringify(form.tightAreas), painPresent: form.painPresent ? 1 : 0, painSeverity: form.painPresent ? form.painSeverity : null, painLocation: form.painPresent ? form.painLocation : null }); }}>
      <div style={styles.sectionTitle(color)}>Posture & Alignment Check</div>
      <div className="kewt-form-grid2" style={styles.grid2}>
        <div><label style={styles.label}>Date</label><FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Alignment Score</label><RangeSlider value={form.alignment} onChange={v => setForm(f => ({ ...f, alignment: v }))} color={color} lowLabel="Poor 1" highLabel="Perfect 10" /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={styles.label}>Tight Areas</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {tightAreas.map(area => {
            const active = form.tightAreas.includes(area);
            return (
              <button key={area} type="button" data-testid={`pill-${area}`} onClick={() => toggleArea(area)}
                style={{ padding: "6px 14px", borderRadius: 100, border: active ? "none" : "1.5px solid rgba(0,0,0,0.1)", background: active ? color : "#f8fafc", color: active ? "#fff" : "#64748b", fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer", transition: "all 150ms ease", boxShadow: active ? `0 3px 8px ${color}40` : "none" }}
              >{area.charAt(0).toUpperCase() + area.slice(1)}</button>
            );
          })}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={form.painPresent} onChange={e => setForm(f => ({ ...f, painPresent: e.target.checked }))} style={{ width: 16, height: 16, accentColor: color, cursor: "pointer" }} />
        <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>Pain present?</span>
      </label>
      {form.painPresent && (
        <div style={styles.grid}>
          <div><label style={styles.label}>Pain Location</label><FInput type="text" color={color} value={form.painLocation} onChange={e => setForm(f => ({ ...f, painLocation: e.target.value }))} placeholder="Right knee, lower back" /></div>
          <div style={styles.fullWidth}><label style={styles.label}>Pain Severity</label><RangeSlider value={form.painSeverity} onChange={v => setForm(f => ({ ...f, painSeverity: v }))} color={color} lowLabel="Mild 1" highLabel="Severe 10" /></div>
        </div>
      )}
      <div style={{ marginBottom: 4 }}><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Neck stiff after yesterday's 3-hour ride" /></div>
      <button type="submit" disabled={mut.isPending} data-testid="button-log-posture" style={styles.btn(color, mut.isPending)} onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {mut.isPending ? "Saving…" : "Log Posture Check"}
      </button>
    </form>
  );
}

// ── Work Form ─────────────────────────────────────────────────────────────────
function WorkForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.work;
  const [form, setForm] = useState({ date: today(), role: "S3", hours: "", stress: 5, energyLevel: 6, mood: 7, notes: "" });
  const roles = ["S3", "Kantner Consulting", "Blue Ember Wellness", "Other"];

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/work", data),
    onSuccess: () => {
      toast({ title: "Work logged" });
      qc.invalidateQueries({ queryKey: ["/api/work"] });
      setForm(f => ({ ...f, hours: "", notes: "" }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, hours: parseFloat(form.hours), stress: form.stress, energyLevel: form.energyLevel, mood: form.mood }); }}>
      <div style={styles.sectionTitle(color)}>Work & Stress Log</div>
      <div className="kewt-form-grid3" style={styles.grid3}>
        <div><label style={styles.label}>Date</label><FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div>
          <label style={styles.label}>Role</label>
          <FSelect color={color} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} data-testid="select-role">
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </FSelect>
        </div>
        <div><label style={styles.label}>Hours Worked *</label><FInput type="number" step="0.25" color={color} required min={0} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="8" data-testid="input-work-hours" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Work Stress</label><RangeSlider value={form.stress} onChange={v => setForm(f => ({ ...f, stress: v }))} color={color} lowLabel="Calm 1" highLabel="Overwhelmed 10" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Post-Work Energy</label><RangeSlider value={form.energyLevel} onChange={v => setForm(f => ({ ...f, energyLevel: v }))} color={color} lowLabel="Drained 1" highLabel="Energized 10" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Post-Work Mood</label><RangeSlider value={form.mood} onChange={v => setForm(f => ({ ...f, mood: v }))} color={color} lowLabel="Low 1" highLabel="Great 10" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Board meeting, difficult client, deadline pressure" /></div>
      </div>
      <button type="submit" disabled={mut.isPending} data-testid="button-log-work" style={styles.btn(color, mut.isPending)} onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {mut.isPending ? "Saving…" : "Log Work Day"}
      </button>
    </form>
  );
}

// ── Practice Form ─────────────────────────────────────────────────────────────
function PracticeForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const color = ACCENT.practice;
  const [form, setForm] = useState({ date: today(), type: "reiki_self", durationMin: "", quality: 8, clientName: "", clientOutcome: 8, revenueUsd: "", notes: "" });

  const types = [
    { value: "reiki_self",   label: "Reiki - Self" },
    { value: "reiki_client", label: "Reiki - Client" },
    { value: "yoga",         label: "Yoga" },
    { value: "meditation",   label: "Meditation" },
    { value: "journaling",   label: "Journaling" },
    { value: "tai_chi",      label: "Tai Chi" },
    { value: "other",        label: "Other" },
  ];

  const mut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/practice", data),
    onSuccess: () => {
      toast({ title: "Practice logged" });
      qc.invalidateQueries({ queryKey: ["/api/practice"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
      setForm(f => ({ ...f, durationMin: "", clientName: "", revenueUsd: "", notes: "" }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isClientSession = form.type === "reiki_client";

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, durationMin: parseInt(form.durationMin), quality: form.quality, clientOutcome: isClientSession ? form.clientOutcome : null, clientName: isClientSession ? form.clientName : null, revenueUsd: form.revenueUsd ? parseFloat(form.revenueUsd) : null }); }}>
      <div style={styles.sectionTitle(color)}>Personal Practice & Reiki</div>
      <div className="kewt-form-grid3" style={styles.grid3}>
        <div><label style={styles.label}>Date</label><FInput type="date" color={color} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div>
          <label style={styles.label}>Practice Type</label>
          <FSelect color={color} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} data-testid="select-practice-type">
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FSelect>
        </div>
        <div><label style={styles.label}>Duration (min) *</label><FInput type="number" color={color} required min={1} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} placeholder="20" data-testid="input-practice-duration" /></div>
        <div style={styles.fullWidth}><label style={styles.label}>Quality / Depth</label><RangeSlider value={form.quality} onChange={v => setForm(f => ({ ...f, quality: v }))} color={color} lowLabel="Surface 1" highLabel="Deep 10" /></div>
        {isClientSession && (
          <>
            <div><label style={styles.label}>Client Name</label><FInput type="text" color={color} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client first name" /></div>
            <div><label style={styles.label}>Revenue ($)</label><FInput type="number" step="0.01" color={color} value={form.revenueUsd} onChange={e => setForm(f => ({ ...f, revenueUsd: e.target.value }))} placeholder="85" /></div>
            <div style={styles.fullWidth}><label style={styles.label}>Client Outcome</label><RangeSlider value={form.clientOutcome} onChange={v => setForm(f => ({ ...f, clientOutcome: v }))} color={color} lowLabel="Poor 1" highLabel="Excellent 10" /></div>
          </>
        )}
        <div style={styles.fullWidth}><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Felt centered, strong channel, client released tension" /></div>
      </div>
      <button type="submit" disabled={mut.isPending} data-testid="button-log-practice" style={styles.btn(color, mut.isPending)} onMouseEnter={e => { if (!mut.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; } }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        {mut.isPending ? "Saving…" : "Log Practice"}
      </button>
    </form>
  );
}

// ── Fasting Form ──────────────────────────────────────────────────────────────
function FastingForm() {
  const { toast } = useToast();
  const color = ACCENT.fasting;

  const parseFormDateTime = (date: string, time: string): Date | null => {
    if (!date || !time) return null;
    try {
      const normalDate = date.match(/^\d{4}-\d{2}-\d{2}$/)
        ? date.split("-").slice(1).concat(date.split("-")[0]).join("/")
        : date;
      return new Date(`${normalDate} ${time}`);
    } catch { return null; }
  };

  const [form, setForm] = useState({
    fastStartDate: "", fastStartTime: "", fastEndDate: "", fastEndTime: "",
    plannedRideDurationMin: "", notes: "",
  });
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fastStartDt = parseFormDateTime(form.fastStartDate, form.fastStartTime);
  const fastEndDt = parseFormDateTime(form.fastEndDate, form.fastEndTime);
  const elapsedMs = fastStartDt ? now - fastStartDt.getTime() : 0;
  const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
  const elapsedH = Math.floor(elapsedHours);
  const elapsedM = Math.floor((elapsedHours - elapsedH) * 60);

  const rideDuration = parseInt(form.plannedRideDurationMin) || 0;
  const cortisolRisk = elapsedHours >= 12 && rideDuration > 75;
  const autophagyZone = elapsedHours >= 16;
  const fatOxZone = elapsedHours >= 12;

  const riskLevel = cortisolRisk && rideDuration > 120 ? "high" : cortisolRisk ? "moderate" : "low";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Fasting window logged", description: `${elapsedH}h ${elapsedM}m fast recorded. ${cortisolRisk ? "Cortisol alert noted." : "Metabolic status saved."}` });
    setForm(f => ({ ...f, fastEndDate: "", fastEndTime: "", plannedRideDurationMin: "", notes: "" }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={styles.sectionTitle(color)}>Fasting Tracker · Metabolic System</div>
      <div style={{ background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`, border: `1.5px solid ${color}30`, borderRadius: 16, padding: "20px 24px", marginBottom: 24, textAlign: "center" as const }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <Timer size={16} color={color} />
          <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Current Fast</span>
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color, letterSpacing: "-2px", lineHeight: 1 }}>
          {elapsedH}<span style={{ fontSize: 24, fontWeight: 600 }}>h</span>{" "}
          {String(elapsedM).padStart(2, "0")}<span style={{ fontSize: 24, fontWeight: 600 }}>m</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" as const }}>
          <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: fatOxZone ? `${color}20` : "#f1f5f9", color: fatOxZone ? color : "var(--color-text-faint)", border: `1px solid ${fatOxZone ? color + "40" : "transparent"}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {fatOxZone && <CheckCircle2 size={10} />}
            Fat oxidation {fatOxZone ? "active" : "(12h+)"}
          </span>
          <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: autophagyZone ? `${color}20` : "#f1f5f9", color: autophagyZone ? color : "var(--color-text-faint)", border: `1px solid ${autophagyZone ? color + "40" : "transparent"}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {autophagyZone && <Zap size={10} />}
            Autophagy {autophagyZone ? "initiated" : "(16h+)"}
          </span>
        </div>
      </div>
      {(() => {
        const fieldStyle: React.CSSProperties = { flex: 1, boxSizing: "border-box", borderRadius: 8, border: "1.5px solid rgba(0,0,0,0.10)", padding: "10px 12px", fontSize: 14, color: "#111827", background: "#fafafa", outline: "none", fontFamily: "inherit", minWidth: 0 };
        const hintStyle: React.CSSProperties = { fontSize: 10, color: "var(--color-text-faint)", marginTop: 3, fontStyle: "italic" };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={styles.label}>Fast Start *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker value={form.fastStartDate} onChange={v => setForm(f => ({ ...f, fastStartDate: v }))} color={color} data-testid="input-fast-start-date" />
                  <div style={hintStyle}>Date</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input type="text" inputMode="numeric" placeholder="HH:MM AM/PM" value={form.fastStartTime} onChange={e => setForm(f => ({ ...f, fastStartTime: e.target.value }))} data-testid="input-fast-start-time" style={fieldStyle} />
                  <div style={hintStyle}>Time</div>
                </div>
              </div>
            </div>
            <div>
              <label style={styles.label}>Fast End</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker value={form.fastEndDate} onChange={v => setForm(f => ({ ...f, fastEndDate: v }))} color={color} data-testid="input-fast-end-date" />
                  <div style={hintStyle}>Date</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input type="text" inputMode="numeric" placeholder="HH:MM AM/PM" value={form.fastEndTime} onChange={e => setForm(f => ({ ...f, fastEndTime: e.target.value }))} data-testid="input-fast-end-time" style={fieldStyle} />
                  <div style={hintStyle}>Time</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
        <div><label style={styles.label}>Activity Duration (min)</label><FInput type="number" color={color} min={0} placeholder="90" value={form.plannedRideDurationMin} onChange={e => setForm(f => ({ ...f, plannedRideDurationMin: e.target.value }))} data-testid="input-ride-duration" /></div>
        <div><label style={styles.label}>Notes</label><FInput type="text" color={color} value={form.notes} placeholder="LMNT + black coffee pre-ride, no exogenous carbs" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-fast-notes" /></div>
      </div>
      {rideDuration > 0 && (
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: riskLevel === "high" ? "#fef2f2" : riskLevel === "moderate" ? "#fffbeb" : "#f0fdf4", border: `1.5px solid ${riskLevel === "high" ? "#fca5a5" : riskLevel === "moderate" ? "#fde68a" : "#86efac"}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ marginTop: 1, flexShrink: 0 }}>
            {riskLevel === "low" ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color={riskLevel === "high" ? "#dc2626" : "#d97706"} />}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: riskLevel === "high" ? "#dc2626" : riskLevel === "moderate" ? "#b45309" : "#15803d" }}>
              {riskLevel === "high" ? "High Cortisol Risk" : riskLevel === "moderate" ? "Moderate Cortisol Risk" : "Fasted Ride - Safe Zone"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              {riskLevel === "low" && `${rideDuration} min fasted ride at ${elapsedH}h is within the safe window. Fat oxidation elevated ~17-21%. Post-ride: 30g protein + 60g carbs within 45 min.`}
              {riskLevel === "moderate" && `${rideDuration} min at ${elapsedH}h fasted crosses the 75-min cortisol threshold. Bring 30-45g carbs on the bike (gel, dates, or UCAN) to blunt cortisol without fully breaking fast benefits. Van Proeyen et al. (2011).`}
              {riskLevel === "high" && `${rideDuration} min at ${elapsedH}h fasted is high cortisol risk. Glycogen stores are depleted at this fast duration. Cortisol spikes sharply above 90 min without fuel. Take 40-60g carbs/hour on the bike. Consider a small meal 60 min pre-ride.`}
            </div>
          </div>
        </div>
      )}
      {fastStartDt && <div style={{ marginTop: 16, padding: "12px 16px", background: `${color}08`, borderRadius: 10, border: `1px solid ${color}20`, fontSize: 12, color: "var(--color-text-faint)", lineHeight: 1.6 }}>
        <strong style={{ color }}>Science:</strong> At {elapsedH}h fasted, AMPK activation promotes mitochondrial biogenesis and fat oxidation. Your fast exceeds the 16:8 TRE threshold shown by Wilkinson et al. (Cell Metabolism, 2020) to reduce body weight 3.3% in 12 weeks without caloric restriction. <em className="ki">KEWT</em> will cross-reference this fast window with your Garmin ride data to compute your fasted training adaptation score.
      </div>}
      <button type="submit" data-testid="button-log-fast" style={styles.btn(color, false)} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}60`; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 14px ${color}40`; }}>
        Log Fasting Window
      </button>
    </form>
  );
}

// ── Tab Config ────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; Icon: React.FC<any> }[] = [
  { id: "activity",   label: "Activity",       Icon: Activity },
  { id: "food",       label: "Food",           Icon: Apple },
  { id: "meal",       label: "Nutrition",      Icon: UtensilsCrossed },
  { id: "weight",     label: "Weight",         Icon: Scale },
  { id: "sleep",      label: "Sleep & Vitals", Icon: Moon },
  { id: "breathwork", label: "Breathwork",     Icon: Wind },
  { id: "posture",    label: "Posture",        Icon: AlignCenter },
  { id: "work",       label: "Work",           Icon: Briefcase },
  { id: "practice",   label: "Practice",       Icon: Sparkles },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DailyLog() {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  // Collapses the entire "What are you logging?" category list under one
  // header, separate from the existing per-row accordion (which still
  // controls which single form is open). Persisted per device so the
  // choice sticks between visits. Defaults to collapsed — that's the
  // whole point of this control, keep the category list out of the way
  // until it's actually wanted.
  const [categoriesOpen, setCategoriesOpen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem("kewt-dailylog-categories-open");
      return saved === null ? false : saved === "true";
    } catch {
      return false;
    }
  });
  const toggleCategoriesOpen = () => {
    setCategoriesOpen(prev => {
      const next = !prev;
      try { window.localStorage.setItem("kewt-dailylog-categories-open", String(next)); } catch {}
      return next;
    });
  };
  const [, navigate] = useHashLocation();

  const { data: practiceAccess } = useQuery<{ ok: boolean }>({
    queryKey: ["/api/me/practice-access"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const showPractice = practiceAccess?.ok === true;
  const visibleTabs = showPractice ? TABS : TABS.filter(t => t.id !== "practice");

  useEffect(() => {
    const handler = () => setActiveTab("activity");
    window.addEventListener("kewt:highlight-activity", handler);
    window.addEventListener("kewt:highlight-week", handler);
    return () => {
      window.removeEventListener("kewt:highlight-activity", handler);
      window.removeEventListener("kewt:highlight-week", handler);
    };
  }, []);

  return (
    <div style={{ ...styles.page, background: "var(--color-bg, #faf8f4)" }}>
      <style>{`
        @keyframes panelFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 500px) {
          .kewt-form-grid-activity { grid-template-columns: 1fr 1fr !important; }
          .kewt-form-grid3         { grid-template-columns: 1fr 1fr !important; }
          .kewt-form-grid2         { grid-template-columns: 1fr 1fr !important; }
          .kewt-form-grid-nutrition{ grid-template-columns: 1fr 1fr !important; }
          .kewt-form-grid-macros   { grid-template-columns: 1fr 1fr 1fr !important; }
        }
        ::-webkit-scrollbar { display: none; }
        .kewt-tab-row-wrap { position: relative; }
        .kewt-tab-row-scroll {
          display: flex; overflow-x: auto; overflow-y: hidden;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          gap: 6px; padding: 12px 0 8px; scroll-snap-type: x proximity;
        }
        .kewt-tab-row-scroll::-webkit-scrollbar { display: none; }
        .kewt-tab-row-scroll > * { scroll-snap-align: start; flex-shrink: 0; }
        .kewt-tab-row-wrap::after {
          content: ""; position: absolute; right: 0; top: 0; bottom: 0;
          width: 40px; background: linear-gradient(to right, transparent, #faf9f6 90%);
          pointer-events: none; z-index: 2;
        }
      `}</style>

      <div className="kewt-cin-hero">
        <img src="/hero_dailylog.jpg" alt="" className="kewt-cin-hero__img" style={{ objectPosition: "center 60%" }} />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(26,13,0)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>{formatDateDisplay()}</div>
          <div className="kewt-cin-hero__title">Daily Log.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#f59e0b,#fcd34d)" }} />
          <div className="kewt-cin-hero__sub">Activity · Food · Sleep · Recovery</div>
        </div>
      </div>

      <div style={{ maxWidth: "var(--page-max, 1120px)", margin: "0 auto", padding: "0 var(--page-pad, 28px)" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, padding: "10px 14px",
            borderRadius: 12,
            background: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(217,122,77,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <UploadIcon size={15} color="#d97a4d" />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-text)" }}>Missing an activity?</div>
              <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>Import files or screenshots</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/upload")}
            data-testid="button-daily-log-upload"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11.5, fontWeight: 700, color: "#fff",
              background: "#d97a4d", border: "none", cursor: "pointer",
              padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap",
            }}
          >
            <UploadIcon size={13} /> Upload
          </button>
        </div>

        <div style={{ paddingTop: 12 }}>
          <ActivityLog color={ACCENT.activity} />
        </div>

        <button
          type="button"
          onClick={toggleCategoriesOpen}
          aria-expanded={categoriesOpen}
          aria-controls="dl-categories-list"
          data-testid="toggle-dl-categories"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.04em",
            textTransform: "uppercase", padding: "16px 4px 4px",
            background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span>What are you logging?</span>
          {categoriesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div
          id="dl-categories-list"
          style={{
            display: "grid",
            gridTemplateRows: categoriesOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.28s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleTabs.map(({ id, label, Icon }) => {
                const isOpen = activeTab === id;
                const rowColor = ACCENT[id];
                return (
                  <div
                    key={id}
                    style={{ background: "var(--color-surface, #ffffff)", borderRadius: 16, boxShadow: isOpen ? "0 2px 20px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)", borderTop: isOpen ? `3px solid ${rowColor}` : "3px solid transparent", transition: "box-shadow 180ms ease, border-color 180ms ease" }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab(prev => prev === id ? null : id)}
                      aria-expanded={isOpen}
                      aria-controls={`dl-section-${id}`}
                      data-testid={`accordion-${id}`}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--color-text)", fontFamily: "inherit" }}
                    >
                      <span style={{ width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: isOpen ? rowColor : `${rowColor}1f`, color: isOpen ? "#fff" : rowColor, flexShrink: 0 }}>
                        <Icon size={16} />
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: isOpen ? 700 : 600, letterSpacing: "-0.01em" }}>{label}</span>
                      {isOpen ? <ChevronDown size={18} color="var(--color-text-faint)" /> : <ChevronRight size={18} color="var(--color-text-faint)" />}
                    </button>
                    {isOpen && (
                      <div id={`dl-section-${id}`} style={styles.panelInner}>
                        {id === "weight"     && <WeightForm />}
                        {id === "activity"   && <ActivityForm />}
                        {id === "food"       && <FoodForm />}
                        {id === "meal"       && <MealForm />}
                        {id === "sleep"      && <SleepForm />}
                        {id === "breathwork" && <BreathworkForm />}
                        {id === "posture"    && <PostureForm />}
                        {id === "work"       && <WorkForm />}
                        {id === "practice"   && <PracticeForm />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
