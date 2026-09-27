/**
 * KEWT Onboarding — Cinematic New User Intake
 * Seven-step immersive sequence: origin story, philosophy, identity,
 * sport selection with Kinetic Arc education, baseline, lifestyle, launch.
 * Design: Warm linen + Emerald + Amber. Ken Burns hero images. Inter font.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wind, Shield, ChevronRight, ChevronLeft,
  Check, Dumbbell, Bike, Footprints, Waves, Mountain,
  Zap, Target, Calendar, Brain, Flame, Activity, Leaf, Bed,
  ArrowRight, Plus, X, Clock, Briefcase, TrendingUp, Heart,
  BarChart2
} from "lucide-react";

// ── Brand palette ─────────────────────────────────────────────────────────────
const C = {
  emerald:      "#065f46",
  emeraldMid:   "#047857",
  emeraldLight: "#d1fae5",
  emeraldGlow:  "#10b981",
  amber:        "#f59e0b",
  amberLight:   "#fef3c7",
  amberDeep:    "#92400e",
  linen:        "#faf9f6",
  linenDark:    "#f0ece4",
  ink:          "#1c1917",
  muted:        "#6b7280",
  border:       "#e5e7eb",
  white:        "#ffffff",
  navy:         "#0c4a6e",
};

// ── Activity options ──────────────────────────────────────────────────────────
const ACTIVITIES = [
  { id: "running",    label: "Running",    icon: Footprints, desc: "Track, trail, road, or treadmill",      arcUnit: "pace per mile" },
  { id: "cycling",    label: "Cycling",    icon: Bike,       desc: "Road, gravel, mountain, or indoor",      arcUnit: "miles per hour" },
  { id: "walking",    label: "Walking",    icon: Activity,   desc: "Daily walks and active commutes",         arcUnit: "pace per mile" },
  { id: "swimming",   label: "Swimming",   icon: Waves,      desc: "Open water or lap pool",                  arcUnit: "pace per 100m" },
  { id: "hiking",     label: "Hiking",     icon: Mountain,   desc: "Trail walking and scrambling",            arcUnit: "pace per mile" },
  { id: "strength",   label: "Strength",   icon: Dumbbell,   desc: "Weights, resistance, functional",         arcUnit: "session duration" },
  { id: "yoga",       label: "Yoga",       icon: Leaf,       desc: "All styles and intensities",              arcUnit: "session duration" },
  { id: "rucking",    label: "Rucking",    icon: Zap,        desc: "Loaded carries and terrain walking",      arcUnit: "pace per mile" },
  { id: "triathlon",  label: "Triathlon",  icon: BarChart2,  desc: "Swim, bike, run multisport",              arcUnit: "run pace per mile" },
  { id: "other",      label: "Other",      icon: Heart,      desc: "Any movement practice you love",          arcUnit: "session duration" },
];

// ── Fitness levels ────────────────────────────────────────────────────────────
const FITNESS_LEVELS = [
  { id: "beginner",     label: "Building a foundation",  desc: "New to structured training or returning after a break" },
  { id: "intermediate", label: "Consistently active",    desc: "Training regularly with some structured approach" },
  { id: "advanced",     label: "Seriously competitive",  desc: "High volume, race-focused, or performance-driven" },
  { id: "elite",        label: "Elite or professional",  desc: "Full-time athlete or high-performance competitor" },
];

// ── Primary goals ─────────────────────────────────────────────────────────────
const PRIMARY_GOALS = [
  { id: "performance",  label: "Athletic Performance",    icon: Zap,      desc: "Race faster, lift more, go further" },
  { id: "recovery",     label: "Recovery Optimization",   icon: Wind,     desc: "Train hard and bounce back faster" },
  { id: "longevity",    label: "Long-Term Health",        icon: Heart,    desc: "Sustainable wellness for decades" },
  { id: "composition",  label: "Body Composition",        icon: Activity, desc: "Weight, lean mass, energy balance" },
  { id: "stress",       label: "Stress Resilience",       icon: Brain,    desc: "Use sport as an anchor against life pressure" },
  { id: "general",      label: "General Wellness",        icon: Leaf,     desc: "Feel better every day, in every way" },
];

// ── Event types ───────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Race", "Gran Fondo", "Triathlon", "Challenge", "Personal Goal", "Other"];

// ── Breathwork experience ─────────────────────────────────────────────────────
const BREATHWORK_EXP = [
  { id: "none",         label: "None yet",        desc: "No prior practice" },
  { id: "curious",      label: "Curious",         desc: "Heard about it, not started" },
  { id: "occasional",   label: "Occasional",      desc: "A few times a month" },
  { id: "regular",      label: "Regular",         desc: "Several times a week" },
  { id: "daily",        label: "Daily practice",  desc: "Committed daily habit" },
];

// ── Hero image map per step ───────────────────────────────────────────────────
const STEP_HEROES = [
  "./bew_wall_amber.png",     // 0: Origin
  "./bew_childs_pose.png",    // 1: Philosophy
  "./hero_dashboard.jpg",     // 2: Identity
  "./bew_cycling.png",        // 3: Sport
  "./hero_sleep.jpg",         // 4: Baseline
  "./bew_wall_teal.png",      // 5: Lifestyle
  "./hero_dashboard.jpg",     // 6: Launch (reuse dashboard)
];

const STEP_LABELS = ["Origin", "Philosophy", "Identity", "Your Sport", "Baseline", "Your Life", "Launch"];

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step) / (total - 1)) * 100;
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.2)", width: "100%" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: C.amber,
        transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
        borderRadius: 2,
      }} />
    </div>
  );
}

// ── Ken Burns hero ────────────────────────────────────────────────────────────
function HeroImage({ src, overlay }: { src: string; overlay?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{
      position: "relative", width: "100%", height: 220, overflow: "hidden",
      flexShrink: 0,
    }}>
      <img
        src={src}
        onLoad={() => setLoaded(true)}
        alt=""
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center",
          transform: loaded ? "scale(1.04)" : "scale(1.0)",
          transition: "transform 6s ease-out, opacity 0.6s",
          opacity: loaded ? 1 : 0,
        }}
      />
      {/* Gradient fade to linen */}
      <div style={{
        position: "absolute", inset: 0,
        background: overlay ||
          `linear-gradient(to bottom, rgba(6,95,70,0.55) 0%, rgba(6,95,70,0.2) 50%, ${C.linen} 100%)`,
      }} />
      {/* KEWT wordmark */}
      <div style={{
        position: "absolute", top: 14, left: 18,
        fontFamily: "'Inter', sans-serif", fontWeight: 900, fontStyle: "italic",
        fontSize: 22, letterSpacing: "-0.06em", color: C.white,
        transform: "skewX(-13deg)", display: "inline-block",
        textShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>KEWT</div>
    </div>
  );
}

// ── Shared text input ─────────────────────────────────────────────────────────
function TextInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700, color: C.muted,
        letterSpacing: "0.07em", marginBottom: 5, textTransform: "uppercase",
      }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          border: `1.5px solid ${C.border}`, fontSize: 14, background: C.white,
          color: C.ink, fontFamily: "inherit", boxSizing: "border-box",
          outline: "none",
        }}
      />
    </div>
  );
}

// ── Scale selector ────────────────────────────────────────────────────────────
function ScaleSelector({ value, onChange, lowLabel, highLabel, color = C.emerald }: {
  value: number; onChange: (v: number) => void;
  lowLabel: string; highLabel: string; color?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            flex: 1, aspectRatio: "1", borderRadius: 8, border: "none",
            background: n <= value ? color : C.linenDark,
            color: n <= value ? C.white : C.muted,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            transition: "all 0.15s",
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: C.muted }}>{lowLabel}</span>
        <span style={{ fontSize: 10, color: C.muted }}>{highLabel}</span>
      </div>
    </div>
  );
}

// ── Nav row ───────────────────────────────────────────────────────────────────
function NavRow({ onBack, onNext, canNext, nextLabel = "Continue", showBack = true }: {
  onBack: () => void; onNext: () => void; canNext: boolean;
  nextLabel?: string; showBack?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 16, paddingBottom: 4 }}>
      {showBack && (
        <button onClick={onBack} style={{
          padding: "12px 18px", borderRadius: 12, border: `1.5px solid ${C.border}`,
          background: C.white, color: C.ink, fontSize: 14, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <ChevronLeft size={16} /> Back
        </button>
      )}
      <button onClick={onNext} disabled={!canNext} style={{
        flex: 1, padding: "13px 18px", borderRadius: 12, border: "none",
        background: canNext ? C.emerald : C.border,
        color: C.white, fontSize: 14, fontWeight: 700,
        cursor: canNext ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all 0.18s",
        boxShadow: canNext ? "0 4px 16px rgba(6,95,70,0.25)" : "none",
      }}>
        {nextLabel} <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── BEI callout badge ─────────────────────────────────────────────────────────
function BEICallout({ text }: { text: string }) {
  return (
    <div style={{
      background: C.navy, borderRadius: 12, padding: "10px 14px",
      display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
        color: C.amber, flexShrink: 0, paddingTop: 1,
        textTransform: "uppercase",
      }}>BEI</div>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 0: ORIGIN
// ─────────────────────────────────────────────────────────────────────────────
function StepOrigin({ onNext }: { onNext: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 120); return () => clearTimeout(t); }, []);

  return (
    <div>
      <HeroImage
        src="./bew_wall_amber.png"
        overlay="linear-gradient(to bottom, rgba(6,95,70,0.72) 0%, rgba(6,95,70,0.38) 55%, #faf9f6 100%)"
      />
      <div style={{ padding: "0 20px 24px" }}>

        {/* Hook */}
        <div style={{
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(18px)",
          transition: "all 0.6s 0.1s ease",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.14em",
            textTransform: "uppercase", color: C.amber, margin: "18px 0 8px",
          }}>Blue Ember Wellness</p>
          <h1 style={{
            fontSize: 24, fontWeight: 900, color: C.emerald,
            lineHeight: 1.2, margin: "0 0 14px", letterSpacing: "-0.02em",
          }}>
            Every app measured the symptoms.<br />None explained the cause.
          </h1>
        </div>

        {/* Founder story */}
        <div style={{
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(18px)",
          transition: "all 0.6s 0.25s ease",
        }}>
          <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.75, margin: "0 0 12px" }}>
            I built <em style={{ fontStyle: "italic", fontWeight: 700, color: C.emerald }}>KEWT</em> because
            I could not find a single platform that connected daily work stress, breathing patterns, and
            posture awareness to what was actually happening in my body and why that determined everything
            about my training.
          </p>
          <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.75, margin: "0 0 12px" }}>
            There was no application that considered the fundamental importance of subjective work stress,
            breathwork, and posture awareness alongside the biochemistry flux that ultimately shapes
            athletic behavior and outcomes. <em style={{ fontWeight: 700, color: C.emerald }}>KEWT</em> closes
            those intelligence gaps with reasons and results.
          </p>
          <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.75, margin: "0 0 18px" }}>
            The athlete and the authentic self are the same body. <em style={{ fontWeight: 700, color: C.emerald }}>KEWT</em> exists
            to help you find the version of yourself that appears when everything aligns, and to return to
            that person reliably.
          </p>
        </div>

        {/* Promise card */}
        <div style={{
          background: C.emerald, borderRadius: 14, padding: "14px 18px", marginBottom: 20,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(18px)",
          transition: "all 0.6s 0.4s ease",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C.amber, marginBottom: 6, textTransform: "uppercase" }}>
            One Subscription. Full Spectrum.
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.white, lineHeight: 1.6 }}>
            No more juggling four separate apps to understand one body. Garmin integration, sleep science,
            HRV, nutrition, fasting, breathwork, posture, and the Blue Ember Intelligence layer that
            explains what all of it means together.
          </p>
        </div>

        {/* Attribution */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          opacity: visible ? 1 : 0, transition: "all 0.6s 0.5s ease",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.emerald}, ${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>MK</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Mark Kantner</div>
            <div style={{ fontSize: 11, color: C.muted }}>Founder, Blue Ember Wellness</div>
          </div>
        </div>

        {/* Begin button */}
        <button
          onClick={onNext}
          style={{
            width: "100%", padding: "15px 24px",
            background: C.amber, color: C.white, borderRadius: 14, border: "none",
            fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: "0.03em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 6px 24px rgba(245,158,11,0.4)",
            opacity: visible ? 1 : 0, transition: "all 0.6s 0.6s ease",
          }}
        >
          Begin My Journey <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: PHILOSOPHY
// ─────────────────────────────────────────────────────────────────────────────
function StepPhilosophyIntro({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [agreed, setAgreed] = useState(false);

  const pillars = [
    {
      icon: <Heart size={18} color={C.emerald} />,
      title: "The whole person creates the whole athlete.",
      body: "Your best run, your best lift, your best anything does not start at the trailhead. It starts the night before, in the breath you took at your desk, and in the way you held your shoulders through a hard meeting.",
    },
    {
      icon: <Brain size={18} color={C.amber} />,
      title: "Stress is a training variable.",
      body: "Job pressure, family demands, sleep debt, and shallow breathing accumulate in your biometrics as surely as hard intervals do. KEWT accounts for all of it because all of it counts.",
    },
    {
      icon: <TrendingUp size={18} color={C.emerald} />,
      title: "Your Authentic Performance State is learnable.",
      body: "The athlete you are on your best days is not an accident. It is a specific biochemical state. KEWT learns what creates it for you, and helps you return to it reliably.",
    },
    {
      icon: <Shield size={18} color={C.amber} />,
      title: "Recovery is the performance.",
      body: "Your readiness score on a given morning is not a judgment. It is information. The most productive response to a low score is to honor it. That discipline is what separates durable athletes from injured ones.",
    },
  ];

  return (
    <div>
      <HeroImage src="./bew_childs_pose.png" />
      <div style={{ padding: "0 20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, margin: "18px 0 6px" }}>
          The KEWT Philosophy
        </p>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: C.emerald, margin: "0 0 4px", lineHeight: 1.2 }}>
          Breathe. Reset. Return.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          Return to your authentic performance state. That is what this platform is built to help you do.
        </p>

        {pillars.map((p, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "12px 14px", marginBottom: 8,
            background: C.white, borderRadius: 12, border: `1.5px solid ${C.border}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: C.linen, display: "flex", alignItems: "center", justifyContent: "center",
            }}>{p.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 3 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{p.body}</div>
            </div>
          </div>
        ))}

        {/* Acknowledgment */}
        <button
          onClick={() => setAgreed(a => !a)}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: agreed ? C.emeraldLight : C.white,
            border: `2px solid ${agreed ? C.emerald : C.border}`,
            borderRadius: 12, cursor: "pointer", width: "100%",
            marginTop: 12, marginBottom: 16, transition: "all 0.2s",
            textAlign: "left",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            border: `2px solid ${agreed ? C.emerald : C.border}`,
            background: agreed ? C.emerald : C.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            {agreed && <Check size={13} color={C.white} />}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: agreed ? C.emerald : C.muted, lineHeight: 1.5 }}>
            I understand that KEWT is a wellness tool, not medical advice, and that my health decisions
            remain my own responsibility.
          </span>
        </button>

        <NavRow onBack={onBack} onNext={onNext} canNext={agreed} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: IDENTITY
// ─────────────────────────────────────────────────────────────────────────────
function StepIdentity({ data, onChange, onNext, onBack }: any) {
  return (
    <div>
      <HeroImage src="./hero_dashboard.jpg" />
      <div style={{ padding: "0 20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, margin: "18px 0 6px" }}>
          Your Starting Line
        </p>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: C.emerald, margin: "0 0 4px", lineHeight: 1.2 }}>
          Let us establish your baseline.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          This is your starting line, not a judgment. Every number here gives KEWT the context it needs
          to make your readiness score meaningful from day one.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <TextInput label="First Name" value={data.firstName} onChange={v => onChange({ firstName: v })} placeholder="Mark" />
          <TextInput label="Last Name" value={data.lastName || ""} onChange={v => onChange({ lastName: v })} placeholder="Optional" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <TextInput label="Age" type="number" value={data.age || ""} onChange={v => onChange({ age: v })} placeholder="e.g. 38" />
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.07em", marginBottom: 5, textTransform: "uppercase" }}>
              Biological Sex
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Male", "Female"].map(s => {
                const sel = data.biologicalSex === s.toLowerCase();
                return (
                  <button key={s} onClick={() => onChange({ biologicalSex: s.toLowerCase() })} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${sel ? C.emerald : C.border}`,
                    background: sel ? C.emeraldLight : C.white,
                    color: sel ? C.emerald : C.muted, cursor: "pointer", transition: "all 0.15s",
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <TextInput label="Height (inches)" type="number" value={data.heightIn || ""} onChange={v => onChange({ heightIn: v })} placeholder="e.g. 70" />
          <TextInput label="Weight (lbs)" type="number" value={data.weightLbs || ""} onChange={v => onChange({ weightLbs: v })} placeholder="e.g. 175" />
        </div>

        <div style={{
          background: C.linenDark, borderRadius: 12, padding: "10px 14px", marginBottom: 16,
          fontSize: 12, color: C.muted, lineHeight: 1.6,
        }}>
          Height and weight are used to calibrate your energy balance estimates. They are never shared
          and are always editable in Settings.
        </div>

        <NavRow onBack={onBack} onNext={onNext} canNext={!!data.firstName} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: SPORT + KINETIC ARC EDUCATION
// ─────────────────────────────────────────────────────────────────────────────
function StepActivities({ data, onChange, onNext, onBack }: any) {
  const selected: string[] = data.favoriteActivities || [];
  const arcModality: string = data.arcModality || "";

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter(a => a !== id);
      const arcUpdate = arcModality === id ? { arcModality: next[0] || "running" } : {};
      onChange({ favoriteActivities: next, ...arcUpdate });
    } else {
      const next = [...selected, id];
      const arcUpdate = next.length === 1 ? { arcModality: id } : {};
      onChange({ favoriteActivities: next, ...arcUpdate });
    }
  };

  const arcActivity = ACTIVITIES.find(a => a.id === arcModality);

  return (
    <div>
      <HeroImage src="./bew_cycling.png" />
      <div style={{ padding: "0 20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, margin: "18px 0 6px" }}>
          What Lights You Up
        </p>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: C.emerald, margin: "0 0 4px", lineHeight: 1.2 }}>
          Pick what drives you.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
          Select every activity you practice. Your passion is data too.
          KEWT will tailor your readiness intelligence to what matters most in your training.
        </p>

        {/* Kinetic Arc education callout */}
        <div style={{
          background: C.emerald, borderRadius: 14, padding: "14px 16px", marginBottom: 16,
          border: `1px solid rgba(245,158,11,0.3)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <TrendingUp size={16} color={C.amber} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.amber, textTransform: "uppercase" }}>
              About Your Kinetic Arc
            </span>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.9)", lineHeight: 1.65 }}>
            One of KEWT's most powerful features is the <strong style={{ color: C.amber }}>Kinetic Arc</strong>,
            a living performance graph on your Dashboard that tracks your trend over time in your primary sport.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.9)", lineHeight: 1.65 }}>
            For a runner it shows pace per mile. For a cyclist, miles per hour. For a swimmer, pace per 100m.
            For a strength athlete, session duration. The metric adapts to you.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.65 }}>
            The first sport you select below becomes your Kinetic Arc sport.
            You can change it at any time in Settings.
          </p>
        </div>

        {/* Arc sport indicator */}
        {arcModality && arcActivity && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: C.amberLight, borderRadius: 12, marginBottom: 14,
            border: `1.5px solid rgba(245,158,11,0.4)`,
          }}>
            <TrendingUp size={15} color={C.amber} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.amberDeep }}>
              Kinetic Arc tracking: <strong>{arcActivity.label}</strong>
              <span style={{ fontWeight: 500, color: "var(--color-ember)" }}> ({arcActivity.arcUnit})</span>
            </span>
          </div>
        )}

        {/* Activity chips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {ACTIVITIES.map(({ id, label, icon: Icon, desc }) => {
            const sel = selected.includes(id);
            const isArc = arcModality === id;
            return (
              <button key={id} onClick={() => toggle(id)} style={{
                padding: "9px 10px", borderRadius: 12,
                border: `2px solid ${sel ? C.emerald : C.border}`,
                background: sel ? C.emeraldLight : C.white,
                cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                display: "flex", alignItems: "flex-start", gap: 9,
                position: "relative",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: sel ? C.emerald : C.linenDark,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: sel ? C.white : C.muted, transition: "all 0.18s",
                }}>
                  <Icon size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sel ? C.emerald : C.ink }}>{label}</div>
                  <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }}>{desc}</div>
                  {isArc && (
                    <div style={{
                      marginTop: 4, display: "inline-flex", alignItems: "center", gap: 3,
                      background: C.amber, borderRadius: 5, padding: "2px 6px",
                    }}>
                      <TrendingUp size={9} color={C.white} />
                      <span style={{ fontSize: 9, fontWeight: 800, color: C.white, letterSpacing: "0.04em" }}>ARC</span>
                    </div>
                  )}
                </div>
                {sel && !isArc && (
                  <Check size={14} color={C.emerald} style={{ flexShrink: 0, marginTop: 2 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Fitness level */}
        <p style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Training Experience
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {FITNESS_LEVELS.map(({ id, label, desc }) => {
            const sel = data.fitnessLevel === id;
            return (
              <button key={id} onClick={() => onChange({ fitnessLevel: id })} style={{
                padding: "9px 13px", borderRadius: 11,
                border: `2px solid ${sel ? C.emerald : C.border}`,
                background: sel ? C.emeraldLight : C.white,
                cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.emerald : C.ink }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
                </div>
                {sel && <Check size={15} color={C.emerald} />}
              </button>
            );
          })}
        </div>

        <NavRow onBack={onBack} onNext={onNext}
          canNext={selected.length > 0 && !!data.fitnessLevel} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: BASELINE METRICS
// ─────────────────────────────────────────────────────────────────────────────
function StepBaseline({ data, onChange, onNext, onBack }: any) {
  return (
    <div>
      <HeroImage src="./hero_sleep.jpg" />
      <div style={{ padding: "0 20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, margin: "18px 0 6px" }}>
          Where Are You Starting From
        </p>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: C.emerald, margin: "0 0 4px", lineHeight: 1.2 }}>
          Your numbers, your ceiling.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
          These values anchor your BEI Readiness Score. Every number here is a baseline, not a ceiling.
          Estimate freely. KEWT will refine these as your data accumulates.
        </p>

        {/* ── Founder sleep narrative ────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.navy}10 0%, ${C.emeraldLight} 100%)`,
          border: `1.5px solid ${C.emerald}30`,
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: 60, height: 60,
            background: `radial-gradient(circle, ${C.amber}22 0%, transparent 70%)`,
            borderRadius: "0 14px 0 60px",
          }} />
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color: C.amber, margin: "0 0 6px" }}>
            Why Sleep Is Here
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "0 0 8px", lineHeight: 1.35 }}>
            "My wearable told me my sleep was disordered. It never told me why, or what to do about it."
          </p>
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 8px", lineHeight: 1.65 }}>
            For years the data was there. Fragmented sleep architecture, suppressed deep-sleep cycles, elevated
            resting heart rate through the night. The numbers were visible. The levers were not.
          </p>
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 8px", lineHeight: 1.65 }}>
            What no platform explained: the timing of your last meal reshapes your overnight HRV. A properly
            scheduled fasting window allows core temperature to drop, cortisol to clear, and slow-wave sleep
            to deepen. Nasal breathing protocols before bed directly lower sympathetic nervous system activity.
            These are not supplements or hacks. They are evidence-backed biological levers.
          </p>
          <p style={{ fontSize: 12, color: C.muted, margin: "0", lineHeight: 1.65 }}>
            <span style={{ color: C.emerald, fontWeight: 700 }}>KEWT connects those dots.</span> Your sleep
            score is not a grade. It is a signal tied to everything that happened in the 16 hours before
            you closed your eyes.
          </p>
          <p style={{
            fontSize: 11, fontStyle: "italic", color: C.amberDeep,
            margin: "10px 0 0", paddingTop: 10,
            borderTop: `1px solid ${C.amber}30`,
          }}>
            Mark Kantner, Founder, Blue Ember Wellness
          </p>
        </div>

        <BEICallout text="HRV is the single most sensitive indicator of your body's readiness to perform. A stable or rising HRV means your nervous system is recovering. A falling HRV signals that something upstream, whether stress, poor sleep, or overtraining, is accumulating. KEWT uses your baseline to detect meaningful deviations." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <TextInput label="Resting HR (bpm)" type="number" value={data.baselineRestingHr || ""} onChange={v => onChange({ baselineRestingHr: v })} placeholder="e.g. 52" />
          <TextInput label="HRV baseline (ms)" type="number" value={data.baselineHrv || ""} onChange={v => onChange({ baselineHrv: v })} placeholder="e.g. 58" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <TextInput label="Avg sleep (hours)" type="number" value={data.baselineSleepHours || ""} onChange={v => onChange({ baselineSleepHours: v })} placeholder="e.g. 7.5" />
          <TextInput label="Garmin sleep score" type="number" value={data.baselineSleepScore || ""} onChange={v => onChange({ baselineSleepScore: v })} placeholder="e.g. 74" />
        </div>

        <div style={{
          background: C.linenDark, borderRadius: 12, padding: "11px 14px", marginBottom: 16,
          fontSize: 12, color: C.muted, lineHeight: 1.65,
        }}>
          If you do not know these values yet, leave them blank. Your Garmin integration will populate
          real readings automatically once connected.
        </div>

        <NavRow onBack={onBack} onNext={onNext} canNext={true} nextLabel="Continue" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: LIFESTYLE + GOALS
// ─────────────────────────────────────────────────────────────────────────────
function StepLifestyle({ data, onChange, onNext, onBack }: any) {
  const [newEvent, setNewEvent] = useState({ name: "", date: "", type: "Race" });
  const [showAdd, setShowAdd] = useState(false);
  const events = (data.upcomingEvents as any[]) || [];

  const addEvent = () => {
    if (!newEvent.name || !newEvent.date) return;
    onChange({ upcomingEvents: [...events, { ...newEvent }] });
    setNewEvent({ name: "", date: "", type: "Race" });
    setShowAdd(false);
  };
  const removeEvent = (i: number) => {
    onChange({ upcomingEvents: events.filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div>
      <HeroImage src="./bew_wall_teal.png" />
      <div style={{ padding: "0 20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, margin: "18px 0 6px" }}>
          The Full Person
        </p>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: C.emerald, margin: "0 0 4px", lineHeight: 1.2 }}>
          Life is the training ground.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
          KEWT's Blue Ember Intelligence framework is built on one conviction: work stress, posture,
          breathwork awareness, and sleep quality are not soft variables. They are the decisive variables.
          Your honest answers here make your readiness score real.
        </p>

        {/* Primary goal */}
        <p style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Primary Goal
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {PRIMARY_GOALS.map(({ id, label, icon: Icon, desc }) => {
            const sel = data.primaryGoal === id;
            return (
              <button key={id} onClick={() => onChange({ primaryGoal: id })} style={{
                padding: "9px 13px", borderRadius: 11,
                border: `2px solid ${sel ? C.amber : C.border}`,
                background: sel ? C.amberLight : C.white,
                cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                display: "flex", alignItems: "center", gap: 13,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: sel ? C.amber : C.linenDark,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: sel ? C.white : C.muted,
                }}>
                  <Icon size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.amberDeep : C.ink }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
                </div>
                {sel && <Check size={15} color={C.amber} />}
              </button>
            );
          })}
        </div>

        {/* Work stress */}
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 7 }}>
          <Briefcase size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          On a typical workday, how much stress do you carry?
        </p>
        <ScaleSelector value={data.workStressLevel} onChange={v => onChange({ workStressLevel: v })}
          lowLabel="Very low stress" highLabel="Extremely high" />
        <div style={{ height: 12 }} />

        {/* Posture */}
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 7 }}>
          <Activity size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          How aware are you of your posture throughout the day?
        </p>
        <ScaleSelector value={data.postureAwareness} onChange={v => onChange({ postureAwareness: v })}
          lowLabel="Rarely think about it" highLabel="Constant awareness" />
        <div style={{ height: 12 }} />

        {/* Sleep priority */}
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 7 }}>
          <Bed size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          How much do you currently prioritize sleep?
        </p>
        <ScaleSelector value={data.sleepPriority} onChange={v => onChange({ sleepPriority: v })} color={C.amber}
          lowLabel="Sleep is sacrificed" highLabel="Sleep is sacred" />
        <div style={{ height: 12 }} />

        {/* Breathwork */}
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 9 }}>
          <Wind size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Breathwork experience
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {BREATHWORK_EXP.map(({ id, label, desc }) => {
            const sel = data.breathworkExperience === id;
            return (
              <button key={id} onClick={() => onChange({ breathworkExperience: id })} style={{
                padding: "9px 11px", borderRadius: 11,
                border: `2px solid ${sel ? C.emerald : C.border}`,
                background: sel ? C.emeraldLight : C.white,
                cursor: "pointer", textAlign: "left", transition: "all 0.18s",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sel ? C.emerald : C.ink }}>{label}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{desc}</div>
                {sel && <Check size={13} color={C.emerald} style={{ marginTop: 5 }} />}
              </button>
            );
          })}
        </div>

        {/* Upcoming events */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
            Upcoming Events
          </p>
          <button onClick={() => setShowAdd(true)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
            background: C.emeraldLight, color: C.emerald, border: "none",
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            <Plus size={12} /> Add Event
          </button>
        </div>
        {events.length === 0 && !showAdd && (
          <div style={{
            border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "18px",
            textAlign: "center", color: C.muted, fontSize: 12, marginBottom: 14,
          }}>
            <Calendar size={22} style={{ margin: "0 auto 7px", display: "block", opacity: 0.4 }} />
            A race, a fondo, a personal challenge. Add what motivates you.
          </div>
        )}
        {events.map((ev: any, i: number) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 13px",
            background: C.white, borderRadius: 11, border: `1.5px solid ${C.border}`, marginBottom: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.emerald,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Target size={15} color={C.white} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{ev.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{ev.type} · {ev.date}</div>
            </div>
            <button onClick={() => removeEvent(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
              <X size={14} />
            </button>
          </div>
        ))}
        {showAdd && (
          <div style={{
            background: C.linen, borderRadius: 12, padding: "14px", border: `1.5px solid ${C.border}`, marginBottom: 14,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <TextInput label="Event Name" value={newEvent.name} onChange={v => setNewEvent(p => ({ ...p, name: v }))} placeholder="e.g. Door County Half" />
              <TextInput label="Date" type="date" value={newEvent.date} onChange={v => setNewEvent(p => ({ ...p, date: v }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", marginBottom: 5, textTransform: "uppercase" }}>Event Type</label>
              <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))} style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${C.border}`, fontSize: 14,
                background: C.white, color: C.ink, fontFamily: "inherit",
              }}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addEvent} disabled={!newEvent.name || !newEvent.date} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                background: C.emerald, color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Add</button>
              <button onClick={() => setShowAdd(false)} style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: `1.5px solid ${C.border}`, background: C.white,
                color: C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}

        <NavRow onBack={onBack} onNext={onNext}
          canNext={!!data.primaryGoal && data.workStressLevel > 0 && data.postureAwareness > 0 && data.sleepPriority > 0 && !!data.breathworkExperience} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: LAUNCH REVEAL
// ─────────────────────────────────────────────────────────────────────────────
function StepLaunch({ data }: { data: any }) {
  const [animIn, setAnimIn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimIn(true), 100); return () => clearTimeout(t); }, []);
  const [, navigate] = useLocation();

  const arcActivity = ACTIVITIES.find(a => a.id === (data.arcModality || "running"));
  const activityCount = (data.favoriteActivities as string[])?.length || 0;

  return (
    <div style={{ padding: "0 20px 32px" }}>
      {/* Animated ring */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%", margin: "32px auto 24px",
        background: `conic-gradient(${C.emeraldGlow} 0%, ${C.amber} 70%, ${C.emeraldLight} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: animIn ? 1 : 0, transform: animIn ? "scale(1)" : "scale(0.6)",
        transition: "all 0.75s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: "0 0 48px rgba(16,185,129,0.3)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 90, height: 90, borderRadius: "50%",
          background: C.emerald, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={42} color={C.white} strokeWidth={2.5} />
        </div>
      </div>

      <div style={{
        textAlign: "center",
        opacity: animIn ? 1 : 0, transform: animIn ? "none" : "translateY(18px)",
        transition: "all 0.6s 0.2s ease",
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: C.emerald, margin: "0 0 8px" }}>
          Welcome to <span style={{ fontStyle: "italic", transform: "skewX(-13deg)", display: "inline-block" }}>KEWT</span>, {data.firstName}.
        </h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: "0 0 24px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Your Authentic Performance State profile is active. KEWT now has the context it needs to
          make your readiness score meaningful from this moment forward.
        </p>
      </div>

      {/* Summary card */}
      <div style={{
        background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`,
        padding: "18px 20px", marginBottom: 20,
        opacity: animIn ? 1 : 0, transition: "all 0.6s 0.35s ease",
      }}>
        {[
          { icon: <Activity size={15} color={C.emerald} />,    label: "Sports selected",  value: `${activityCount} activit${activityCount === 1 ? "y" : "ies"}` },
          { icon: <TrendingUp size={15} color={C.amber} />,    label: "Kinetic Arc sport", value: arcActivity?.label || "Running" },
          { icon: <Target size={15} color={C.emerald} />,      label: "Primary goal",      value: PRIMARY_GOALS.find(g => g.id === data.primaryGoal)?.label || "General Wellness" },
          { icon: <Bed size={15} color={C.amber} />,           label: "Sleep priority",    value: `${data.sleepPriority}/10` },
          { icon: <Wind size={15} color={C.emerald} />,        label: "Breathwork",        value: BREATHWORK_EXP.find(b => b.id === data.breathworkExperience)?.label || "Getting started" },
        ].map((row, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
            borderBottom: i < 4 ? `1px solid ${C.border}` : "none",
          }}>
            {row.icon}
            <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Closing philosophy */}
      <div style={{
        background: C.emerald, borderRadius: 14, padding: "16px 20px", marginBottom: 22,
        opacity: animIn ? 1 : 0, transition: "all 0.6s 0.5s ease",
      }}>
        <p style={{ margin: "0 0 6px", color: C.white, fontSize: 13, lineHeight: 1.7 }}>
          You are not your average pace. You are not your resting heart rate.
          You are the version of yourself that appears when sleep, stress, breath, and movement align.
        </p>
        <p style={{ margin: 0, fontWeight: 700, color: C.amber, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Breathe. Reset. Return.
        </p>
      </div>

      <button
        onClick={() => navigate("/")}
        style={{
          width: "100%", padding: "15px 24px",
          background: C.amber, color: C.white, borderRadius: 14, border: "none",
          fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: "0.03em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 6px 24px rgba(245,158,11,0.4)",
          opacity: animIn ? 1 : 0, transition: "all 0.6s 0.65s ease",
        }}
      >
        Open My Dashboard <ArrowRight size={18} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ONBOARDING SHELL
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const initialData = {
  firstName: "", lastName: "", age: "", biologicalSex: "",
  heightIn: "", weightLbs: "",
  favoriteActivities: [] as string[], fitnessLevel: "",
  baselineHrv: "", baselineRestingHr: "", baselineSleepHours: "", baselineSleepScore: "",
  primaryGoal: "", upcomingEvents: [] as any[],
  workStressLevel: 0, postureAwareness: 0, sleepPriority: 0, breathworkExperience: "",
  philosophyAcknowledged: 1,  // philosophy is now step 1 of the flow
  arcModality: "running", arcWindow: 56,
};

export default function Onboarding() {
  const [step, setStep]           = useState(0);
  const [data, setData]           = useState(initialData);
  const [done, setDone]           = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [visible, setVisible]     = useState(true);
  const { toast }                 = useToast();
  const [, navigate]              = useLocation();
  const qc                        = useQueryClient();

  const merge = (partial: Partial<typeof initialData>) =>
    setData(prev => ({ ...prev, ...partial }));

  const transition = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 240);
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection("forward");
      transition(() => setStep(s => s + 1));
    }
  };
  const back = () => {
    if (step > 0) {
      setDirection("back");
      transition(() => setStep(s => s - 1));
    }
  };

  const mutation = useMutation({
    mutationFn: async (payload: any) => apiRequest("POST", "/api/onboarding/profile", payload),
    onSuccess: () => {
      qc.setQueryData(["/api/me"], (prev: any) => prev ? { ...prev, onboardingComplete: true } : prev);
      setDirection("forward");
      transition(() => setDone(true));
    },
    onError: () => {
      toast({ title: "Could not save profile", description: "Please try again.", variant: "destructive" });
    },
  });

  const submit = () => {
    const payload = {
      ...data,
      age:                data.age               ? parseInt(data.age as any)                : null,
      heightIn:           data.heightIn          ? parseFloat(data.heightIn as any)         : null,
      weightLbs:          data.weightLbs         ? parseFloat(data.weightLbs as any)        : null,
      baselineHrv:        data.baselineHrv       ? parseFloat(data.baselineHrv as any)      : null,
      baselineRestingHr:  data.baselineRestingHr ? parseInt(data.baselineRestingHr as any)  : null,
      baselineSleepHours: data.baselineSleepHours ? parseFloat(data.baselineSleepHours as any) : null,
      baselineSleepScore: data.baselineSleepScore ? parseInt(data.baselineSleepScore as any) : null,
      workStressLevel:    data.workStressLevel   || null,
      postureAwareness:   data.postureAwareness  || null,
      sleepPriority:      data.sleepPriority     || null,
      favoriteActivities: JSON.stringify(data.favoriteActivities),
      upcomingEvents:     JSON.stringify(data.upcomingEvents),
      arcModality:        (data as any).arcModality || "running",
      arcWindow:          (data as any).arcWindow   || 56,
      philosophyAcknowledged: 1,
      onboardingComplete: 1,
      createdAt:          new Date().toISOString(),
    };
    mutation.mutate(payload);
  };

  // Step 5 (lifestyle) is the last data-entry step; it triggers submit on Continue
  const handleNext = () => {
    if (step === 5) {
      submit();
    } else {
      next();
    }
  };

  // Steps: 0=Origin 1=Philosophy 2=Identity 3=Sport 4=Baseline 5=Lifestyle [done=Launch]
  const steps = [
    <StepOrigin           key={0} onNext={next} />,
    <StepPhilosophyIntro  key={1} onNext={next}        onBack={back} />,
    <StepIdentity         key={2} data={data} onChange={merge} onNext={next}        onBack={back} />,
    <StepActivities       key={3} data={data} onChange={merge} onNext={next}        onBack={back} />,
    <StepBaseline         key={4} data={data} onChange={merge} onNext={next}        onBack={back} />,
    <StepLifestyle        key={5} data={data} onChange={merge} onNext={handleNext}  onBack={back} />,
  ];

  return (
    <div style={{
      height: "100svh", background: C.linen,
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      {!done && (
        <div style={{
          background: C.emerald, flexShrink: 0,
        }}>
          <div style={{
            padding: "11px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {/* Wordmark */}
            <span style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 900, fontStyle: "italic",
              fontSize: 20, letterSpacing: "-0.06em", color: C.white,
              transform: "skewX(-13deg)", display: "inline-block",
            }}>KEWT</span>

            {/* Step label + counter */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                {STEP_LABELS[step]}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                {step + 1} of {TOTAL_STEPS}
              </div>
            </div>
          </div>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "none"
            : direction === "forward" ? "translateX(22px)" : "translateX(-22px)",
          transition: "opacity 0.22s ease, transform 0.22s ease",
          paddingBottom: "env(safe-area-inset-bottom, 24px)",
        }}>
          {done
            ? <StepLaunch data={data} />
            : steps[step]
          }
        </div>
      </div>

      {/* BEI tagline footer */}
      {!done && (
        <div style={{
          padding: "9px 24px", background: C.white,
          borderTop: `1px solid ${C.border}`,
          textAlign: "center", flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, color: C.muted,
            letterSpacing: "0.14em", fontWeight: 600, textTransform: "uppercase",
          }}>
            Breathe · Reset · Return
          </span>
        </div>
      )}
    </div>
  );
}
