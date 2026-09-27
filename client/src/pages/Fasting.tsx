import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Zap, Flame, Clock, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const GOALS = [12, 14, 16, 18, 20, 24];

// Convert ISO string to datetime-local input value (local time)
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Convert datetime-local input value back to ISO string
function localToIso(local: string): string {
  return new Date(local).toISOString();
}

// ── Inline Time Editor ────────────────────────────────────────────────────────
function TimeEditor({
  label, isoValue, onSave, onCancel,
}: {
  label: string;
  isoValue: string;
  onSave: (iso: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(isoToLocal(isoValue));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-faint)", minWidth: 36 }}>{label}</span>
      <input
        type="datetime-local"
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{
          fontSize: 13, fontWeight: 500,
          border: "1.5px solid rgba(6,95,70,0.35)",
          borderRadius: 8, padding: "5px 8px",
          background: "#fff", color: "#111827",
          outline: "none", fontFamily: "inherit",
        }}
      />
      <button onClick={() => onSave(localToIso(val))} style={{ background: "#065f46", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>
        <Check size={13} />
      </button>
      <button onClick={onCancel} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--color-text-faint)", display: "flex", alignItems: "center" }}>
        <X size={13} />
      </button>
    </div>
  );
}

const PHASES = [
  { h: 0,  label: "Fed state",        color: "var(--fp-faint)", desc: "Glucose metabolism active" },
  { h: 4,  label: "Glycogen burn",    color: "#f59e0b", desc: "Stored glycogen depleting" },
  { h: 8,  label: "Fat oxidation",    color: "#f97316", desc: "Liver glycogen depleted, fat mobilized" },
  { h: 12, label: "Deep fat burn",    color: "#10b981", desc: "Peak fat oxidation" },
  { h: 16, label: "Autophagy",        color: "var(--color-primary)", desc: "Cellular cleanup initiated" },
  { h: 20, label: "Deep autophagy",   color: "var(--color-blue)", desc: "Growth hormone surge" },
  { h: 24, label: "Extended fast",    color: "#7c3aed", desc: "Stem cell regeneration begins" },
];

function currentPhase(hours: number) {
  let p = PHASES[0];
  for (const phase of PHASES) {
    if (hours >= phase.h) p = phase;
    else break;
  }
  return p;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

function fmtDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const { h, m } = formatDuration(ms);
  return `${h}h ${m}m`;
}

// ── SVG Ring ──────────────────────────────────────────────────────────────────
function FastRing({
  elapsedMs, goalHours, phase, isFasting,
}: {
  elapsedMs: number; goalHours: number; phase: typeof PHASES[0]; isFasting: boolean;
}) {
  const size = 280;
  const cx = size / 2;
  const r = 118;
  const stroke = 14;
  const circumference = 2 * Math.PI * r;

  const elapsedHours = elapsedMs / 3_600_000;
  const pct = Math.min(1, elapsedHours / goalHours);
  const offset = circumference * (1 - pct);
  const { h: eh, m: em } = formatDuration(elapsedMs);
  const goalMs = goalHours * 3_600_000;
  const remainingMs = Math.max(0, goalMs - elapsedMs);
  const { h, m } = formatDuration(remainingMs);
  const done = remainingMs === 0;

  // Pulse animation ref
  const pulseRef = useRef<SVGCircleElement>(null);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track - reads from the kewt-fasting-page CSS var so the ring
            stays visible against the dark page bg in dark theme. */}
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="var(--fp-track)" strokeWidth={stroke} />
        {/* Progress arc */}
        {isFasting && (
          <circle
            ref={pulseRef}
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={phase.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.8s ease" }}
          />
        )}
        {/* Goal markers at each phase */}
        {PHASES.filter(p => p.h > 0 && p.h <= goalHours).map(p => {
          const angle = (p.h / goalHours) * 2 * Math.PI;
          const x = cx + r * Math.cos(angle - Math.PI / 2);
          const y = cx + r * Math.sin(angle - Math.PI / 2);
          return (
            <circle key={p.h} cx={x} cy={y} r={4}
              fill={elapsedHours >= p.h ? p.color : "var(--fp-marker-inactive)"}
              style={{ transition: "fill 0.5s ease" }}
            />
          );
        })}
      </svg>
      {/* Center content */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 2,
      }}>
        {isFasting ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: phase.color, marginBottom: 4 }}>
              {phase.label}
            </div>
            {done ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: phase.color, letterSpacing: "-0.5px", textAlign: "center" }}>Goal reached!</div>
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-3px", color: "var(--color-text)", lineHeight: 1 }}>{h}</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: "var(--fp-faint)" }}>h</span>
                <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-2px", color: "var(--color-text)", lineHeight: 1 }}>{String(m).padStart(2, "0")}</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: "var(--fp-faint)" }}>m</span>
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--fp-faint)", marginTop: 4 }}>
              {done ? `${goalHours}h complete` : `${eh}h ${String(em).padStart(2,"0")}m elapsed · ${Math.round(pct * 100)}%`}
            </div>
          </>
        ) : (
          <>
            <Flame size={32} color="#f59e0b" strokeWidth={1.5} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-muted)", marginTop: 8 }}>No active cleanse</div>
            <div style={{ fontSize: 12, color: "var(--fp-faint)" }}>Tap Start to begin</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────
function HistoryRow({ session, onDelete, onUpdate }: {
  session: any;
  onDelete: (id: number) => void;
  onUpdate: (id: number, startedAt?: string, endedAt?: string) => void;
}) {
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd,   setEditingEnd]   = useState(false);
  const completed = !!session.endedAt;
  const durationMs = completed
    ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    : 0;
  const { h, m } = formatDuration(durationMs);
  const phaseName = currentPhase(durationMs / 3_600_000).label;
  const goalMet = completed && (durationMs / 3_600_000) >= (session.goalHours || 16);
  // History is dated by the day the fast was completed (broken), not the day
  // it was initiated. For any in-history row endedAt is guaranteed by the
  // upstream filter, but we fall back to startedAt defensively if a record
  // somehow lands here without it.
  const dateLabelIso = session.endedAt || session.startedAt;

  // The History rows render inside a hardcoded white card surface, so the
  // text colors are pinned to dark slate. Theme tokens would flip to white
  // in dark mode and disappear against the locked-light bg.
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Date block - shows the completion date in device timezone */}
        <div style={{ minWidth: 48, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
            {new Date(dateLabelIso).getDate()}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {new Date(dateLabelIso).toLocaleDateString("en-US", { month: "short" })}
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              {completed ? `${h}h ${m}m` : "In progress"}
            </span>
            {goalMet && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#065f46", background: "rgba(6,95,70,0.1)", borderRadius: 99, padding: "2px 8px", letterSpacing: "0.04em" }}>
                GOAL MET
              </span>
            )}
          </div>
          {/* Times with inline edit pencils */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
            <span>{fmtTime(session.startedAt)}</span>
            <button onClick={() => { setEditingStart(v => !v); setEditingEnd(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "0 2px", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
              <Pencil size={10} />
            </button>
            {completed && (
              <>
                <span>— {fmtTime(session.endedAt)}</span>
                <button onClick={() => { setEditingEnd(v => !v); setEditingStart(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "0 2px", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
                  <Pencil size={10} />
                </button>
              </>
            )}
            <span>· {phaseName}</span>
          </div>
        </div>

        {/* Delete */}
        <button onClick={() => onDelete(session.id)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 6, borderRadius: 8 }}>
          <Trash2 size={15} />
        </button>
      </div>

      {/* Inline editors */}
      {editingStart && (
        <TimeEditor
          label="Start"
          isoValue={session.startedAt}
          onSave={iso => { onUpdate(session.id, iso, undefined); setEditingStart(false); }}
          onCancel={() => setEditingStart(false)}
        />
      )}
      {editingEnd && session.endedAt && (
        <TimeEditor
          label="End"
          isoValue={session.endedAt}
          onSave={iso => { onUpdate(session.id, undefined, iso); setEditingEnd(false); }}
          onCancel={() => setEditingEnd(false)}
        />
      )}
    </div>
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Fasting() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [goalHours, setGoalHours] = useState(16);
  const [showHistory, setShowHistory] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [editingActiveStart, setEditingActiveStart] = useState(false);

  // Tick every second while a fast is active
  const { data: activeFast } = useQuery<any>({
    queryKey: ["/api/fasting/active"],
    refetchInterval: 10_000,
  });
  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/fasting/history"],
  });

  useEffect(() => {
    if (!activeFast) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeFast]);

  const isFasting = !!activeFast;
  const elapsedMs = isFasting
    ? Math.max(0, now - new Date(activeFast.startedAt).getTime())
    : 0;
  const elapsedHours = elapsedMs / 3_600_000;
  const phase = currentPhase(elapsedHours);
  const activeGoal = activeFast?.goalHours ?? goalHours;

  const startMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fasting/start", { goalHours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fasting/active"] });
      qc.invalidateQueries({ queryKey: ["/api/fasting/history"] });
      toast({ title: "System Cleanse started", description: `${goalHours}h goal set. Breathe. Reset. Return.` });
    },
  });

  const endMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fasting/end", { id: activeFast?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fasting/active"] });
      qc.invalidateQueries({ queryKey: ["/api/fasting/history"] });
      const { h, m } = formatDuration(elapsedMs);
      toast({ title: "Cleanse complete", description: `${h}h ${m}m logged. Well done.` });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fasting/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fasting/history"] });
    },
  });

  const updateTimeMut = useMutation({
    mutationFn: ({ id, startedAt, endedAt }: { id: number; startedAt?: string; endedAt?: string }) =>
      apiRequest("PATCH", `/api/fasting/${id}`, { startedAt, endedAt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fasting/active"] });
      qc.invalidateQueries({ queryKey: ["/api/fasting/history"] });
      toast({ title: "Time updated" });
    },
  });

  // Background color shifts with phase
  const bgGradient = isFasting
    ? `radial-gradient(ellipse at 50% 0%, ${phase.color}18 0%, transparent 65%)`
    : "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 65%)";

  return (
    <div className="kewt-fasting-page" style={{
      minHeight: "100dvh",
      background: `var(--color-bg)`,
      paddingBottom: 32,
      transition: "background 1s ease",
    }}>
      {/* Page-scoped theme tokens. The Fasting page sits on the app bg
          (warm linen in light, near-black in dark), so several SVG strokes
          and faint text labels need brighter values in dark theme to read.
          Locked-light card surfaces (goal picker, stats, history) keep
          their pinned slate colors from the prior contrast pass. */}
      <style>{`
        .kewt-fasting-page {
          --fp-track: rgba(0,0,0,0.07);
          --fp-marker-inactive: rgba(0,0,0,0.12);
          --fp-faint: var(--color-text-faint);
          --fp-pill-bg: rgba(0,0,0,0.04);
          --fp-pill-border: transparent;
        }
        [data-theme='dark'] .kewt-fasting-page {
          --fp-track: rgba(255,255,255,0.14);
          --fp-marker-inactive: rgba(255,255,255,0.20);
          --fp-faint: rgba(255,255,255,0.78);
          --fp-pill-bg: rgba(255,255,255,0.05);
          --fp-pill-border: rgba(255,255,255,0.10);
        }
      `}</style>
      {/* Dynamic glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: bgGradient,
        transition: "background 2s ease",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{ paddingTop: 24, paddingBottom: 8, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 4 }}>
            Blue Ember Wellness
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.5px", margin: 0 }}>
            System Cleanse
          </h1>
        </div>

        {/* Ring */}
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 20px" }}>
          <FastRing
            elapsedMs={elapsedMs}
            goalHours={activeGoal}
            phase={phase}
            isFasting={isFasting}
          />
        </div>

        {/* Phase description */}
        {isFasting && (
          <div style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--fp-faint)",
            marginBottom: 20,
            padding: "0 24px",
            lineHeight: 1.5,
          }}>
            {phase.desc}
          </div>
        )}

        {/* Phase milestone pills */}
        {isFasting && (
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
            marginBottom: 24,
          }}>
            {PHASES.filter(p => p.h > 0).map(p => (
              <span key={p.h} style={{
                padding: "5px 12px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                background: elapsedHours >= p.h ? `${p.color}18` : "var(--fp-pill-bg)",
                color: elapsedHours >= p.h ? p.color : "var(--fp-faint)",
                border: `1px solid ${elapsedHours >= p.h ? p.color + "40" : "var(--fp-pill-border)"}`,
                transition: "all 0.5s ease",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {elapsedHours >= p.h && <Zap size={9} />}
                {p.h}h
              </span>
            ))}
          </div>
        )}

        {/* Goal picker (pre-fast only) */}
        {!isFasting && (
          <div style={{ marginBottom: 24 }}>
            <div
              onClick={() => setShowGoalPicker(v => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px",
                background: "#fff",
                borderRadius: 14,
                border: "1.5px solid rgba(0,0,0,0.08)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={16} color="#f59e0b" />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Goal: {goalHours}h cleanse</span>
              </div>
              {showGoalPicker ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
            </div>
            {showGoalPicker && (
              <div style={{
                display: "flex", gap: 8, flexWrap: "wrap",
                padding: "12px 4px 4px",
              }}>
                {GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => { setGoalHours(g); setShowGoalPicker(false); }}
                    style={{
                      flex: "1 1 60px",
                      padding: "10px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      background: goalHours === g ? "#065f46" : "rgba(0,0,0,0.04)",
                      color: goalHours === g ? "#fff" : "#475569",
                      border: `1.5px solid ${goalHours === g ? "#065f46" : "rgba(0,0,0,0.08)"}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {g}h
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start / Stop button */}
        <button
          onClick={() => isFasting ? endMut.mutate() : startMut.mutate()}
          disabled={startMut.isPending || endMut.isPending}
          style={{
            width: "100%",
            padding: "18px 0",
            borderRadius: 18,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "0.01em",
            border: "none",
            cursor: startMut.isPending || endMut.isPending ? "not-allowed" : "pointer",
            background: isFasting
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #065f46, #047857)",
            color: "#fff",
            boxShadow: isFasting
              ? "0 8px 32px rgba(239,68,68,0.35)"
              : "0 8px 32px rgba(6,95,70,0.35)",
            transition: "all 0.3s ease",
            opacity: startMut.isPending || endMut.isPending ? 0.7 : 1,
          }}
        >
          {startMut.isPending || endMut.isPending
            ? "…"
            : isFasting ? "End Cleanse" : `Start ${goalHours}h Cleanse`}
        </button>

        {/* Start time display with inline edit */}
        {isFasting && activeFast?.startedAt && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            {editingActiveStart ? (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TimeEditor
                  label="Start"
                  isoValue={activeFast.startedAt}
                  onSave={iso => {
                    updateTimeMut.mutate({ id: activeFast.id, startedAt: iso });
                    setEditingActiveStart(false);
                  }}
                  onCancel={() => setEditingActiveStart(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setEditingActiveStart(true)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, color: "var(--fp-faint)", fontSize: 12 }}
              >
                Started {fmtDate(activeFast.startedAt)} at {fmtTime(activeFast.startedAt)}
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}

        {/* Stats row from history */}
        {history && history.filter(s => s.endedAt).length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginTop: 28,
          }}>
            {(() => {
              const completed = history.filter(s => s.endedAt);
              const durations = completed.map(s =>
                (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 3_600_000
              );
              const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
              const best = Math.max(...durations);
              const goalMet = completed.filter((s, i) => durations[i] >= (s.goalHours || 16)).length;
              return [
                { label: "Fasts", value: completed.length },
                { label: "Avg", value: `${avg.toFixed(1)}h` },
                { label: "Best", value: `${best.toFixed(1)}h` },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "14px 0",
                  textAlign: "center",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.5px" }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                    {stat.label}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* History */}
        {history && history.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: "4px 0 12px",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Cleanse History ({history.filter(s => s.endedAt).length})
              </span>
              {showHistory ? <ChevronUp size={16} color="var(--fp-faint)" /> : <ChevronDown size={16} color="var(--fp-faint)" />}
            </button>
            {showHistory && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "0 16px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                {history.filter(s => s.endedAt).map(s => (
                  <HistoryRow
                    key={s.id}
                    session={s}
                    onDelete={id => deleteMut.mutate(id)}
                    onUpdate={(id, startedAt, endedAt) => updateTimeMut.mutate({ id, startedAt, endedAt })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* BEI tagline */}
        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, fontWeight: 600, color: "var(--fp-faint)", letterSpacing: "0.06em" }}>
          Breathe. Reset. Return.
        </div>
      </div>
    </div>
  );
}
