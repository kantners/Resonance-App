/**
 * ActivityEnrichmentPanel — Activity Intelligence for ALL activities
 * Renders beneath every activity card with HR zone, training load context,
 * modality-specific science, and a recovery prescription.
 * Mirrors the visual language of FastedActivityPanel.
 * Returns null silently while loading or if the activity can't be found.
 */

import { useQuery } from "@tanstack/react-query";
import { Activity, Brain, TrendingUp, Moon, Award, Zap } from "lucide-react";

// ── Tokens (shared with FastedActivityPanel) ─────────────────────────────────
const C = {
  emerald:  "#065f46",
  green:    "#10b981",
  amber:    "#f59e0b",
  navy:     "#0c4a6e",
  blue:     "#3b82f6",
  ink:      "#1c1917",
  muted:    "#6b7280",
  faint:    "#9ca3af",
  border:   "rgba(0,0,0,0.07)",
  surface:  "#ffffff",
  bg:       "#faf9f6",
};

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 2, width: "100%", padding: "10px 8px",
      background: `${color}0e`, borderRadius: 10,
      border: `1px solid ${color}22`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color, lineHeight: 1.15, textAlign: "center" }}>{value}</span>
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
export function ActivityEnrichmentPanel({ activityId }: { activityId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/activity-enrichment", activityId],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return apiRequest("GET", `/api/activity-enrichment/${activityId}`);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: `${C.blue}08`, border: `1px solid ${C.blue}18`, display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={13} color={C.blue} />
        <span style={{ fontSize: 12, color: C.muted }}>Analyzing activity…</span>
      </div>
    );
  }

  if (!data || data.error) return null;

  const {
    modality, duration, hrZone, loadContext, modalityNote,
    recoveryNote, narrative, milestone, weekContext, sleep, totalActivities,
  } = data;

  // Determine accent color for the recovery block from its language
  const recoveryColor =
    /full rest|high.stress|high cortisol/i.test(recoveryNote ?? "")
      ? "#ef4444"
      : /48|hard|quality/i.test(recoveryNote ?? "")
      ? C.amber
      : C.green;

  return (
    <div
      data-testid="activity-enrichment-panel"
      style={{
        marginTop: 12,
        borderRadius: 14,
        border: `1.5px solid ${C.blue}28`,
        overflow: "hidden",
        background: C.bg,
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.navy} 0%, #0a3a56 100%)`,
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Activity size={14} color="#7dd3fc" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
            Activity Intelligence
          </span>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", textTransform: "capitalize" }}>
          {modality} · {duration}min
        </span>
      </div>

      <div style={{ padding: "14px 14px 18px" }}>

        {/* ── Milestone banner ───────────────────────────────────────────── */}
        {milestone && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", borderRadius: 10, marginBottom: 14,
            background: `${C.amber}12`, border: `1px solid ${C.amber}30`,
          }}>
            <Award size={14} color={C.amber} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{milestone}</span>
          </div>
        )}

        {/* ── Stat pills ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {hrZone && (
            <Pill
              label={`Zone ${hrZone.zone} · ${hrZone.pct}% Max`}
              value={hrZone.label.split(" · ")[1] ?? hrZone.label}
              color={hrZone.color}
            />
          )}
          {loadContext && (
            <Pill label="Training Load" value={loadContext.label} color={loadContext.color} />
          )}
        </div>

        {/* ── HR Zone science ────────────────────────────────────────────── */}
        {hrZone && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Heart Rate Zone</SectionLabel>
            <div style={{
              padding: "11px 13px", borderRadius: 10,
              background: `${hrZone.color}0a`, borderLeft: `3px solid ${hrZone.color}`,
              display: "flex", gap: 9, alignItems: "flex-start",
            }}>
              <Zap size={13} color={hrZone.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{hrZone.science}</p>
            </div>
          </div>
        )}

        {/* ── Training load context ──────────────────────────────────────── */}
        {loadContext && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Load Context (7-Day)</SectionLabel>
            <div style={{
              padding: "11px 13px", borderRadius: 10,
              background: `${loadContext.color}0a`, borderLeft: `3px solid ${loadContext.color}`,
              display: "flex", gap: 9, alignItems: "flex-start",
            }}>
              <TrendingUp size={13} color={loadContext.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{loadContext.text}</p>
            </div>
          </div>
        )}

        {/* ── Modality science note ──────────────────────────────────────── */}
        {modalityNote && (
          <div style={{
            padding: "11px 13px", borderRadius: 10, marginBottom: 14,
            background: `${C.emerald}07`, borderLeft: `3px solid ${C.emerald}40`,
            display: "flex", gap: 9, alignItems: "flex-start",
          }}>
            <Brain size={13} color={C.emerald} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{modalityNote}</p>
          </div>
        )}

        {/* ── Sleep context ─────────────────────────────────────────────── */}
        {sleep && (sleep.sleepScore != null || sleep.hrv != null || sleep.restingHr != null) && (
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
        {narrative && (
          <div style={{
            padding: "11px 13px", borderRadius: 10, marginBottom: 10,
            background: `${C.navy}07`, borderLeft: `3px solid ${C.navy}40`,
            display: "flex", gap: 9, alignItems: "flex-start",
          }}>
            <Brain size={13} color={C.navy} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{narrative}</p>
          </div>
        )}

        {/* ── Recovery prescription ─────────────────────────────────────── */}
        {recoveryNote && (
          <div style={{
            padding: "10px 13px", borderRadius: 10,
            background: `${recoveryColor}0d`,
            border: `1px solid ${recoveryColor}20`,
            display: "flex", gap: 9, alignItems: "flex-start",
          }}>
            <TrendingUp size={13} color={recoveryColor} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.7 }}>{recoveryNote}</p>
          </div>
        )}

        {/* ── Footer: week context + attribution ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          {weekContext && weekContext.sessions > 0 ? (
            <span style={{ fontSize: 9, color: C.faint }}>
              {weekContext.sessions} session{weekContext.sessions === 1 ? "" : "s"} this week
              {totalActivities ? ` · ${totalActivities} total` : ""}
            </span>
          ) : <span />}
          <span style={{ fontSize: 9, color: C.faint, textAlign: "right", fontStyle: "italic" }}>
            Blue Ember Intelligence
          </span>
        </div>

      </div>
    </div>
  );
}