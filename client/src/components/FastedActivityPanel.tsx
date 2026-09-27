/**
 * FastedActivityPanel — Fasted Activity Intelligence
 * Renders automatically beneath an activity card when a fasting session overlaps.
 * Returns null silently when no overlap exists.
 */

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Flame, Brain, TrendingUp, Moon } from "lucide-react";

// ── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  emerald:  "#065f46",
  green:    "#10b981",
  amber:    "#f59e0b",
  navy:     "#0c4a6e",
  ink:      "#1c1917",
  muted:    "#6b7280",
  faint:    "#9ca3af",
  border:   "rgba(0,0,0,0.07)",
  surface:  "#ffffff",
  bg:       "#faf9f6",
};

const CBI_COLOR: Record<string, string> = {
  Low: "#10b981", Moderate: "#f59e0b", Elevated: "#f97316", High: "#ef4444",
};

const TIER_SHORT: Record<string, string> = {
  measured: "Measured", "hr-derived": "HR-Derived", virtual: "Virtual",
};

// ── Tooltip components ────────────────────────────────────────────────────────
function FuelTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,10,14,0.88)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "7px 11px" }}>
      <p style={{ color: C.faint, fontSize: 10, margin: "0 0 3px" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: 11, fontWeight: 700, margin: "1px 0" }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
}

function CortTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,10,14,0.88)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "7px 11px" }}>
      <p style={{ color: C.faint, fontSize: 10, margin: "0 0 3px" }}>{label}</p>
      <p style={{ color: "#f87171", fontSize: 11, fontWeight: 700, margin: 0 }}>Index: {payload[0]?.value}</p>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 2, width: "100%", padding: "10px 8px",
      background: `${color}0e`, borderRadius: 10,
      border: `1px solid ${color}22`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color, lineHeight: 1, textAlign: "center" }}>{value}</span>
      <span style={{ fontSize: 9, color: C.faint, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>{label}</span>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      margin: "0 0 8px", fontSize: 9, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: "0.12em", color: C.faint,
    }}>{children}</p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FastedActivityPanel({ activityId }: { activityId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/fasting/activity-report", activityId],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return apiRequest("GET", `/api/fasting/activity-report/${activityId}`);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: `${C.green}08`, border: `1px solid ${C.green}18`, display: "flex", alignItems: "center", gap: 8 }}>
        <Flame size={13} color={C.green} />
        <span style={{ fontSize: 12, color: C.muted }}>Checking fasted overlap…</span>
      </div>
    );
  }

  if (!data?.fasted) return null;

  const { hoursAtStart, fuelCurve, cortisolCurve, cbi, ftss, power, badges, narrative, recoveryForecast, sleep, overlapType } = data;
  const cbiColor  = CBI_COLOR[cbi?.label]  ?? C.amber;
  const ftssColor = ftss?.score >= 75 ? "#f97316" : ftss?.score >= 50 ? C.amber : ftss?.score >= 25 ? C.green : C.muted;

  return (
    <div
      data-testid="fasted-activity-panel"
      style={{
        marginTop: 12,
        borderRadius: 14,
        border: `1.5px solid ${C.green}28`,
        overflow: "hidden",
        background: C.bg,
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.emerald} 0%, #064e3b 100%)`,
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Flame size={14} color="#fbbf24" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
            Fasted Activity Intelligence
          </span>
          {overlapType === "partial" && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.18)", padding: "2px 6px", borderRadius: 5, letterSpacing: "0.06em" }}>PARTIAL</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{hoursAtStart}h fasted</span>
          {power && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.18)", padding: "2px 6px", borderRadius: 5, letterSpacing: "0.05em" }}>
              {TIER_SHORT[power.tier] ?? power.tier}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 14px 18px" }}>

        {/* ── Stat pills — 2×2 grid ──────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          <Pill label="Fuel Zone"  value={badges.fuelZone.replace(" Oxidation", " Ox.")} color={C.green} />
          <Pill label="Autophagy"  value={badges.autophagySignal}                        color={C.amber} />
          <Pill label="Cortisol"   value={cbi.label}                                     color={cbiColor} />
          <Pill label="Stimulus"   value={`${ftss.score}`}                               color={ftssColor} />
          {power && <Pill label="Power" value={`${power.watts}W`}                        color={C.navy} />}
        </div>

        {/* ── Fuel curve ────────────────────────────────────────────────── */}
        <SectionLabel>Substrate Fuel Curve</SectionLabel>
        <div style={{ height: 120, marginBottom: 14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fuelCurve} margin={{ top: 2, right: 2, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="fai-fat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.amber} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.amber} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fai-glyco" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: C.faint }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: C.faint }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={<FuelTip />} />
              <Area type="monotone" dataKey="fat"   name="Fat %"    stroke={C.amber} strokeWidth={2} fill="url(#fai-fat)"   dot={false} />
              <Area type="monotone" dataKey="glyco" name="Glucose %" stroke={C.green} strokeWidth={2} fill="url(#fai-glyco)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Cortisol arc ──────────────────────────────────────────────── */}
        <SectionLabel>Cortisol Arc (Estimated)</SectionLabel>
        <div style={{ height: 80, marginBottom: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cortisolCurve} margin={{ top: 2, right: 2, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="fai-cort" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: C.faint }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: C.faint }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={<CortTip />} />
              <Area type="monotone" dataKey="cortisol" stroke="#f87171" strokeWidth={2} fill="url(#fai-cort)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize: 10, color: C.faint, fontStyle: "italic", margin: "0 0 14px" }}>
          Modeled from time of day, prior-night HRV, fasting depth, and session intensity.
        </p>

        {/* ── Cortisol burden factors ───────────────────────────────────── */}
        {cbi.factors?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Cortisol Burden Factors</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {cbi.factors.map((f: string, i: number) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "3px 9px", borderRadius: 20,
                  background: `${cbiColor}10`, color: cbiColor,
                  border: `1px solid ${cbiColor}22`,
                }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Sleep context ─────────────────────────────────────────────── */}
        {sleep && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", borderRadius: 10,
            background: `${C.navy}06`, border: `1px solid ${C.navy}12`,
            marginBottom: 14,
          }}>
            <Moon size={13} color={C.navy} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {sleep.sleepScore != null && (
                <span style={{ fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Sleep </span>
                  <span style={{ fontWeight: 700, color: C.ink }}>{sleep.sleepScore}</span>
                </span>
              )}
              {sleep.hrv != null && (
                <span style={{ fontSize: 12 }}>
                  <span style={{ color: C.muted }}>HRV </span>
                  <span style={{ fontWeight: 700, color: C.ink }}>{sleep.hrv}</span>
                </span>
              )}
              {sleep.restingHr != null && (
                <span style={{ fontSize: 12 }}>
                  <span style={{ color: C.muted }}>RHR </span>
                  <span style={{ fontWeight: 700, color: C.ink }}>{sleep.restingHr}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Narrative ─────────────────────────────────────────────────── */}
        <div style={{
          padding: "11px 13px", borderRadius: 10, marginBottom: 10,
          background: `${C.navy}07`, borderLeft: `3px solid ${C.navy}40`,
          display: "flex", gap: 9, alignItems: "flex-start",
        }}>
          <Brain size={13} color={C.navy} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{narrative}</p>
        </div>

        {/* ── Recovery forecast ─────────────────────────────────────────── */}
        <div style={{
          padding: "10px 13px", borderRadius: 10,
          background: cbi.score <= 3
            ? `${C.green}0d`
            : cbi.score <= 5
            ? `${C.amber}0d`
            : "rgba(239,68,68,0.05)",
          border: `1px solid ${cbi.score <= 3 ? C.green : cbi.score <= 5 ? C.amber : "#ef4444"}20`,
          display: "flex", gap: 9, alignItems: "flex-start",
        }}>
          <TrendingUp size={13} color={cbi.score <= 3 ? C.green : cbi.score <= 5 ? C.amber : "#ef4444"} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{recoveryForecast}</p>
        </div>

        {/* ── Attribution ───────────────────────────────────────────────── */}
        <p style={{ fontSize: 9, color: C.faint, margin: "10px 0 0", textAlign: "right", fontStyle: "italic" }}>
          Blue Ember Intelligence
        </p>

      </div>
    </div>
  );
}
