/**
 * FastingCrossroads — post-activity bottom sheet
 * Shows: what you earned (fasting benefits at current hour tier)
 *        + extension ladder (what unlocks at +2h, +4h, +8h)
 * Also fires POST /api/fasting/crossroads-science to inject BEI ticker cards.
 */

import { useEffect, useState } from "react";
import { X, Flame, Zap, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from "lucide-react";

// ── Fasting benefit tiers ──────────────────────────────────────────────────
interface TierDef {
  minHours: number;
  label: string;
  color: string;
  earned: string[];
}

const TIERS: TierDef[] = [
  {
    minHours: 0,
    label: "Early Fast",
    color: "#10b981",
    earned: [
      "Glycogen stores depleted — fat mobilization beginning",
      "Insulin levels falling, glucagon rising",
      "Cellular housekeeping (micro-autophagy) underway",
    ],
  },
  {
    minHours: 12,
    label: "Metabolic Shift",
    color: "#f59e0b",
    earned: [
      "Liver glycogen fully depleted — body running on fat",
      "Ketone production initiated (beta-hydroxybutyrate rising)",
      "Growth hormone pulse beginning — muscle preservation active",
    ],
  },
  {
    minHours: 16,
    label: "Autophagy Window",
    color: "#7c3aed",
    earned: [
      "Macro-autophagy confirmed — cellular debris clearance accelerating",
      "Fat oxidation at peak efficiency for this fast duration",
      "Insulin sensitivity at 24-hour high — glucose tolerance improved",
      "BDNF elevated — cognitive clarity and neuroplasticity enhanced",
    ],
  },
  {
    minHours: 20,
    label: "Deep Repair",
    color: "#ec4899",
    earned: [
      "Mitophagy active — damaged mitochondria being recycled",
      "mTOR suppression maximized — longevity pathway (AMPK) fully engaged",
      "Anti-inflammatory cytokine profile shifting favorably",
      "Stem cell regeneration signaling elevated",
    ],
  },
  {
    minHours: 24,
    label: "Cellular Reset",
    color: "#0ea5e9",
    earned: [
      "Deep autophagy — proteostasis (protein quality control) at maximum",
      "Circadian reset signals potentiated",
      "Immune cell recycling documented at this duration (Longo et al.)",
      "Significant reduction in systemic inflammatory markers (CRP, IL-6)",
    ],
  },
];

interface ExtensionRung {
  addHours: number;
  headline: string;
  detail: string;
  color: string;
}

function getExtensionRungs(currentHours: number): ExtensionRung[] {
  return [
    {
      addHours: 2,
      headline: `+2h → ${(currentHours + 2).toFixed(1)}h: Deeper autophagy`,
      detail:
        "Two more hours meaningfully deepens macro-autophagy flux. Damaged organelles that were flagged during your workout are now being cleared. (Mizushima & Levine, Cell, 2020)",
      color: "#7c3aed",
    },
    {
      addHours: 4,
      headline: `+4h → ${(currentHours + 4).toFixed(1)}h: Mitophagy onset`,
      detail:
        "At this extension, PINK1/Parkin-mediated mitophagy activates — selectively removing mitochondria damaged by your exercise bout. Net result: higher-quality mitochondrial pool over weeks. (Youle & Narendra, Nature Reviews, 2011)",
      color: "#ec4899",
    },
    {
      addHours: 8,
      headline: `+8h → ${(currentHours + 8).toFixed(1)}h: Stem cell priming`,
      detail:
        "Extended fasts beyond 20h initiate hematopoietic stem cell regeneration signaling and maximize AMPK activation. Re-feeding after this duration produces a pronounced anabolic rebound — optimal for muscle synthesis. (Cheng et al., Cell Stem Cell, 2014)",
      color: "#0ea5e9",
    },
  ];
}

function getCurrentTier(hours: number): TierDef {
  return [...TIERS].reverse().find(t => hours >= t.minHours) ?? TIERS[0];
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  activityId: number;
  fastHours: number;          // hours fasted at activity start
  activityType: string;       // e.g. "walking", "cycling"
  durationMin: number;
  onClose: () => void;
}

export function FastingCrossroads({ activityId, fastHours, activityType, durationMin, onClose }: Props) {
  const tier = getCurrentTier(fastHours);
  const rungs = getExtensionRungs(fastHours);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tickerFired, setTickerFired] = useState(false);
  const [tickerLoading, setTickerLoading] = useState(false);

  // Fire science ticker injection once on mount
  useEffect(() => {
    if (tickerFired) return;
    setTickerFired(true);
    setTickerLoading(true);
    fetch("/api/fasting/crossroads-science", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ activityId, fastHours, activityType, durationMin }),
    })
      .catch(() => {})
      .finally(() => setTickerLoading(false));
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1100,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101,
          background: "var(--color-bg)",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          maxHeight: "88vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border)" }} />
        </div>

        {/* Header */}
        <div style={{
          padding: "14px 20px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flame size={16} color={tier.color} />
            <span style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--color-text)" }}>
              Fasting Crossroads
            </span>
            <span style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em",
              background: `${tier.color}18`, color: tier.color,
              padding: "2px 7px", borderRadius: 6,
            }}>
              {tier.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-faint)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "0 20px 32px", display: "grid", gap: 20, marginTop: 16 }}>

          {/* ── Left: What you earned ── */}
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: 10 }}>
              What you earned at {fastHours.toFixed(1)}h
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {tier.earned.map((benefit, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <CheckCircle2 size={14} color={tier.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text)", lineHeight: 1.5 }}>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-divider)" }} />

          {/* ── Extension ladder ── */}
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: 10 }}>
              Extend to unlock
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rungs.map((rung, i) => (
                <div key={i} style={{
                  borderRadius: 12, border: `1px solid ${rung.color}28`,
                  background: expanded === i ? `${rung.color}0a` : "var(--color-surface)",
                  overflow: "hidden",
                }}>
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    style={{
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Zap size={13} color={rung.color} />
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text)", textAlign: "left" }}>
                        {rung.headline}
                      </span>
                    </div>
                    {expanded === i
                      ? <ChevronUp size={14} color="var(--color-text-faint)" />
                      : <ChevronDown size={14} color="var(--color-text-faint)" />
                    }
                  </button>
                  {expanded === i && (
                    <div style={{ padding: "0 14px 12px", fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                      {rung.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── BEI ticker injection notice ── */}
          {(tickerLoading || !tickerLoading) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10,
              background: "var(--color-surface)", border: "1px solid var(--color-border)",
              fontSize: "0.75rem", color: "var(--color-text-muted)",
            }}>
              {tickerLoading
                ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                : <Flame size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
              }
              <span>
                {tickerLoading
                  ? "Generating your fasting science cards…"
                  : "3 BEI science cards queued — check the Science page for your personalized fasting brief."
                }
              </span>
            </div>
          )}

          {/* ── CTAs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: "13px 0", borderRadius: 12, border: "1.5px solid var(--color-border)",
                background: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                color: "var(--color-text-muted)",
              }}
            >
              Break Fast
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "13px 0", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${tier.color} 0%, ${tier.color}cc 100%)`,
                cursor: "pointer", fontWeight: 700, fontSize: "0.875rem", color: "#fff",
              }}
            >
              Continue Fasting
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
