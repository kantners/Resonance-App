import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Moon, Zap, Flame, Wind,
  ArrowRight, Activity, Heart, Brain,
  TrendingUp, Salad, Timer, BarChart3,
} from "lucide-react";

// ── KEWT Wordmark (inline — not exported from App.tsx) ───────────────────────
function KEWTWordmark({ size = 20, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontWeight: 900,
      fontStyle: "italic",
      fontSize: size,
      letterSpacing: "-0.06em",
      color: "var(--color-text)",
      lineHeight: 1,
      opacity: muted ? 0.18 : 1,
      transform: "skewX(-13deg)",
      transformOrigin: "left bottom",
    }}><em className="ki">KEWT</em></span>
  );
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const FRAMEWORK_CSS = `
/* ── Framework Page Shell ─────────────────────────────────────── */
.fw-page {
  max-width: var(--page-max, 1120px);
  margin: 0 auto;
  padding-bottom: 32px;
}

/* ── Hero ─────────────────────────────────────────────────────── */
.fw-hero {
  text-align: center;
  padding: 72px var(--page-pad, 28px) 56px;
  max-width: 780px;
  margin: 0 auto;
  position: relative;
}
.fw-hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--color-primary);
  margin-bottom: 20px;
  padding: 5px 14px 6px;
  border-radius: 100px;
  background: hsl(158 72% 28% / 0.08);
  border: 1px solid hsl(158 72% 28% / 0.2);
}
.fw-hero-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
}
.fw-hero-title {
  font-size: clamp(32px, 5.5vw, 58px);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.05;
  color: var(--color-text);
  margin-bottom: 22px;
}
.fw-hero-title em {
  font-style: normal;
  background: linear-gradient(135deg, var(--color-primary) 0%, hsl(158 72% 42%) 50%, var(--color-ember) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.fw-hero-sub {
  font-size: 18px;
  color: var(--color-text-muted);
  line-height: 1.7;
  max-width: 620px;
  margin: 0 auto 20px;
}
.fw-hero-divider {
  width: 48px; height: 2px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-ember));
  border-radius: 2px;
  margin: 0 auto 44px;
}

/* ── Four Systems Overview Pills ──────────────────────────────── */
.fw-systems-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 var(--page-pad, 28px) 24px;
}
.fw-sys-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: 1.5px solid transparent;
  cursor: default;
  transition: transform 180ms ease, box-shadow 180ms ease;
}
.fw-sys-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.08);
}
.fw-sys-pill--recovery {
  background: hsl(220 80% 96%);
  border-color: hsl(220 60% 78%);
  color: hsl(220 60% 32%);
}
.fw-sys-pill--kinetic {
  background: hsl(158 72% 95%);
  border-color: hsl(158 60% 72%);
  color: var(--color-primary);
}
.fw-sys-pill--metabolic {
  background: hsl(36 91% 95%);
  border-color: hsl(36 80% 72%);
  color: hsl(36 80% 30%);
}
.fw-sys-pill--respiratory {
  background: hsl(270 60% 96%);
  border-color: hsl(270 40% 74%);
  color: hsl(270 50% 36%);
}

/* ── System Sections ──────────────────────────────────────────── */
.fw-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  min-height: 420px;
  border-top: 1px solid var(--color-border);
  overflow: hidden;
}
.fw-section:last-of-type { border-bottom: 1px solid var(--color-border); }

/* Alternate left/right layout */
.fw-section--flip { direction: rtl; }
.fw-section--flip > * { direction: ltr; }

.fw-section-copy {
  padding: 64px 52px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
}
.fw-section-visual {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* System color themes */
.fw-section--recovery .fw-section-visual { background: linear-gradient(140deg, hsl(220 60% 96%) 0%, hsl(220 40% 90%) 100%); }
.fw-section--kinetic  .fw-section-visual { background: linear-gradient(140deg, hsl(158 60% 95%) 0%, hsl(158 40% 88%) 100%); }
.fw-section--metabolic .fw-section-visual { background: linear-gradient(140deg, hsl(36 80% 95%) 0%, hsl(36 60% 88%) 100%); }
.fw-section--respiratory .fw-section-visual { background: linear-gradient(140deg, hsl(270 50% 96%) 0%, hsl(270 30% 88%) 100%); }

/* System number */
.fw-sys-number {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  opacity: 0.5;
}
.fw-section--recovery  .fw-sys-number { color: hsl(220 60% 40%); }
.fw-section--kinetic   .fw-sys-number { color: var(--color-primary); }
.fw-section--metabolic .fw-sys-number { color: hsl(36 80% 36%); }
.fw-section--respiratory .fw-sys-number { color: hsl(270 50% 42%); }

/* System name */
.fw-sys-name {
  font-size: clamp(26px, 3.5vw, 40px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: var(--color-text);
}
.fw-sys-tagline {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}
.fw-section--recovery  .fw-sys-tagline { color: hsl(220 60% 40%); }
.fw-section--kinetic   .fw-sys-tagline { color: var(--color-primary); }
.fw-section--metabolic .fw-sys-tagline { color: hsl(36 80% 36%); }
.fw-section--respiratory .fw-sys-tagline { color: hsl(270 50% 42%); }

.fw-sys-body {
  font-size: 15px;
  color: var(--color-text-muted);
  line-height: 1.75;
  max-width: 480px;
}
.fw-sys-scenario {
  padding: 16px 20px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  font-style: italic;
  color: var(--color-text);
  border-left: 3px solid;
}
.fw-section--recovery  .fw-sys-scenario { background: hsl(220 60% 97%); border-color: hsl(220 60% 65%); }
.fw-section--kinetic   .fw-sys-scenario { background: hsl(158 60% 97%); border-color: var(--color-primary); }
.fw-section--metabolic .fw-sys-scenario { background: hsl(36 80% 97%); border-color: hsl(36 80% 55%); }
.fw-section--respiratory .fw-sys-scenario { background: hsl(270 50% 97%); border-color: hsl(270 50% 60%); }

/* Data sources row */
.fw-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.fw-source-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 100px;
  letter-spacing: 0.02em;
}
.fw-section--recovery  .fw-source-tag { background: hsl(220 60% 92%); color: hsl(220 60% 36%); }
.fw-section--kinetic   .fw-source-tag { background: hsl(158 60% 92%); color: var(--color-primary); }
.fw-section--metabolic .fw-source-tag { background: hsl(36 80% 92%); color: hsl(36 80% 32%); }
.fw-section--respiratory .fw-source-tag { background: hsl(270 50% 92%); color: hsl(270 50% 38%); }

/* Visual illustration area */
.fw-visual-icon-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 40px;
}
.fw-vis-card {
  background: white;
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}
.fw-vis-card-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
}
.fw-vis-card-value {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
.fw-vis-card-sub {
  font-size: 11px;
  color: var(--color-text-muted);
}
.fw-section--recovery  .fw-vis-card-value { color: hsl(220 60% 44%); }
.fw-section--kinetic   .fw-vis-card-value { color: var(--color-primary); }
.fw-section--metabolic .fw-vis-card-value { color: hsl(36 80% 36%); }
.fw-section--respiratory .fw-vis-card-value { color: hsl(270 50% 44%); }

/* ── Cross-System Intelligence Section ────────────────────────── */
.fw-intel {
  padding: 80px var(--page-pad, 28px) 72px;
  text-align: center;
  background: linear-gradient(180deg, var(--color-bg) 0%, hsl(158 40% 97%) 50%, var(--color-bg) 100%);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.fw-intel-eyebrow {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--color-ember);
  margin-bottom: 16px;
}
.fw-intel-title {
  font-size: clamp(26px, 4vw, 42px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--color-text);
  margin-bottom: 20px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
}
.fw-intel-sub {
  font-size: 16px;
  color: var(--color-text-muted);
  line-height: 1.75;
  max-width: 600px;
  margin: 0 auto 52px;
}

/* Cross-system flow diagram */
.fw-flow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  max-width: 900px;
  margin: 0 auto 44px;
  position: relative;
}
/* Connecting line behind the cards */
.fw-flow::before {
  content: '';
  position: absolute;
  top: 50%; left: 12.5%;
  width: 75%; height: 2px;
  background: linear-gradient(90deg,
    hsl(220 60% 72%), hsl(158 60% 60%), hsl(36 80% 60%), hsl(270 50% 65%)
  );
  transform: translateY(-50%);
  z-index: 0;
}
.fw-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px;
  position: relative;
  z-index: 1;
}
.fw-flow-icon {
  width: 56px; height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.fw-flow-icon--recovery    { background: hsl(220 60% 96%); color: hsl(220 60% 40%); }
.fw-flow-icon--kinetic     { background: hsl(158 60% 95%); color: var(--color-primary); }
.fw-flow-icon--metabolic   { background: hsl(36 80% 95%);  color: hsl(36 80% 36%); }
.fw-flow-icon--respiratory { background: hsl(270 50% 96%); color: hsl(270 50% 42%); }
.fw-flow-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  text-align: center;
}

/* Intelligence node at center (overlaid via absolute) */
.fw-intel-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 0 auto 0;
}
.fw-intel-orb {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, hsl(158 72% 38%) 50%, var(--color-ember) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28px;
  font-weight: 900;
  box-shadow: 0 8px 32px hsl(158 72% 28% / 0.35);
  letter-spacing: -0.04em;
}
.fw-intel-orb-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  text-align: center;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Intel insight rows */
.fw-intel-insights {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  text-align: left;
}
.fw-intel-insight {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fw-intel-insight-systems {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-ember);
}
.fw-intel-insight-body {
  font-size: 13.5px;
  color: var(--color-text);
  line-height: 1.6;
}

/* ── CTA Section ──────────────────────────────────────────────── */
.fw-cta {
  text-align: center;
  padding: 72px var(--page-pad, 28px) 56px;
}
.fw-cta-title {
  font-size: clamp(24px, 3.5vw, 38px);
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--color-text);
  margin-bottom: 14px;
}
.fw-cta-sub {
  font-size: 16px;
  color: var(--color-text-muted);
  line-height: 1.65;
  max-width: 480px;
  margin: 0 auto 36px;
}
.fw-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  border-radius: 100px;
  background: var(--color-primary);
  color: white;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: 0.02em;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
  box-shadow: 0 4px 24px hsl(158 72% 28% / 0.3);
}
.fw-cta-btn:hover {
  background: hsl(158 72% 22%);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px hsl(158 72% 28% / 0.4);
}

/* ── KEWT Brand Placements ────────────────────────────────────── */
.fw-hero-brand-lockup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 28px;
}
.fw-hero-bew-logo {
  width: 44px; height: 44px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 2px 12px hsl(158 72% 28% / 0.18);
}
.fw-hero-brand-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.fw-hero-brand-sub {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
/* Icon grid in visual panel */
.fw-visual-icon-grid {
  position: relative;
  z-index: 1;
}
/* Intelligence section wordmark stamp */
.fw-intel-kewt-stamp {
  margin-bottom: 16px;
  opacity: 0.65;
}
/* CTA brand lockup */
.fw-cta-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}
.fw-cta-bew-logo {
  width: 36px; height: 36px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 10px hsl(158 72% 28% / 0.15);
}

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 860px) {
  .fw-section, .fw-section--flip {
    grid-template-columns: 1fr;
    direction: ltr;
    min-height: unset;
  }
  .fw-section-visual { min-height: 220px; }
  .fw-section-copy { padding: 40px 24px; }
  .fw-visual-icon-grid { padding: 24px; gap: 10px; }
  .fw-flow { grid-template-columns: 1fr 1fr; gap: 20px; }
  .fw-flow::before { display: none; }
  .fw-intel-insights { grid-template-columns: 1fr; }
  .fw-systems-row { gap: 8px; }
}
@media (max-width: 480px) {
  .fw-hero { padding: 44px 20px 36px; }
  .fw-sys-pill { font-size: 12px; padding: 8px 14px; }
  .fw-flow { grid-template-columns: 1fr 1fr; }
  .fw-visual-icon-grid { grid-template-columns: 1fr 1fr; }
}
`;

// ── Types ───────────────────────────────────────────────────────────────────
interface FrameworkSnapshot {
  recovery: {
    hrv: string | null;
    deepSleep: string | null;
    bodyBattery: string | null;
    spo2: string | null;
    hrvStatus: string | null;
  };
  metabolic: {
    weight: string | null;
    fastWindow: string | null;
  };
  respiratory: {
    session: string | null;
    sessionType: string | null;
    respRate: string | null;
    hrvDelta: string | null;
  };
}

// ── Static system definitions (copy + sources — no live data here) ───────────
const SYSTEMS = [
  {
    id: "recovery",
    number: "System 01",
    name: "Recovery",
    tagline: "The verdict on yesterday.",
    body: "Sleep staging, HRV, and oxygen delivery tell KEWT whether your body actually rebuilt overnight - and whether today's training will produce adaptation or breakdown. This is the system that answers the question every athlete wakes up asking.",
    scenario: "When your HRV drops 8 points below your 7-day baseline and your deep sleep was under 60 minutes, KEWT flags a recovery deficit before you feel it - and suggests reducing today's planned intensity.",
    sources: ["Sleep Staging", "HRV / RMSSD", "Body Battery", "Resting HR", "SpO2", "Respiratory Rate"],
    icon: Moon,
  },
  {
    id: "kinetic",
    number: "System 02",
    name: "Kinetic",
    tagline: "The ledger of what you asked your body to do.",
    body: "Every session writes an entry in a biological ledger. Training Stress Score quantifies the demand, Chronic Training Load tracks your fitness arc, Acute Training Load measures current fatigue, and Form tells you whether you are primed to race or primed to rest.",
    scenario: "When your weekly TSS exceeds your CTL by more than 1.3x and your Recovery score is below 50, KEWT flags an overreaching risk - two weeks before your body would have told you itself.",
    sources: ["TSS / CTL / ATL", "Heart Rate Zones", "Power Output", "Elevation", "Cadence", "Pace"],
    icon: Zap,
  },
  {
    id: "metabolic",
    number: "System 03",
    name: "Metabolic",
    tagline: "The fuel side of the equation.",
    body: "Adaptation from training requires raw material. KEWT cross-references your nutrition log, fasting windows, and body weight trend against your daily training load - flagging days where under-fueling may be limiting your recovery or performance before the deficit accumulates.",
    scenario: "When your fasted training window exceeds 75 minutes, KEWT issues a cortisol-risk alert - because beyond that threshold, the hormonal cost begins to undermine the muscle protein synthesis your Recovery system is working to complete.",
    sources: ["Macros & Calories", "Fasting Windows", "Body Weight Trend", "Hydration", "Meal Timing"],
    icon: Flame,
  },
  {
    id: "respiratory",
    number: "System 04",
    name: "Respiratory",
    tagline: "The regulator that governs all three.",
    body: "The respiratory system is the only biological system that is both involuntary and under conscious control. Change your breathing pattern and within 90 seconds you produce measurable changes in HRV, cortisol, and autonomic state - propagating improvements into every other system. KEWT closes the feedback loop.",
    scenario: "A 10-minute resonance frequency breathwork session logged at 9pm correlates with a measurable HRV improvement the following morning. KEWT shows you that correlation so your practice becomes evidence, not intuition.",
    sources: ["Breathwork Sessions", "Respiratory Rate", "HRV Coherence", "Stress Score", "Perceived Effort"],
    icon: Wind,
  },
];

const INTEL_INSIGHTS = [
  {
    systems: "Recovery + Kinetic",
    body: "When Recovery score drops below 40 and Kinetic load exceeds your CTL, KEWT flags the mismatch before you feel it.",
  },
  {
    systems: "Metabolic + Recovery",
    body: "When fasting windows extend past 75 minutes of training, KEWT correlates cortisol risk with overnight HRV suppression.",
  },
  {
    systems: "Respiratory + Recovery",
    body: "Breathwork sessions logged before sleep correlate with measurable deep sleep gains the same night. KEWT shows you the data.",
  },
  {
    systems: "All Four Systems",
    body: "When all four systems are aligned, KEWT identifies your performance window - the days you are primed to go hard.",
  },
];

// ── Live data helpers ────────────────────────────────────────────────────
function VisCard({
  label, value, sub, loading,
}: { label: string; value: string | null; sub: string; loading?: boolean }) {
  return (
    <div className="fw-vis-card">
      <div className="fw-vis-card-label">{label}</div>
      <div className="fw-vis-card-value">
        {loading
          ? <span style={{ opacity: 0.3, fontSize: 14 }}>—</span>
          : value ?? <span style={{ opacity: 0.35, fontSize: 14 }}>No data</span>}
      </div>
      <div className="fw-vis-card-sub">{sub}</div>
    </div>
  );
}

function ProCard({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="fw-vis-card" style={{ position: "relative", overflow: "hidden" }}>
      <div className="fw-vis-card-label">{label}</div>
      <div className="fw-vis-card-value" style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
        ——
      </div>
      <div className="fw-vis-card-sub">{sub}</div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "hsl(36 91% 97% / 0.75)",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: "var(--color-ember)",
          textTransform: "uppercase", letterSpacing: "0.1em",
          padding: "3px 8px", borderRadius: 100,
          border: "1px solid hsl(36 80% 72%)",
          background: "hsl(36 91% 95%)",
        }}>
          Pro
        </span>
      </div>
    </div>
  );
}

function PremiumGate() {
  return (
    <div className="fw-premium-gate" style={{
      position: "absolute", inset: 0,
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      background: "hsl(158 60% 96% / 0.6)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 14, zIndex: 10, padding: 28, borderRadius: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "linear-gradient(135deg, var(--color-primary), var(--color-ember))",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px hsl(158 72% 28% / 0.3)",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: "var(--color-primary)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <em className="ki">KEWT</em> Pro
        </div>
        <div style={{
          fontSize: 12, color: "var(--color-text-muted)",
          marginTop: 5, lineHeight: 1.55,
        }}>
          Advanced load analytics<br />available on the Pro tier
        </div>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────────
export default function FrameworkPage() {
  useEffect(() => {
    const id = "kewt-framework-css";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = FRAMEWORK_CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // ── Live data ──────────────────────────────────────────────────────
  const { data: snapshot, isLoading } = useQuery<FrameworkSnapshot>({
    queryKey: ["/api/framework-snapshot"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: me } = useQuery<{ isPremium?: boolean }>({
    queryKey: ["/api/me"],
    staleTime: 10 * 60 * 1000,
  });

  const isPremium = me?.isPremium ?? false;
  const rec  = snapshot?.recovery;
  const met  = snapshot?.metabolic;
  const resp = snapshot?.respiratory;

  return (
    <>
      {/* Cinematic Hero — full-bleed */}
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 32 }}>
        <img
          src="/hero_framework.jpg"
          alt=""
          className="kewt-cin-hero__img"
          style={{ objectPosition: "center 55%" }}
        />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(3,14,6)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>Breathe · Reset · Return</div>
          <div className="kewt-cin-hero__title">The BEI<br/>Framework.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#10b981,#f59e0b)" }} />
          <div className="kewt-cin-hero__sub">Blue Ember Intelligence</div>
        </div>
      </div>

      <div className="fw-page">

        {/* ── Four System Sections ───────────────────────────────────── */}
        {SYSTEMS.map((sys, idx) => {
          const Icon = sys.icon;
          const isFlip = idx % 2 === 1;
          return (
            <div
              key={sys.id}
              className={`fw-section fw-section--${sys.id}${isFlip ? " fw-section--flip" : ""}`}
            >
              {/* Copy side */}
              <div className="fw-section-copy">
                <div className="fw-sys-number">{sys.number}</div>
                <div>
                  <div className="fw-sys-name">{sys.name} System</div>
                  <div className="fw-sys-tagline">{sys.tagline}</div>
                </div>
                <p className="fw-sys-body">{sys.body}</p>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-muted)", marginBottom: 8 }}>
                    Data sources
                  </div>
                  <div className="fw-sources">
                    {sys.sources.map(s => <span key={s} className="fw-source-tag">{s}</span>)}
                  </div>
                </div>
                <div className="fw-sys-scenario">{sys.scenario}</div>
              </div>

              {/* Visual side */}
              <div className="fw-section-visual" style={{ position: "relative" }}>
                <div className="fw-visual-icon-grid">

                  {/* System 01: Recovery — Tier 1 live */}
                  {sys.id === "recovery" && (<>
                    <VisCard label="HRV" value={rec?.hrv ?? null}
                      sub={rec?.hrvStatus ? `Status: ${rec.hrvStatus}` : "Last night"} loading={isLoading} />
                    <VisCard label="Deep Sleep" value={rec?.deepSleep ?? null}
                      sub="Last night" loading={isLoading} />
                    <VisCard label="Body Battery" value={rec?.bodyBattery ?? null}
                      sub="Overnight rebuild" loading={isLoading} />
                    <VisCard label="SpO2" value={rec?.spo2 ?? null}
                      sub="Avg overnight" loading={isLoading} />
                  </>)}

                  {/* System 02: Kinetic — Pro gate (Tier 3, built now, locked until flip) */}
                  {sys.id === "kinetic" && (<>
                    <div className="fw-vis-card">
                      <div className="fw-vis-card-label">CTL</div>
                      <div className="fw-vis-card-value" style={{ filter: isPremium ? "none" : "blur(7px)", userSelect: "none" }}>68</div>
                      <div className="fw-vis-card-sub">42-day fitness avg</div>
                    </div>
                    <div className="fw-vis-card">
                      <div className="fw-vis-card-label">ATL</div>
                      <div className="fw-vis-card-value" style={{ filter: isPremium ? "none" : "blur(7px)", userSelect: "none" }}>74</div>
                      <div className="fw-vis-card-sub">7-day fatigue</div>
                    </div>
                    <div className="fw-vis-card">
                      <div className="fw-vis-card-label">Form (TSB)</div>
                      <div className="fw-vis-card-value" style={{ filter: isPremium ? "none" : "blur(7px)", userSelect: "none" }}>−6</div>
                      <div className="fw-vis-card-sub">Building phase</div>
                    </div>
                    <div className="fw-vis-card">
                      <div className="fw-vis-card-label">Zone 2</div>
                      <div className="fw-vis-card-value" style={{ filter: isPremium ? "none" : "blur(7px)", userSelect: "none" }}>81%</div>
                      <div className="fw-vis-card-sub">This week's volume</div>
                    </div>
                    {!isPremium && <PremiumGate />}
                  </>)}

                  {/* System 03: Metabolic — Tier 1 live + Pro cards */}
                  {sys.id === "metabolic" && (<>
                    <VisCard label="Fast Window" value={met?.fastWindow ?? null}
                      sub="Most recent completed" loading={isLoading} />
                    <VisCard label="Weight" value={met?.weight ?? null}
                      sub="Latest logged" loading={isLoading} />
                    <ProCard label="Carbs Today" sub="Macro tracking — Pro" />
                    <ProCard label="Fuel Match" sub="Load correlation — Pro" />
                  </>)}

                  {/* System 04: Respiratory — Tier 1 live + Pro card */}
                  {sys.id === "respiratory" && (<>
                    <VisCard label="Session" value={resp?.session ?? null}
                      sub={resp?.sessionType ?? "Last breathwork"} loading={isLoading} />
                    <VisCard label="Resp Rate" value={resp?.respRate ? `${resp.respRate} brpm` : null}
                      sub="Avg overnight" loading={isLoading} />
                    <VisCard label="HRV Delta" value={resp?.hrvDelta ?? null}
                      sub="vs prior night" loading={isLoading} />
                    <ProCard label="Coherence" sub="Session scoring — Pro" />
                  </>)}

                </div>
              </div>
            </div>
          );
        })}

        {/* ── Cross-System Intelligence ──────────────────────────────────── */}
        <div className="fw-intel">
          <div className="fw-intel-kewt-stamp"><KEWTWordmark size={32} /></div>
          <div className="fw-intel-eyebrow">Blue Ember Intelligence</div>
          <h2 className="fw-intel-title">
            The signal lives in the<br />cross-system relationships.
          </h2>
          <p className="fw-intel-sub">
            Each system generates data. <em className="ki">KEWT</em>'s intelligence layer finds what no single app can see —
            because no single app holds all four data streams simultaneously.
            When all four systems are aligned, <em className="ki">KEWT</em> identifies your performance window
            before you feel it.
          </p>

          <div className="fw-flow" style={{ marginBottom: 24 }}>
            {[
              { label: "Recovery",    cls: "recovery",    icon: Moon },
              { label: "Kinetic",     cls: "kinetic",     icon: Zap },
              { label: "Metabolic",   cls: "metabolic",   icon: Flame },
              { label: "Respiratory", cls: "respiratory", icon: Wind },
            ].map(({ label, cls, icon: FIcon }) => (
              <div key={cls} className="fw-flow-node">
                <div className={`fw-flow-icon fw-flow-icon--${cls}`}><FIcon size={24} /></div>
                <div className="fw-flow-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="fw-intel-node" style={{ marginBottom: 52 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, maxWidth: 120, height: 1, background: "linear-gradient(to right, transparent, var(--color-primary))" }} />
              <div className="fw-intel-orb">∫</div>
              <div style={{ flex: 1, maxWidth: 120, height: 1, background: "linear-gradient(to left, transparent, var(--color-primary))" }} />
            </div>
            <div className="fw-intel-orb-label"><em className="ki">KEWT</em> Intelligence Layer</div>
          </div>

          <div className="fw-intel-insights">
            {INTEL_INSIGHTS.map(ins => (
              <div key={ins.systems} className="fw-intel-insight">
                <div className="fw-intel-insight-systems">{ins.systems}</div>
                <div className="fw-intel-insight-body">{ins.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <div className="fw-cta">
          <div className="fw-cta-brand">
            <KEWTWordmark size={28} />
          </div>
          <h2 className="fw-cta-title">Built for one athlete.<br />Ready for yours.</h2>
          <p className="fw-cta-sub">
            <em className="ki">KEWT</em> was built by an endurance athlete who wanted to understand his own biology.
            The framework scales to any sport, any age, any device ecosystem.
            Connect your first system and let <em className="ki">KEWT</em> start listening.
          </p>
          <Link
            href="/integrations"
            className="fw-cta-btn"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              document.getElementById("kewt-main")?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Connect your first system
            <ArrowRight size={16} />
          </Link>
        </div>

      </div>
    </>
  );
}
