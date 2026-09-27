import { useState, useEffect, useRef } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import {
  Brain, Zap, Moon, Apple, Heart, Activity, ChevronDown, ChevronUp,
  FlaskConical, BookOpen, ExternalLink, TrendingUp, Shield, Wind,
  Dumbbell, Clock, Star, AlertCircle, CheckCircle2, BarChart2,
} from "lucide-react";

// ── Science CSS ──────────────────────────────────────────────────────────────
const SCIENCE_CSS = `
/* ── Science Page Shell ─────────────────────────────────────────── */
.sci-page { max-width: var(--page-max); margin: 0 auto; padding-bottom: 80px; }

/* ── Hero ───────────────────────────────────────────────────────── */
.sci-hero {
  text-align: center;
  padding: 56px var(--page-pad) 44px;
  max-width: 760px;
  margin: 0 auto;
}
.sci-hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-ember);
  margin-bottom: 16px;
}
.sci-hero-eyebrow-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--color-ember);
  animation: kewt-pulse-dot 2s ease-in-out infinite;
}
.sci-hero-title {
  font-size: clamp(30px, 4.5vw, 48px);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--color-text);
  margin-bottom: 16px;
}
.sci-hero-sub {
  font-size: 16px;
  font-weight: 400;
  color: var(--color-text-muted);
  line-height: 1.65;
  max-width: 540px;
  margin: 0 auto 24px;
}
.sci-hero-divider {
  width: 52px; height: 2px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-ember));
  border-radius: 2px;
  margin: 0 auto 28px;
}
/* Profile pill — personalized callout */
.sci-profile-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 40px;
  padding: 8px 16px 8px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
}
.sci-profile-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: #fff;
  flex-shrink: 0;
}
.sci-profile-name { font-weight: 700; color: var(--color-text); }
.sci-profile-sep { color: var(--color-border); }

/* ── Domain Tabs ─────────────────────────────────────────────────── */
.sci-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--page-pad) 20px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  max-width: var(--page-max);
  margin: 0 auto;
}
.sci-tabs::-webkit-scrollbar { display: none; }
.sci-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 40px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: all 160ms ease;
  flex-shrink: 0;
}
.sci-tab:hover {
  border-color: var(--color-ember);
  color: var(--color-text);
  background: var(--color-ember-light);
}
.sci-tab--active {
  background: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-bg);
  box-shadow: 0 2px 12px rgba(0,0,0,0.14);
}
.sci-tab-icon { flex-shrink: 0; }

/* ── Domain Section ──────────────────────────────────────────────── */
.sci-domain {
  padding: 0 var(--page-pad) 32px;
  max-width: var(--page-max);
  margin: 0 auto;
}

/* Domain header — dark hero card */
.sci-domain-header {
  border-radius: 20px;
  padding: 36px 36px 30px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
  color: #fff;
}
.sci-domain-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.28);
  z-index: 0;
}
.sci-domain-header-content { position: relative; z-index: 1; }
.sci-domain-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 10px;
}
.sci-domain-title {
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 10px;
}
.sci-domain-desc {
  font-size: 14px;
  line-height: 1.65;
  opacity: 0.88;
  max-width: 580px;
}

/* ── Research Cards ──────────────────────────────────────────────── */
.sci-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.sci-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 24px;
  cursor: pointer;
  transition: box-shadow 160ms ease, transform 140ms ease, border-color 160ms ease;
}
.sci-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
  border-color: var(--color-ember);
}
.sci-card--open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px hsl(158 72% 28% / 0.12);
}
.sci-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}
.sci-card-icon-wrap {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sci-card-toggle {
  color: var(--color-text-faint);
  flex-shrink: 0;
  margin-top: 2px;
  transition: color 140ms;
}
.sci-card:hover .sci-card-toggle { color: var(--color-text-muted); }
.sci-card-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ember);
  margin-bottom: 5px;
}
.sci-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.35;
  margin-bottom: 8px;
}
.sci-card-summary {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.62;
}

/* Expanded drawer */
.sci-card-drawer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-divider);
  animation: sci-drawer-in 200ms ease forwards;
}
@keyframes sci-drawer-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sci-mechanism {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.7;
  margin-bottom: 14px;
}
.sci-citation {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: hsl(215 74% 48% / 0.06);
  border: 1px solid hsl(215 74% 48% / 0.16);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.sci-citation-icon { color: hsl(215 74% 48%); flex-shrink: 0; margin-top: 1px; }
.sci-citation-text { font-size: 12px; color: var(--color-text-muted); line-height: 1.55; }
.sci-citation-text strong { color: var(--color-text); font-weight: 600; }
.sci-citation-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: hsl(215 74% 48%);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  margin-top: 3px;
}
.sci-citation-link:hover { text-decoration: underline; }

/* KEWT usage callout */
.sci-kewt-callout {
  background: linear-gradient(135deg, hsl(158 72% 28% / 0.06), hsl(36 91% 50% / 0.05));
  border: 1px solid hsl(158 72% 28% / 0.18);
  border-radius: 12px;
  padding: 12px 14px;
}
.sci-kewt-callout-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin-bottom: 5px;
}
.sci-kewt-callout-body {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

/* ── Mitophagy feature banner ───────────────────────────────────── */
.sci-mitophagy-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, #0d2744 0%, #0a1e38 100%);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 20px;
  padding: 28px 28px;
  margin: 0 var(--page-pad) 28px;
  max-width: var(--page-max);
  margin-left: auto;
  margin-right: auto;
  position: relative;
  overflow: hidden;
}
.sci-mitophagy-banner::before {
  content: '';
  position: absolute;
  top: -40px; right: -40px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%);
  pointer-events: none;
}
.sci-mitophagy-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 16px rgba(201,168,76,0.3));
}
.sci-mitophagy-content { flex: 1; }
.sci-mitophagy-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c9a84c;
  margin-bottom: 6px;
}
.sci-mitophagy-title {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 7px;
}
.sci-mitophagy-body {
  font-size: 13px;
  color: rgba(255,255,255,0.72);
  line-height: 1.6;
}
.sci-mitophagy-stats {
  display: flex;
  gap: 20px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.sci-mitophagy-stat { text-align: center; }
.sci-mitophagy-stat-val {
  font-size: 22px;
  font-weight: 800;
  color: #e8c96a;
  letter-spacing: -0.03em;
  line-height: 1;
}
.sci-mitophagy-stat-label {
  font-size: 10px;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
  margin-top: 3px;
}

/* ── Mark's Protocol card ─────────────────────────────────────────── */
.sci-mark-card {
  background: linear-gradient(135deg, hsl(158 72% 28% / 0.08), hsl(36 91% 50% / 0.06));
  border: 1.5px solid hsl(158 72% 28% / 0.2);
  border-radius: 18px;
  padding: 24px;
  margin-top: 20px;
}
.sci-mark-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.sci-mark-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; color: #fff; flex-shrink: 0;
}
.sci-mark-label { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-primary); }
.sci-mark-name { font-size: 14px; font-weight: 700; color: var(--color-text); }
.sci-mark-items { display: flex; flex-direction: column; gap: 8px; }
.sci-mark-item {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: var(--color-text-muted); line-height: 1.5;
}
.sci-mark-item-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-primary); flex-shrink: 0; margin-top: 6px;
}

/* ── Section headers within page ─────────────────────────────────── */
.sci-section-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding: 0 var(--page-pad);
  margin: 4px auto 12px;
  max-width: var(--page-max);
}

/* ── Mobile ──────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .sci-hero { padding: 36px 20px 28px; }
  .sci-domain { padding: 0 16px 28px; }
  .sci-domain-header { padding: 24px 20px; }
  .sci-grid { grid-template-columns: 1fr; }
  .sci-mitophagy-banner { flex-direction: column; text-align: center; padding: 24px 20px; margin-left: 16px; margin-right: 16px; }
  .sci-mitophagy-stats { justify-content: center; }
  .sci-tabs { padding: 0 16px 16px; }
  .sci-section-title { padding: 0 16px; }
}
/* ── Science Ticker (marquee) ──────────────────────────────── */
@keyframes sci-ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.sci-ticker {
  display: flex;
  align-items: center;
  height: 38px;
  overflow: hidden;
  position: relative;
  background: hsl(158 72% 28% / 0.06);
  border-top: 1px solid hsl(158 72% 28% / 0.15);
  border-bottom: 1px solid hsl(158 72% 28% / 0.15);
  margin-bottom: 0;
}
.sci-ticker::before {
  content: '';
  position: absolute; top: 0; bottom: 0; left: 110px;
  width: 60px;
  background: linear-gradient(to right, var(--color-bg), transparent);
  z-index: 2; pointer-events: none;
}
.sci-ticker::after {
  content: '';
  position: absolute; top: 0; bottom: 0; right: 0;
  width: 60px;
  background: linear-gradient(to left, var(--color-bg), transparent);
  z-index: 2; pointer-events: none;
}
.sci-ticker-label {
  display: flex; align-items: center; gap: 5px;
  flex-shrink: 0;
  padding: 0 12px 0 14px;
  height: 100%;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--color-primary);
  border-right: 1px solid hsl(158 72% 28% / 0.18);
  background: var(--color-bg);
  z-index: 3;
  white-space: nowrap;
}
.sci-ticker-track {
  flex: 1; overflow: hidden; height: 100%;
  display: flex; align-items: center;
}
.sci-ticker-moving {
  display: flex; align-items: center;
  white-space: nowrap;
  animation: sci-ticker-scroll 52s linear infinite;
  will-change: transform;
}
.sci-ticker-item {
  display: inline-flex; align-items: center;
  font-size: 12.5px; color: var(--color-text-muted);
}
.sci-ticker-item strong {
  color: var(--color-text); font-weight: 700; margin-right: 4px;
}
.sci-ticker-sep {
  display: inline-block;
  width: 4px; height: 4px; border-radius: 50%;
  background: hsl(158 72% 28% / 0.5);
  margin: 0 28px; flex-shrink: 0;
}
@media (max-width: 1024px) { .sci-ticker-moving { animation-duration: 80s; } }
@media (max-width: 760px)  { .sci-ticker-moving { animation-duration: 110s; } }
.sci-ticker-track--paused { cursor: grab; user-select: none; }
.sci-ticker-track--paused:active { cursor: grabbing; }

`;

// ── Domain definitions ────────────────────────────────────────────────────────
const DOMAINS = [
  {
    id: "training",
    label: "Training Science",
    icon: <Zap size={16} />,
    gradient: "linear-gradient(135deg, #1a3a2a 0%, #0f2a40 100%)",
    bgColor: "#0f2a40",
    eyebrow: "Physiology · Load Management",
    title: "Training Science",
    desc: "The evidence base behind how KEWT structures your ride and run sessions - zone calibration, load progression, and injury prevention through acute:chronic workload ratios.",
    cards: [
      {
        id: "zone2",
        icon: <Activity size={18} />,
        iconBg: "linear-gradient(135deg, #065f46, #10b981)",
        iconColor: "#10b981",
        label: "Aerobic Base",
        title: "Zone 2 Training: The Mitochondrial Stimulus",
        summary: "Low-intensity aerobic work (roughly 60-70% max HR) is the single most potent stimulus for mitochondrial biogenesis in endurance athletes.",
        mechanism: "Zone 2 training activates PGC-1alpha, the master regulator of mitochondrial production. At this intensity, type I slow-twitch fibers are maximally recruited while lactate remains at or below 2 mmol/L. This environment forces mitochondria to oxidize fat efficiently rather than relying on glycolysis, improving fat oxidation capacity and overall metabolic flexibility.\n\nFor masters athletes, zone 2 work also preserves aerobic capacity (VO2max) that naturally declines ~1% per year post-40 without consistent low-intensity training.",
        citation: {
          text: "Iaia FM & Bangsbo J (2010). Speed endurance training is superior to distance training in improving the capacity to sustain high-intensity exercise. Acta Physiol 199(2):151-9.",
          doi: "10.1111/j.1748-1716.2010.02083.x",
        },
        kewt: "KEWT color-codes your Garmin and Strava activities by zone. Your weekly Zone 2 target is 3-4 hours. The Aerobic Efficiency metric on the Analytics page tracks fat oxidation improvement over time.",
      },
      {
        id: "cortisol-curve",
        icon: <BarChart2 size={18} />,
        iconBg: "linear-gradient(135deg, #7c3aed, #a855f7)",
        iconColor: "#a855f7",
        label: "Session Ceiling",
        title: "The 60-75 Min Cortisol Threshold",
        summary: "Endurance sessions beyond 60-75 minutes trigger a cortisol surge that, without adequate recovery, impairs adaptation and accelerates muscle catabolism.",
        mechanism: "Cortisol is a necessary stress hormone that mobilizes energy during exercise. However, the cortisol-to-testosterone ratio is a validated proxy for anabolic vs. catabolic balance. Research in masters athletes shows cortisol suppression of growth hormone pulsatility becomes pronounced after 75 minutes of sustained effort, particularly when sessions are stacked on consecutive days.\n\nFor masters athletes, testosterone baseline declines with age, making the cortisol ratio more consequential. KEWT's session targeting keeps key aerobic efforts within the 55-70 minute window and flags sessions that exceed this threshold.",
        citation: {
          text: "Hackney AC et al. (2012). Cortisol and testosterone: Physiology and further complications of selectively altering one without the other. Curr Sports Med Rep 11(4):179-183.",
          doi: "10.1249/JSR.0b013e318259f92a",
        },
        kewt: "The Weekly View flags rides and runs that exceeded 75 minutes when Garmin data shows elevated Training Effect. KEWT periodizes session length to help manage cumulative cortisol load.",
      },
      {
        id: "acwr",
        icon: <TrendingUp size={18} />,
        iconBg: "linear-gradient(135deg, #c2410c, #f97316)",
        iconColor: "#f97316",
        label: "Injury Prevention",
        title: "Acute:Chronic Workload Ratio (ACWR)",
        summary: "The ACWR compares your last 7 days of training load to your rolling 28-day average. A ratio above 1.5 is associated with 2-4x greater injury risk.",
        mechanism: "Pioneered by Tim Gabbett, the ACWR is the most evidence-backed load management tool in sports medicine. It quantifies the 'preparedness vs. fatigue' relationship. An ACWR of 0.8-1.3 represents the 'sweet spot' for adaptation without overreach.\n\nFor masters athletes specifically, connective tissue (tendons, fascia) adapts more slowly than cardiovascular fitness. This means it is possible to feel aerobically capable of doing more while structural load tolerance lags behind by 10-14 days.",
        citation: {
          text: "Gabbett TJ (2016). The training-injury prevention paradox: Should athletes be training smarter and harder? Br J Sports Med 50(5):273-280.",
          doi: "10.1136/bjsports-2015-095788",
        },
        kewt: "KEWT calculates your ACWR weekly from Strava/Garmin activity data. Your Analytics page shows a color-coded ACWR gauge: green (0.8-1.3), amber (1.3-1.5), red (above 1.5). Target ACWR below 1.4 during build phases.",
      },
      {
        id: "strength-running",
        icon: <Dumbbell size={18} />,
        iconBg: "linear-gradient(135deg, #1e40af, #3b82f6)",
        iconColor: "#3b82f6",
        label: "Economy",
        title: "Strength Training and Running Economy",
        summary: "Heavy resistance training 2 days per week improves running economy in endurance athletes by 3-8% without adding body mass.",
        mechanism: "Running economy (the oxygen cost at a given pace) is the primary variable that separates elite from age-group athletes of similar VO2max. Strength training improves neuromuscular stiffness and leg spring, reducing the energy cost per stride.\n\nA 5% improvement in economy translates to roughly a 25-second per mile improvement at the same aerobic effort. Relevant exercises: single-leg Romanian deadlifts, Bulgarian split squats, calf raises. Heavy and low-rep (3-5 sets of 4-6) outperforms high-rep hypertrophy work for economy gains.",
        citation: {
          text: "Beattie K et al. (2017). The effect of strength training on performance in endurance athletes. Sports Med 47(8):1525-1554.",
          doi: "10.1007/s40279-016-0682-2",
        },
        kewt: "Strength sessions logged in the Daily Log feed into your weekly training load and are excluded from ACWR cardio calculations to prevent dilution. KEWT tracks your 2-day strength cadence on the Goals ring.",
      },
    ],
  },
  {
    id: "recovery",
    label: "Recovery Science",
    icon: <Moon size={16} />,
    gradient: "linear-gradient(135deg, #1a1a3e 0%, #0d1b2e 100%)",
    bgColor: "#0d1b2e",
    eyebrow: "Sleep · HRV · Restoration",
    title: "Recovery Science",
    desc: "Recovery is not passive. It is the phase where adaptation actually occurs. The research behind sleep architecture, HRV, cortisol rhythms, and cold therapy timing.",
    cards: [
      {
        id: "sleep-gh",
        icon: <Moon size={18} />,
        iconBg: "linear-gradient(135deg, #1e1b4b, #4f46e5)",
        iconColor: "#818cf8",
        label: "Sleep Architecture",
        title: "N3 Sleep and Growth Hormone Pulse",
        summary: "The body's largest daily growth hormone pulse occurs in the first slow-wave (N3) sleep cycle, typically within 60-90 minutes of sleep onset.",
        mechanism: "Growth hormone is the primary tissue repair signal for endurance athletes, driving muscle protein synthesis and fat mobilization. Nedeltcheva et al. (2010) demonstrated that sleep restriction to 5.5 hours reduced GH secretion and anabolic signaling while increasing cortisol, resulting in 60% less fat loss and 55% more lean mass loss during a caloric deficit compared to 8.5 hour sleep.\n\nFor masters athletes, natural GH secretion is already 50-70% lower than at age 25. Protecting N3 sleep is therefore especially high-leverage for body composition and recovery.",
        citation: {
          text: "Nedeltcheva AV et al. (2010). Insufficient sleep undermines dietary efforts to reduce adiposity. Ann Intern Med 153(7):435-441.",
          doi: "10.7326/0003-4819-153-7-201010050-00006",
        },
        kewt: "Your Oura Ring or Garmin sleep data feeds KEWT's nightly Recovery Score. N3 sleep percentage is displayed on the Dashboard recovery card. Nights below 7 hours trigger an amber advisory on tomorrow's training plan.",
      },
      {
        id: "hrv",
        icon: <Heart size={18} />,
        iconBg: "linear-gradient(135deg, #7f1d1d, #ef4444)",
        iconColor: "#f87171",
        label: "Heart Rate Variability",
        title: "HRV and RMSSD: Autonomic Readiness",
        summary: "RMSSD (the HRV metric used by Garmin, WHOOP, and Oura) reflects parasympathetic nervous system activity. A morning RMSSD below your 7-day baseline by 15%+ signals inadequate recovery.",
        mechanism: "Heart rate variability is the variation in time between successive heartbeats, measured in milliseconds. RMSSD (Root Mean Square of Successive Differences) captures the high-frequency HRV component linked to vagal tone. High vagal tone means your parasympathetic system is dominant, indicating systemic readiness to absorb training stress.\n\nMasters athletes show greater HRV suppression in response to identical training loads compared to younger athletes, with a longer return-to-baseline timeline (typically 48-72 hours vs. 24-36 hours in younger athletes).",
        citation: {
          text: "Buchheit M (2014). Monitoring training status with HR measures: Do all roads lead to Rome? Front Physiol 5:73.",
          doi: "10.3389/fphys.2014.00073",
        },
        kewt: "Your Garmin HRV status is displayed on the Dashboard. KEWT's training plan uses your 7-day rolling RMSSD average as a readiness gate: hard sessions are auto-recommended on high-HRV days and swapped for Zone 2 or rest on suppressed days.",
      },
      {
        id: "cortisol-rhythm",
        icon: <Clock size={18} />,
        iconBg: "linear-gradient(135deg, #451a03, #d97706)",
        iconColor: "#fbbf24",
        label: "Circadian Biology",
        title: "Cortisol Awakening Response and Training Timing",
        summary: "Cortisol peaks 20-40 minutes after waking (the Cortisol Awakening Response) and creates an anti-inflammatory window ideal for strength training. Afternoon sessions 3-6 PM align with peak neuromuscular output.",
        mechanism: "The cortisol diurnal rhythm is arguably the most underutilized training periodization tool. Morning cortisol elevation primes gluconeogenesis and fat mobilization, making fasted morning low-intensity work metabolically favorable. Conversely, peak afternoon temperature, hand-eye coordination, and strength output occur between 3-6 PM - supported by 40+ studies showing 3-7% improvements in strength and power output in afternoon vs. morning sessions.\n\nDuring extended fasting (18h+), the elevated cortisol state amplifies autophagy but makes high-intensity training contraindicated. Zone 2 or light movement is optimal during a System Cleanse.",
        citation: {
          text: "Chtourou H & Souissi N (2012). The effect of training at a specific time of day. J Strength Cond Res 26(7):1984-2005.",
          doi: "10.1519/JSC.0b013e31825770a7",
        },
        kewt: "The Daily Log records your workout time of day. Over 8+ weeks, KEWT's analytics will surface your personal performance-time correlation so your plan can sequence session types optimally.",
      },
      {
        id: "cold",
        icon: <Wind size={18} />,
        iconBg: "linear-gradient(135deg, #0c4a6e, #0ea5e9)",
        iconColor: "#38bdf8",
        label: "Cold Therapy",
        title: "Cold Water Immersion: When Timing Matters",
        summary: "Cold water immersion post-strength training blunts the hypertrophic response by reducing the inflammatory signals that drive muscle remodeling. Best used after endurance sessions, not strength sessions.",
        mechanism: "Cold immersion reduces muscle temperature, decreasing inflammatory cytokines (IL-6, TNF-alpha) and blunting satellite cell activation. For endurance sessions, this is net positive: faster perceived recovery, reduced DOMS, and lower sympathetic activation. For strength training designed to produce hypertrophy or neuromuscular adaptation, however, this same anti-inflammatory effect suppresses the very signals needed for adaptation.\n\nRecommendation: cold immersion within 30 minutes of Zone 2 rides or runs. For strength days, wait 6+ hours or avoid cold entirely.",
        citation: {
          text: "Roberts LA et al. (2015). Post-exercise cold water immersion attenuates acute anabolic signalling. J Physiol 593(18):4285-4301.",
          doi: "10.1113/JP270570",
        },
        kewt: "The Integrations page includes Apple Health integration to receive cold plunge and recovery activity logs. KEWT's recovery algorithm adjusts the following day's readiness score based on cold exposure timing relative to session type.",
      },
    ],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    icon: <Apple size={16} />,
    gradient: "linear-gradient(135deg, #1a3300 0%, #0f2200 100%)",
    bgColor: "#0f2200",
    eyebrow: "Protein · Fasting · Metabolic Health",
    title: "Nutrition and Metabolic Science",
    desc: "Evidence-based nutrition for a 58-year-old masters endurance athlete in a 12 lb weight loss phase. Protein timing, fasting physiology, carbohydrate periodization, and hydration.",
    cards: [
      {
        id: "protein-masters",
        icon: <Dumbbell size={18} />,
        iconBg: "linear-gradient(135deg, #14532d, #22c55e)",
        iconColor: "#4ade80",
        label: "Masters Protein",
        title: "Protein Requirements for Athletes Over 50",
        summary: "Masters athletes (50+) require 1.6-2.2g of protein per kg of body weight daily to offset anabolic resistance and preserve lean mass during weight loss. At 182 lbs, that is 132-181g/day.",
        mechanism: "Anabolic resistance describes the reduced ability of older muscle to respond to a given protein dose. Where a 30-year-old may maximally stimulate muscle protein synthesis with 20g of leucine-rich protein per meal, a 58-year-old requires closer to 35-40g per meal to achieve the same response. This is driven by reduced mTORC1 sensitivity and lower IGF-1 signaling.\n\nDistributing protein across 4 meals of 35-40g each outperforms 3 larger meals. Leucine-rich sources (whey, eggs, poultry, beef) are most effective. Casein before sleep provides a sustained overnight amino acid release aligned with GH pulsatility.",
        citation: {
          text: "Stokes T et al. (2018). Recent perspectives regarding the role of dietary protein for the promotion of muscle hypertrophy with resistance exercise training. Nutrients 10(2):180.",
          doi: "10.3390/nu10020180",
        },
        kewt: "Your Nutrition log in Daily Log tracks daily protein. The Dashboard insight card flags days below 150g as an amber alert. Protein targets adjust based on your active goals in the Goals section.",
      },
      {
        id: "fasting",
        icon: <Clock size={18} />,
        iconBg: "linear-gradient(135deg, #1c1917, #78716c)",
        iconColor: "#a8a29e",
        label: "Metabolic Fasting",
        title: "Fasting and Autophagy: The 18-Hour Threshold",
        summary: "Autophagy (cellular self-cleaning) is robustly upregulated at 18+ hours of fasting. Extended fasts beyond 24 hours represent deep autophagy activation.",
        mechanism: "Autophagy removes damaged organelles including dysfunctional mitochondria (mitophagy), misfolded proteins, and cellular debris. It is the biological basis of the mitophagy process depicted in the Blue Ember badge. Fasting-induced autophagy follows a non-linear curve: minimal upregulation at 12-14 hours, significant at 18-24 hours, and peak between 24-48 hours.\n\nBreaking a fast with protein and easily digestible carbohydrates stimulates mTOR, which shuts off autophagy and initiates rebuild. This post-fast anabolic window is optimal for a training session within 2-4 hours of refeeding.",
        citation: {
          text: "Alirezaei M et al. (2010). Short-term fasting induces profound neuronal autophagy. Autophagy 6(6):702-710.",
          doi: "10.4161/auto.6.6.12376",
        },
        kewt: "System Cleanse tracks your fast in real time, color-coding each metabolic phase as you progress. The ring timer shows your current autophagy status live.",
        kewtAction: { label: "Open System Cleanse", path: "/fasting" },
      },
      {
        id: "carb-periodization",
        icon: <Zap size={18} />,
        iconBg: "linear-gradient(135deg, #7f1d1d, #b91c1c)",
        iconColor: "#f87171",
        label: "Carb Strategy",
        title: "Carbohydrate Periodization for Endurance Athletes",
        summary: "Matching carbohydrate intake to session intensity and duration amplifies training adaptations by manipulating the ratio of fat to carbohydrate oxidation.",
        mechanism: "Training LOW (reduced pre-session carb availability) on easy Zone 2 days amplifies PGC-1alpha signaling and upregulates fat oxidation enzymes, enhancing metabolic flexibility. Training HIGH (carb-loaded) before and during intense sessions preserves glycolytic capacity and maximal performance.\n\nFor masters athletes in a fat-loss phase, strategic training-low sessions on Zone 2 days 2-3 times per week can accelerate the body composition changes without sacrificing performance on quality days. The key constraint: quality sessions (intervals, tempo, long rides above Zone 3) must always have carbohydrate support.",
        citation: {
          text: "Impey SG et al. (2018). Fuel for the work required: A theoretical framework for carbohydrate periodization. Sports Med 48(5):1031-1048.",
          doi: "10.1007/s40279-018-0867-7",
        },
        kewt: "KEWT's meal planning tab in Daily Log supports carb periodization by linking each day's nutrition context to the planned training session type. High-carb targets auto-populate before quality sessions. Training-low days are coded yellow.",
      },
      {
        id: "hydration",
        icon: <Activity size={18} />,
        iconBg: "linear-gradient(135deg, #0c4a6e, #0369a1)",
        iconColor: "#38bdf8",
        label: "Hydration",
        title: "2% Dehydration: Cognitive and Physical Impairment",
        summary: "A body water deficit of just 2% of body weight impairs endurance performance by 6-8% and reduces cognitive processing speed by 14%.",
        mechanism: "At 75kg (165 lbs), 2% dehydration equals roughly 1.5 liters of fluid loss — achievable in 45-60 minutes of intense exercise without replacing fluids. Cognitive impairment at this level affects decision-making during technical efforts and high-demand work alike.\n\nSodium co-ingestion (300-500mg/hour during endurance sessions over 60 minutes) reduces net fluid loss by stimulating thirst and reducing urine output. Sweat sodium concentration varies widely between athletes and can be estimated from post-session scale readings combined with fluid consumption tracking.",
        citation: {
          text: "Gopinathan PM et al. (1988). Role of dehydration in heat stress-induced variations in mental performance. Arch Environ Health 43(1):15-17.",
          doi: "10.1080/00039896.1988.9934367",
        },
        kewt: "KEWT's Daily Log includes a hydration tracker pre-loaded with a 3L daily target adjusted for session duration and outdoor temperature. Garmin integration pulls sweat rate estimates from supported running sessions.",
      },
    ],
  },
  {
    id: "mindbody",
    label: "Mind-Body",
    icon: <Brain size={16} />,
    gradient: "linear-gradient(135deg, #2d1b69 0%, #1a0e3f 100%)",
    bgColor: "#1a0e3f",
    eyebrow: "Breathwork · Reiki · Mindfulness",
    title: "Mind-Body Science",
    desc: "The emerging research behind vagal tone, biofield therapy, posture and cervical health, and mindfulness as physiological tools for the endurance athlete.",
    cards: [
      {
        id: "breathwork",
        icon: <Wind size={18} />,
        iconBg: "linear-gradient(135deg, #312e81, #6366f1)",
        iconColor: "#a5b4fc",
        label: "Vagal Tone",
        title: "Breathwork and the Vagal Brake",
        summary: "Slow diaphragmatic breathing at 4-6 breaths per minute directly stimulates the vagus nerve via the Hering-Breuer reflex, increasing parasympathetic tone and elevating HRV within minutes.",
        mechanism: "The vagus nerve is the primary pathway of the parasympathetic nervous system. Resonance frequency breathing (typically 5-6 breaths/min) entrains cardiovascular oscillations to the Mayer wave, producing maximal HRV amplitude. This 'coherence' state has been shown to reduce cortisol, improve cognitive performance, and accelerate recovery from exercise stress.\n\nPractical protocol: 4 seconds inhale through nose, 6 seconds exhale through pursed lips. 10 minutes pre-training reduces sympathetic overdrive and enhances focus. 10 minutes post-training or pre-sleep accelerates the cortisol decline.",
        citation: {
          text: "Lehrer PM & Gevirtz R (2014). Heart rate variability biofeedback: How and why does it work? Front Psychol 5:756.",
          doi: "10.3389/fpsyg.2014.00756",
        },
        kewt: "The Breathwork tab in Daily Log includes guided breathing sessions with real-time visual pacing. Blue Ember Wellness breathwork protocols are built in as named presets. Garmin HRV data the following morning serves as a biofeedback marker for session effectiveness.",
      },
      {
        id: "reiki",
        icon: <Star size={18} />,
        iconBg: "linear-gradient(135deg, #4c0519, #e11d48)",
        iconColor: "#fb7185",
        label: "Biofield Research",
        title: "Reiki and Biofield Therapy: The Evidence",
        summary: "Randomized controlled trials in clinical populations show Reiki reduces pain perception, cortisol levels, and anxiety compared to sham treatment. The mechanism involves autonomic nervous system modulation.",
        mechanism: "Reiki is classified as a 'biofield therapy' by the National Center for Complementary and Integrative Health. While the biofield mechanism is not yet fully characterized, measurable physiological responses include: reduction in salivary cortisol (consistent across 8 RCTs), reduction in anxiety (13 RCTs), and modulation of heart rate variability toward parasympathetic dominance.\n\nThe proposed mechanism involves gentle sensory input activating the touch-pressure pathway and the Merkel cell mechanoreceptors, triggering oxytocin release and vagal activation. Reiki sessions from Blue Ember Wellness serve as both recovery tools and a direct expression of the 'Healing From the Inside Out' philosophy.",
        citation: {
          text: "Thrane S & Cohen SM (2014). Effect of Reiki therapy on pain and anxiety in adults. Pain Manag Nurs 15(4):897-908.",
          doi: "10.1016/j.pmn.2013.07.008",
        },
        kewt: "Log Reiki sessions under the Mindfulness tab in Daily Log. KEWT tracks pre/post subjective recovery scores to build your personal dose-response relationship. Reiki days tend to show elevated HRV the following morning in practitioner-reported data.",
      },
      {
        id: "posture-cervical",
        icon: <AlertCircle size={18} />,
        iconBg: "linear-gradient(135deg, #7c2d12, #ea580c)",
        iconColor: "#fb923c",
        label: "Injury Recovery",
        title: "Posture, Forward Head Position, and Cervical Load",
        summary: "For every inch the head moves forward of neutral, the effective weight on the cervical spine increases by approximately 10 lbs. At 3 inches forward, a 12 lb head creates 42 lbs of cervical load.",
        mechanism: "Hansraj KK (2014) quantified the biomechanical forces on cervical musculature during forward head posture using finite element modeling. Prolonged cycling position (road bike aerobars) recreates chronic forward head posture — a direct risk factor for cervical and suboccipital strain.\n\nThe suboccipital muscles (rectus capitis posterior major/minor, obliquus capitis) are the most neurologically dense muscles in the body per square centimeter, with a direct fascial connection to the cervical dura. Suboccipital tension can produce symptoms including occipital neuralgia, visual disturbance, tension headache, and cervicogenic dizziness. Recovery protocol: cervical retraction exercises, chin tucks, suboccipital release work with a qualified practitioner.",
        citation: {
          text: "Hansraj KK (2014). Assessment of stresses in the cervical spine caused by posture and position of the head. Surg Technol Int 25:277-279.",
          doi: "10.1097/00132586-201501000-00050",
        },
        kewt: "Log neck mobility work under the Activity tab in Daily Log. The Goals page can track cervical mobility milestones as a recovery KPI. KEWT flags extended cycling sessions that may stress the cervical spine.",
      },
      {
        id: "mindfulness-cortisol",
        icon: <Brain size={18} />,
        iconBg: "linear-gradient(135deg, #134e4a, #0d9488)",
        iconColor: "#2dd4bf",
        label: "Stress Hormones",
        title: "Mindfulness Practice and Cortisol Reduction",
        summary: "8 weeks of Mindfulness-Based Stress Reduction (MBSR) reduces morning cortisol by 13% and blunts the cortisol awakening response, creating a more favorable anabolic-to-catabolic ratio.",
        mechanism: "The dorsolateral prefrontal cortex (dlPFC) exerts top-down inhibition on the hypothalamic-pituitary-adrenal (HPA) axis. Mindfulness practice thickens the dlPFC and strengthens its connectivity with the amygdala, reducing reactive cortisol spikes from perceived stressors. For athletes managing high-stakes professional demands, this is not just athletic performance leverage — it is career performance leverage.\n\nPractical minimum effective dose: 10 minutes of focused attention meditation daily. The effect on morning HRV is measurable within 4 weeks.",
        citation: {
          text: "Carlson LE et al. (2007). One year pre-post intervention follow-up of psychological, immune, endocrine, and blood pressure outcomes of mindfulness-based stress reduction. Brain Behav Immun 21(8):1038-1049.",
          doi: "10.1016/j.bbi.2007.04.002",
        },
        kewt: "Meditation and mindfulness sessions are logged in the Mindfulness tab of Daily Log. KEWT correlates logged practice with next-morning HRV trends over 30-day windows to surface your personal dose-response curve.",
      },
    ],
  },
  {
    id: "longevity",
    label: "Longevity",
    icon: <Shield size={16} />,
    gradient: "linear-gradient(135deg, #1a2a00 0%, #0d1f1f 100%)",
    bgColor: "#0d1f1f",
    eyebrow: "Masters Athletics · VO2max · Sarcopenia",
    title: "Longevity and Masters Athlete Science",
    desc: "The long game: VO2max as a mortality predictor, sarcopenia prevention, bone density in cyclists, and protocols for masters athlete recovery and performance.",
    cards: [
      {
        id: "vo2max-mortality",
        icon: <TrendingUp size={18} />,
        iconBg: "linear-gradient(135deg, #064e3b, #059669)",
        iconColor: "#34d399",
        label: "Longevity Predictor",
        title: "VO2max: The Most Powerful Mortality Predictor",
        summary: "Low cardiorespiratory fitness (VO2max below the 25th percentile) carries a greater mortality risk than smoking, hypertension, diabetes, and obesity combined.",
        mechanism: "Peter Attia's analysis of the CRF and mortality literature identifies VO2max as the single strongest predictor of all-cause mortality in healthy populations, with a hazard ratio of 5.04 between the lowest and highest fitness quintiles - surpassing all traditional risk factors.\n\nFor men aged 55-59, the 50th percentile VO2max is approximately 35 ml/kg/min. Elite-level fitness in this age group (75th percentile and above) is approximately 42+ ml/kg/min. Every 1 ml/kg/min increase in VO2max reduces all-cause mortality risk by approximately 3%. The best training intervention: a combination of Zone 2 volume and high-intensity intervals (VO2max intervals, e.g., 4x4 minutes at 90-95% max HR).",
        citation: {
          text: "Mandsager K et al. (2018). Association of cardiorespiratory fitness with long-term mortality among adults undergoing exercise treadmill testing. JAMA Netw Open 1(6):e183605.",
          doi: "10.1001/jamanetworkopen.2018.3605",
        },
        kewt: "Your estimated VO2max from Garmin (lactate threshold estimate method) appears on the Analytics page and is tracked longitudinally. Set a VO2max goal in the Goals section to track your target.",
      },
      {
        id: "sarcopenia",
        icon: <Dumbbell size={18} />,
        iconBg: "linear-gradient(135deg, #1e3a5f, #2563eb)",
        iconColor: "#60a5fa",
        label: "Muscle Preservation",
        title: "Sarcopenia Prevention: The 1% Per Year Rule",
        summary: "Adults lose 1-2% of muscle mass per year after age 50 without resistance training intervention. At 58, the cumulative effect is clinically significant and accelerates after 70 without prevention.",
        mechanism: "Sarcopenia is the age-related loss of skeletal muscle mass and function. The underlying mechanisms include reduced satellite cell activity, decreased motor unit recruitment, declining IGF-1 and testosterone, and reduced protein synthetic response to feeding (anabolic resistance).\n\nFor masters endurance athletes, there is an additional risk: high-volume endurance training without adequate strength work accelerates muscle mass loss by prioritizing oxidative fiber remodeling. The evidence-based prevention strategy: 2 resistance training sessions per week, heavy enough to recruit type II motor units (above 70% of 1RM), with high protein intake before and after.",
        citation: {
          text: "Cruz-Jentoft AJ et al. (2019). Sarcopenia: Revised European consensus on definition and diagnosis. Age Ageing 48(1):16-31.",
          doi: "10.1093/ageing/afy169",
        },
        kewt: "KEWT's Goals page tracks lean mass preservation as a priority metric alongside weight. Set a body composition goal to structure fat loss while preserving lean tissue through the combination of high protein intake, strength training, and strategic cardio.",
      },
      {
        id: "bone-density-cycling",
        icon: <Activity size={18} />,
        iconBg: "linear-gradient(135deg, #3b0764, #7c3aed)",
        iconColor: "#c4b5fd",
        label: "Bone Health",
        title: "Cyclists and Bone Density: A Hidden Risk",
        summary: "Competitive cyclists have significantly lower bone mineral density than age-matched runners and non-cyclists due to the non-weight-bearing nature of the sport. Masters cyclists face elevated osteoporosis risk.",
        mechanism: "Bone remodeling is driven by mechanical loading (Wolff's Law). Cycling provides cardiovascular stimulus but essentially no axial skeletal loading. Multiple studies show retired competitive cyclists have bone mineral density Z-scores equivalent to sedentary age-matched controls despite decades of elite fitness.\n\nFor cyclists, running and strength training are not just cross-training adjuncts — they are bone health interventions. Impact activities (running, jumping, hiking) create osteogenic mechanical signals cycling cannot replicate.",
        citation: {
          text: "Nichols JF et al. (2003). Bone mineral density in female high school athletes. J Pediatr 143(6):690-695. (Extended by) Rector RS et al. (2008). Comparisons of regional bone density in competitive cyclists. J Strength Cond Res 22(4):1332-1337.",
          doi: "10.1519/JSC.0b013e31816d496b",
        },
        kewt: "KEWT tracks your weekly impact activity volume (running + hiking minutes) as a bone-loading metric separate from cycling volume. A Running Volume goal can be set in the Goals section for bone density maintenance.",
      },
      {
        id: "neck-protocol",
        icon: <CheckCircle2 size={18} />,
        iconBg: "linear-gradient(135deg, #065f46, #10b981)",
        iconColor: "#6ee7b7",
        label: "Injury Recovery",
        title: "Cervical Injury Recovery Protocol for Cyclists",
        summary: "Post-whiplash cervical rehabilitation follows a structured 3-phase progression integrating progressive mobility work, aerodynamic position modification, and neural tension management.",
        mechanism: "Phase 1 (0-8 weeks): pain management, gentle ROM, isometric activation. Phase 2 (8-16 weeks): progressive loading, cervical stability, return to upright cycling. Phase 3 (16+ weeks): full athletic position, power training.\n\nRoad bike bar height should remain elevated above pre-injury position until full cervical extension and lateral flexion symmetry is restored. The long cervical flexor muscles (longus colli, longus capitis) need specific activation work not addressed by general neck stretching.",
        citation: {
          text: "Jull GA et al. (2008). Cervical musculoskeletal impairment in frequent intermittent headache. Part 1: Subjects with single headaches. Cephalalgia 28(8):793-802.",
          doi: "10.1111/j.1468-2982.2008.01608.x",
        },
        kewt: "Log mobility and rehabilitation sessions in Daily Log. Post-ride mobility check reminders can be set via Goals. Breathwork sessions from Blue Ember Wellness complement cervical recovery through vagal activation and tissue relaxation.",
      },
    ],
  },
];

// ── Science Page Component ────────────────────────────────────────────────────
// ── Science ticker headlines ─────────────────────────────────────────────────
const SCI_TICKER_FALLBACK = [
  { headline: "HRV & Recovery", body: "RMSSD-guided training outperforms traditional periodization by 15% in recreational athletes over 8 weeks (Buchheit 2014)." },
  { headline: "Fasted Training", body: "Fasted cycling for 6 weeks increases muscle fat oxidation by 21% - but rides over 75 min elevate cortisol and impair MPS (Van Proeyen 2011)." },
  { headline: "Training Load", body: "Acute:Chronic Workload Ratio above 1.5 increases injury risk by 2-4x across endurance athletes (Gabbett 2016)." },
  { headline: "Performance Management", body: "TSS-based periodization is the gold standard for quantified endurance training - target Form of +5 to +25 for peak race day (Coggan & Allen 2010)." },
  { headline: "Carbohydrate Timing", body: "Carb periodization improves 100km TT performance by 4.5% vs fixed-macro diets in trained cyclists (Burke et al., J Sports Sci 2011)." },
  { headline: "Respiratory Rate", body: "A rise of just 1 breath/min above your baseline precedes illness symptoms by 24-48 hours with r=0.71 correlation to training load (Matthews et al. 2022)." },
  { headline: "Circadian Temperature", body: "Distal skin temperature peaks 2 hours before sleep onset, driving heat dissipation and melatonin rise - validated to ±0.2°C (Haskell et al. 2021)." },
];


export default function SciencePage() {
  const [, navigate] = useHashLocation();
  const [activeTab, setActiveTab] = useState("training");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [tickerPaused, setTickerPaused] = useState(false);
  const [mitoOpen, setMitoOpen] = useState(false);
  const [tickerItems, setTickerItems] = useState<{ headline: string; body: string }[]>(SCI_TICKER_FALLBACK);

  // Drag-scroll refs
  const trackRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ active: boolean; startX: number; scrollX: number }>({ active: false, startX: 0, scrollX: 0 });

  // Inject CSS
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "kewt-science-css";
    el.textContent = SCIENCE_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("kewt-science-css")?.remove(); };
  }, []);

  // Fetch live ticker
  useEffect(() => {
    fetch("/api/science-ticker")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          setTickerItems(data.items);
        }
      })
      .catch(() => {});
  }, []);

  // Drag helpers - active only when paused
  const onDragStart = (clientX: number) => {
    if (!tickerPaused || !movingRef.current) return;
    const tx = parseFloat(movingRef.current.style.transform.replace("translateX(", "").replace("px)", "") || "0");
    dragState.current = { active: true, startX: clientX, scrollX: tx };
  };
  const onDragMove = (clientX: number) => {
    if (!dragState.current.active || !movingRef.current) return;
    const dx = clientX - dragState.current.startX;
    movingRef.current.style.transform = `translateX(${dragState.current.scrollX + dx}px)`;
  };
  const onDragEnd = () => { dragState.current.active = false; };

  const toggleTicker = () => {
    if (!tickerPaused) {
      if (movingRef.current) {
        const matrix = window.getComputedStyle(movingRef.current).transform;
        const tx = matrix !== "none" ? parseFloat(matrix.split(",")[4]) : 0;
        movingRef.current.style.animation = "none";
        movingRef.current.style.transform = `translateX(${tx}px)`;
      }
      setTickerPaused(true);
    } else {
      if (movingRef.current) {
        movingRef.current.style.animation = "";
        movingRef.current.style.transform = "";
      }
      dragState.current = { active: false, startX: 0, scrollX: 0 };
      setTickerPaused(false);
    }
  };

  const toggleCard = (id: string) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const domain = DOMAINS.find(d => d.id === activeTab) ?? DOMAINS[0];

  return (
    <>

      {/* ── Live Science Ticker ──────────────────────────────────── */}
      <div className="sci-ticker">
        <div
          className="sci-ticker-label"
          onClick={toggleTicker}
          style={{ cursor: "pointer" }}
          title={tickerPaused ? "Tap to resume" : "Tap to pause"}
        >
          <FlaskConical size={12} />
          <span>Science {tickerPaused ? "▶" : "⏸"}</span>
        </div>
        <div
          ref={trackRef}
          className={`sci-ticker-track${tickerPaused ? " sci-ticker-track--paused" : ""}`}
          onMouseDown={e => { e.preventDefault(); onDragStart(e.clientX); }}
          onMouseMove={e => onDragMove(e.clientX)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={e => onDragStart(e.touches[0].clientX)}
          onTouchMove={e => { e.preventDefault(); onDragMove(e.touches[0].clientX); }}
          onTouchEnd={onDragEnd}
        >
          <div ref={movingRef} className="sci-ticker-moving">
            {tickerItems.map((s, i) => (
              <span key={`a-${i}`} className="sci-ticker-item">
                <strong>{s.headline}:</strong>
                <span> {s.body}</span>
                <span className="sci-ticker-sep" />
              </span>
            ))}
            {tickerItems.map((s, i) => (
              <span key={`b-${i}`} className="sci-ticker-item">
                <strong>{s.headline}:</strong>
                <span> {s.body}</span>
                <span className="sci-ticker-sep" />
              </span>
            ))}
          </div>
        </div>
      </div>


      {/* Cinematic Hero — full-bleed, outside max-width wrapper */}
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 28 }}>
        <img
          src="/hero_science.jpg"
          alt=""
          className="kewt-cin-hero__img"
          style={{ objectPosition: "center 50%" }}
        />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(2,4,14)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#0ea5e9" }}>Blue Ember Intelligence · Evidence Base</div>
          <div className="kewt-cin-hero__title">The Science<br/>Behind <em style={{ color: "#10b981", fontStyle: "italic" }}>KEWT</em>.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#0ea5e9,#10b981)" }} />
          <div className="kewt-cin-hero__sub">HRV · Circadian · Mitochondria · Thermal</div>
        </div>
      </div>

      {/* ── Constrained content wrapper ─────────────────────────── */}
      <div className="sci-page">

      {/* ── Domain Tabs ───────────────────────────────────────────────────── */}
      <div className="sci-tabs">
        {DOMAINS.map(d => (
          <button
            key={d.id}
            className={`sci-tab${activeTab === d.id ? " sci-tab--active" : ""}`}
            onClick={() => setActiveTab(d.id)}
          >
            <span className="sci-tab-icon">{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>

      {/* ── Active Domain ─────────────────────────────────────────────────── */}
      <div className="sci-domain">

        {/* Domain header card */}
        <div
          className="sci-domain-header"
          style={{ background: domain.gradient }}
        >
          <div className="sci-domain-header-content">
            <div className="sci-domain-eyebrow">{domain.eyebrow}</div>
            <div className="sci-domain-title">{domain.title}</div>
            <div className="sci-domain-desc">{domain.desc}</div>
          </div>
        </div>

        {/* Research cards */}
        <div className="sci-grid">
          {domain.cards.map(card => {
            const isOpen = openCards.has(card.id);
            return (
              <div
                key={card.id}
                className={`sci-card${isOpen ? " sci-card--open" : ""}`}
                onClick={() => toggleCard(card.id)}
              >
                <div className="sci-card-top">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div
                      className="sci-card-icon-wrap"
                      style={{ background: card.iconBg }}
                    >
                      <span style={{ color: "#fff" }}>{card.icon}</span>
                    </div>
                    <div>
                      <div className="sci-card-label">{card.label}</div>
                      <div className="sci-card-title">{card.title}</div>
                    </div>
                  </div>
                  <div className="sci-card-toggle">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                <div className="sci-card-summary">{card.summary}</div>

                {isOpen && (
                  <div className="sci-card-drawer" onClick={e => e.stopPropagation()}>
                    {/* Mechanism */}
                    <div className="sci-mechanism">
                      {card.mechanism.split("\n\n").map((para, i) => (
                        <p key={i} style={{ marginBottom: i < card.mechanism.split("\n\n").length - 1 ? 10 : 0 }}>
                          {para}
                        </p>
                      ))}
                    </div>

                    {/* Citation */}
                    <div className="sci-citation">
                      <BookOpen size={14} className="sci-citation-icon" />
                      <div className="sci-citation-text">
                        <strong>Research:</strong> {card.citation.text}
                        <br />
                        <a
                          href={`https://doi.org/${card.citation.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sci-citation-link"
                          onClick={e => e.stopPropagation()}
                        >
                          DOI: {card.citation.doi} <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    {/* KEWT usage */}
                    <div className="sci-kewt-callout">
                      <div className="sci-kewt-callout-label">How KEWT Uses This</div>
                      <div className="sci-kewt-callout-body">{card.kewt}</div>
                      {(card as any).kewtAction && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate((card as any).kewtAction.path); }}
                          style={{
                            marginTop: 10,
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 16px",
                            fontSize: 12, fontWeight: 700,
                            background: "linear-gradient(135deg, #065f46, #047857)",
                            color: "#fff",
                            border: "none", borderRadius: 99,
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(6,95,70,0.3)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {(card as any).kewtAction.label} →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Longevity blueprint card */}
        {activeTab === "longevity" && (
          <div className="sci-mark-card" style={{ marginTop: 24 }}>
            <div className="sci-mark-header">
              <div className="sci-mark-avatar"><Shield size={16} /></div>
              <div>
                <div className="sci-mark-label">Masters Athlete Blueprint</div>
                <div className="sci-mark-name">Evidence-Based Longevity Protocol</div>
              </div>
            </div>
            <div className="sci-mark-items">
              {[
                "Track your goals and targets in the Goals section",
                "VO2max: monitor Garmin estimate trends on the Analytics page",
                "Running: 3x/week, progressing pace at aerobic threshold (Zone 3)",
                "Cycling: 2-3x/week, Zone 2 base with ACWR-managed load",
                "Strength: 2x/week, heavy compound lifts for sarcopenia prevention and running economy",
                "Protein: 1.8-2.2g/kg bodyweight daily, distributed across meals",
                "Recovery: 7-8h sleep, breathwork pre/post key sessions, bodywork as available",
              ].map((item, i) => (
                <div key={i} className="sci-mark-item">
                  <div className="sci-mark-item-dot" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BEI Callout footer ────────────────────────────────────────────── */}
      {/* Mitophagy Collapsible Card */}
      <div style={{ padding: "0 var(--page-pad) 16px", maxWidth: "var(--page-max)", margin: "0 auto" }}>
        <button
          onClick={() => setMitoOpen(o => !o)}
          style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        >
          <div className="sci-mitophagy-banner" style={{ marginBottom: 0 }}>
            <img src="./bew_mitophagy.png" alt="Mitophagy" className="sci-mitophagy-img" />
            <div className="sci-mitophagy-content">
              <div className="sci-mitophagy-label">Blue Ember Intelligence · Cellular Renewal</div>
              <div className="sci-mitophagy-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>Mitophagy: Renewal From Within</span>
                <span style={{ transition: "transform 200ms", display: "inline-block", transform: mitoOpen ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>
                  <ChevronDown size={18} />
                </span>
              </div>
            </div>
          </div>
        </button>
        {mitoOpen && (
          <div className="sci-mitophagy-banner" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 0 20px 20px", marginTop: 0, paddingTop: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="sci-mitophagy-body">
                Mitophagy is the selective autophagy of damaged mitochondria, the cellular
                power plants that decline with age and accumulate oxidative damage. The Blue Ember
                philosophy of "Healing From the Inside Out" begins here: at the mitochondrial level.
                <em className="ki">KEWT</em>'s program design maximizes mitophagic stimulus through Zone 2 training, strategic fasting, and sleep protection.
              </div>
              <div className="sci-mitophagy-stats" style={{ marginTop: 16 }}>
                <div className="sci-mitophagy-stat"><div className="sci-mitophagy-stat-val">18h+</div><div className="sci-mitophagy-stat-label">Fasting threshold</div></div>
                <div className="sci-mitophagy-stat"><div className="sci-mitophagy-stat-val">Zone 2</div><div className="sci-mitophagy-stat-label">Primary stimulus</div></div>
                <div className="sci-mitophagy-stat"><div className="sci-mitophagy-stat-val">N3</div><div className="sci-mitophagy-stat-label">Sleep phase</div></div>
                <div className="sci-mitophagy-stat"><div className="sci-mitophagy-stat-val">58yo</div><div className="sci-mitophagy-stat-label">Highest leverage</div></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 var(--page-pad) 20px", maxWidth: "var(--page-max)", margin: "0 auto" }}>
        <div className="bei-callout">
          <div className="bei-callout-header">
            <div className="bei-callout-flame">
              <FlaskConical size={14} style={{ color: "#fff" }} />
            </div>
            <div>
              <div className="bei-callout-label">Blue Ember Intelligence</div>
              <div className="bei-callout-title">Evidence-First Coaching</div>
            </div>
          </div>
          <div className="bei-callout-body">
            Every <em className="ki">KEWT</em> recommendation links back to the peer-reviewed literature in this library.
            As your data accumulates, Blue Ember Intelligence surfaces personalized insights,
            flagging when your real-world HRV, sleep, weight, and training load patterns match
            or contradict the research, and adjusts your plan accordingly. Science is the map.
            You are the territory.
          </div>
        </div>
      </div>

      </div>{/* end sci-page */}
    </>
  );
}
