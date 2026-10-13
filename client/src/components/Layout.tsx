import { useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMe } from "@/lib/api";
import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { BackIcon, BriefIcon, LogIcon, StudyIcon, TrendsIcon } from "./Icons";

/** Shown on every screen that displays demo data. */
export function DemoTag() {
  return <span className="r-demo-tag" role="note">Illustrative data</span>;
}

function NavItem({ href, label, icon, active, onClick }: { href: string; label: string; icon: ReactNode; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "r-nav-item flex flex-col items-center justify-center gap-px min-h-[44px] no-underline text-12 leading-none",
        active ? "text-ink font-semibold hover:text-ink" : "text-muted font-medium hover:text-ink",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const { data: me } = useMe();
  // Easter egg: three taps on Brief within 0.7s flips light/dark.
  const taps = useRef<number[]>([]);
  const onBriefTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 700), now];
    if (taps.current.length >= 3) { taps.current = []; toggleTheme(); }
  };
  const tabs = [
    { href: "/", label: "Brief", icon: <BriefIcon />, match: (l: string) => l === "/" || l === "/how" },
    { href: "/log", label: "Log", icon: <LogIcon />, match: (l: string) => l.startsWith("/log") },
    { href: "/trends", label: "Trends", icon: <TrendsIcon />, match: (l: string) => l.startsWith("/trends") },
    ...(me?.isPractitioner
      ? [{ href: "/study", label: "Study", icon: <StudyIcon />, match: (l: string) => l.startsWith("/study") }]
      : []),
  ];
  return (
    <nav
      aria-label="Primary"
      // 44px tap targets (the floor); bottom padding only as tall as the phone's
      // home-indicator area (iPhone), otherwise 4px.
      className="sticky bottom-0 grid border-t border-line bg-surface px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))]"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(t => <NavItem key={t.href} href={t.href} label={t.label} icon={t.icon} active={t.match(location)}
        onClick={t.href === "/" ? onBriefTap : undefined} />)}
    </nav>
  );
}

/** A top-level screen (Brief, Log, Trends, Study) with the bottom navigation. */
export function TabScreen({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="min-h-screen flex justify-center bg-ground">
      <div className="w-full max-w-phone flex flex-col min-h-screen">
        <main aria-label={label} className="flex-1 flex flex-col gap-[14px] px-6 pt-7 pb-4">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}

/** Header for a tab screen: mono kicker line, then a serif title. */
export function TabHeader({ kicker, meta, title, demo }: { kicker: string; meta?: string; title: string; demo?: boolean }) {
  return (
    <header className="flex flex-col gap-1">
      {/* Brand row: larger than the page title; byline justified to the name's width. */}
      <div className="flex items-center gap-3 mb-4">
        <img src="/brand-shield.png" alt="" width={34} height={44} className="w-[34px] h-auto" />
        <div className="inline-flex flex-col items-stretch gap-1.5">
          <span className="font-serif font-semibold text-[40px] leading-none text-ink">Resonance</span>
          <span className="flex items-center gap-1.5" aria-label="by Blue Ember Wellness">
            <span aria-hidden="true" className="flex-1 min-w-[6px] h-px bg-[rgb(var(--brand-rule))]" />
            <span className="font-mono text-[9px] tracking-[0.12em] uppercase whitespace-nowrap text-[rgb(var(--brand-text))]">By Blue Ember Wellness</span>
            <span aria-hidden="true" className="flex-1 min-w-[6px] h-px bg-[rgb(var(--brand-rule))]" />
          </span>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-mono text-12 tracking-header text-muted">{kicker}</span>
        {meta && <span className="font-mono text-12 tracking-header text-muted">{meta}</span>}
      </div>
      <h1 className="m-0 font-serif font-medium text-26 leading-[1.1]">{title}</h1>
      {demo && <div className="pt-1"><DemoTag /></div>}
    </header>
  );
}

/** A task screen (a log form, an explainer) with a back link and no bottom navigation. */
export function SubScreen({
  back, title, meta, demo, children,
}: { back: { href: string; label: string }; title: string; meta?: ReactNode; demo?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen flex justify-center bg-ground">
      <main className="w-full max-w-phone flex flex-col gap-[18px] px-6 pt-3 pb-8 box-border">
        <header className="flex flex-col gap-1">
          <Link href={back.href} className="self-start flex items-center gap-0.5 min-h-[44px] text-15 font-medium no-underline">
            <BackIcon />{back.label}
          </Link>
          <div className="flex justify-between items-baseline gap-3">
            <h1 className="m-0 font-serif font-medium text-30 leading-[1.1]">{title}</h1>
            {typeof meta === "string"
              ? <span className="font-mono text-12 tracking-header text-muted text-right">{meta}</span>
              : meta}
          </div>
          {demo && <div className="pt-1"><DemoTag /></div>}
        </header>
        {children}
      </main>
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("r-eyebrow", className)}>{children}</span>;
}
