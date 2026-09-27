import React, { useEffect, useState, useRef } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { localToday, localDate, fmtLocalDate, daysUntil } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Activity, Scale, Zap, Heart, TrendingUp, Flame, Wind, Target,
  ArrowDown, ArrowUp, Sparkles, Check, Pencil, Moon, Footprints,
  BatteryCharging, Brain, MapPin, TrendingDown, Timer, Gauge, Cpu
} from "lucide-react";

// ─────────────────────────────────────────────
// CSS Injection
// ─────────────────────────────────────────────
const DASH_CSS = `
  @keyframes dash-fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dash-pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.7); }
  }
  @keyframes dash-ring-draw {
    from { stroke-dashoffset: 276.46; }
  }
  @keyframes dash-ring-pulse {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(16,185,129,0.5)); }
    50%       { filter: drop-shadow(0 0 20px rgba(16,185,129,0.85)); }
  }
  @keyframes dash-flame-flicker {
    0%, 100% { text-shadow: 0 0 8px rgba(251,146,60,0.6); }
    50%       { text-shadow: 0 0 20px rgba(251,146,60,1), 0 0 40px rgba(251,146,60,0.4); }
  }
  @keyframes dash-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes dash-orb-float {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(-6px) scale(1.04); }
  }

  .dash-page {
    min-height: 100vh;
    background: var(--color-bg, hsl(36 20% 97%));
    padding: 0 0 60px;
    font-family: 'Inter', var(--font-sans, system-ui, sans-serif);
  }
  .dash-inner {
    max-width: var(--page-max, 1120px);
    margin: 0 auto;
    padding: 0 var(--page-pad, 28px);
  }

  /* ── Hero ── */
  .dash-hero {
    margin-bottom: 20px;
    animation: dash-fadeSlideUp 0.5s ease both;
  }
  /* KEWT full name — true H1, dominant */
  .dash-kewt-h1 {
    font-size: clamp(28px, 4.5vw, 52px);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: #111827;
    margin-bottom: 6px;
  }
  [data-theme="dark"] .dash-kewt-h1 { color: #f9fafb; }
  /* Blue Ember Intelligence — H2 powered-by line */
  .dash-bei-title {
    font-size: clamp(13px, 1.6vw, 17px);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.3;
    color: #6b7280;
    margin-bottom: 14px;
  }
  [data-theme="dark"] .dash-bei-title { color: #9ca3af; }
  .dash-bei-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f59e0b;
    margin-bottom: 14px;
  }
  .dash-bei-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245,158,11,0.8);
    animation: dash-pulse-dot 1.8s ease infinite;
  }
  /* Good morning — demoted to warm secondary greeting */
  .dash-greeting {
    font-size: clamp(17px, 2vw, 22px);
    font-weight: 500;
    color: #6b7280;
    letter-spacing: -0.01em;
    line-height: 1.3;
    margin-bottom: 4px;
  }
  .dash-subtitle {
    font-size: 13px;
    font-weight: 500;
    color: #9ca3af;
    letter-spacing: 0.01em;
    margin-bottom: 18px;
  }
  .dash-pulse-strip {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dash-pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: dash-pulse-dot 2s ease infinite;
  }
  .dash-pulse-dot--green  { background: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.7); animation-delay: 0s; }
  .dash-pulse-dot--blue   { background: #3b82f6; box-shadow: 0 0 6px rgba(59,130,246,0.7); animation-delay: 0.4s; }
  .dash-pulse-dot--emerald{ background: #06b6d4; box-shadow: 0 0 6px rgba(6,182,212,0.7);  animation-delay: 0.8s; }
  .dash-pulse-label {
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  /* ── KPI Grid ── */
  .dash-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .dash-card {
    background: var(--color-surface, #ffffff);
    border-radius: 14px;
    padding: 14px 14px 14px;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04);
    position: relative;
    overflow: hidden;
    animation: dash-fadeSlideUp 0.5s ease both;
    animation-delay: calc(var(--dash-i, 0) * 80ms);
  }
  .dash-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 16px 16px 0 0;
    background: var(--dash-top-gradient, linear-gradient(90deg, #10b981, #3b82f6));
  }

  .dash-card-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .dash-card-value {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--color-text, #111827);
    font-family: 'Inter', var(--font-sans, system-ui, sans-serif);
    line-height: 1.1;
    display: flex;
    align-items: baseline;
    gap: 3px;
  }
  .dash-card-unit {
    font-size: 14px;
    font-weight: 500;
    color: #9ca3af;
    letter-spacing: 0;
  }
  .dash-card-delta {
    font-size: 12px;
    font-weight: 600;
    margin-top: 6px;
  }
  .dash-delta-good  { color: #10b981; }
  .dash-delta-warn  { color: #f59e0b; }
  .dash-delta-muted { color: #9ca3af; }

  /* days-left card */
  .dash-days-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 4px;
  }

  /* streak badges */
  .dash-streak-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 700;
    color: #f97316;
    background: rgba(249,115,22,0.08);
    border: 1px solid rgba(249,115,22,0.15);
    border-radius: 8px;
    padding: 4px 10px;
    animation: dash-flame-flicker 2.5s ease infinite;
  }
  .dash-streak-badge + .dash-streak-badge {
    margin-top: 6px;
  }
  .dash-streak-col {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 6px;
  }

  /* ── Charts Grid ── */
  .dash-charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  /* ── Daily Readiness Card ── */
  .rd-signal-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }
  .rd-signal-bar {
    flex: 1;
    height: 4px;
    border-radius: 4px;
    background: rgba(0,0,0,0.07);
    overflow: hidden;
  }
  .rd-signal-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.9s cubic-bezier(0.16,1,0.3,1);
  }
  .rd-signal-label {
    font-size: 10px;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    width: 68px;
    flex-shrink: 0;
  }
  .rd-signal-val {
    font-size: 11px;
    font-weight: 700;
    width: 38px;
    text-align: right;
    flex-shrink: 0;
  }
  /* ── Contextual Coach Line ── */
  .dash-coach-line {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 14px;
    background: var(--color-surface, #fff);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #111827);
    line-height: 1.4;
    animation: dash-fadeSlideUp 0.4s ease both;
    animation-delay: 80ms;
  }
  .dash-coach-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    animation: dash-pulse-dot 2s ease infinite;
  }
  /* ── Live Fasting Timer Card ── */
  .dash-fast-card {
    background: linear-gradient(135deg, #0c4a6e 0%, #075985 100%);
    border-radius: 14px;
    padding: 14px 14px 13px;
    border: none;
    box-shadow: 0 4px 18px rgba(12,74,110,0.25);
    position: relative;
    overflow: hidden;
    animation: dash-fadeSlideUp 0.5s ease both;
  }
  .dash-fast-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 16px 16px 0 0;
    background: linear-gradient(90deg, #f59e0b, #f97316);
  }
  .dash-fast-label {
    font-size: 11px;
    font-weight: 700;
    color: rgba(186,230,253,0.75);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .dash-fast-timer {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: #fff;
    line-height: 1;
    font-family: 'Inter', var(--font-sans, system-ui, sans-serif);
  }
  .dash-fast-zone {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 7px;
    padding: 3px 9px;
    border-radius: 20px;
    background: rgba(255,255,255,0.12);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .dash-fast-progress {
    margin-top: 10px;
    height: 4px;
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    overflow: hidden;
  }
  .dash-fast-progress-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, #f59e0b, #f97316);
    transition: width 1s linear;
  }

  /* ── Body Composition Card ── */
  .bc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 10px;
    margin-top: 6px;
  }
  .bc-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .bc-item-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #9ca3af;
  }
  .bc-item-value {
    font-size: 14px;
    font-weight: 800;
    color: var(--color-text, #111827);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .bc-item-unit {
    font-size: 10px;
    font-weight: 500;
    color: #9ca3af;
    margin-left: 2px;
  }
  .bc-score-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    margin-top: 4px;
  }

  /* Key Insights card spans full width and is centered */
  .dash-chart-card--insights {
    grid-column: 1 / -1;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }
  .dash-chart-card {
    background: var(--color-surface, #ffffff);
    border-radius: 14px;
    padding: 14px 14px 12px;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    animation: dash-fadeSlideUp 0.5s ease both;
    animation-delay: calc(var(--dash-i, 0) * 80ms);
  }
  .dash-chart-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* insights glassmorphism */
  .dash-insight-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(59,130,246,0.04) 100%);
    border: 1px solid rgba(16,185,129,0.15);
    border-left: 3px solid #10b981;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    line-height: 1.45;
    backdrop-filter: blur(6px);
  }
  /* Dark mode: the translucent emerald surface sits over the dark page bg,
     so the slate body color reads as black on near-black. Flip to white so
     the insight text stays readable while the card surface, emerald border,
     and accent strip remain unchanged. */
  [data-theme='dark'] .dash-insight-card { color: #fff; }
  .dash-insight-card:last-child { margin-bottom: 0; }

  /* ── Goals ── */
  .dash-section-title {
    font-size: 16px;
    font-weight: 800;
    color: var(--color-text, #111827);
    font-family: 'Inter', var(--font-sans, system-ui, sans-serif);
    letter-spacing: -0.02em;
    margin-bottom: 14px;
    animation: dash-fadeSlideUp 0.5s ease both;
  }
  .dash-goals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }
  .dash-goal-card {
    background: var(--color-surface, #ffffff);
    border-radius: 12px;
    padding: 14px 12px 12px;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    animation: dash-fadeSlideUp 0.5s ease both;
    animation-delay: calc(var(--dash-i, 0) * 80ms);
  }
  .dash-goal-label {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 10px;
  }
  .dash-goal-current {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--color-text, #111827);
    font-family: 'Inter', var(--font-sans, system-ui, sans-serif);
  }
  .dash-goal-target {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
    margin-top: 2px;
    margin-bottom: 12px;
  }
  .dash-goal-bar-track {
    width: 100%;
    height: 4px;
    background: rgba(0,0,0,0.06);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 4px;
  }
  .dash-goal-bar-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #10b981, #3b82f6);
    transition: width 1s cubic-bezier(0.16,1,0.3,1);
  }
  .dash-goal-pct {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    margin-top: 6px;
  }

  /* ── Empty states ── */
  .dash-empty {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 10px;
  }
  .dash-empty::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 70%);
    border-radius: 10px;
  }
  .dash-empty-text {
    font-size: 13px;
    font-style: italic;
    color: #9ca3af;
    font-weight: 500;
    z-index: 1;
    text-align: center;
    padding: 8px;
  }

  /* ── Recovery ring glow on high score ── */
  .dash-ring-excellent {
    animation: dash-ring-pulse 2.5s ease infinite;
  }

  /* ── Weather Ticker ── */
  @keyframes wx-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .wx-ticker {
    display: flex;
    align-items: center;
    height: 36px;
    overflow: hidden;
    position: relative;
    background: hsl(214 80% 20% / 0.06);
    border-bottom: 1px solid hsl(214 80% 20% / 0.12);
  }
  .wx-ticker::after {
    content: '';
    position: absolute; top: 0; bottom: 0; right: 0;
    width: 48px;
    background: linear-gradient(to left, var(--color-bg), transparent);
    z-index: 2; pointer-events: none;
  }
  .wx-ticker-label {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 14px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-primary);
    white-space: nowrap;
    flex-shrink: 0;
    border-right: 1px solid hsl(214 80% 20% / 0.12);
    z-index: 1;
    background: var(--color-bg);
  }
  .wx-ticker-track {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  .wx-ticker-moving {
    display: flex;
    align-items: center;
    width: max-content;
    animation: wx-scroll 38s linear infinite;
  }

  .wx-ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 22px;
    font-size: 12px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .wx-ticker-item strong { color: var(--color-text); font-weight: 700; }
  .wx-ticker-sep {
    display: inline-block;
    width: 3px; height: 3px;
    border-radius: 50%;
    background: var(--color-ember);
    margin-left: 22px;
    opacity: 0.6;
  }
  .wx-ticker-wrap {
    display: flex;
    flex-direction: column;
  }
  .wx-expanded {
    background: var(--color-surface, #fff);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    padding: 14px 20px;
    animation: wx-slide-down 200ms ease;
  }
  @keyframes wx-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .wx-expanded-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px 20px;
  }
  .wx-expanded-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wx-expanded-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  .wx-expanded-val {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.2;
  }
  .wx-expanded-key {
    font-size: 11px;
    color: var(--color-text-muted);
    font-weight: 500;
    margin-top: 1px;
  }
  .wx-expanded-link {
    cursor: pointer;
  }
  .wx-expanded-link:hover .wx-expanded-val {
    text-decoration: underline;
  }

  /* ── Daily Intelligence card ───────────────────────────────────────────
     Synthesizes existing daily signals (sleep, recent move, fasting,
     recovery, weight) into Insight / Watch / Recovery Action / Fuel Watch
     sections. Theme-aware: warm linen surface in light, deep slate in dark,
     with a thin teal left rail and amber subheads. */
  .dash-di {
    position: relative;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.06);
    border-left: 3px solid #14b8a6;
    border-radius: 16px;
    padding: 16px 18px;
    margin-bottom: 12px;
  }
  [data-theme='dark'] .dash-di {
    background: #15171c;
    border-color: rgba(255,255,255,0.06);
    border-left-color: #2dd4bf;
  }
  .dash-di-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    color: #d97706; margin-bottom: 4px;
  }
  [data-theme='dark'] .dash-di-title { color: #fbbf24; }
  .dash-di-summary {
    font-size: 11px; color: #6b7280; margin-bottom: 12px; line-height: 1.5;
  }
  [data-theme='dark'] .dash-di-summary { color: rgba(255,255,255,0.65); }
  .dash-di-section + .dash-di-section { margin-top: 10px; }
  .dash-di-section {
    padding: 10px 12px;
    background: rgba(20,184,166,0.06);
    border-radius: 10px;
  }
  [data-theme='dark'] .dash-di-section { background: rgba(45,212,191,0.07); }
  .dash-di-sub {
    font-size: 10px; font-weight: 800; letter-spacing: 0.10em; text-transform: uppercase;
    color: #d97706; margin-bottom: 5px;
  }
  [data-theme='dark'] .dash-di-sub { color: #fbbf24; }
  .dash-di-text {
    font-size: 13px; line-height: 1.5; color: #1f2937;
  }
  [data-theme='dark'] .dash-di-text { color: #f1f5f9; }
  .dash-di-empty {
    font-size: 12px; color: #6b7280; line-height: 1.5; padding: 6px 0 0;
  }
  [data-theme='dark'] .dash-di-empty { color: rgba(255,255,255,0.62); }

  /* ── Collapsible accordion rows (Phase 1) ─────────────────────────────
     Wraps existing .dash-card content unchanged. The row owns the chrome
     (border, shadow, top-gradient accent); the inner card's own chrome is
     neutralized via .dash-collapse-body-inner > .dash-card overrides below. */
  .dash-accordion {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  .dash-collapse-row {
    background: var(--color-surface, #ffffff);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    animation: dash-fadeSlideUp 0.5s ease both;
    animation-delay: calc(var(--dash-i, 0) * 60ms);
  }
  .dash-collapse-row::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--dash-top-gradient, linear-gradient(90deg, #10b981, #3b82f6));
    z-index: 1;
  }
  .dash-collapse-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    user-select: none;
    position: relative;
    z-index: 2;
  }
  .dash-collapse-icon {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.045);
  }
  [data-theme='dark'] .dash-collapse-icon { background: rgba(255,255,255,0.06); }
  .dash-collapse-titles { flex: 1; min-width: 0; }
  .dash-collapse-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text, #111827);
    letter-spacing: -0.01em;
  }
  .dash-collapse-summary {
    font-size: 12px;
    color: var(--color-text-muted, #9ca3af);
    margin-top: 2px;
    line-height: 1.3;
  }
  .dash-collapse-chevron {
    width: 18px;
    height: 18px;
    color: var(--color-text-faint, #9ca3af);
    transition: transform 0.25s ease;
    flex: 0 0 auto;
  }
  .dash-collapse-row.is-open .dash-collapse-chevron { transform: rotate(180deg); }
  .dash-collapse-body-wrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.28s cubic-bezier(0.16,1,0.3,1);
  }
  .dash-collapse-row.is-open .dash-collapse-body-wrap { grid-template-rows: 1fr; }
  .dash-collapse-body-inner { overflow: hidden; }
  .dash-collapse-body-inner > .dash-card {
    border: none;
    border-radius: 0;
    box-shadow: none;
    margin: 0;
    padding: 0 16px 16px;
    animation: none;
  }
  .dash-collapse-body-inner > .dash-card::before { display: none; }
`;

// ─────────────────────────────────────────────
// Collapsible accordion row (Phase 1)
// ─────────────────────────────────────────────
// Persists open/closed state per row in localStorage so the dashboard
// remembers what the person left open or closed between sessions. This is
// per-device (browser-local) persistence; syncing this across devices via
// Supabase is a small, separate follow-up if it's ever wanted.
const COLLAPSE_STORAGE_KEY = "kewt-dashboard-collapse-v1";

function useCollapseState(defaults: Record<string, boolean> = {}) {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });

  const toggle = (id: string) => {
    setState(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // non-fatal — state just won't persist this session
      }
      return next;
    });
  };

  return { state, toggle };
}

function CollapsibleRow({
  id, icon, label, summary, open, onToggle, gradient, children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  gradient?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`dash-collapse-row ${open ? "is-open" : ""}`}
      data-testid={`collapse-row-${id}`}
      style={gradient ? ({ "--dash-top-gradient": gradient } as any) : undefined}
    >
      <div
        className="dash-collapse-header"
        onClick={onToggle}
        role="button"
        aria-expanded={open}
        data-testid={`collapse-toggle-${id}`}
      >
        <div className="dash-collapse-icon">{icon}</div>
        <div className="dash-collapse-titles">
          <div className="dash-collapse-label">{label}</div>
          {!open && <div className="dash-collapse-summary">{summary}</div>}
        </div>
        <svg className="dash-collapse-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div className="dash-collapse-body-wrap">
        <div className="dash-collapse-body-inner">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function RecoveryGauge({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color =
    score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const glowStr =
    score >= 70
      ? "0 0 20px rgba(16,185,129,0.5)"
      : score >= 45
      ? "0 0 20px rgba(245,158,11,0.4)"
      : "0 0 16px rgba(239,68,68,0.4)";
  const label =
    score >= 70 ? "Ready" : score >= 45 ? "Moderate" : "Rest Day";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        className={`${score >= 70 ? "dash-ring-excellent" : ""} dash-ring-mobile-sm`.trim()}
        style={{ width: 110, height: 110 }}
      >
        <svg
          viewBox="0 0 100 100"
          width="110"
          height="110"
          style={{ filter: `drop-shadow(${glowStr})` }}
        >
          {/* outer track */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" />
          {/* filled arc */}
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{
              transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)",
              animation: "dash-ring-draw 1.4s cubic-bezier(0.16,1,0.3,1) both",
            }}
          />
          <text x="50" y="54" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
            {score}
          </text>
        </svg>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
    </div>
  );
}

function GoalRing({ pct, color }: { pct: number; color: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg viewBox="0 0 100 100" width="90" height="90" style={{ display: "block", margin: "0 auto 6px" }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────
// Live Fasting Timer sub-component
// ─────────────────────────────────────────────
function LiveFastingTimer({ activeFast }: {
  activeFast: {
    id: number;
    startedAt: string;
    elapsedHours: number;
    fuelZone: string;
    fuelZoneColor: string;
    targetHours: number | null;
  };
}) {
  const [elapsed, setElapsed] = React.useState(() => {
    return (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
  });

  React.useEffect(() => {
    const iv = setInterval(() => {
      setElapsed((Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000);
    }, 1000);
    return () => clearInterval(iv);
  }, [activeFast.startedAt]);

  const totalSeconds = elapsed * 3600;
  const hrs  = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const display = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const fuelZoneColor = (
    elapsed < 8  ? "#6b7280" :
    elapsed < 12 ? "#f59e0b" :
    elapsed < 16 ? "#f97316" :
    elapsed < 20 ? "#10b981" : "#8b5cf6"
  );
  const fuelZone = (
    elapsed < 8  ? "Glycolytic" :
    elapsed < 12 ? "Transitional" :
    elapsed < 16 ? "Fat-Dominant" :
    elapsed < 20 ? "Deep Fat Oxidation" : "Extended Fast"
  );

  const targetHrs = activeFast.targetHours || 16;
  const pct = Math.min(100, Math.round((elapsed / targetHrs) * 100));

  const [, navigate] = useHashLocation();

  return (
    <div
      className="dash-fast-card"
      data-testid="card-fasting-timer"
      onClick={() => { navigate("/fasting"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      style={{ cursor: "pointer" }}
    >
      <div className="dash-fast-label">
        <Timer size={11} /> Active Fast
      </div>
      <div className="dash-fast-timer">{display}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <span className="dash-fast-zone" style={{ color: fuelZoneColor }}>
          {fuelZone}
        </span>
      </div>
      <div className="dash-fast-progress">
        <div className="dash-fast-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ marginTop: 5, fontSize: 10, fontWeight: 600, color: "rgba(186,230,253,0.55)", letterSpacing: "0.04em" }}>
        {pct}% to {targetHrs}h target
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Daily Readiness Signal Breakdown
// ─────────────────────────────────────────────
function ReadinessSignals({ rd }: {
  rd: {
    hrv: number | null;
    sleepScore: number | null;
    restingHr: number | null;
    bodyBattery: number | null;
    composite: number;
    label: string;
    color: string;
  };
}) {
  const signals: { key: string; label: string; value: number | null; pct: number; unit: string; color: string }[] = [
    {
      key: "hrv",
      label: "HRV",
      value: rd.hrv,
      pct: rd.hrv !== null ? Math.min(100, Math.round((rd.hrv / 60) * 100)) : 0,
      unit: "ms",
      color: rd.hrv !== null ? (rd.hrv >= 50 ? "#10b981" : rd.hrv >= 35 ? "#f59e0b" : "#ef4444") : "#e5e7eb",
    },
    {
      key: "sleep",
      label: "Sleep",
      value: rd.sleepScore,
      pct: rd.sleepScore !== null ? rd.sleepScore : 0,
      unit: "/100",
      color: rd.sleepScore !== null ? (rd.sleepScore >= 80 ? "#6366f1" : rd.sleepScore >= 60 ? "#f59e0b" : "#ef4444") : "#e5e7eb",
    },
    {
      key: "rhr",
      label: "Rest HR",
      value: rd.restingHr,
      pct: rd.restingHr !== null ? Math.max(0, Math.round(((80 - rd.restingHr) / 30) * 100)) : 0,
      unit: "bpm",
      color: rd.restingHr !== null ? (rd.restingHr <= 55 ? "#10b981" : rd.restingHr <= 65 ? "#f59e0b" : "#ef4444") : "#e5e7eb",
    },
    {
      key: "battery",
      label: "Battery",
      value: rd.bodyBattery,
      pct: rd.bodyBattery !== null ? Math.min(100, Math.round((rd.bodyBattery / 60) * 100)) : 0,
      unit: "pts",
      color: rd.bodyBattery !== null ? (rd.bodyBattery >= 50 ? "#10b981" : rd.bodyBattery >= 30 ? "#f59e0b" : "#ef4444") : "#e5e7eb",
    },
  ];

  const hasAnyData = signals.some(s => s.value !== null);

  if (!hasAnyData) {
    return (
      <div style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 6, lineHeight: 1.5 }}>
        Log sleep to activate readiness signals.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {signals.map(sig => (
        <div key={sig.key} className="rd-signal-row">
          <span className="rd-signal-label">{sig.label}</span>
          <div className="rd-signal-bar">
            <div
              className="rd-signal-fill"
              style={{ width: `${sig.pct}%`, background: sig.color }}
            />
          </div>
          <span className="rd-signal-val" style={{ color: sig.value !== null ? sig.color : "#d1d5db" }}>
            {sig.value !== null ? `${sig.value}${sig.unit}` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatPace(decimalMins: number): string {
  const mins = Math.floor(decimalMins);
  const secs = Math.round((decimalMins - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const ARC_META: Record<string, { label: string; unit: string; metricLabel: string; color: string }> = {
  running:    { label: "Kinetic Pace Arc",     unit: "min/mi",    metricLabel: "Pace",     color: "#f97316" },
  walking:    { label: "Kinetic Pace Arc",     unit: "min/mi",    metricLabel: "Pace",     color: "#10b981" },
  hiking:     { label: "Kinetic Pace Arc",     unit: "min/mi",    metricLabel: "Pace",     color: "#84cc16" },
  rucking:    { label: "Kinetic Pace Arc",     unit: "min/mi",    metricLabel: "Pace",     color: "var(--color-text-faint)" },
  cycling:    { label: "Kinetic Speed Arc",    unit: "mph",       metricLabel: "Speed",    color: "#3b82f6" },
  swimming:   { label: "Kinetic Pace Arc",     unit: "min/100m",  metricLabel: "Pace",     color: "#06b6d4" },
  strength:   { label: "Kinetic Volume Arc",   unit: "min",       metricLabel: "Duration", color: "#8b5cf6" },
  yoga:       { label: "Kinetic Volume Arc",   unit: "min",       metricLabel: "Duration", color: "#ec4899" },
  breathwork: { label: "Kinetic Volume Arc",   unit: "min",       metricLabel: "Duration", color: "#14b8a6" },
  other:      { label: "Kinetic Arc",          unit: "min",       metricLabel: "Duration", color: "var(--color-text-faint)" },
};

// Tooltip styles - color pinned dark so the recharts tooltip stays readable
// in dark theme (the white surface is intentional and does not flip with theme).
const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  fontWeight: 600,
  color: "#111827",
};

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Weather Ticker
// ─────────────────────────────────────────────

const WMO_LABELS: Record<number, string> = {
  0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Fog", 48: "Icy Fog",
  51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
  71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
  80: "Showers", 81: "Rain Showers", 82: "Heavy Showers",
  95: "Thunderstorm", 99: "Hail Storm",
};

function wxIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code <= 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 65) return "🌧️";
  if (code <= 75) return "❄️";
  if (code <= 82) return "🌦️";
  return "⚡";
}

function windDir(deg: number): string {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

interface WxData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDeg: number;
  code: number;
  high: number;
  low: number;
  city: string;
  uvIndex: number;
  visibility: number; // km
  precipitation: number; // mm
}

// Richmond, VA 23220
const WX_LAT = 37.5407;
const WX_LON = -77.4360;
const WX_CITY = "Richmond, VA";

function useWeather() {
  const [wx, setWx] = useState<WxData | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${WX_LAT}&longitude=${WX_LON}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index,visibility,precipitation` +
          `&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`
        );
        const json = await res.json();
        const c = json.current;
        const d = json.daily;
        setWx({
          temp: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          humidity: Math.round(c.relative_humidity_2m),
          windSpeed: Math.round(c.wind_speed_10m),
          windDeg: c.wind_direction_10m,
          code: c.weather_code,
          high: Math.round(d.temperature_2m_max[0]),
          low: Math.round(d.temperature_2m_min[0]),
          city: WX_CITY,
          uvIndex: Math.round(c.uv_index ?? 0),
          visibility: Math.round((c.visibility ?? 10000) / 1000 * 0.621), // km → miles
          precipitation: c.precipitation ?? 0,
        });
      } catch {}
    })();
  }, []);
  return wx;
}

function uvLabel(uv: number) {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}

function WeatherTicker() {
  const wx = useWeather();
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Always render the bar — show loading state until wx resolves
  const icon = wx ? wxIcon(wx.code) : "🌡️";
  const label = wx ? (WMO_LABELS[wx.code] ?? "") : "";

  const items: React.ReactNode[] = wx ? [
    <><strong>{icon} {wx.city}</strong></>,
    <><strong>{wx.temp}°F</strong><span> · feels {wx.feelsLike}°F</span></>,
    <><strong>H {wx.high}° / L {wx.low}°</strong></>,
    <><strong>{label}</strong></>,
    <><strong>Humidity</strong><span> {wx.humidity}%</span></>,
    <><strong>Wind</strong><span> {wx.windSpeed} mph {windDir(wx.windDeg)}</span></>,
  ] : [
    <><strong>Richmond, VA</strong><span> · loading weather...</span></>,
    <><strong>Richmond, VA</strong><span> · loading weather...</span></>,
    <><strong>Richmond, VA</strong><span> · loading weather...</span></>,
  ];

  const doubled = [...items, ...items];

  const openWeatherChannel = () => {
    window.open("https://weather.com/weather/today/l/37.5407,-77.4360", "_blank", "noopener");
  };

  return (
    <div className="wx-ticker-wrap">
    <div className="wx-ticker">
      <div
        className="wx-ticker-label"
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: "pointer", userSelect: "none" }}
        title={expanded ? "Collapse" : "Expand weather"}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span>Weather</span>
        <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.6 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      <div
        className="wx-ticker-track"
        onClick={() => setPaused(p => !p)}
        style={{ cursor: "pointer" }}
        title={paused ? "Tap to resume" : "Tap to pause"}
      >
        <div className="wx-ticker-moving" style={{ animationPlayState: paused ? "paused" : "running" }}>
          {doubled.map((item, i) => (
            <span key={i} className="wx-ticker-item">
              {item}
              <span className="wx-ticker-sep" />
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* ── Expanded weather panel ── */}
    {expanded && wx && (
      <div className="wx-expanded">
        <div className="wx-expanded-grid">
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">🌡️</span>
            <div><div className="wx-expanded-val">{wx.temp}°F</div><div className="wx-expanded-key">feels {wx.feelsLike}°F</div></div>
          </div>
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">📈</span>
            <div><div className="wx-expanded-val">H {wx.high}° / L {wx.low}°</div><div className="wx-expanded-key">Today's range</div></div>
          </div>
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">💧</span>
            <div><div className="wx-expanded-val">{wx.humidity}%</div><div className="wx-expanded-key">Humidity</div></div>
          </div>
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">🌬️</span>
            <div><div className="wx-expanded-val">{wx.windSpeed} mph {windDir(wx.windDeg)}</div><div className="wx-expanded-key">Wind</div></div>
          </div>
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">☀️</span>
            <div><div className="wx-expanded-val">UV {wx.uvIndex} <span style={{fontSize:11,color: wx.uvIndex>=8?'#ef4444':wx.uvIndex>=6?'#f59e0b':'#065f46'}}>{uvLabel(wx.uvIndex)}</span></div><div className="wx-expanded-key">UV Index</div></div>
          </div>
          <div className="wx-expanded-item">
            <span className="wx-expanded-icon">👁️</span>
            <div><div className="wx-expanded-val">{wx.visibility} mi</div><div className="wx-expanded-key">Visibility</div></div>
          </div>
          {wx.precipitation > 0 && (
            <div className="wx-expanded-item">
              <span className="wx-expanded-icon">🌧️</span>
              <div><div className="wx-expanded-val">{wx.precipitation} mm</div><div className="wx-expanded-key">Precipitation</div></div>
            </div>
          )}
          <div className="wx-expanded-item wx-expanded-link" onClick={openWeatherChannel}>
            <span className="wx-expanded-icon">🔗</span>
            <div><div className="wx-expanded-val" style={{color:"var(--color-primary)"}}>Full Forecast</div><div className="wx-expanded-key">weather.com</div></div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Intelligence (KEWT-native, not Garmin clone)
//
// Synthesizes existing daily signals into a small Insight / Watch /
// Recovery Action card, with a Fuel Watch section when fasting or weight
// context exists. Reads only signals already loaded on the Dashboard,
// never invents values. If no signals are available it renders a
// cautious empty-state asking the user to log/import.
// Tone follows the Sleep Morning Interpretation pattern: "may suggest",
// "pattern is consistent with", "watch", "recovery action". No claim
// that cortisol or any specific hormone is directly measured.
// ─────────────────────────────────────────────────────────────────────────────
function DailyIntelligence({
  todaySleep, recoveryScore, moveActivities, moveIsToday, activeFast, latestWeight, todayFoodEntries,
}: {
  todaySleep: any | null;
  recoveryScore: number | null;
  moveActivities: any[];
  moveIsToday: boolean;
  activeFast: any | null;
  latestWeight: number | null;
  todayFoodEntries: any[];
}) {
  const hasSleep    = !!todaySleep && (todaySleep.hours != null || todaySleep.sleep_score != null);
  const hasMove     = moveActivities.length > 0;
  const hasFood     = todayFoodEntries.length > 0;
  const hasFast     = !!activeFast;
  const hasWeight   = latestWeight != null;
  const hasAny      = hasSleep || hasMove || hasFast || hasWeight || hasFood || recoveryScore != null;

  if (!hasAny) {
    return (
      <div className="dash-di">
        <div className="dash-di-title">
          <Activity size={13} style={{ color: "#14b8a6" }} /> Daily Intelligence
        </div>
        <div className="dash-di-empty">
          No daily signals yet. Log a sleep entry, log or sync an activity, or start a fast and this card will fill in with a careful, KEWT-toned interpretation.
        </div>
      </div>
    );
  }

  // ── Posture flags (deterministic, conservative) ──
  const sleepHours = todaySleep?.hours ?? null;
  const sleepScore = todaySleep?.sleep_score ?? null;
  const deepMin    = todaySleep?.deep_min ?? null;
  const remMin     = todaySleep?.rem_min ?? null;
  const hrv        = todaySleep?.hrv ?? null;
  const bbChange   = todaySleep?.body_battery_change ?? null;
  const rec        = recoveryScore;

  let sleepTag: "strong" | "supportive" | "short" | "unknown" = "unknown";
  if (sleepHours != null) {
    sleepTag = sleepHours < 6.5 ? "short" : sleepHours >= 8 ? "strong" : "supportive";
  } else if (sleepScore != null) {
    sleepTag = sleepScore >= 80 ? "strong" : sleepScore >= 65 ? "supportive" : "short";
  }
  // Ratio-based REM tag mirrors the Sleep page Score Factor logic so the
  // copy is consistent: REM < 20 percent of total sleep reads as "light"
  // (Fair on the Sleep page factor row).
  const remPctDI = sleepHours != null && remMin != null && sleepHours > 0 ? remMin / (sleepHours * 60) : null;
  const remTag: "light" | "normal" | "strong" | "unknown" =
    remMin == null ? "unknown"
    : (remPctDI == null) ? (remMin < 70 ? "light" : remMin < 100 ? "normal" : "strong")
    : (remPctDI < 0.20 ? "light" : remPctDI >= 0.22 ? "strong" : "normal");

  let recTag: "stable" | "softer" | "low" | "unknown" = "unknown";
  if (rec != null) recTag = rec >= 70 ? "stable" : rec >= 55 ? "softer" : "low";
  else if (sleepTag === "strong") recTag = "stable";
  else if (sleepTag === "short")  recTag = "low";
  else if (sleepTag === "supportive") recTag = "softer";

  // ── Summary chip ──
  const sleepLabel = sleepTag === "unknown" ? "sleep unknown"
                    : sleepTag === "strong" ? "sleep strong"
                    : sleepTag === "supportive" ? "sleep supportive"
                    : "sleep short";
  const recLabel = recTag === "unknown" ? "recovery unknown"
                 : `recovery ${recTag}`;
  const summary = `${recLabel} · ${sleepLabel}${hasMove ? (moveIsToday ? " · moved today" : " · last move on file") : " · no recent move"}`;

  // ── Insight ──
  const insightParts: string[] = [];
  if (sleepTag === "strong" && remTag === "light") {
    insightParts.push("Total sleep was strong, but REM was light. The pattern is consistent with adequate physical recovery alongside a quieter mental-restoration window.");
  } else if (sleepTag === "strong") {
    insightParts.push("Total sleep was strong. The pattern is consistent with a recovered body heading into the day.");
  } else if (sleepTag === "supportive" && remTag === "light") {
    insightParts.push("Sleep duration was supportive, but REM was light. This may suggest the body recovered enough for normal movement while still needing a lower-stress morning rhythm.");
  } else if (sleepTag === "supportive") {
    insightParts.push("Sleep duration was supportive. A steady morning rhythm tends to help the day land smoothly.");
  } else if (sleepTag === "short") {
    insightParts.push("Sleep was short. This pattern can carry forward as sleep debt and mild stress reactivity through the day; treat morning cues with extra patience.");
  }
  if (rec != null) {
    insightParts.push(`Today's readiness score sits around ${rec}, which is ${recTag === "stable" ? "in a supportive range" : recTag === "softer" ? "workable but not peak" : "in a recovery-leaning range"}.`);
  }
  if (hrv != null) insightParts.push(`HRV around ${hrv} ms is one signal in a broader recovery picture, not a verdict.`);
  if (deepMin != null && deepMin > 0 && deepMin < 60) insightParts.push(`Deep sleep on the lower side; this can shift night to night.`);
  if (insightParts.length === 0) insightParts.push("Limited daily signals so far. A few logged or synced inputs will sharpen the read.");

  // ── Watch ──
  let watchText = "";
  if (sleepTag === "short" || recTag === "low") {
    watchText = "Watch for an early afternoon energy dip and shorter patience with stressors. If hunger or cravings rise, lean on protein and water before reaching for sugar.";
  } else if (sleepTag === "supportive" && remTag === "light") {
    watchText = "Watch the mental-load pile. Light REM nights may suggest the brain needs a quieter context, so spread cognitive tasks over the day rather than stacking them.";
  } else if (hasFast && activeFast && activeFast.elapsedHours >= 16) {
    watchText = "Extended fasting state. Watch standing-up dizziness and grip strength on the first heavy lift; if either feels off, end the fast and refuel before training.";
  } else {
    watchText = "Nothing pressing to flag based on tonight's signals. Hold the routine.";
  }

  // ── Recovery Action ──
  let recoveryText = "";
  if (recTag === "low") {
    recoveryText = "Choose moderate movement, prioritize hydration and protein, and avoid judging body weight from a single morning reading.";
  } else if (recTag === "softer") {
    recoveryText = "Moderate session is fine. Consider trimming intensity by about ten percent and protect tomorrow's recovery window.";
  } else if (recTag === "stable") {
    recoveryText = "Recovery looks intact. Train as planned, prioritize hydration and protein, and avoid judging body weight from a single morning reading.";
  } else {
    recoveryText = "Log a sleep entry and one activity to unlock a sharper recovery suggestion.";
  }

  // ── Fuel Watch (food signals, fasting, and / or weight context) ──
  // Reads only real saved food entries; never invents data. When tags
  // are present we use them to surface cautious watches (late caffeine,
  // alcohol last night, low hydration log etc.). When fasting is
  // active we also surface a fast-aware refeed quality note.
  const fuelParts: string[] = [];
  if (hasFood) {
    const allTags: Set<string> = new Set();
    let hasProteinToday = false;
    let hasHydrationToday = false;
    let lateCaffeineEntry: any = null;
    let alcoholEntry: any = null;
    let postWorkoutEntry: any = null;
    for (const f of todayFoodEntries) {
      const t = (f.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      t.forEach((x: string) => allTags.add(x));
      if (t.includes("protein")) hasProteinToday = true;
      if (t.includes("hydration") || f.mealType === "hydration") hasHydrationToday = true;
      if ((t.includes("caffeine") || f.mealType === "coffee") && f.time) {
        const [hh] = f.time.split(":").map(Number);
        if (!isNaN(hh) && hh >= 14) lateCaffeineEntry = f;
      }
      if (t.includes("alcohol") || f.mealType === "alcohol") alcoholEntry = f;
      if (f.mealType === "post_workout") postWorkoutEntry = f;
    }
    if (lateCaffeineEntry) {
      fuelParts.push(`Caffeine logged at ${lateCaffeineEntry.time} may push sleep onset later. Watch for restless sleep tonight if caffeine reliably affects you.`);
    }
    if (alcoholEntry) {
      fuelParts.push("Alcohol on file today. The pattern is consistent with lower deep sleep and elevated overnight resting heart rate; hydrate before bed and treat tomorrow's recovery score with extra patience.");
    }
    if (allTags.has("high_sodium")) {
      fuelParts.push("High-sodium intake noted. A small bump on tomorrow's morning scale can simply be water; treat the single number as noise.");
    }
    if (allTags.has("sugar") && hasMove && moveIsToday) {
      fuelParts.push("Sugar tag with a logged session today is fine fuel; if energy crashes mid-afternoon, lean on protein and water before another sweet.");
    } else if (allTags.has("sugar")) {
      fuelParts.push("Sugar tag today without a logged session. Watch for an afternoon dip and pair the next snack with protein.");
    }
    if (hasFast && activeFast && postWorkoutEntry) {
      fuelParts.push("Post-workout entry logged during the active fast. The first refeed sets the recovery curve; lean on protein and a real meal rather than only sugar.");
    } else if (postWorkoutEntry && !hasProteinToday) {
      fuelParts.push("Post-workout entry logged, but no protein tag today yet. A protein-forward refuel within an hour or two tends to support recovery.");
    }
    if (!hasProteinToday && !hasHydrationToday && fuelParts.length === 0) {
      fuelParts.push("Food signals logged. Adding protein or hydration tags as the day goes on will sharpen this read.");
    }
    if (fuelParts.length === 0) {
      fuelParts.push("Food signals on file look balanced for the day so far.");
    }
  }
  if (hasFast && activeFast) {
    const fh = Math.round((activeFast.elapsedHours ?? 0) * 10) / 10;
    const zone = activeFast.fuelZone || "Glycolytic";
    fuelParts.push(`Currently ${fh}h into a fast in the ${zone} window. ` +
      (fh >= 16 ? "Lean on water and electrolytes; if hunger or cravings rise, that is a normal hormonal signal, not lack of discipline." :
       fh >= 8  ? "Pattern is consistent with a metabolic shift toward fat oxidation. Watch caffeine intake on an empty stomach if it feels jittery." :
                  "Early in the fast window. Keep normal hydration; no special precaution suggested yet."));
  }
  if (!hasFood && !hasFast) {
    if (hasWeight && bbChange != null) {
      fuelParts.push(`Latest weight on file ${latestWeight} lbs. Overnight body battery change ${bbChange > 0 ? "+" : ""}${bbChange}. Single-morning weight shifts are noise; trend across multiple mornings is the signal.`);
    } else if (hasWeight) {
      fuelParts.push(`Latest weight on file ${latestWeight} lbs. A single morning weight reading is noise; trend across several mornings is what to read.`);
    }
  }
  const fuelText = fuelParts.join(" ");

  return (
    <div className="dash-di">
      <div className="dash-di-title">
        <Activity size={13} style={{ color: "#14b8a6" }} /> Daily Intelligence
      </div>
      <div className="dash-di-summary">{summary}</div>

      <div className="dash-di-section">
        <div className="dash-di-sub">Insight</div>
        <div className="dash-di-text">{insightParts.join(" ")}</div>
      </div>
      <div className="dash-di-section">
        <div className="dash-di-sub">Watch</div>
        <div className="dash-di-text">{watchText}</div>
      </div>
      <div className="dash-di-section">
        <div className="dash-di-sub">Recovery Action</div>
        <div className="dash-di-text">{recoveryText}</div>
      </div>
      {fuelText && (
        <div className="dash-di-section">
          <div className="dash-di-sub">Fuel Watch</div>
          <div className="dash-di-text">{fuelText}</div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useHashLocation();

  // Inject CSS once
  useEffect(() => {
    const styleId = "dash-styles";
    if (!document.getElementById(styleId)) {
      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = DASH_CSS;
      document.head.appendChild(el);
    }
    return () => {
      // leave styles — avoids flash on remount
    };
  }, []);

  const _dashToday = localToday();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard", _dashToday],
    queryFn: () => apiRequest("GET", `/api/dashboard?date=${_dashToday}`),
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch latest health marker for smart pre-fill
  const { data: latestMarker } = useQuery<any>({ queryKey: ["/api/health-markers/latest"] });
  const { data: latestBodyComp } = useQuery<any>({ queryKey: ["/api/body-composition/latest"] });

  // ── Collapsible section state (Phase 1) ──────────
  const { state: rowOpen, toggle: toggleRow } = useCollapseState({});

  // ── Inline weight edit state ──────────────────
  // ── Activity drawer state (open/close only — data derived after d is declared below)
  const [todayDrawerOpen, setTodayDrawerOpen] = useState(false);
  const [weekDrawerOpen,  setWeekDrawerOpen]  = useState(false);

  const [weightEditing, setWeightEditing] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightJustSaved, setWeightJustSaved] = useState(false);
  const weightInputRef = useRef<HTMLInputElement>(null);

  const weightMutation = useMutation({
    mutationFn: (weight: number) => {
      const todayStr = localToday();
      return apiRequest("POST", "/api/health-markers", { date: todayStr, morningWeight: weight });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/health-markers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-markers/latest"] });
      setWeightEditing(false);
      setWeightInput("");
      setWeightJustSaved(true);
      setTimeout(() => setWeightJustSaved(false), 3000);
      toast({ title: "Weight logged" });
      // Re-fetch with current date in case query key differs
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", localToday()] });
    },
    onError: () => toast({ title: "Could not save weight", variant: "destructive" }),
  });

  const handleWeightSave = () => {
    const val = parseFloat(weightInput);
    if (!isNaN(val) && val > 50 && val < 500) weightMutation.mutate(val);
  };

  // ── Loading skeleton ──────────────────────
  if (isLoading) {
    return (
      <div className="dash-page">
        <div className="dash-hero">
          <div
            className="dash-greeting"
            style={{
              background: "linear-gradient(110deg, #e5e7eb 30%, #f3f4f6 50%, #e5e7eb 70%)",
              backgroundSize: "200% auto",
              animation: "dash-shimmer 1.6s linear infinite",
              borderRadius: 8,
              width: 280,
              height: 40,
              WebkitTextFillColor: "transparent",
            }}
          />
          <div style={{ width: 200, height: 16, borderRadius: 6, background: "#f3f4f6", marginTop: 10 }} />
        </div>
        <div className="dash-kpi-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="dash-card"
              style={{ height: 100, background: "#f9fafb", "--dash-i": i } as any}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Data ──────────────────────────────────
  const d = data as any;
  const latestWeight = d?.currentWeight;
  const weeklyDeficit = d?.weeklyDeficit || [];
  const weightTrend = d?.weightTrend || [];
  const runningPace = d?.runningPaceTrend || [];
  const arcModality: string = d?.arcModality || "running";
  const arcMetric: string   = d?.arcMetric   || "pace";
  const arcPR: number | null = d?.arcPR ?? null;
  const arcMeta = ARC_META[arcModality] || ARC_META["running"];
  const streaks = d?.streaks || { breathwork: 0, practice: 0, walk: 0 };
  const todaySleep = d?.todaySleep || null;
  const weeklyMiles = d?.weeklyMiles || { thisWeek: 0, lastWeek: 0 };
  const todayActivities: any[] = d?.todayActivities || [];
  const weekActivities:  any[] = d?.weekActivities  || [];
  // Recent Move card source: prefer today's activities, otherwise fall back
  // to the most recent activity day. The most recent move "applies to the
  // following day until another activity is recorded" per product direction.
  const recentActivities: any[] = d?.recentActivities || [];
  const recentActivityDate: string | null = d?.recentActivityDate ?? null;
  const moveActivities: any[] = todayActivities.length > 0 ? todayActivities : recentActivities;
  const moveIsToday: boolean = todayActivities.length > 0;
  const moveDate: string | null = moveIsToday ? null : recentActivityDate;
  const todayActivity = moveActivities.length > 0 ? {
    distance_miles: Math.round(moveActivities.reduce((s: number, a: any) => s + (a.distanceMiles || 0), 0) * 10) / 10,
    est_cals_burned: moveActivities.reduce((s: number, a: any) => s + (a.estCalsBurned || 0), 0),
    duration_min: moveActivities.reduce((s: number, a: any) => s + (a.durationMin || 0), 0),
  } : null;
  const sleepTrend = d?.sleepTrend || null;
  const inflammationSignal = d?.inflammationSignal || null;
  const insights = d?.topInsights || [];
  const recoveryScore = d?.recoveryScore ?? 50;
  const allGoals: any[] = d?.goals || [];
  const weightGoal = allGoals.find((g: any) => g.type === "weight");
  const readinessBreakdown = d?.readinessBreakdown ?? null;
  const coachLine: string | null = d?.coachLine ?? null;
  const activeFast = d?.activeFast ?? null;

  const activeDays = weeklyDeficit.filter((day: any) => day.intake > 0);
  const hasCalData = activeDays.length > 0;
  const avgDeficit = hasCalData
    ? Math.round(activeDays.reduce((s: number, day: any) => s + day.deficit, 0) / activeDays.length)
    : null;

  // Days to Goal — nearest upcoming goal by targetDate
  const activeEventGoal = Array.isArray(data?.goals)
    ? (data.goals
        .filter((g: any) => g.targetDate)
        .sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
        .find((g: any) => new Date(g.targetDate).getTime() >= Date.now()) ?? null)
    : null;
  const daysLeft = activeEventGoal
    ? Math.max(0, Math.ceil((new Date(activeEventGoal.targetDate).getTime() - Date.now()) / 86400000))
    : null;

  const weightDelta =
    weightGoal && latestWeight
      ? (latestWeight - weightGoal.targetValue).toFixed(1)
      : null;

  const goalColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

  // ── Collapsible row summaries (Phase 1) ──────────
  const bcData = latestBodyComp?.data;

  const summaryReadiness = readinessBreakdown
    ? `${readinessBreakdown.composite}/100 · ${readinessBreakdown.label}`
    : "Log sleep to activate";
  const summarySleep = todaySleep
    ? `${todaySleep.sleep_score ?? "—"}/100${todaySleep.hours ? ` · ${todaySleep.hours.toFixed(1)}h` : ""}`
    : "No sleep logged";
  const summaryBattery = todaySleep?.body_battery_change != null
    ? `+${todaySleep.body_battery_change} pts overnight`
    : "No data";
  const summaryMove = todayActivity
    ? `${todayActivity.distance_miles?.toFixed(1) ?? "—"} mi${!moveIsToday ? " · last logged" : ""}`
    : "No activity yet";
  const summaryWeeklyMiles = `${weeklyMiles.thisWeek} mi this week`;
  const summaryStreaks = `${streaks.breathwork}d breathwork · ${streaks.practice}d practice`;
  const summaryWalkStreak = `${streaks.walk} consecutive active days`;
  const summaryDaysToGoal = daysLeft !== null ? `${daysLeft} days left` : "No goal set";
  const summaryDeficit = hasCalData ? `${avgDeficit! > 0 ? "+" : ""}${avgDeficit} cal avg` : "No data yet";
  const summaryWeight = latestMarker?.morningWeight
    ? `${latestMarker.morningWeight} lbs${latestMarker.date === localToday() ? " · today" : ""}`
    : "Tap to log";
  const summaryBodyComp = bcData?.body_score != null ? `Body Score ${bcData.body_score}` : "View details";

  // ── Render ────────────────────────────────
  return (
    <div className="dash-page">
      {/* ── Cinematic Hero — full bleed, outside padded inner ── */}
      <div className="kewt-cin-hero" style={{ marginBottom: 0, borderRadius: "0 0 24px 24px" }}>
        <img
          src="/hero_dashboard.jpg"
          alt=""
          className="kewt-cin-hero__img"
          style={{ objectPosition: "center 50%" }}
        />
        <div className="kewt-cin-hero__overlay" />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#10b981" }}>{activeEventGoal ? `${daysLeft} days to ${new Date(activeEventGoal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Set a goal to begin"}</div>
          <div className="kewt-cin-hero__title">Dashboard.</div>
          <div className="kewt-cin-hero__bar" style={{ "--cin-base": "rgb(10,26,12)" } as React.CSSProperties} />
          <div className="kewt-cin-hero__sub">Today's vitality snapshot</div>
        </div>
      </div>
      <div className="dash-inner" style={{ paddingTop: 20 }}>

      <WeatherTicker />

      {/* ── Option B: Daily Brief — Morning Greeting + Top Insight ── */}
      <div style={{
        maxWidth: 740,
        margin: "0 auto 20px",
        padding: "0 4px",
        animation: "dash-fadeSlideUp 0.45s ease both",
      }}>
        {/* Date + greeting line */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 10,
          marginBottom: 10,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-primary, #065f46)",
          }}>
            {localDate(localToday()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{
            fontSize: 11, color: "var(--color-text-muted)",
            fontWeight: 500,
          }}>
            Your Daily Brief
          </div>
        </div>

        {/* ── Contextual Coach Line ── */}
        {coachLine && (
          <div className="dash-coach-line" data-testid="coach-line">
            <div
              className="dash-coach-dot"
              style={{
                background: readinessBreakdown?.color ?? "#10b981",
                boxShadow: `0 0 6px ${readinessBreakdown?.color ?? "#10b981"}aa`,
              }}
            />
            <span>{coachLine}</span>
            {readinessBreakdown && (
              <span style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: readinessBreakdown.color,
                whiteSpace: "nowrap",
                paddingLeft: 4,
              }}>
                {readinessBreakdown.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Daily Intelligence — promoted to primary position (Phase 1) ──
          This now renders immediately below the Daily Brief header, ahead
          of every other signal, per the "primary informational source"
          decision. Its own internal logic (Insight / Watch / Recovery
          Action / Fuel Watch) is unchanged — only its position moved. ── */}
      <div style={{ maxWidth: 740, margin: "0 auto 20px", padding: "0 4px" }}>
        <DailyIntelligence
          todaySleep={todaySleep}
          recoveryScore={d?.recoveryScore ?? null}
          moveActivities={moveActivities}
          moveIsToday={moveIsToday}
          activeFast={activeFast}
          latestWeight={latestWeight ?? null}
          todayFoodEntries={d?.todayFoodEntries ?? []}
        />
      </div>

      {/* ── Everything else — collapsed accordion rows (Phase 1) ──
          Every metric below is available in one tap but no longer
          competes with Daily Intelligence for the person's first glance. ── */}
      <div className="dash-accordion">

        {/* Daily Readiness */}
        <CollapsibleRow
          id="readiness"
          icon={<Gauge size={16} style={{ color: readinessBreakdown?.color ?? "#10b981" }} />}
          label="Daily Readiness"
          summary={summaryReadiness}
          open={!!rowOpen["readiness"]}
          onToggle={() => toggleRow("readiness")}
          gradient={readinessBreakdown ? `linear-gradient(90deg, ${readinessBreakdown.color}, ${readinessBreakdown.color}99)` : undefined}
        >
          <div className="dash-card" data-testid="kpi-readiness" style={{ "--dash-i": 0 } as any}>
            {readinessBreakdown ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: readinessBreakdown.color, lineHeight: 1.1 }}>
                    {readinessBreakdown.composite}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-text-faint)", fontWeight: 500 }}>/100</span>
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: readinessBreakdown.color }}>
                    {readinessBreakdown.label}
                  </span>
                </div>
                <ReadinessSignals rd={readinessBreakdown} />
              </>
            ) : (
              <div className="dash-empty" style={{ height: 80 }}>
                <span className="dash-empty-text">Log sleep to activate readiness signals</span>
              </div>
            )}
          </div>
        </CollapsibleRow>

        {/* Active Fast — kept always-visible (not collapsible) when live, same as before */}
        {activeFast && (
          <LiveFastingTimer activeFast={activeFast} />
        )}

        {/* Sleep */}
        <CollapsibleRow
          id="sleep"
          icon={<Moon size={16} style={{ color: "#6366f1" }} />}
          label="Sleep"
          summary={summarySleep}
          open={!!rowOpen["sleep"]}
          onToggle={() => toggleRow("sleep")}
          gradient="linear-gradient(90deg,#6366f1,#8b5cf6)"
        >
          <div
            className="dash-card"
            data-testid="kpi-sleep"
            onClick={() => { navigate("/sleep"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ "--dash-i": 1, cursor: "pointer" } as any}
          >
            {todaySleep ? (
              <>
                <div className="dash-card-value" style={{ color: (todaySleep.sleep_score ?? 0) >= 80 ? "#6366f1" : (todaySleep.sleep_score ?? 0) >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {todaySleep.sleep_score ?? "—"}
                  <span className="dash-card-unit">/100</span>
                </div>
                <div className="dash-card-delta" style={{ color: "#6366f1" }}>
                  {todaySleep.hours ? `${todaySleep.hours.toFixed(1)}h` : ""}
                  {todaySleep.deep_min ? ` · ${Math.floor(todaySleep.deep_min / 60)}h${String(todaySleep.deep_min % 60).padStart(2,'0')}m deep` : ""}
                </div>
                {todaySleep.hrv && (
                  <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 3 }}>
                    HRV {todaySleep.hrv}ms
                  </div>
                )}
              </>
            ) : (
              <div className="dash-empty" style={{ height: 64 }}>
                <span className="dash-empty-text">Log sleep to see your score</span>
              </div>
            )}
          </div>
        </CollapsibleRow>

        {/* Body Battery */}
        {todaySleep?.body_battery_change != null && (
          <CollapsibleRow
            id="battery"
            icon={<BatteryCharging size={16} style={{ color: todaySleep.body_battery_change >= 50 ? "#10b981" : "#f59e0b" }} />}
            label="Body Battery"
            summary={summaryBattery}
            open={!!rowOpen["battery"]}
            onToggle={() => toggleRow("battery")}
            gradient={todaySleep.body_battery_change >= 50 ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#f59e0b,#fbbf24)"}
          >
            <div className="dash-card" data-testid="kpi-battery" style={{ "--dash-i": 2 } as any}>
              <div className="dash-card-value" style={{ color: todaySleep.body_battery_change >= 50 ? "#10b981" : "#f59e0b" }}>
                +{todaySleep.body_battery_change}
                <span className="dash-card-unit">pts</span>
              </div>
              <div className="dash-card-delta dash-delta-muted">overnight gain</div>
            </div>
          </CollapsibleRow>
        )}

        {/* Recent Move */}
        <CollapsibleRow
          id="move"
          icon={<Footprints size={16} style={{ color: "#0ea5e9" }} />}
          label="Recent Move"
          summary={summaryMove}
          open={!!rowOpen["move"]}
          onToggle={() => toggleRow("move")}
          gradient="linear-gradient(90deg,#0ea5e9,#06b6d4)"
        >
          <div
            className="dash-card"
            data-testid="kpi-activity"
            onClick={() => {
              if (!moveActivities.length) return;
              const mostRecent = moveActivities[0];
              navigate("/log");
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("kewt:highlight-activity", { detail: { id: mostRecent.id } }));
              }, 400);
            }}
            style={{ "--dash-i": 3, cursor: moveActivities.length > 0 ? "pointer" : "default" } as any}
          >
            {todayActivity ? (
              <>
                <div className="dash-card-value" style={{ color: "#0ea5e9" }}>
                  {todayActivity.distance_miles?.toFixed(1) ?? "—"}
                  <span className="dash-card-unit">mi</span>
                </div>
                <div className="dash-card-delta" style={{ color: "#0ea5e9" }}>
                  {moveActivities.length > 1 ? `${moveActivities.length} activities · ` : ""}
                  {todayActivity.duration_min ? `${Math.round(todayActivity.duration_min)}min` : ""}
                  {todayActivity.est_cals_burned ? ` · ${todayActivity.est_cals_burned} cal` : ""}
                </div>
                {!moveIsToday && moveDate && (
                  <div className="dash-card-delta" style={{ color: "var(--color-text-faint)", fontSize: 10, marginTop: 2 }}>
                    Recorded {(() => {
                      const [y, mo, day] = moveDate.split("-").map(Number);
                      const dt = new Date(y, mo - 1, day);
                      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div className="dash-empty" style={{ height: 64 }}>
                <span className="dash-empty-text">No activity yet</span>
              </div>
            )}
          </div>
        </CollapsibleRow>

        {/* Weekly Miles */}
        <CollapsibleRow
          id="weekly-miles"
          icon={<MapPin size={16} style={{ color: "#f59e0b" }} />}
          label="Weekly Miles"
          summary={summaryWeeklyMiles}
          open={!!rowOpen["weekly-miles"]}
          onToggle={() => toggleRow("weekly-miles")}
          gradient="linear-gradient(90deg,#f59e0b,#fbbf24)"
        >
          <div
            className="dash-card"
            data-testid="kpi-weekly-miles"
            onClick={() => {
              navigate("/log");
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("kewt:highlight-week", {
                  detail: { ids: weekActivities.map((a: any) => a.id) }
                }));
              }, 400);
            }}
            style={{ "--dash-i": 4, cursor: "pointer" } as any}
          >
            <div className="dash-card-value" style={{ color: "#f59e0b" }}>
              {weeklyMiles.thisWeek}
              <span className="dash-card-unit">mi</span>
            </div>
            <div className={`dash-card-delta ${weeklyMiles.thisWeek > 0 && weeklyMiles.thisWeek >= weeklyMiles.lastWeek ? "dash-delta-good" : weeklyMiles.thisWeek > 0 ? "dash-delta-warn" : "dash-delta-muted"}`}>
              {weeklyMiles.lastWeek > 0 ? (
                <>{weeklyMiles.thisWeek >= weeklyMiles.lastWeek ? <ArrowUp size={10} /> : <ArrowDown size={10} />} vs {weeklyMiles.lastWeek}mi last wk</>
              ) : weeklyMiles.thisWeek > 0 ? "this week" : "Log a run or walk"}
            </div>
          </div>
        </CollapsibleRow>

        {/* Streaks */}
        <CollapsibleRow
          id="streaks"
          icon={<Wind size={16} style={{ color: "#f97316" }} />}
          label="Streaks"
          summary={summaryStreaks}
          open={!!rowOpen["streaks"]}
          onToggle={() => toggleRow("streaks")}
          gradient="linear-gradient(90deg,#f97316,#fb923c)"
        >
          <div className="dash-card" data-testid="kpi-streaks" style={{ "--dash-i": 5 } as any}>
            <div className="dash-streak-col">
              {streaks.breathwork > 0 ? (
                <div className="dash-streak-badge">
                  <Wind size={12} /> {streaks.breathwork}d breathwork
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--color-text-faint)", fontStyle: "italic" }}>Start breathwork streak</div>
              )}
              {streaks.practice > 0 ? (
                <div className="dash-streak-badge">
                  <Zap size={12} /> {streaks.practice}d practice
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--color-text-faint)", fontStyle: "italic", marginTop: 6 }}>Start practice streak</div>
              )}
            </div>
          </div>
        </CollapsibleRow>

        {/* Active Streak (conditional) */}
        {streaks.walk > 0 && (
          <CollapsibleRow
            id="walk-streak"
            icon={<Activity size={16} style={{ color: "#ec4899" }} />}
            label="Active Streak"
            summary={summaryWalkStreak}
            open={!!rowOpen["walk-streak"]}
            onToggle={() => toggleRow("walk-streak")}
            gradient="linear-gradient(90deg,#ec4899,#f43f5e)"
          >
            <div className="dash-card" data-testid="kpi-walk-streak" style={{ "--dash-i": 6 } as any}>
              <div className="dash-card-value" style={{ color: "#ec4899" }}>
                {streaks.walk}
                <span className="dash-card-unit">days</span>
              </div>
              <div className="dash-card-delta" style={{ color: "#ec4899" }}>consecutive active days</div>
            </div>
          </CollapsibleRow>
        )}

        {/* Days to Goal */}
        <CollapsibleRow
          id="days-to-goal"
          icon={<Target size={16} style={{ color: "#8b5cf6" }} />}
          label="Days to Goal"
          summary={summaryDaysToGoal}
          open={!!rowOpen["days-to-goal"]}
          onToggle={() => toggleRow("days-to-goal")}
          gradient="linear-gradient(90deg,#8b5cf6,#3b82f6)"
        >
          <div
            className="dash-card"
            data-testid="kpi-days"
            onClick={() => { navigate("/goals"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ "--dash-i": 7, cursor: "pointer" } as any}
          >
            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <div className="dash-days-label">Days left</div>
              <div
                className="dash-card-value"
                style={{
                  fontSize: 42, justifyContent: "center",
                  background: "linear-gradient(110deg,#8b5cf6,#3b82f6)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}
              >
                {daysLeft !== null ? daysLeft : "—"}
              </div>
              <div className="dash-card-delta dash-delta-muted">{activeEventGoal ? `Target: ${new Date(activeEventGoal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No goal set"}</div>
            </div>
          </div>
        </CollapsibleRow>

        {/* Avg Deficit */}
        <CollapsibleRow
          id="deficit"
          icon={<Flame size={16} style={{ color: hasCalData && avgDeficit! >= 250 ? "#10b981" : "#f59e0b" }} />}
          label="Avg Daily Deficit"
          summary={summaryDeficit}
          open={!!rowOpen["deficit"]}
          onToggle={() => toggleRow("deficit")}
          gradient={hasCalData && avgDeficit! >= 250 ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#f59e0b,#fbbf24)"}
        >
          <div className="dash-card" data-testid="kpi-deficit" style={{ "--dash-i": 8 } as any}>
            {hasCalData ? (
              <>
                <div className="dash-card-value" style={{ color: avgDeficit! >= 250 ? "#10b981" : "#f59e0b" }}>
                  {avgDeficit! > 0 ? "+" : ""}{avgDeficit}
                  <span className="dash-card-unit">cal</span>
                </div>
                <div className={`dash-card-delta ${avgDeficit! >= 250 ? "dash-delta-good" : "dash-delta-warn"}`}>
                  {avgDeficit! >= 250 ? "On track" : "Need more deficit"}
                </div>
              </>
            ) : (
              <div className="dash-empty" style={{ height: 64 }}>
                <span className="dash-empty-text">Log your first meal to fuel the Metabolic system</span>
              </div>
            )}
          </div>
        </CollapsibleRow>

        {/* Weight — tap-to-edit inline preserved unchanged inside the row */}
        <CollapsibleRow
          id="weight"
          icon={<Scale size={16} style={{ color: "#10b981" }} />}
          label="Weight"
          summary={summaryWeight}
          open={!!rowOpen["weight"]}
          onToggle={() => toggleRow("weight")}
          gradient="linear-gradient(90deg,#10b981,#06b6d4)"
        >
          <div
            className="dash-card"
            data-testid="kpi-weight"
            style={{ "--dash-i": 9, cursor: weightEditing ? "default" : "pointer" } as any}
            onClick={() => {
              if (!weightEditing) {
                setWeightEditing(true);
                const todayStr2 = localToday();
                const todayWeight = latestMarker?.date === todayStr2 ? latestMarker?.morningWeight : null;
                setWeightInput(todayWeight ? String(todayWeight) : "");
              }
            }}
          >
            {!weightEditing && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <span style={{ opacity: 0.45, display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500 }}>
                  <Pencil size={10} /> tap to log
                </span>
              </div>
            )}
            {weightEditing ? (
              <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    ref={weightInputRef}
                    type="number"
                    step="0.1"
                    min="50"
                    max="500"
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleWeightSave(); if (e.key === "Escape") setWeightEditing(false); }}
                    placeholder="e.g. 178.8"
                    data-testid="input-weight-inline"
                    style={{
                      width: "100%", fontSize: 24, fontWeight: 800, color: "var(--color-text)",
                      background: "var(--color-surface-2, #f8fafc)", border: "1.5px solid #10b981",
                      borderRadius: 10, padding: "6px 10px", outline: "none", letterSpacing: "-0.02em",
                      boxShadow: "0 0 0 3px rgba(16,185,129,0.12)",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>lbs</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={handleWeightSave}
                    disabled={weightMutation.isPending}
                    data-testid="btn-weight-save"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      background: "#10b981", color: "#fff", border: "none", borderRadius: 8,
                      padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <Check size={13} />
                    {weightMutation.isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setWeightEditing(false)}
                    data-testid="btn-weight-cancel"
                    style={{
                      padding: "8px 14px", background: "transparent", border: "1px solid var(--color-border)",
                      borderRadius: 8, fontSize: 13, color: "var(--color-text-muted)", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="dash-card-value" style={{ color: weightJustSaved ? "#10b981" : undefined, transition: "color 400ms" }}>
                  {latestMarker?.morningWeight ?? "—"}
                  <span className="dash-card-unit">lbs</span>
                  {latestWeight && weightTrend.length > 1 && (
                    <span style={{ fontSize: 14, marginLeft: 4 }}>
                      {weightTrend[weightTrend.length - 1]?.weight < weightTrend[weightTrend.length - 2]?.weight
                        ? <ArrowDown size={14} color="#10b981" />
                        : <ArrowUp size={14} color="#ef4444" />}
                    </span>
                  )}
                </div>
                {weightDelta !== null && weightGoal ? (
                  <div className="dash-card-delta dash-delta-good">
                    {weightDelta} lbs to goal
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--color-text-faint, var(--color-text-muted))", marginTop: 6 }}>
                    {latestWeight ? "" : "Tap to log today's weight"}
                  </div>
                )}
                {latestMarker?.date && (
                  <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 4, fontWeight: 500, letterSpacing: "0.02em" }}>
                    {latestMarker.date === localToday()
                      ? "Logged today"
                      : `Logged ${fmtLocalDate(latestMarker.date, { month: "short", day: "numeric" })}`}
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleRow>

        {/* Body Composition (conditional) */}
        {bcData && (
          <CollapsibleRow
            id="body-comp"
            icon={<Cpu size={16} style={{ color: "#8b5cf6" }} />}
            label="Body Composition"
            summary={summaryBodyComp}
            open={!!rowOpen["body-comp"]}
            onToggle={() => toggleRow("body-comp")}
            gradient="linear-gradient(90deg,#8b5cf6,#a78bfa)"
          >
            <div className="dash-card" data-testid="kpi-body-comp" style={{ "--dash-i": 10 } as any}>
              {bcData.date && (
                <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 9, color: "var(--color-text-faint)", fontWeight: 500, marginBottom: 2 }}>
                  {fmtLocalDate(bcData.date, { month: "short", day: "numeric" })}
                </div>
              )}
              {bcData.body_score != null && (() => {
                const score = bcData.body_score;
                const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
                return (
                  <span className="bc-score-badge" style={{ background: `${scoreColor}18`, color: scoreColor }}>
                    Body Score {score}
                  </span>
                );
              })()}
              <div className="bc-grid">
                {[
                  { label: "Body Fat",   value: bcData.body_fat_pct,   unit: "%",    warn: (v: number) => v > 25 },
                  { label: "Muscle",     value: bcData.muscle_mass_lb, unit: "lb" },
                  { label: "Visceral",   value: bcData.visceral_fat,   unit: "idx",  warn: (v: number) => v > 12 },
                  { label: "Body Water", value: bcData.body_water_pct, unit: "%" },
                  { label: "Bone Mass",  value: bcData.bone_mass_lb,   unit: "lb" },
                  { label: "BMR",        value: bcData.bmr_kcal,       unit: "kcal" },
                  { label: "Protein",    value: bcData.protein_pct,    unit: "%" },
                  { label: "BMI",        value: bcData.bmi,            unit: "",     warn: (v: number) => v > 25 },
                ].filter(i => i.value != null).map(item => (
                  <div key={item.label} className="bc-item">
                    <span className="bc-item-label">{item.label}</span>
                    <span className="bc-item-value" style={{ color: item.warn?.(item.value!) ? "#f59e0b" : undefined }}>
                      {item.value}<span className="bc-item-unit">{item.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleRow>
        )}

      </div>

      {/* ── Sleep Trend Callout ─────────── */}
      {sleepTrend && (
        <div style={{ maxWidth: 680, margin: "16px auto 0", padding: "0 16px" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.05))",
            border: "1px solid rgba(99,102,241,0.18)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <Brain size={15} style={{ color: "#6366f1", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>{sleepTrend}</span>
          </div>
        </div>
      )}

      {/* ── Inflammation Signal Callout ─────── */}
      {inflammationSignal?.detected && (
        <div style={{ maxWidth: 680, margin: "12px auto 0", padding: "0 16px" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))",
            border: "1px solid rgba(245,158,11,0.28)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              <TrendingDown size={16} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 4 }}>
                Inflammation Signal Detected
              </div>
              <span style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5 }}>
                {inflammationSignal.message}
              </span>
              <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 6 }}>
                Scale fluctuations under 5 lbs are almost never fat. HRV + weight together tell the real story.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────── */}
      <div className="dash-charts-grid">

        {/* Weight Trend */}
        <div className="dash-chart-card" style={{ "--dash-i": 0 } as any}>
          <div className="dash-chart-title">
            <Scale size={13} style={{ color: "#10b981" }} /> Weight Trend · 30-Day Arc
          </div>
          {weightTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={weightTrend} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#weightGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-empty" style={{ height: 160 }}>
              <span className="dash-empty-text">Weigh in each morning to track your kinetic trajectory</span>
            </div>
          )}
        </div>

        {/* Calorie Balance */}
        <div className="dash-chart-card" style={{ "--dash-i": 1 } as any}>
          <div className="dash-chart-title">
            <Flame size={13} style={{ color: "#f97316" }} /> Metabolic Balance · This Week
          </div>
          {hasCalData ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={weeklyDeficit.filter((dd: any) => dd.intake > 0 || dd.burn > 0)}
                margin={{ top: 6, right: 6, bottom: 0, left: -22 }}
              >
                <defs>
                  <linearGradient id="intakeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="intake" fill="url(#intakeGrad)" name="Intake" radius={[4, 4, 0, 0]} />
                <Bar dataKey="burn" fill="url(#burnGrad)" name="Burn" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-empty" style={{ height: 160 }}>
              <span className="dash-empty-text">Log meals and movement to reveal your energy balance</span>
            </div>
          )}
        </div>

        {/* Kinetic Arc — sport-aware */}
        <div className="dash-chart-card" style={{ "--dash-i": 2 } as any}>
          <div className="dash-chart-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={13} style={{ color: arcMeta.color }} />
              {arcMeta.label}
            </span>
            {runningPace.length >= 3 && (() => {
              const last3 = runningPace.slice(-3).map((p: any) => p.pace);
              const improving = arcMetric === "speed" || arcMetric === "duration"
                ? last3[2] > last3[0]
                : last3[2] < last3[0];
              return improving ? (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 6 }}>
                  +trend
                </span>
              ) : null;
            })()}
          </div>
          {runningPace.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={runningPace} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={arcMeta.color} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={arcMeta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => arcMetric === "pace" || arcMetric === "swim_pace" ? formatPace(v) : arcMetric === "speed" ? `${v}mph` : `${v}m`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: any) => [
                    arcMetric === "pace" || arcMetric === "swim_pace" ? `${formatPace(v)} ${arcMeta.unit}` : arcMetric === "speed" ? `${v} mph` : `${v} min`,
                    arcMeta.metricLabel
                  ]}
                />
                {arcPR !== null && (
                  <ReferenceLine
                    y={arcPR}
                    stroke={arcMeta.color}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                    label={{ value: "PR", position: "insideTopRight", fontSize: 9, fill: arcMeta.color }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="pace"
                  stroke={arcMeta.color}
                  strokeWidth={2.5}
                  fill="url(#paceGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-empty" style={{ height: 160 }}>
              <span className="dash-empty-text">Log a {arcModality} to begin your {arcMeta.label.toLowerCase()}</span>
            </div>
          )}
        </div>

        {/* Key Insights */}
        <div className="dash-chart-card dash-chart-card--insights" style={{ "--dash-i": 3 } as any}>
          <div className="dash-chart-title">
            <Activity size={13} style={{ color: "#10b981" }} /> Key Insights
          </div>
          {/* Mitophagy science badge - fasting/cellular renewal reference */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            background: "rgba(13,39,68,0.04)",
            border: "1px solid rgba(13,39,68,0.1)",
            borderRadius: 10,
            padding: "8px 10px",
          }}>
            <img src="./bew_mitophagy.png" alt="Mitophagy" width={36} height={36} style={{ borderRadius: 6, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c9a84c", marginBottom: 2 }}>
                Blue Ember Intelligence · Science
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                Your fasting window activates mitophagy - cellular cleanup that removes damaged mitochondria and primes energy systems.
              </div>
            </div>
          </div>
          {insights.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {insights.map((ins: string, i: number) => (
                <div key={i} className="dash-insight-card">
                  <Sparkles size={13} style={{ color: "#10b981", flexShrink: 0, marginTop: 1 }} />
                  {ins}
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-empty" style={{ height: 120 }}>
              <span className="dash-empty-text">KEWT Intelligence activates once your systems are fed data</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Goal Progress ───────────────── */}
      {allGoals.length > 0 && (
        <>
          <div className="dash-section-title" style={{ "--dash-i": 0, textAlign: "center" } as any}>
            Goal Progress
          </div>
          <div className="dash-goals-grid" style={{ justifyItems: "center" }}>
            {allGoals.map((g: any, idx: number) => {
              const range = g.startValue - g.targetValue;
              const pct =
                range !== 0
                  ? Math.max(0, Math.min(100, Math.round(((g.startValue - g.currentValue) / range) * 100)))
                  : 0;
              const color = goalColors[idx % goalColors.length];
              return (
                <div
                  key={g.id}
                  className="dash-goal-card"
                  data-testid={`goal-card-${g.id}`}
                  style={{ "--dash-i": idx } as any}
                >
                  <div className="dash-goal-label">{g.label}</div>
                  <GoalRing pct={pct} color={color} />
                  <div className="dash-goal-current">
                    {g.currentValue}
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-faint)", marginLeft: 2 }}>
                      {g.unit}
                    </span>
                  </div>
                  <div className="dash-goal-target">→ {g.targetValue} {g.unit}</div>
                  <div className="dash-goal-bar-track">
                    <div className="dash-goal-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                  </div>
                  <div className="dash-goal-pct">{pct}% complete · {g.targetDate}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      </div>

      {/* ── Recent Move Drawer ─────────────────────────────────────── */}
      <ActivityDrawer
        open={todayDrawerOpen}
        onClose={() => setTodayDrawerOpen(false)}
        title="Recent Move"
        accentColor="#0ea5e9"
        activities={moveActivities}
        summaryMode="today"
      />

      {/* ── Weekly Miles Drawer ───────────────────────────────────── */}
      <ActivityDrawer
        open={weekDrawerOpen}
        onClose={() => setWeekDrawerOpen(false)}
        title="This Week"
        accentColor="#f59e0b"
        activities={weekActivities}
        summaryMode="week"
      />

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityDrawer — slide-up sheet for both Today's Move and Weekly Miles
// ─────────────────────────────────────────────────────────────────────────────

const ACT_ICON: Record<string, string> = {
  running:"\uD83C\uDFC3", walking:"\uD83D\uDEB6", cycling:"\uD83D\uDEB4", hiking:"\uD83E\uDD7E", rucking:"\uD83C\uDF92",
  swimming:"\uD83C\uDFCA", strength:"\uD83C\uDFCB\uFE0F", yoga:"\uD83E\uDDD8", rowing:"\uD83D\uDEA3",
  run:"\uD83C\uDFC3", walk:"\uD83D\uDEB6", bike:"\uD83D\uDEB4", other:"\u26A1",
};

const ACT_LABEL: Record<string, string> = {
  running:"Running", walking:"Walking", cycling:"Cycling", hiking:"Hiking", rucking:"Rucking",
  swimming:"Swimming", strength:"Strength", yoga:"Yoga", rowing:"Rowing",
  run:"Run", walk:"Walk", bike:"Cycling", other:"Activity",
};

function ActivityDrawer({
  open, onClose, title, accentColor, activities, summaryMode,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  accentColor: string;
  activities: any[];
  summaryMode: "today" | "week";
}) {
  // Block body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  // Aggregate totals
  const totalMiles    = activities.reduce((s, a) => s + (a.distanceMiles || 0), 0);
  const totalDuration = activities.reduce((s, a) => s + (a.durationMin   || 0), 0);
  const totalCals     = activities.reduce((s, a) => s + (a.estCalsBurned || 0), 0);
  const totalElevation = activities.reduce((s, a) => s + (a.elevationFt  || 0), 0);

  // Group by date for weekly view
  const byDate: Record<string, any[]> = {};
  activities.forEach(a => {
    const d = a.date || "Unknown";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a);
  });
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const fmtDuration = (min: number) => {
    if (min < 60) return `${Math.round(min)}m`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const fmtDate = (d: string) => {
    try { return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
    catch { return d; }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)", zIndex: 1100,
          animation: "dashFadeIn 180ms ease forwards",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        maxHeight: "82vh", borderRadius: "24px 24px 0 0",
        background: "var(--color-bg)", zIndex: 1101,
        display: "flex", flexDirection: "column",
        animation: "dashSlideUp 240ms cubic-bezier(0.32,0.72,0,1) forwards",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
      }}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-border)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px 12px", borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--color-text)" }}>{title}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              {activities.length} {activities.length === 1 ? "activity" : "activities"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 99,
              border: "1px solid var(--color-border)", background: "var(--color-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, color: "var(--color-text-muted)",
            }}
          >x</button>
        </div>

        {/* Summary bar */}
        <div style={{
          display: "flex", gap: 0, borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          {[
            { label: "Miles",    value: totalMiles    > 0 ? totalMiles.toFixed(1)     : "—", color: accentColor },
            { label: "Time",     value: totalDuration > 0 ? fmtDuration(totalDuration) : "—", color: accentColor },
            { label: "Calories", value: totalCals     > 0 ? `${totalCals}`            : "—", color: accentColor },
            ...(totalElevation > 0 ? [{ label: "Elev", value: `${totalElevation}ft`, color: accentColor }] : []),
          ].map((s, i, arr) => (
            <div key={s.label} style={{
              flex: 1, padding: "10px 0", textAlign: "center",
              borderRight: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scrollable activity list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px 32px" }}>
          {summaryMode === "today" ? (
            // Today: flat list
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activities.map((a, i) => (
                <ActivityRow key={a.id ?? i} activity={a} accentColor={accentColor} fmtDuration={fmtDuration} />
              ))}
            </div>
          ) : (
            // Week: grouped by date
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {sortedDates.map(date => (
                <div key={date}>
                  <p style={{
                    margin: "0 0 8px", fontSize: 11, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                  }}>{fmtDate(date)}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {byDate[date].map((a, i) => (
                      <ActivityRow key={a.id ?? i} activity={a} accentColor={accentColor} fmtDuration={fmtDuration} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dashFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dashSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

function ActivityRow({ activity: a, accentColor, fmtDuration }: {
  activity: any; accentColor: string; fmtDuration: (m: number) => string;
}) {
  const mod   = (a.modality || a.type || "other").toLowerCase();
  const icon  = ACT_ICON[mod]  ?? "\u26A1";
  const label = ACT_LABEL[mod] ?? (mod.charAt(0).toUpperCase() + mod.slice(1));

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 14, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: `${accentColor}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{label}</span>
          {a.distanceMiles > 0 && (
            <span style={{ fontSize: 15, fontWeight: 800, color: accentColor }}>
              {a.distanceMiles.toFixed(2)}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)", marginLeft: 3 }}>mi</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          {a.durationMin > 0 && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {fmtDuration(a.durationMin)}
            </span>
          )}
          {a.avgHr > 0 && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {a.avgHr} bpm avg
            </span>
          )}
          {a.estCalsBurned > 0 && (
            <span style={{ fontSize: 12, color: accentColor, fontWeight: 600 }}>
              {a.estCalsBurned} cal
            </span>
          )}
          {a.elevationFt > 0 && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {a.elevationFt}ft elev
            </span>
          )}
          {a.perceivedEffort > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
              background: `${accentColor}15`, color: accentColor,
            }}>RPE {a.perceivedEffort}</span>
          )}
          {a.intensity && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
              background: "var(--color-bg)", color: "var(--color-text-muted)",
              textTransform: "capitalize",
            }}>{a.intensity}</span>
          )}
        </div>
        {a.notes && (() => {
          const noteText = a.notes.replace(/\|[^|]+=[^|]*/g, "").replace(/^\|+/, "").trim();
          return noteText ? (
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>{noteText}</p>
          ) : null;
        })()}
      </div>
    </div>
  );
}
