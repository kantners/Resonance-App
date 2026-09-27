import { localToday, localDate, fmtLocalDate } from "@/lib/dateUtils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Activity, Flame, Moon, TrendingUp, Heart, Dumbbell, ChevronDown, ChevronUp } from "lucide-react";

// ─── Color palette ──────────────────────────────────────────────────────────

const MODALITY_COLORS: Record<string, string> = {
  cycling:  "var(--color-primary)",
  running:  "var(--color-orange)",
  walking:  "var(--color-blue)",
  rucking:  "var(--color-purple)",
  hiking:   "var(--color-gold)",
  swimming: "var(--color-blue)",
  strength: "var(--color-error)",
  yoga:     "var(--color-warning)",
  other:    "var(--color-text-muted)",
};

const MODALITY_HEX: Record<string, string> = {
  cycling:  "#22c55e",
  running:  "#f97316",
  walking:  "#3b82f6",
  rucking:  "#a855f7",
  hiking:   "#eab308",
  swimming: "#3b82f6",
  strength: "#ef4444",
  yoga:     "#f59e0b",
  other:    "#94a3b8",
};

function getModalityHex(mod: string): string {
  return MODALITY_HEX[mod?.toLowerCase()] ?? "#94a3b8";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreClass(s: number | null): { color: string; bg: string } {
  if (!s) return { color: "var(--color-text-faint)", bg: "transparent" };
  if (s >= 70) return { color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
  if (s >= 45) return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  return { color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
}

function sleepColor(h: number | null): string {
  if (!h) return "var(--color-text-faint)";
  if (h >= 7) return "#22c55e";
  if (h >= 6) return "#f59e0b";
  return "#ef4444";
}

function moodColor(m: number | null): string {
  if (!m) return "var(--color-text-faint)";
  if (m >= 7) return "#22c55e";
  if (m >= 4) return "#f59e0b";
  return "#ef4444";
}

function formatDate(iso: string): { short: string; full: string } {
  const d = localDate(iso);
  return {
    short: d.toLocaleDateString("en-US", { weekday: "short" }),
    full:  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function isToday(iso: string): boolean {
  const today = localToday();
  return iso === today;
}

function dateRangeLabel(): string {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-divider)" }}>
      {[120, 90, 60, 60, 60, 70].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div
            style={{
              height: 14,
              width: w,
              borderRadius: 7,
              background: "var(--color-divider)",
              animation: "wv-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.08}s`,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Stat Tile ───────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number;
  unit: string;
  accentColor: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatTile({ label, value, unit, accentColor, icon, loading }: StatTileProps) {
  return (
    <div
      style={{
        minWidth: 128,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 16,
        padding: "14px 16px 13px",
        boxShadow: "var(--shadow-sm)",
        borderTop: `3px solid ${accentColor}`,
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* subtle glow behind accent strip */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 56,
          background: `linear-gradient(180deg, ${accentColor}18 0%, transparent 100%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 10,
        }}
      >
        <span style={{ color: accentColor, display: "flex" }}>{icon}</span>
        {label}
      </div>
      {loading ? (
        <div
          style={{
            height: 28,
            width: 72,
            borderRadius: 6,
            background: "var(--color-divider)",
            animation: "wv-pulse 1.4s ease-in-out infinite",
          }}
        />
      ) : value === "—" || value == null ? (
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-faint)", fontStyle: "italic", paddingTop: 4 }}>
          Awaiting <em className="ki">KEWT</em> data
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-muted)" }}>
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Modality Bar Row ─────────────────────────────────────────────────────────

function ModalityBar({ modality, minutes, sessions, totalMinutes }: {
  modality: string;
  minutes: number;
  sessions: number;
  totalMinutes: number;
}) {
  const pct = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
  const hex = getModalityHex(modality);
  const label = modality.charAt(0).toUpperCase() + modality.slice(1);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* dot */}
      <div
        style={{
          width: 9, height: 9,
          borderRadius: "50%",
          background: hex,
          boxShadow: `0 0 6px ${hex}88`,
          flexShrink: 0,
        }}
      />
      {/* name */}
      <div
        style={{
          width: 76,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text)",
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      {/* bar track */}
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--color-divider)",
          borderRadius: 100,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${hex}cc, ${hex})`,
            borderRadius: 100,
            transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
            boxShadow: `0 0 8px ${hex}66`,
          }}
        />
      </div>
      {/* pill */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: hex,
          background: `${hex}18`,
          border: `1px solid ${hex}33`,
          borderRadius: 100,
          padding: "2px 8px",
          flexShrink: 0,
          minWidth: 52,
          textAlign: "center",
        }}
      >
        {minutes}m
      </div>
      {/* sessions */}
      <div
        style={{
          fontSize: 11,
          color: "var(--color-text-faint)",
          flexShrink: 0,
          width: 32,
          textAlign: "right",
        }}
      >
        ×{sessions}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeeklyView() {
  const todayStr = localToday();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/weekly", todayStr],
    queryFn: () => apiRequest("GET", `/api/weekly?date=${todayStr}`),
  });
  const [perfOpen, setPerfOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const d             = data as any;
  const rows          = [...(d?.rows || [])].reverse();
  const stats         = d?.weekStats || {};
  const modality      = d?.modalityBreakdown || [];
  const totalTrainingMin = modality.reduce((s: number, m: any) => s + m.minutes, 0);
  const totalSessions    = modality.reduce((s: number, m: any) => s + (Number(m.sessions) || 0), 0);

  const hasData = rows.length > 0;

  /* ── Training time label ── */
  const trainingLabel =
    totalTrainingMin >= 60
      ? `${Math.floor(totalTrainingMin / 60)}h ${totalTrainingMin % 60}m`
      : totalTrainingMin > 0
      ? `${totalTrainingMin}m`
      : "—";

  /* ── Net deficit display ── */
  const deficit = stats.netDeficit ?? 0;
  const deficitStr = deficit > 0 ? `+${deficit}` : `${deficit}`;

  /* ── Burned display ── */
  const burnedStr =
    stats.totalCalsBurned > 0
      ? `${(stats.totalCalsBurned / 1000).toFixed(1)}`
      : "—";

  /* ── Animations ── */
  const keyframes = `
    @keyframes wv-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes wv-fadein {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes wv-scalein {
      from { opacity: 0; transform: scale(0.97); }
      to   { opacity: 1; transform: scale(1); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>

      {/* Cinematic Hero — full bleed */}
      <div className="kewt-cin-hero" style={{ marginBottom: 0, borderRadius: "0 0 24px 24px" }}>
          <img
            src="/hero_weekly.jpg"
            alt=""
            className="kewt-cin-hero__img"
            style={{ objectPosition: "center 45%" }}
          />
          <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(2,13,6)" } as React.CSSProperties} />
          <div className="kewt-cin-hero__content">
            <div className="kewt-cin-hero__eyebrow" style={{ color: "#10b981" }}>{dateRangeLabel()}</div>
            <div className="kewt-cin-hero__title">This Week.</div>
            <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#10b981,#34d399)" }} />
            <div className="kewt-cin-hero__sub">Rolling 7-day training window</div>
          </div>
      </div>

      <div
        style={{
          padding: "20px var(--page-pad, 28px) 48px",
          maxWidth: "var(--page-max, 1120px)",
          margin: "0 auto",
          animation: "wv-fadein 0.35s ease both",
        }}
      >

        {/* ── Stat Tiles Strip ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 28,
            scrollbarWidth: "none",
          }}
        >
          <StatTile
            label="Avg Weight"
            value={stats.avgWeight ?? "—"}
            unit="lbs"
            accentColor="#22c55e"
            icon={<TrendingUp size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Net Deficit"
            value={isLoading ? "—" : deficitStr}
            unit="cal"
            accentColor="#22c55e"
            icon={<Flame size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Total Burned"
            value={isLoading ? "—" : burnedStr}
            unit="kcal"
            accentColor="#22c55e"
            icon={<Flame size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Avg Sleep"
            value={stats.avgSleepHours ?? "—"}
            unit="hrs"
            accentColor="#3b82f6"
            icon={<Moon size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Avg HR"
            value={stats.avgResting ?? "—"}
            unit="bpm"
            accentColor="#f97316"
            icon={<Heart size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Avg Mood"
            value={stats.avgMood ?? "—"}
            unit="/10"
            accentColor="#a855f7"
            icon={<Activity size={12} />}
            loading={isLoading}
          />
          <StatTile
            label="Training"
            value={isLoading ? "—" : trainingLabel}
            unit=""
            accentColor="#a855f7"
            icon={<Dumbbell size={12} />}
            loading={isLoading}
          />
        </div>

        {/* ── Two-column layout: Breakdown + Donut ── */}
        {(isLoading || modality.length > 0) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 28,
              animation: "wv-scalein 0.4s ease both",
              animationDelay: "0.08s",
            }}
          >
            {/* Modality bars */}
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 20,
                padding: "20px 22px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                onClick={() => setBreakdownOpen(o => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: breakdownOpen ? 18 : 0,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <Dumbbell size={14} style={{ color: "var(--color-primary)" }} />
                  Training Breakdown
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                    {totalSessions > 0 ? `${totalSessions} session${totalSessions !== 1 ? "s" : ""}` : "No sessions logged"} · {totalTrainingMin > 0 ? `${totalTrainingMin}m total` : ""}
                  </span>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {breakdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>

              {breakdownOpen && isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-divider)", animation: "wv-pulse 1.4s ease-in-out infinite" }} />
                      <div style={{ width: 76, height: 13, borderRadius: 6, background: "var(--color-divider)", animation: "wv-pulse 1.4s ease-in-out infinite" }} />
                      <div style={{ flex: 1, height: 6, borderRadius: 100, background: "var(--color-divider)", animation: "wv-pulse 1.4s ease-in-out infinite" }} />
                    </div>
                  ))}
                </div>
              ) : breakdownOpen ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {modality.map((m: any) => (
                    <ModalityBar
                      key={m.modality}
                      modality={m.modality}
                      minutes={m.minutes}
                      sessions={m.sessions}
                      totalMinutes={totalTrainingMin}
                    />
                  ))}
                </div>
              ) : null}

              {/* Stacked bar + hours list */}
              {breakdownOpen && !isLoading && modality.length > 0 && (
                <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 16, paddingTop: 16 }}>
                  {/* Stacked bar */}
                  <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", gap: 2 }}>
                    {modality.map((m: any) => {
                      const pct = totalTrainingMin > 0 ? (m.minutes / totalTrainingMin) * 100 : 0;
                      return (
                        <div
                          key={m.modality}
                          title={`${m.modality.charAt(0).toUpperCase() + m.modality.slice(1)}: ${Math.round(pct)}%`}
                          style={{
                            width: `${pct}%`,
                            background: getModalityHex(m.modality),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: pct > 8 ? 11 : 0,
                            fontWeight: 800,
                            color: "white",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                          }}
                        >
                          {pct > 8 ? `${Math.round(pct)}%` : ""}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hours list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    {modality.map((m: any) => (
                      <div key={m.modality} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--color-text-muted)", textTransform: "capitalize" }}>{m.modality}</span>
                        <span style={{ color: "var(--color-text)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {Math.floor(m.minutes / 60) > 0 ? `${Math.floor(m.minutes / 60)}h ` : ""}{m.minutes % 60}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 7-Day Pivot Table ── */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
            animation: "wv-fadein 0.45s ease both",
            animationDelay: "0.12s",
          }}
        >
          {/* table header section title */}
          <div
            onClick={() => setPerfOpen(o => !o)}
            style={{
              padding: "16px 20px 14px",
              borderBottom: perfOpen ? "1px solid var(--color-divider)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--color-text)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Calendar size={14} style={{ color: "var(--color-primary)" }} />
            7-Day Performance Log
            <span style={{ marginLeft: "auto", color: "var(--color-text-muted)" }}>
              {perfOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>

          {perfOpen && <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              {/* sticky header */}
              <thead>
                <tr
                  style={{
                    background: "var(--color-surface-2, hsl(220 14% 97%))",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  {["Date", "Activity", "Cals", "Sleep", "Mood", "Recovery"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        textAlign: i === 0 ? "left" : "center",
                        borderBottom: "1px solid var(--color-divider)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading
                  ? Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
                  : !hasData
                  ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "56px 24px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 48, height: 48,
                              borderRadius: 14,
                              background: "var(--color-primary-light)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <Calendar size={22} style={{ color: "var(--color-primary)" }} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                            Nothing logged this week. Feed <em className="ki">KEWT</em> your first session.
                          </div>
                          <div style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 320 }}>
                            Start your first day log to see your 7-day picture.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                  : rows.map((row: any, idx: number) => {
                      const today    = isToday(row.date);
                      const dateInfo = formatDate(row.date);
                      const sc       = scoreClass(row.recoveryScore);
                      const sCal     = row.calories ?? row.calsIntake ?? null;
                      const sSleep   = row.sleep ?? row.sleepHours ?? null;
                      const sMood    = row.mood ?? null;
                      const sRecov   = row.recoveryScore ?? null;
                      const sAct     = row.activities ?? "";
                      const slColor  = sleepColor(sSleep);
                      const mColor   = moodColor(sMood);

                      return (
                        <tr
                          key={row.date}
                          data-testid={`weekly-row-${row.date}`}
                          style={{
                            background: idx % 2 === 0
                              ? "transparent"
                              : "hsl(220 12% 99%)",
                            borderBottom: "1px solid var(--color-divider)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              "var(--color-primary-light)";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              idx % 2 === 0 ? "transparent" : "hsl(220 12% 99%)";
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {today ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  gap: 1,
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    background: "var(--color-primary)",
                                    color: "white",
                                    borderRadius: 8,
                                    padding: "3px 9px 3px 6px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 5, height: 5,
                                      borderRadius: "50%",
                                      background: "rgba(255,255,255,0.8)",
                                      flexShrink: 0,
                                    }}
                                  />
                                  {dateInfo.short} {dateInfo.full}
                                </span>
                              </span>
                            ) : (
                              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                                  {dateInfo.short}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                                  {dateInfo.full}
                                </span>
                              </span>
                            )}
                          </td>

                          {/* Activity */}
                          <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {sAct ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 4,
                                  justifyContent: "center",
                                  maxWidth: 180,
                                  margin: "0 auto",
                                }}
                              >
                                {String(sAct).split(",").map((a: string, i: number) => {
                                  const clean = a.trim().toLowerCase();
                                  const hex   = getModalityHex(clean);
                                  return (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "2px 7px",
                                        borderRadius: 100,
                                        background: `${hex}18`,
                                        color: hex,
                                        border: `1px solid ${hex}33`,
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {a.trim()}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--color-text-faint)", fontStyle: "italic" }}>
                                Rest
                              </span>
                            )}
                          </td>

                          {/* Cals */}
                          <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {sCal ? (
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#22c55e",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {sCal.toLocaleString()}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  textAlign: "center",
                                  fontSize: 14,
                                  color: "var(--color-text-faint)",
                                  borderBottom: "1px dashed var(--color-divider)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>

                          {/* Sleep */}
                          <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {sSleep != null ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: slColor,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {Number(sSleep).toFixed(1)}h
                                </span>
                                <div
                                  style={{
                                    width: 40, height: 3,
                                    borderRadius: 100,
                                    background: "var(--color-divider)",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${Math.min((sSleep / 9) * 100, 100)}%`,
                                      background: slColor,
                                      borderRadius: 100,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  textAlign: "center",
                                  fontSize: 14,
                                  color: "var(--color-text-faint)",
                                  borderBottom: "1px dashed var(--color-divider)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>

                          {/* Mood */}
                          <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {sMood != null ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                <div
                                  style={{
                                    width: 8, height: 8,
                                    borderRadius: "50%",
                                    background: mColor,
                                    boxShadow: `0 0 6px ${mColor}88`,
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: mColor,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {sMood}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--color-text-faint)" }}>/10</span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  textAlign: "center",
                                  fontSize: 14,
                                  color: "var(--color-text-faint)",
                                  borderBottom: "1px dashed var(--color-divider)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>

                          {/* Recovery */}
                          <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {sRecov != null ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: sc.color,
                                  background: sc.bg,
                                  border: `1px solid ${sc.color}44`,
                                  borderRadius: 8,
                                  padding: "3px 10px",
                                  fontVariantNumeric: "tabular-nums",
                                  minWidth: 40,
                                  textAlign: "center",
                                }}
                              >
                                {sRecov}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  textAlign: "center",
                                  fontSize: 14,
                                  color: "var(--color-text-faint)",
                                  borderBottom: "1px dashed var(--color-divider)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>}
        </div>
      </div>
    </>
  );
}
