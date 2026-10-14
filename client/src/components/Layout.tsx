import { useEffect, useRef, type ReactNode, type RefObject } from "react";
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
        "r-nav-item flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px] no-underline leading-none",
        active ? "text-physiology font-semibold hover:text-physiology" : "text-muted font-normal hover:text-ink",
      )}
    >
      <span className="r-nav-icon">{icon}</span>
      <span className="text-11 tracking-[0.01em]">{label}</span>
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
    { href: "/", label: "Brief", icon: <BriefIcon size={20} />, match: (l: string) => l === "/" || l === "/how" },
    { href: "/log", label: "Log", icon: <LogIcon size={20} />, match: (l: string) => l.startsWith("/log") },
    { href: "/trends", label: "Trends", icon: <TrendsIcon size={20} />, match: (l: string) => l.startsWith("/trends") },
    ...(me?.isPractitioner
      ? [{ href: "/study", label: "Study", icon: <StudyIcon size={20} />, match: (l: string) => l.startsWith("/study") }]
      : []),
  ];
  return (
    <nav
      aria-label="Primary"
      // 44px tap targets (the floor); bottom padding only as tall as the phone's
      // home-indicator area (iPhone), otherwise 4px.
      className="r-nav sticky bottom-0 z-10 grid px-2 pb-[max(4px,env(safe-area-inset-bottom))]"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(t => <NavItem key={t.href} href={t.href} label={t.label} icon={t.icon} active={t.match(location)}
        onClick={t.href === "/" ? onBriefTap : undefined} />)}
    </nav>
  );
}


/**
 * Pinned-header shrink: as the page scrolls the first 80px, --s eases 0 → 1 and
 * the CSS (.r-hero) scales the badge, wordmark and padding down a little.
 * The height the shrink gives up is handed back as bottom margin, so the content
 * never shifts under the finger; only the pinned bar itself gets smaller.
 */
function useHeroShrink(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let full = 0, raf = 0;
    const measure = () => {
      el.style.setProperty("--s", "0");
      el.style.marginBottom = "0px";
      full = el.offsetHeight;
    };
    const apply = () => {
      raf = 0;
      const s = Math.max(0, Math.min(1, window.scrollY / 80));
      el.style.setProperty("--s", s.toFixed(3));
      el.style.marginBottom = `${Math.max(0, full - el.offsetHeight)}px`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onResize = () => { measure(); apply(); };
    measure(); apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(onResize).catch(() => {});
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

/** A top-level screen (Brief, Log, Trends, Study) with the bottom navigation. */
export function TabScreen({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="min-h-screen flex justify-center bg-ground">
      <div className="w-full max-w-phone flex flex-col min-h-screen">
        <main aria-label={label} className="flex-1 flex flex-col gap-[14px] px-6 pb-4">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}

/** Pinned header for a tab screen: badge and wordmark, then the title (date range at right). It shrinks slightly on scroll. */
export function TabHeader({ meta, title, demo }: { kicker?: string; meta?: string; title: string; demo?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useHeroShrink(ref);
  return (
    <header ref={ref} className="r-hero sticky top-0 z-20 -mx-6 px-6 bg-ground flex flex-col">
      {/* Brand row: byline justified to the name's width. */}
      <div className="r-hero-brand flex items-center gap-3">
        <img src="/brand-shield.png" alt="" width={52} height={67} className="r-hero-shield" />
        <div className="inline-flex flex-col items-stretch gap-1.5">
          <span className="r-hero-word font-serif font-bold leading-none text-ink">Resonance</span>
          <span className="flex items-center gap-1.5" aria-label="by Blue Ember Wellness">
            <span aria-hidden="true" className="flex-1 min-w-[6px] h-px bg-[rgb(var(--brand-rule))]" />
            <span className="font-mono text-[9px] tracking-[0.12em] uppercase whitespace-nowrap text-[rgb(var(--brand-text))]">By Blue Ember Wellness</span>
            <span aria-hidden="true" className="flex-1 min-w-[6px] h-px bg-[rgb(var(--brand-rule))]" />
          </span>
        </div>
      </div>
      <div className="flex justify-between items-baseline gap-3">
        <h1 className="m-0 font-serif font-semibold text-26 leading-[1.1]">{title}</h1>
        {meta && <span className="font-mono text-12 tracking-header text-muted">{meta}</span>}
      </div>
      {demo && <div className="pt-1"><DemoTag /></div>}
    </header>
  );
}

/** A task screen (a log form, an explainer) with a back link and no bottom navigation. */
export function SubScreen({
  back, title, meta, demo, children,
}: { back: { href: string; label: string }; title: string; meta?: ReactNode; demo?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useHeroShrink(ref);
  return (
    <div className="min-h-screen flex justify-center bg-ground">
      <main className="w-full max-w-phone flex flex-col gap-[18px] px-6 pb-8 box-border">
        <header ref={ref} className="r-hero r-hero-sub sticky top-0 z-20 -mx-6 px-6 bg-ground flex flex-col gap-1">
          <Link href={back.href} className="self-start flex items-center gap-0.5 min-h-[44px] text-15 font-medium no-underline">
            <BackIcon />{back.label}
          </Link>
          <div className="flex justify-between items-baseline gap-3">
            <h1 className="m-0 font-serif font-semibold text-30 leading-[1.1]">{title}</h1>
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
