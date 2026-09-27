import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Zap, Moon, Activity, Brain, FlaskConical } from "lucide-react";

function formatPace(v: number) {
  const m = Math.floor(v);
  const s = Math.round((v - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Custom Tooltips ─────────────────────────────────────────────────────────
// Tooltips use dark glass backgrounds since they float over charts — that's intentional

function PaceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,15,20,0.92)",
      border: "1px solid rgba(251,146,60,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(12px)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#fb923c", fontWeight: 700, fontSize: 15 }}>
        {formatPace(payload[0].value)}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>/mi</span>
      </p>
      {payload[1] && (
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>
          Effort: {payload[1].value}/10
        </p>
      )}
    </div>
  );
}

function CyclingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,15,20,0.92)",
      border: "1px solid rgba(16,185,129,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(12px)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>
        {payload[0].value}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>min</span>
      </p>
      {payload[1] && payload[1].value && (
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>
          ~{payload[1].value} kcal
        </p>
      )}
    </div>
  );
}

function SleepTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,15,20,0.92)",
      border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(12px)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 600, fontSize: 14, marginTop: 2 }}>
          {p.name === "hours" ? `${p.value}h sleep` : `Quality ${p.value}/10`}
        </p>
      ))}
    </div>
  );
}

// ─── Significance badge ───────────────────────────────────────────────────────

function SignificanceBadge({ value }: { value: number }) {
  const abs = Math.abs(value);
  if (abs >= 0.7) {
    return (
      <span style={{
        background: "rgba(16,185,129,0.15)",
        color: "#10b981",
        border: "1px solid rgba(16,185,129,0.3)",
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}>Strong</span>
    );
  }
  if (abs >= 0.4) {
    return (
      <span style={{
        background: "rgba(251,191,36,0.12)",
        color: "var(--color-ember)",
        border: "1px solid rgba(251,191,36,0.25)",
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}>Moderate</span>
    );
  }
  return (
    <span style={{
      background: "var(--color-surface-2, rgba(148,163,184,0.08))",
      color: "var(--color-text-muted)",
      border: "1px solid var(--color-border)",
      borderRadius: 20,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
    }}>Weak</span>
  );
}

// ─── Correlation Card ─────────────────────────────────────────────────────────

function CorrelationCard({ corr }: { corr: any }) {
  const coeff = parseFloat(corr.coefficient ?? corr.pearsonR ?? corr.value ?? 0);
  const isPositive = coeff > 0.1;
  const isNegative = coeff < -0.1;

  const glowColor = isPositive
    ? "rgba(16,185,129,0.10)"
    : isNegative
    ? "rgba(239,68,68,0.08)"
    : "var(--color-surface)";

  const coeffColor = isPositive ? "#10b981" : isNegative ? "#ef4444" : "var(--color-text-muted)";
  const borderColor = isPositive
    ? "rgba(16,185,129,0.25)"
    : isNegative
    ? "rgba(239,68,68,0.2)"
    : "var(--color-border)";

  const label = corr.label || corr.metrics || `${corr.metricA || ""} → ${corr.metricB || ""}`;
  const insight = corr.insight || corr.description || "";

  return (
    <div style={{
      background: glowColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 16,
      padding: "20px 22px",
      display: "flex",
      gap: 20,
      alignItems: "flex-start",
      backdropFilter: "blur(8px)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow spot */}
      <div style={{
        position: "absolute",
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: isPositive
          ? "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)"
          : isNegative
          ? "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)"
          : "transparent",
        pointerEvents: "none",
      }} />

      {/* Coefficient */}
      <div style={{ minWidth: 72, textAlign: "center" }}>
        <div style={{
          fontSize: 30,
          fontWeight: 800,
          color: coeffColor,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}>
          {coeff >= 0 ? "+" : ""}{coeff.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-faint, var(--color-text-muted))", marginTop: 4, letterSpacing: "0.05em" }}>
          Pearson r
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text)",
            lineHeight: 1.3,
          }}>{label}</span>
          <SignificanceBadge value={coeff} />
        </div>
        {insight && (
          <p style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}>{insight}</p>
        )}
      </div>
    </div>
  );
}

// ─── Section Eyebrow ─────────────────────────────────────────────────────────

function SectionEyebrow({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    }}>
      <div style={{
        width: 20,
        height: 2,
        borderRadius: 2,
        background: color,
      }} />
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color,
        textTransform: "uppercase",
      }}>{label}</span>
    </div>
  );
}

// ─── Chart Card Shell ─────────────────────────────────────────────────────────

function ChartCard({
  eyebrow,
  eyebrowColor,
  title,
  icon,
  children,
  isEmpty,
  emptyLabel,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 20,
      padding: 24,
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}>
      <SectionEyebrow label={eyebrow} color={eyebrowColor} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ color: eyebrowColor, display: "flex" }}>{icon}</span>
        <h3 style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 700,
          color: "var(--color-text)",
          letterSpacing: "-0.01em",
        }}>{title}</h3>
      </div>
      {isEmpty ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 180,
          border: "1.5px dashed var(--color-border)",
          borderRadius: 14,
          gap: 10,
          color: "var(--color-text-faint, var(--color-text-muted))",
        }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>📈</span>
          <p style={{ margin: 0, fontSize: 13, textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
            {emptyLabel || "Feed KEWT more data to surface your patterns"}
          </p>
        </div>
      ) : children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: correlations, isLoading: corrLoading } = useQuery<any[]>({ queryKey: ["/api/correlations"] });
  const { data: activities, isLoading: actLoading } = useQuery<any[]>({ queryKey: ["/api/activities"] });
  const { data: sleepLogs } = useQuery<any[]>({ queryKey: ["/api/sleep"] });

  const runActivities = (activities || [])
    .filter((a: any) => a.modality === "running" && a.distanceMiles && a.durationMin)
    .map((a: any) => ({ date: a.date.slice(5), pace: a.durationMin / a.distanceMiles, perceivedEffort: a.perceivedEffort }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const cyclingActivities = (activities || [])
    .filter((a: any) => a.modality === "cycling")
    .map((a: any) => ({ date: a.date.slice(5), durationMin: a.durationMin, calsBurned: a.estCalsBurned }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const sleepSeries = (sleepLogs || [])
    .map((s: any) => ({ date: s.date.slice(5), hours: s.hours, quality: s.quality, restingHr: s.restingHr }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Axis tick style — theme-aware via CSS variable
  const axisTick = { fill: "var(--color-text-muted)", fontSize: 11 };
  // Grid line — subtle on both light and dark
  const gridStroke = "var(--color-border)";

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Cinematic Hero — full bleed */}
      <div className="kewt-cin-hero" style={{ marginBottom: 0, borderRadius: "0 0 24px 24px" }}>
          <img
            src="/hero_analytics.jpg"
            alt=""
            className="kewt-cin-hero__img"
            style={{ objectPosition: "center 40%" }}
          />
          <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,15)" } as React.CSSProperties} />
          <div className="kewt-cin-hero__content">
            <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>Blue Ember Intelligence · Pattern Detection</div>
            <div className="kewt-cin-hero__title">Analytics.</div>
            <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
            <div className="kewt-cin-hero__sub">Your patterns. Decoded.</div>
          </div>
      </div>
      <div style={{ padding: "20px 28px 64px", maxWidth: "var(--page-max, 1120px)", margin: "0 auto" }}>

        {/* ── Correlation Engine ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionEyebrow label="Correlation Engine" color="#10b981" />
          <h2 style={{
            margin: "0 0 20px",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
          }}>
Cross-system pattern recognition
          </h2>

          {corrLoading ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: 80,
                  borderRadius: 16,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  animation: "analyticsSkeletonPulse 1.6s ease-in-out infinite",
                }} />
              ))}
            </div>
          ) : !correlations || correlations.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "52px 24px",
              border: "1.5px dashed rgba(16,185,129,0.25)",
              borderRadius: 20,
              gap: 12,
              background: "rgba(16,185,129,0.04)",
            }}>
              <FlaskConical size={36} color="rgba(16,185,129,0.45)" strokeWidth={1.5} />
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                  <em className="ki">KEWT</em> needs more signal
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", maxWidth: 280, lineHeight: 1.6 }}>
                  14 days of logged data across Recovery, Kinetic, and Metabolic systems unlocks your personal correlation engine.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {correlations.map((corr: any, i: number) => (
                <CorrelationCard key={i} corr={corr} />
              ))}
            </div>
          )}
        </section>

        {/* ── Charts Grid ── */}
        <div style={{ display: "grid", gap: 24 }}>

          {/* Running Pace */}
          <ChartCard
            eyebrow="Running Performance"
            eyebrowColor="#fb923c"
            title="Pace Over Time"
            icon={<Activity size={17} strokeWidth={2} />}
            isEmpty={runActivities.length === 0}
            emptyLabel="Log a run to begin building your Kinetic pace arc"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={runActivities} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatPace(v)}
                  reversed
                  domain={["dataMin - 0.5", "dataMax + 0.5"]}
                />
                <Tooltip content={<PaceTooltip />} />
                <ReferenceLine
                  y={8.5}
                  stroke="rgba(251,146,60,0.45)"
                  strokeDasharray="5 4"
                  label={{
                    value: "Target 8:30",
                    position: "insideTopRight",
                    fill: "rgba(251,146,60,0.6)",
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pace"
                  stroke="#fb923c"
                  strokeWidth={2}
                  fill="url(#paceGrad)"
                  dot={{ r: 3, fill: "#fb923c", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#fb923c", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cycling */}
          <ChartCard
            eyebrow="Cycling Performance"
            eyebrowColor="#10b981"
            title="Session Duration"
            icon={<Zap size={17} strokeWidth={2} />}
            isEmpty={cyclingActivities.length === 0}
            emptyLabel="Log a ride to light up your aerobic output history"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cyclingActivities} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="35%">
                <defs>
                  <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}m`}
                />
                <Tooltip content={<CyclingTooltip />} />
                <Bar
                  dataKey="durationMin"
                  fill="url(#cycleGrad)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sleep */}
          <ChartCard
            eyebrow="Sleep & Recovery"
            eyebrowColor="#818cf8"
            title="Sleep Duration & Quality"
            icon={<Moon size={17} strokeWidth={2} />}
            isEmpty={sleepSeries.length === 0}
            emptyLabel="Log sleep to activate your Recovery system baseline"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sleepSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="sleepHoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sleepQualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, 12]} />
                <Tooltip content={<SleepTooltip />} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  name="hours"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  fill="url(#sleepHoursGrad)"
                  dot={{ r: 3, fill: "#60a5fa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#60a5fa", strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="quality"
                  name="quality"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#sleepQualGrad)"
                  dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 12, paddingLeft: 4 }}>
              {[
                { color: "#60a5fa", label: "Sleep hours" },
                { color: "#a78bfa", label: "Quality score" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2.5, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </ChartCard>

        </div>

        {/* Subtle footer */}
        <div style={{
          marginTop: 48,
          paddingTop: 20,
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <TrendingUp size={13} color="var(--color-text-muted)" />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Correlations recalculate nightly · Minimum 14 days for statistical confidence
          </span>
        </div>
      </div>

      {/* Keyframe pulse for skeleton */}
      <style>{`
        @keyframes analyticsSkeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
