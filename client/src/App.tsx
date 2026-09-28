import { Switch, Route, Router, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import DailyLog from "@/pages/DailyLog";
import WeeklyView from "@/pages/WeeklyView";
import GoalsPage from "@/pages/Goals";
import AnalyticsPage from "@/pages/Analytics";
import NotFound from "@/pages/not-found";
import IntegrationsPage from "@/pages/Integrations";
import SettingsPage from "@/pages/Settings";
import SciencePage from "@/pages/Science";
import UploadPage from "@/pages/Upload";
import SleepDashboard from "@/pages/SleepDashboard";
import NutritionPage from "@/pages/Nutrition";
import FrameworkPage from "@/pages/Framework";
import InstallPrompt from "@/components/InstallPrompt";
import OnboardingPage from "@/pages/Onboarding";
import FitExportEgg from "@/components/FitExportEgg";
import LoginPage from "@/pages/Login";
import FastingPage from "@/pages/Fasting";
import IGPostGenerator from "@/pages/IGPostGenerator";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sun, Moon, X, Menu, LayoutDashboard, PenLine, CalendarDays, Moon as MoonIcon, MoreHorizontal, BarChart2, Target, Upload, FlaskConical, Layers, Link2, Settings, ChevronUp, TrendingUp, Heart, Flame, ChevronRight, LogOut, Sparkles, UtensilsCrossed } from "lucide-react";

// ── Haptic utility ────────────────────────────────────────────────────────────
// Fires navigator.vibrate on supported devices (Android/Chrome).
// Silently no-ops on iOS/desktop where vibration API is absent.
function haptic(pattern: number | number[] = 8) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

// ── Blue Ember Wellness Shield Logo ───────────────────────────────────────────
// Uses the official brand image directly for pixel-perfect fidelity.
function KEWTLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/icon-192x192.png"
      alt="Blue Ember Wellness"
      width={size}
      height={Math.round(size * 112 / 100)}
      style={{ display: "block", objectFit: "contain", borderRadius: 3 }}
    />
  );
}

// ── KEWT Wordmark ──────────────────────────────────────────────────────────────
// Stylized wordmark: italic Inter Extra Bold + ember-amber accent dot/flame
function KEWTWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontWeight: 900,
      fontStyle: "italic",
      fontSize: compact ? 17 : 20,
      letterSpacing: "-0.06em",
      color: "var(--color-text, #111827)",
      lineHeight: 1,
      transform: "skewX(-13deg)",
      transformOrigin: "left bottom",
    }}><em className="ki">KEWT</em></span>
  );
}

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { href: "/",             label: "Dashboard"   },
  { href: "/log",          label: "Daily Log"   },
  { href: "/weekly",       label: "Weekly"      },
  { href: "/goals",        label: "Goals"       },
  { href: "/sleep",        label: "Sleep"       },
  { href: "/analytics",    label: "Analytics"   },
  { href: "/framework",    label: "The Framework"},
  { href: "/science",      label: "Science"     },
  { href: "/upload",       label: "Upload"      },
  { href: "/settings",     label: "Settings"    },
];

// Scroll the main content area back to top
function scrollToTop() {
  const el = document.getElementById("kewt-main");
  if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Theme toggle ───────────────────────────────────────────────────────────────
// KEWT is now dark-theme-first. Light theme is preserved only as an Easter
// egg behind three quick taps on the Dash bottom nav tab.
// Priority: 1) explicit kewt-theme === "light" from a previous Easter-egg
//              toggle keeps the user in light, otherwise
//           2) ALWAYS dark.
// The previous default-to-light behavior is intentionally removed.
function resolveInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem("resonance-theme");
    if (saved === "light") return false;
  } catch {}
  // Default to dark for everyone except users who explicitly chose light
  // via the Easter egg.
  return true;
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="kewt-theme-btn"
      aria-label="Toggle theme"
      data-testid="button-theme-toggle"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

// ── More Sheet (bottom sheet — replaces hamburger on mobile) ──────────────────
const MORE_GROUPS = [
  {
    label: "Analyze",
    items: [
      { href: "/analytics",  label: "Analytics",     icon: BarChart2   },
      { href: "/goals",      label: "Goals",         icon: Target      },
      { href: "/framework",  label: "The Framework", icon: Layers      },
    ],
  },
  {
    label: "Import",
    items: [
      { href: "/upload",     label: "Upload",        icon: Upload      },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/science",    label: "Science",       icon: FlaskConical },
      { href: "/integrations", label: "Integrations", icon: Link2      },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/settings",   label: "Settings",      icon: Settings    },
    ],
  },
];

function MoreSheet({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [location, navigate] = useHashLocation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startT: number; dragging: boolean }>({ startY: 0, startT: 0, dragging: false });

  const go = (href: string) => {
    haptic(10);
    navigate(href);
    scrollToTop();
    onClose();
  };

  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Drag-to-dismiss
  const onTouchStart = (e: React.TouchEvent) => {
    dragState.current = { startY: e.touches[0].clientY, startT: Date.now(), dragging: true };
    const el = sheetRef.current;
    if (el) { el.style.transition = "none"; }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    // Only drag-dismiss if the scroll area is at the very top
    const scrollEl = sheetRef.current?.querySelector(".more-sheet-scroll") as HTMLElement | null;
    if (scrollEl && scrollEl.scrollTop > 2) return;
    const dy = Math.max(0, e.touches[0].clientY - dragState.current.startY);
    if (dy < 4) return; // ignore tiny jitter
    const el = sheetRef.current;
    if (el) el.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const dy = e.changedTouches[0].clientY - dragState.current.startY;
    const dt = Date.now() - dragState.current.startT;
    const velocity = dy / dt; // px/ms
    const el = sheetRef.current;
    if (dy > 120 || velocity > 0.5) {
      // Dismiss
      if (el) { el.style.transition = "transform 260ms cubic-bezier(0.4,0,1,1)"; el.style.transform = "translateY(100%)"; }
      setTimeout(onClose, 240);
    } else {
      // Snap back
      if (el) { el.style.transition = "transform 260ms cubic-bezier(0.22,1,0.36,1)"; el.style.transform = "translateY(0)"; }
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="more-sheet-backdrop" onClick={onClose} />

      {/* Sheet */}
      <div
        className="more-sheet"
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull handle */}
        <div className="more-sheet-handle" />

        {/* Header */}
        <div className="more-sheet-header">
          <span className="more-sheet-title">More</span>
          <button className="more-sheet-close" onClick={onClose} aria-label="Close">
            <ChevronUp size={20} />
          </button>
        </div>

        {/* Scrollable grouped nav */}
        <div className="more-sheet-scroll">
          {MORE_GROUPS.map(group => (
            <div key={group.label} className="more-sheet-group">
              <div className="more-sheet-group-label">{group.label}</div>
              <div className="more-sheet-group-items">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = location === href || (href !== "/" && location.startsWith(href));
                  return (
                    <button
                      key={href}
                      className={`more-sheet-item${active ? " more-sheet-item--active" : ""}`}
                      onClick={() => go(href)}
                    >
                      <div className={`more-sheet-item-icon${active ? " more-sheet-item-icon--active" : ""}`}>
                        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                      </div>
                      <span className="more-sheet-item-label">{label}</span>
                      {active && <div className="more-sheet-item-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Profile row + Sign Out */}
          <div className="more-sheet-profile">
            <div className="more-sheet-avatar">M</div>
            <div style={{ flex: 1 }}>
              <div className="more-sheet-name">Mark Kantner</div>
              <div className="more-sheet-meta">Blue Ember Wellness</div>
            </div>
            <button
              className="more-sheet-signout"
              onClick={() => { onClose(); onLogout(); }}
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Top navigation bar ─────────────────────────────────────────────────────────
// ── Logout button ───────────────────────────────────────────────────────
function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      className="kewt-hamburger kewt-logout-btn"
      aria-label="Sign out"
      data-testid="button-logout"
      title="Sign out"
    >
      <LogOut size={18} />
    </button>
  );
}

function TopNav({ onMenuOpen, dark, onToggle }: { onMenuOpen: () => void; dark: boolean; onToggle: () => void }) {
  const [location] = useHashLocation();
  const [scrolled, setScrolled] = useState(false);

  // ── Easter egg: 5-tap wordmark (mobile) opens orb ───────────────────────────
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  const onWordmarkTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      window.dispatchEvent(new Event("kewt-easter-egg"));
    }
  };

  // ── Easter egg: 3-tap brand bar logo = hard reload ───────────────────────
  const reloadTapCount = useRef(0);
  const reloadTapTimer = useRef<ReturnType<typeof setTimeout>>();
  const onReloadTap = () => {
    reloadTapCount.current += 1;
    clearTimeout(reloadTapTimer.current);
    reloadTapTimer.current = setTimeout(() => { reloadTapCount.current = 0; }, 1500);
    if (reloadTapCount.current >= 3) {
      reloadTapCount.current = 0;
      window.dispatchEvent(new Event("kewt-hard-reload"));
    }
  };

  useEffect(() => {
    const el = document.getElementById("kewt-main");
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 8);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <header className={`kewt-topnav${scrolled ? " kewt-topnav--scrolled" : ""}`}>

      {/* ── Nav strip ── */}
      <div className="kewt-topnav-inner">

        {/* LEFT slot: KEWT wordmark (desktop only) */}
        <div className="kewt-nav-left">
          <img
            src={"/icon-192x192.png"}
            alt="Resonance"
            className="kewt-nav-wordmark"
            onClick={onWordmarkTap}
            style={{ cursor: "default" }}
          />
        </div>

        {/* CENTER: nav links on desktop, KEWT logo on mobile */}
        <nav className="kewt-nav-center" aria-label="Primary navigation">
          {navItems.map(({ href, label }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`kewt-navlink${active ? " kewt-navlink--active" : ""}`}
                onClick={scrollToTop}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {/* Mobile: cropped wordmark — correct landscape aspect ratio */}
        <img src={"/icon-192x192.png"} alt="Resonance" className="kewt-mobile-logo" onClick={onWordmarkTap} />

        {/* RIGHT slot: logout + hamburger (desktop/tablet only) */}
        <div className="kewt-nav-right" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <LogoutButton />
          <button
            className="kewt-hamburger kewt-hamburger--desktop-only"
            onClick={onMenuOpen}
            aria-label="Open menu"
            data-testid="button-menu"
          >
            <Menu size={22} />
          </button>
        </div>

      </div>

      {/* ── Brand bar: hidden on desktop (wordmark now in nav), kept for tablet/mobile spacing ── */}
      <div className="kewt-brand-bar kewt-brand-bar--desktop-hidden" onClick={onReloadTap}>
        <img src={"/icon-192x192.png"} alt="Resonance" className="kewt-brand-bar-logo" />
        <div className="kewt-brand-bar-text">
          <span className="kewt-brand-bar-namesake">Kinetic Endurance Wellness Tracking</span>
          <span className="kewt-brand-bar-tagline">Breathe. Reset. Return.</span>
        </div>
      </div>
    </header>
  );
}

// ── Orb Sound Engine (Web Audio API — zero file deps) ─────────────────────────
const orbAudio = (() => {
  let ctx: AudioContext | null = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  // ── Chamber Swish ─── soft swish + deep chamber echo on orb tap
  // A breath-like noise swish (very low gain) followed by two decaying
  // sub-bass sine echoes that simulate a large stone-room reverb tail.
  function sonar(opening: boolean) {
    const ac  = getCtx();
    const now = ac.currentTime;

    // — Soft swish — narrow bandpass noise, very gentle
    const swishLen = Math.floor(ac.sampleRate * 0.09);
    const swishBuf = ac.createBuffer(2, swishLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = swishBuf.getChannelData(ch);
      // Bell-curve envelope: rises then falls
      for (let i = 0; i < swishLen; i++) {
        const t = i / swishLen;
        const env = Math.sin(t * Math.PI); // 0 → 1 → 0
        d[i] = (Math.random() * 2 - 1) * env;
      }
    }
    const swishSrc  = ac.createBufferSource();
    const swishFilt = ac.createBiquadFilter();
    const swishGain = ac.createGain();
    swishFilt.type = "bandpass";
    swishFilt.frequency.value = opening ? 900 : 600; // slightly brighter on open
    swishFilt.Q.value = 1.4;
    swishGain.gain.setValueAtTime(0.11, now);
    swishGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    swishSrc.buffer = swishBuf;
    swishSrc.connect(swishFilt); swishFilt.connect(swishGain); swishGain.connect(ac.destination);
    swishSrc.start(now);

    // — Deep chamber echoes — two sub-bass sine pulses, delayed, panned apart
    // Simulates sound bouncing off distant stone walls
    const echo = (freq: number, pan: number, delay: number, peakGain: number, decayS: number) => {
      const osc    = ac.createOscillator();
      const g      = ac.createGain();
      const panner = ac.createStereoPanner();
      osc.type = "sine";
      osc.frequency.value = freq;
      panner.pan.value = pan;
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(peakGain, now + delay + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decayS);
      osc.connect(g); g.connect(panner); panner.connect(ac.destination);
      osc.start(now + delay);
      osc.stop(now + delay + decayS + 0.05);
    };

    if (opening) {
      // First echo — low room rumble left, arrives at 80ms
      echo(68,  -0.6, 0.08, 0.20, 1.1);
      // Second echo — slightly higher right, arrives at 180ms, quieter
      echo(92,   0.5, 0.18, 0.11, 0.85);
      // Faint third reflection — center, arrives at 320ms
      echo(54,   0.0, 0.32, 0.06, 0.60);
    } else {
      // Close: same echoes but reversed order — room collapses inward
      echo(92,   0.5, 0.06, 0.16, 0.90);
      echo(68,  -0.6, 0.15, 0.09, 0.70);
      echo(54,   0.0, 0.26, 0.04, 0.45);
    }
  }

  // ── Tap Click ─── subtle mouse-click / touchpad tap on nav item select
  // Very short noise burst shaped like a physical contact tap — no ring, no bowl.
  function swish() {
    const ac  = getCtx();
    const now = ac.currentTime;

    // Primary click body — 6ms noise, bandpass around 3kHz (plastic/metal contact)
    const clickLen = Math.floor(ac.sampleRate * 0.006);
    const clickBuf = ac.createBuffer(1, clickLen, ac.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * 0.25));
    }
    const cSrc  = ac.createBufferSource();
    const cFilt = ac.createBiquadFilter();
    const cGain = ac.createGain();
    cFilt.type = "bandpass"; cFilt.frequency.value = 3200; cFilt.Q.value = 1.8;
    cGain.gain.setValueAtTime(0.28, now);
    cGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
    cSrc.buffer = clickBuf;
    cSrc.connect(cFilt); cFilt.connect(cGain); cGain.connect(ac.destination);
    cSrc.start(now);

    // Sub-thump — tiny low-freq body that gives it tactile weight (touchpad feel)
    const osc  = ac.createOscillator();
    const oGain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = 180;
    oGain.gain.setValueAtTime(0.10, now);
    oGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    osc.connect(oGain); oGain.connect(ac.destination);
    osc.start(now); osc.stop(now + 0.03);
  }

  // ── Magnetic Ratchet ─── fires each time ring moves ~9° of arc
  let lastTickAngle = 0;
  const TICK_DEG    = 9;
  function maybeTick(currentAngle: number) {
    const diff = Math.abs(currentAngle - lastTickAngle);
    if (diff < TICK_DEG) return;
    lastTickAngle = currentAngle;
    haptic(6); // short pulse synced with ratchet click
    const ac  = getCtx();
    const now = ac.currentTime;
    const buf  = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.018), ac.sampleRate);
    const d    = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const ns   = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    const ng   = ac.createGain();
    filt.type = "bandpass"; filt.frequency.value = 2200; filt.Q.value = 6;
    ng.gain.setValueAtTime(0.09, now); // halved from 0.18
    ns.buffer = buf;
    ns.connect(filt); filt.connect(ng); ng.connect(ac.destination);
    ns.start(now);
  }

  return { sonar, swish, maybeTick };
})();

// ── Floating Ember Orb Navigator (mobile only) ─────────────────────────────────
const ORB_PAGES = [
  { href: "/",             label: "Dashboard",    icon: "⚡" },
  { href: "/log",          label: "Daily Log",    icon: "📋" },
  { href: "/weekly",       label: "Weekly",       icon: "📅" },
  { href: "/goals",        label: "Goals",        icon: "🎯" },
  { href: "/sleep",        label: "Sleep",        icon: "🌙" },
  { href: "/analytics",    label: "Analytics",    icon: "📊" },
  { href: "/framework",    label: "The Framework",icon: "🧬" },
  { href: "/settings",     label: "Settings",     icon: "⚙️" },
  { href: "/upload",       label: "Upload",       icon: "📤" },
  { href: "/science",      label: "Science",      icon: "🔬" },
];

// Saved orb position: x + y from top-left
function loadOrbPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem("kewt-orb-pos-v2");
    if (raw) return JSON.parse(raw);
  } catch {}
  // default: bottom-right
  return { x: window.innerWidth - 60, y: window.innerHeight - 120 };
}
function saveOrbPos(x: number, y: number) {
  try { localStorage.setItem("kewt-orb-pos-v2", JSON.stringify({ x, y })); } catch {}
}

function FloatingOrbNav() {
  const [open, setOpen] = useState(false);
  const [bloom, setBloom] = useState(false);
  const [eggActive, setEggActive] = useState(false);
  const { toast } = useToast();
  const [location, navigate] = useHashLocation();

  // ── Easter egg trigger ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      haptic(40);
      // Toggle: if already active, hide the orb
      if (eggActive) {
        setEggActive(false);
        setOpen(false);
        orbAudio.sonar(false);
        toast({
          title: "Until next time.",
          description: "The orb returns when you need it.",
          duration: 2000,
        });
        return;
      }
      // Snap orb to safe bottom-right position above the tab bar
      const safeX = window.innerWidth  - 60;
      const safeY = window.innerHeight - 140;
      setOrbX(safeX);
      setOrbY(safeY);
      saveOrbPos(safeX, safeY);
      setEggActive(true);
      setBloom(true);
      setTimeout(() => setBloom(false), 700);
      setTimeout(() => {
        setOpen(true);
        orbAudio.sonar(true);
      }, 220);
      toast({
        title: "Found it.",
        description: "The orb was always there.",
        duration: 3000,
      });
    };
    window.addEventListener("kewt-easter-egg", handler);
    return () => window.removeEventListener("kewt-easter-egg", handler);
  }, []);

  // ── Hard reload Easter egg (3-tap brand bar logo) ────────────────────────
  useEffect(() => {
    const handler = () => {
      toast({
        title: "Refreshing KEWT...",
        description: "Pulling the latest build.",
        duration: 1200,
      });
      setTimeout(() => { window.location.reload(); }, 900);
    };
    window.addEventListener("kewt-hard-reload", handler);
    return () => window.removeEventListener("kewt-hard-reload", handler);
  }, []);

  // Orb screen position
  const savedPos = loadOrbPos();
  const [orbX, setOrbX] = useState(savedPos.x);
  const [orbY, setOrbY] = useState(savedPos.y);

  // Ring angle — kept in a ref for RAF-driven updates, mirrored to state only on release
  const [ringAngle, setRingAngle] = useState(0);
  const ringAngleRef = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const ringElRef = useRef<HTMLDivElement | null>(null);

  const ORB_SIZE  = 40;
  const ITEM_SIZE = 40;
  const RADIUS    = 76;
  const MARGIN    = 12;
  const TOTAL     = ORB_PAGES.length;
  const STEP      = 360 / TOTAL;

  const goTo = (href: string) => {
    haptic(10);
    orbAudio.swish();
    scrollToTop();
    navigate(href);
    setOpen(false);
  };

  // ── Orb drag ──────────────────────────────────────────────────────────────
  const dragging      = useRef(false);
  const didDrag       = useRef(false);
  const dragStartX    = useRef(0);
  const dragStartY    = useRef(0);
  const dragStartOrbX = useRef(0);
  const dragStartOrbY = useRef(0);

  const onDragStart = (clientX: number, clientY: number) => {
    dragging.current = true; didDrag.current = false;
    dragStartX.current = clientX; dragStartY.current = clientY;
    dragStartOrbX.current = orbX; dragStartOrbY.current = orbY;
  };
  const onDragMove = (clientX: number, clientY: number) => {
    if (!dragging.current) return;
    const dx = clientX - dragStartX.current;
    const dy = clientY - dragStartY.current;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) { didDrag.current = true; setOpen(false); }
    if (!didDrag.current) return;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const nx = Math.max(MARGIN, Math.min(vw - ORB_SIZE - MARGIN, dragStartOrbX.current + dx));
    const ny = Math.max(MARGIN, Math.min(vh - ORB_SIZE - MARGIN, dragStartOrbY.current + dy));
    setOrbX(nx); setOrbY(ny);
  };
  const onDragEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (didDrag.current) saveOrbPos(orbX, orbY);
  };
  const onMouseDown  = (e: React.MouseEvent) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); };
  const onTouchStart = (e: React.TouchEvent) => { onDragStart(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchEnd   = (_e: React.TouchEvent) => { onDragEnd(); };

  useEffect(() => {
    const mm = (e: MouseEvent) => onDragMove(e.clientX, e.clientY);
    const mu = () => onDragEnd();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [orbX, orbY]);

  // ── Ring spin — RAF-driven for zero jank ──────────────────────────────────
  const spinActive    = useRef(false);
  const spinPrevAng   = useRef(0);
  const spinAccum     = useRef(0);
  const spinBaseRing  = useRef(0);
  const spinDidSpin   = useRef(false);
  const rafId         = useRef<number>(0);

  const getOrbCenter = useCallback(() => ({
    cx: orbX + ORB_SIZE / 2,
    cy: orbY + ORB_SIZE / 2,
  }), [orbX, orbY]);

  const ptrAngle = (clientX: number, clientY: number) => {
    const { cx, cy } = getOrbCenter();
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const normDelta = (d: number) => {
    while (d >  180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  // Apply ring transform directly to DOM element — bypasses React render loop
  const applyRingTransform = (angle: number) => {
    if (ringElRef.current) {
      ringElRef.current.style.transform = `rotate(${angle}deg)`;
    }
    // Also update counter-rotation on each icon so they stay upright
    if (ringElRef.current) {
      const items = ringElRef.current.querySelectorAll<HTMLElement>(".orb-icon-inner");
      items.forEach(el => { el.style.transform = `rotate(${-angle}deg)`; });
    }
  };

  const onRingDown = (e: React.PointerEvent) => {
    if (!open) return;
    const { cx, cy } = getOrbCenter();
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist < ORB_SIZE) return;
    spinActive.current   = true;
    spinDidSpin.current  = false;
    spinPrevAng.current  = ptrAngle(e.clientX, e.clientY);
    spinAccum.current    = 0;
    spinBaseRing.current = ringAngleRef.current;
    setIsSpinning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const onRingMove = (e: React.PointerEvent) => {
    if (!spinActive.current) return;
    const cur   = ptrAngle(e.clientX, e.clientY);
    const frame = normDelta(cur - spinPrevAng.current);
    spinPrevAng.current = cur;
    spinAccum.current  += frame;
    if (Math.abs(spinAccum.current) > 3) spinDidSpin.current = true;
    const next = spinBaseRing.current + spinAccum.current;
    orbAudio.maybeTick(next);
    ringAngleRef.current = next;
    // RAF: schedule one DOM write per frame — no React re-renders during spin
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => applyRingTransform(next));
    e.stopPropagation();
  };

  const onRingUp = (e: React.PointerEvent) => {
    if (!spinActive.current) return;
    spinActive.current = false;
    cancelAnimationFrame(rafId.current);
    // Snap to nearest icon position
    const snapped = Math.round(ringAngleRef.current / STEP) * STEP;
    ringAngleRef.current = snapped;
    setIsSpinning(false);   // triggers transition CSS
    setRingAngle(snapped);  // sync React state
    e.stopPropagation();
  };

  // Keep DOM in sync when ring opens (state may differ from ref after close/reopen)
  useEffect(() => {
    if (open) applyRingTransform(ringAngleRef.current);
  }, [open]);

  // ── Screen position ───────────────────────────────────────────────────────
  const posStyle: React.CSSProperties = {
    left: orbX, top: orbY, right: "auto", bottom: "auto",
    transition: dragging.current ? "none" : "left 60ms linear, top 60ms linear",
  };

  const half  = ORB_SIZE  / 2;
  const hItem = ITEM_SIZE / 2;

  return (
    <div className={`orb-root${eggActive ? " orb-root--egg" : ""}`} style={posStyle}>

      {/* Full-screen spin capture */}
      {open && (
        <div
          className="orb-backdrop"
          onPointerDown={onRingDown}
          onPointerMove={onRingMove}
          onPointerUp={onRingUp}
          onClick={() => { if (!spinDidSpin.current) setOpen(false); }}
          style={{ touchAction: "none" }}
        />
      )}

      {/* Rotatable ring wrapper - ref-driven, transition only on snap */}
      {open && (
        <div
          ref={ringElRef}
          style={{
            position: "absolute",
            bottom: half, right: half,
            width: 0, height: 0,
            transform: `rotate(${ringAngle}deg)`,
            transition: isSpinning ? "none" : "transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            pointerEvents: "none",
          }}
          onPointerDown={onRingDown}
          onPointerMove={onRingMove}
          onPointerUp={onRingUp}
        >
          {ORB_PAGES.map((page, i) => {
            const itemAngle = (STEP * i) - 90;
            const rad = (itemAngle * Math.PI) / 180;
            const tx  = Math.cos(rad) * RADIUS;
            const ty  = Math.sin(rad) * RADIUS;
            const isActive = page.href === location || (page.href !== "/" && location.startsWith(page.href));

            return (
              <button
                key={page.href}
                className={`orb-item orb-item--visible${isActive ? " orb-item--active" : ""}`}
                style={{
                  position: "absolute",
                  width: ITEM_SIZE, height: ITEM_SIZE,
                  bottom: -hItem, right: -hItem,
                  pointerEvents: "auto",
                  transitionDelay: `${i * 30}ms`,
                  transform: `translate(${tx}px, ${ty}px) scale(1)`,
                }}
                onClick={(e) => { e.stopPropagation(); goTo(page.href); }}
                aria-label={page.label}
              >
                {/* counter-rotation applied via RAF, class name for querySelector */}
                <div className="orb-icon-inner" style={{
                  transform: `rotate(${-ringAngle}deg)`,
                  transition: "none",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                }}>
                  <span className="orb-item-icon">{page.icon}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Core orb */}
      <button
        className={`orb-core${open ? " orb-core--open" : ""}${bloom ? " orb-core--bloom" : ""}`}
        onClick={() => { if (!didDrag.current) { const next = !open; haptic(12); orbAudio.sonar(next); setOpen(next); if (!next) setEggActive(false); } }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="Open navigation"
        style={{ touchAction: "none" }}
      >
        {/* Two-dot drag grip */}
        <div style={{
          position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
          opacity: 0.5, pointerEvents: "none",
        }}>
          {[0,1,2,3].map(d => (
            <div key={d} style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,0.9)" }} />
          ))}
        </div>
        {/* Neptune swirl SVG */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ transition: "transform 300ms ease", transform: open ? "scale(0.85) rotate(180deg)" : "scale(1)" }}>
          <circle cx="8" cy="8" r="6.5" fill="url(#nepGrad)" />
          <ellipse cx="8" cy="8" rx="6.5" ry="2.2" fill="rgba(255,255,255,0.10)" />
          <ellipse cx="8" cy="6" rx="4" ry="1.1" fill="rgba(255,255,255,0.08)" />
          <defs>
            <radialGradient id="nepGrad" cx="38%" cy="32%" r="70%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#a5c8f0" />
              <stop offset="35%" stopColor="#4a90d9" />
              <stop offset="65%" stopColor="#1a5fad" />
              <stop offset="100%" stopColor="#0d2b6e" />
            </radialGradient>
          </defs>
        </svg>
      </button>
    </div>
  );
}

// ── Bottom Tab Bar (mobile only) ──────────────────────────────────────────────
// ── BEI Overflow Sheet — Option D: Color Cards ───────────────────────────────
function BEISheet({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [, navigate] = useHashLocation();

  // Post Generator is gated to a small allowlist (Mark + Trish). Probe the
  // server which is the source of truth, then hide the card if not allowed.
  const { data: igAccess } = useQuery<{ ok: boolean }>({
    queryKey: ["/api/me/ig-access"],
    staleTime: 5 * 60 * 1000,
  });
  const igAllowed = !!igAccess?.ok;

  const allCards: { path: string; icon: React.ElementType; label: string; desc: string; bg: string; border: string; color: string; iconColor: string }[] = [
    { path: "/fasting",      icon: Flame,        label: "System Cleanse",  desc: "Metabolic reset tracker",    bg: "rgba(6,95,70,0.09)",    border: "rgba(6,95,70,0.18)",    color: "#064e3b", iconColor: "#065f46" },
    { path: "/nutrition",    icon: UtensilsCrossed, label: "Nutrition",     desc: "Recent food entries",        bg: "rgba(20,184,166,0.08)", border: "rgba(20,184,166,0.20)", color: "#115e59", iconColor: "#0d9488" },
    { path: "/science",      icon: FlaskConical, label: "Science",          desc: "The BEI research layer",    bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.18)", color: "#4c1d95", iconColor: "#7c3aed" },
    { path: "/framework",    icon: Layers,       label: "Framework",        desc: "How KEWT thinks",           bg: "rgba(245,158,11,0.09)", border: "rgba(245,158,11,0.22)", color: "#78350f", iconColor: "#d97706" },
    { path: "/ig-post",      icon: Sparkles,     label: "Post Generator",   desc: "BEI science → Instagram",   bg: "rgba(225,29,72,0.08)",  border: "rgba(225,29,72,0.18)",  color: "#9f1239", iconColor: "#e11d48" },
    { path: "/upload",       icon: Upload,       label: "Import",           desc: "File uploads",              bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.18)", color: "#0c4a6e", iconColor: "#0284c7" },
    { path: "/integrations", icon: Link2,        label: "Integrations",     desc: "Connect your devices",     bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.18)", color: "#0c4a6e", iconColor: "#0284c7" },
    { path: "/settings",     icon: Settings,     label: "Settings",         desc: "Preferences & account",    bg: "rgba(100,116,139,0.08)",border: "rgba(100,116,139,0.18)",color: "#1e293b", iconColor: "#475569" },
  ];
  const cards = allCards.filter(c => c.path !== "/ig-post" || igAllowed);

  const go = (path: string) => {
    navigate(path);
    scrollToTop();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end",
        animation: "beiSheetBackdrop 0.22s ease both",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%",
        background: "var(--color-bg, #faf9f6)",
        borderRadius: "20px 20px 0 0",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        animation: "beiSheetSlideUp 0.28s cubic-bezier(0.34,1.3,0.64,1) both",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(0,0,0,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 20px 14px",
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "#f59e0b", marginBottom: 2,
            }}>Blue Ember Intelligence</div>
            <div style={{
              fontSize: 18, fontWeight: 800,
              color: "var(--color-text, #1c1917)",
              letterSpacing: "-0.02em",
            }}>More</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(0,0,0,0.07)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--color-text-muted)",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Color card stack */}
        <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {cards.map(({ path, icon: Icon, label, desc, bg, border, color, iconColor }) => (
            <button
              key={path}
              onClick={() => go(path)}
              data-testid={`bei-card-${path.replace("/", "")}`}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: 14, padding: "13px 14px",
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 14,
                cursor: "pointer", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Icon size={20} color={iconColor} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="kewt-bei-card-title" style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{label}</div>
                <div className="kewt-bei-card-desc" style={{ fontSize: 11, color, opacity: 0.62, marginTop: 1 }}>{desc}</div>
              </div>
              <ChevronRight size={14} color={color} style={{ opacity: 0.28, flexShrink: 0 }} className="kewt-bei-card-chevron" />
            </button>
          ))}
        </div>

        {/* BEI tagline */}
        <div style={{
          textAlign: "center", padding: "16px 0 0",
          fontSize: 10, letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.2)",
          fontWeight: 600,
        }}>Breathe. Reset. Return.</div>

        {/* Sign Out */}
        <div style={{ padding: "12px 20px 0" }}>
          <button
            onClick={() => { onClose(); onLogout(); }}
            data-testid="button-bei-signout"
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "11px 0",
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.18)",
              borderRadius: 12, cursor: "pointer",
              color: "#dc2626", fontSize: 14, fontWeight: 700,
              letterSpacing: "-0.01em",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <LogOut size={15} strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes beiSheetBackdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes beiSheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Bottom Tab Bar — Option B Pulse Strip ────────────────────────────────────
function BottomTabBar({ onTodayTripleTap }: { onTodayTripleTap: () => void }) {
  const [location, navigate] = useHashLocation();
  const [beiOpen, setBeiOpen] = useState(false);
  const { logout } = useAuth();
  const { toast } = useToast();

  // Data refresh: fired when exactly 2 taps land on the Dash tab within the
  // gesture window (see registerNavTap below). Mirrors the Upload page's
  // manual refresh — invalidate everything so any screen showing stale
  // data (Dashboard, Log, Weekly, etc.) re-fetches next render.
  const handleDashDoubleTap = () => {
    // Rapid triple-pulse — reads as "quick burst" rather than one soft buzz,
    // and stays distinct from the single haptic(6) ratchet tick and the
    // long-press [10,30,10] pattern used elsewhere in this file.
    haptic([12, 45, 12, 45, 12]);
    queryClient.invalidateQueries();
    toast({ title: "Data refreshed" });
  };

  // Easter egg: three taps on the Dash (home) tab within 700 ms toggles
  // between dark and light. KEWT is now dark-theme-first, so this is the
  // only path to light theme. Exactly two taps within the same window
  // instead triggers a full data refresh — see handleDashDoubleTap above.
  // Triple-tapping (or double-tapping) any other tab is ignored.
  // Counter is held in refs so navigation re-renders cannot reset state
  // mid-sequence.
  const tapStateRef = useRef<{ id: string | null; count: number }>({ id: null, count: 0 });
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerNavTap = (id: string) => {
    // Only the home tab (id "today") arms the double/triple-tap gestures.
    if (id !== "today") {
      tapStateRef.current = { id: null, count: 0 };
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      return;
    }
    if (tapStateRef.current.id !== id) {
      tapStateRef.current = { id, count: 1 };
    } else {
      tapStateRef.current.count += 1;
    }
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapStateRef.current.count >= 3) {
      tapStateRef.current = { id: null, count: 0 };
      onTodayTripleTap();
      return;
    }
    // Wait out the window before acting on a 2-tap sequence — if a third
    // tap arrives in time it escalates to the theme toggle above instead,
    // so the two gestures never both fire for the same tap sequence.
    tapTimerRef.current = setTimeout(() => {
      if (tapStateRef.current.count === 2) {
        handleDashDoubleTap();
      }
      tapStateRef.current = { id: null, count: 0 };
    }, 700);
  };
  // Demo-aware nav helper: while on /demo* the bottom nav keeps the user
  // inside the demo route family so query rewrites and the demo banner
  // stay active. Outside demo this is a no-op pass-through.
  const inDemo = location.startsWith("/demo");
  const demoNav = (target: string) => {
    if (!inDemo) { navigate(target); return; }
    // Map normal targets to their /demo equivalents. Anything without a
    // demo equivalent falls back to /demo so the user stays in the demo
    // shell instead of getting kicked to the login page.
    const map: Record<string, string> = {
      "/":          "/demo",
      "/log":       "/demo/log",
      "/sleep":     "/demo/sleep",
      "/goals":     "/demo/goals",
      "/nutrition": "/demo/nutrition",
    };
    navigate(map[target] ?? "/demo");
  };
  const handleTodayTap = () => {
    demoNav("/");
    scrollToTop();
  };

  // Long-press on the Log tab (1000 ms) opens the Daily Log Activity form.
  // Reuses the existing kewt:highlight-activity event so DailyLog expands
  // its Activity accordion row, matching the Dashboard deep-link behavior.
  // Held in refs so re-renders cannot lose the timer or the suppress flag.
  const logHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logHoldFiredRef = useRef(false);
  const logHoldStartRef = useRef<{ x: number; y: number } | null>(null);
  const cancelLogHold = () => {
    if (logHoldTimerRef.current) {
      clearTimeout(logHoldTimerRef.current);
      logHoldTimerRef.current = null;
    }
    logHoldStartRef.current = null;
  };
  const onLogPointerDown = (e: React.PointerEvent) => {
    // Only primary button for mouse; touch and pen always count.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    logHoldFiredRef.current = false;
    logHoldStartRef.current = { x: e.clientX, y: e.clientY };
    cancelLogHold();
    logHoldTimerRef.current = setTimeout(() => {
      logHoldFiredRef.current = true;
      haptic([10, 30, 10]);
      demoNav("/log");
      scrollToTop();
      window.dispatchEvent(new CustomEvent("kewt:highlight-activity"));
      logHoldTimerRef.current = null;
    }, 1000);
  };
  const onLogPointerMove = (e: React.PointerEvent) => {
    const start = logHoldStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > 100) cancelLogHold(); // 10 px movement threshold
  };
  const onLogPointerUp = () => cancelLogHold();
  const onLogPointerCancel = () => cancelLogHold();
  const onLogClick = () => {
    if (logHoldFiredRef.current) {
      // Long-press already navigated and dispatched the event. Suppress the
      // synthetic click that fires on pointer release so navigation does not
      // double-trigger.
      logHoldFiredRef.current = false;
      return;
    }
    demoNav("/log");
    scrollToTop();
  };

  // Android back button: push a dummy history entry when BEI sheet opens,
  // then intercept popstate to close the sheet instead of navigating back.
  useEffect(() => {
    if (beiOpen) {
      window.history.pushState({ kewtBeiSheet: true }, "");
      const onPop = (e: PopStateEvent) => {
        setBeiOpen(false);
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }
  }, [beiOpen]);

  // The 5 primary tabs
  const tabs = [
    {
      id: "today",
      paths: ["/", "/demo"],
      icon: Sun,
      label: "Dash",
      onClick: handleTodayTap,
    },
    {
      id: "log",
      paths: ["/log", "/demo/log"],
      icon: PenLine,
      label: "Log",
      onClick: onLogClick,
    },
    {
      id: "recover",
      paths: ["/sleep", "/demo/sleep"],
      icon: Heart,
      label: "Sleep",
      onClick: () => { demoNav("/sleep"); scrollToTop(); },
    },
    {
      id: "grow",
      paths: ["/goals", "/analytics", "/weekly", "/demo/goals"],
      icon: TrendingUp,
      label: "Goals",
      onClick: () => { demoNav("/goals"); scrollToTop(); },
    },
    {
      id: "bei",
      paths: ["/science", "/framework", "/upload", "/integrations", "/settings", "/ig-post", "/nutrition", "/fasting"],
      icon: Flame,
      label: "More",
      onClick: () => { haptic([6, 30, 6]); setBeiOpen(true); },
    },
  ];

  return (
    <>
      {beiOpen && <BEISheet onClose={() => setBeiOpen(false)} onLogout={logout} />}
      <nav className="kewt-bottom-tab-bar">
        <div className="kewt-tab-strip">
          {tabs.map(({ id, paths, icon: Icon, label, onClick }) => {
            const active = paths.some(p =>
              p === "/" ? (location === "/" || location === "") : location.startsWith(p)
            );
            const longPressProps = id === "log" ? {
              onPointerDown: onLogPointerDown,
              onPointerMove: onLogPointerMove,
              onPointerUp: onLogPointerUp,
              onPointerCancel: onLogPointerCancel,
              onPointerLeave: onLogPointerCancel,
              onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
            } : {};
            return (
              <button
                key={id}
                className={`kewt-tab-item${active ? " kewt-tab-active" : ""}${id === "bei" ? " kewt-tab-bei" : ""}`}
                onClick={() => { registerNavTap(id); onClick(); }}
                aria-label={label}
                data-testid={`tab-${id}`}
                {...longPressProps}
              >
                {id === "today" ? (
                  <div className="tab-today-icon" data-active={active ? "true" : undefined}>
                    <div className="tab-today-rays">
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                      <div className="tab-today-ray" />
                    </div>
                    <div className="tab-today-core" />
                  </div>
                ) : id === "log" ? (
                  <div className="tab-log-icon" data-active={active ? "true" : undefined}>
                    <div className="tab-log-ring" />
                    <div className="tab-log-ring tab-log-ring2" />
                    <div className="tab-log-dot" />
                  </div>
                ) : id === "recover" ? (
                  <div className="tab-recover-icon" data-active={active ? "true" : undefined}>
                    <div className="tab-recover-ring" />
                    <div className="tab-recover-heart">
                      <svg width="20" height="18" viewBox="0 0 28 26" fill="currentColor">
                        <path d="M14 23S2 15 2 8A6 6 0 0 1 14 6 6 6 0 0 1 26 8C26 15 14 23 14 23z"/>
                      </svg>
                    </div>
                  </div>
                ) : id === "grow" ? (
                  <div className="tab-grow-icon" data-active={active ? "true" : undefined}>
                    <div className="tab-grow-ring" />
                    <div className="tab-grow-center" />
                    <div className="tab-grow-dot" />
                    <div className="tab-grow-dot tab-grow-dot2" />
                  </div>
                ) : id === "bei" ? (
                  <div className="bei-ember-badge">
                    <div className="bei-particle" />
                    <div className="bei-particle" />
                    <div className="bei-particle" />
                    <svg width="16" height="16" fill="#7c2d00" viewBox="0 0 24 24">
                      <path d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-5-5-11-5-11zm0 15a3 3 0 01-3-3c0-2.5 2-5.5 3-7.5 1 2 3 5 3 7.5a3 3 0 01-3 3z"/>
                    </svg>
                  </div>
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.7} />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────────
function AppShell() {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fitEggOpen, setFitEggOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    const isDark = resolveInitialTheme();
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    return isDark;
  });
  const toggleDark = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("resonance-theme", next); } catch {}
    setDark(!dark);
  };
  const [location, navigate] = useHashLocation();

  // Always start on Dashboard — no route persistence across sessions

  // Global haptic: every button / link tap in the entire app
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, [role='button'], a")) haptic(8);
    };
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, []);

  // ── Easter egg: type "kewt" on desktop (no input focused) ───────────────────────
  useEffect(() => {
    const SEQ = "kewt";
    let buf = "";
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      buf += e.key.toLowerCase();
      if (buf.length > SEQ.length) buf = buf.slice(-SEQ.length);
      clearTimeout(timer);
      timer = setTimeout(() => { buf = ""; }, 1500);
      if (buf === SEQ) {
        buf = "";
        window.dispatchEvent(new Event("kewt-easter-egg"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, []);

  // ── Easter egg: type "fit" on desktop → FIT Export gag ───────────────────────
  useEffect(() => {
    const SEQ = "fit";
    let buf = "";
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      buf += e.key.toLowerCase();
      if (buf.length > SEQ.length) buf = buf.slice(-SEQ.length);
      clearTimeout(timer);
      timer = setTimeout(() => { buf = ""; }, 1500);
      if (buf === SEQ) {
        buf = "";
        haptic([10, 40, 10]);
        setFitEggOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, []);

  // ── Fullscreen onboarding bypass — renders without any shell chrome ────────────
  if (location.startsWith("/onboarding")) {
    return <OnboardingPage />;
  }

  const inDemoShell = isDemoLocation(location);

  return (
    <div className="kewt-shell">
      {inDemoShell && (
        <div
          role="status"
          aria-label="Demo mode banner"
          style={{
            position: "sticky", top: 0, zIndex: 50,
            background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
            color: "#fff",
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          Demo Mode · sample data · view only
        </div>
      )}
      <TopNav onMenuOpen={() => setMobileOpen(true)} dark={dark} onToggle={toggleDark} />
      {mobileOpen && <MoreSheet onClose={() => setMobileOpen(false)} onLogout={logout} />}
      <FitExportEgg open={fitEggOpen} onClose={() => setFitEggOpen(false)} />
      <FloatingOrbNav />
      <main id="kewt-main" className="kewt-main">
        <Switch>
          {/* Public, no-login demo routes. Stay on /demo* so the
              queryClient demo URL-rewrite stays active. */}
          <Route path="/demo"           component={Dashboard}       />
          <Route path="/demo/sleep"     component={SleepDashboard}  />
          <Route path="/demo/goals"     component={GoalsPage}       />
          <Route path="/demo/log"       component={DailyLog}        />
          <Route path="/demo/nutrition" component={NutritionPage}   />
          <Route path="/"             component={Dashboard}       />
          <Route path="/log"          component={DailyLog}        />
          <Route path="/weekly"       component={WeeklyView}      />
          <Route path="/goals"        component={GoalsPage}       />
          <Route path="/analytics"    component={AnalyticsPage}   />
          <Route path="/integrations" component={IntegrationsPage}/>
          <Route path="/fasting"      component={FastingPage}       />
          <Route path="/settings"      component={SettingsPage}     />
          <Route path="/sleep"        component={SleepDashboard}  />
          <Route path="/nutrition"    component={NutritionPage}   />
          <Route path="/upload"       component={UploadPage}      />
          <Route path="/science"      component={SciencePage}     />
          <Route path="/framework"    component={FrameworkPage}   />
          <Route path="/ig-post"      component={IGPostGenerator} />
          <Route path="/privacy"      component={PrivacyPolicy}   />
          <Route path="/terms"        component={TermsOfService}  />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomTabBar onTodayTripleTap={toggleDark} />
    </div>
  );
}

// ── Auth guard wrapper ───────────────────────────────────────────────────────
// ── Inject splash CSS synchronously at module load — prevents flash before useEffect fires ──
(function injectSplashCSS() {
  if (typeof document !== "undefined" && !document.getElementById("kewt-splash-css")) {
    const el = document.createElement("style");
    el.id = "kewt-splash-css";
    el.textContent = `

/* ══════════════════════════════════════════════════════
   KEWT Splash — Frost Reveal (entry) + Ember Bloom (exit)
   D + E combined
   ══════════════════════════════════════════════════════ */

/* ── Entry: frost clears, logo zooms in with elastic snap ── */
@keyframes kewt-frost-in {
  0%   { opacity: 1; backdrop-filter: blur(32px) brightness(1.12); -webkit-backdrop-filter: blur(32px) brightness(1.12); }
  100% { opacity: 0; backdrop-filter: blur(0px)  brightness(1.0);  -webkit-backdrop-filter: blur(0px)  brightness(1.0); }
}
@keyframes kewt-logo-zoom-in {
  0%   { opacity: 0;    transform: scale(0.52); filter: blur(12px); }
  55%  { opacity: 0;    transform: scale(0.52); filter: blur(12px); }
  72%  { opacity: 1;    transform: scale(1.06); filter: blur(0px);  }
  84%  { opacity: 1;    transform: scale(0.97); filter: blur(0px);  }
  92%  { opacity: 1;    transform: scale(1.01); filter: blur(0px);  }
  100% { opacity: 1;    transform: scale(1.0);  filter: blur(0px);  }
}

/* ── Exit: ember bloom radiates, frost rushes back in, whole wrap fades ── */
@keyframes kewt-bloom {
  0%   { opacity: 0;   transform: scale(0.4); }
  30%  { opacity: 0.7; transform: scale(1.1); }
  100% { opacity: 0;   transform: scale(2.8); }
}
@keyframes kewt-frost-out {
  0%   { opacity: 0; backdrop-filter: blur(0px)  brightness(1.0);  -webkit-backdrop-filter: blur(0px);  }
  40%  { opacity: 1; backdrop-filter: blur(24px) brightness(1.15); -webkit-backdrop-filter: blur(24px) brightness(1.15); }
  100% { opacity: 1; backdrop-filter: blur(40px) brightness(1.2);  -webkit-backdrop-filter: blur(40px) brightness(1.2);  }
}
@keyframes kewt-wrap-dissolve {
  0%   { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes kewt-logo-fade-exit {
  0%   { opacity: 1; transform: scale(1.0); filter: blur(0px); }
  40%  { opacity: 1; transform: scale(1.04); filter: blur(0px); }
  100% { opacity: 0; transform: scale(1.08); filter: blur(6px); }
}

/* ── Wrap ── */
.kewt-splash-wrap {
  position: fixed; inset: 0;
  background: var(--color-bg, #faf9f6);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  z-index: 9999;
}
.kewt-splash-wrap--exit {
  animation: kewt-wrap-dissolve 0.65s cubic-bezier(0.4,0,0.2,1) both;
}

/* ── Frost layer (sits above bg, below logo) ── */
.kewt-splash-frost {
  position: absolute; inset: 0;
  background: rgba(250,249,246,0.72);
  backdrop-filter: blur(32px) brightness(1.12);
  -webkit-backdrop-filter: blur(32px) brightness(1.12);
  z-index: 1;
  animation: kewt-frost-in 0.6s cubic-bezier(0.4,0,0.2,1) 0.15s both;
}
.kewt-splash-frost--exit {
  animation: kewt-frost-out 0.55s cubic-bezier(0.4,0,0.2,1) both !important;
}

/* ── Ember bloom ring (exit only) ── */
.kewt-splash-bloom {
  position: absolute;
  width: 340px; height: 340px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245,158,11,0.55) 0%, rgba(6,95,70,0.18) 55%, transparent 75%);
  z-index: 2;
  opacity: 0;
  pointer-events: none;
}
.kewt-splash-bloom--active {
  animation: kewt-bloom 0.65s cubic-bezier(0.22,1,0.36,1) both;
}

/* ── Logo ── */
.kewt-splash-logo {
  position: relative; z-index: 3;
  animation: kewt-logo-zoom-in 1.05s cubic-bezier(0.22,1,0.36,1) both;
}
.kewt-splash-logo--exit {
  animation: kewt-logo-fade-exit 0.55s cubic-bezier(0.4,0,0.6,1) both !important;
}
`;
    document.head.appendChild(el);
  }
})();

// Hidden /demo route lets beta testers preview the app with sample data
// and no login. Detection is hash-based to match wouter's useHashLocation.
function isDemoLocation(loc: string): boolean {
  return loc === "/demo" || loc.startsWith("/demo/");
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, navigate] = useHashLocation();
  const [showSplash, setShowSplash] = useState(true);
  const [exiting, setExiting]       = useState(false);
  const demoMode = isDemoLocation(location);

  // CSS already injected at module level — nothing to do here

  // When auth resolves, play exit animation then hide splash
  useEffect(() => {
    if (!isLoading && showSplash) {
      setExiting(true);
      const t = setTimeout(() => setShowSplash(false), 480);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  useEffect(() => {
    if (demoMode) return; // demo route never gets pushed to onboarding
    if (!isLoading && isAuthenticated && user && !user.onboardingComplete && !location.startsWith("/onboarding")) {
      navigate("/onboarding");
    }
  }, [isLoading, isAuthenticated, user, location, demoMode]);

  // Demo route bypasses splash + auth entirely; sample data flows through
  // the queryClient demo-mode rewrite (see lib/queryClient.ts).
  if (demoMode) return <>{children}</>;

  if (showSplash) {
    return (
      <div className={`kewt-splash-wrap${exiting ? " kewt-splash-wrap--exit" : ""}`}>
        {/* Frost layer — clears on entry, rushes back on exit */}
        <div className={`kewt-splash-frost${exiting ? " kewt-splash-frost--exit" : ""}`} />
        {/* Ember bloom — radiates outward on exit */}
        <div className={`kewt-splash-bloom${exiting ? " kewt-splash-bloom--active" : ""}`} />
        {/* Logo — zooms in with elastic snap, glassy dissolve on exit */}
        <img
          src="/icon-192x192.png"
          alt="Resonance"
          className={`kewt-splash-logo${exiting ? " kewt-splash-logo--exit" : ""}`}
          style={{ width: 240, objectFit: "contain", display: "block" }}
        />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AuthGate>
          <AppShell />
        </AuthGate>
        <Toaster />
        <InstallPrompt />
      </Router>
    </QueryClientProvider>
  );
}
