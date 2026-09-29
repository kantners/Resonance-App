// The Log tab. Not on the canvas (whose tab bar links straight to Exposure):
// a plain list of the log screens, in the design's tokens.
import { Link } from "wouter";
import { ChevronIcon } from "@/components/Icons";
import { TabHeader, TabScreen } from "@/components/Layout";
import { useMe } from "@/lib/api";

const ITEMS = [
  { href: "/log/morning", title: "Morning reading", sub: "HRV and heart rate, with the device and app" },
  { href: "/log/sleep", title: "Sleep", sub: "Last night: time asleep, score, HRV, resting HR" },
  { href: "/log/exposure", title: "Digital exposure", sub: "Yesterday's screen time and pickups" },
  { href: "/log/stillness", title: "Stillness", sub: "Time you chose to spend without input" },
  { href: "/log/reading", title: "Reading", sub: "Paper, e-reader or app" },
  { href: "/log/fasting", title: "Fasting", sub: "Start or end a fast" },
];

export default function LogScreen() {
  const { data: me } = useMe();
  return (
    <TabScreen label="Log">
      <TabHeader kicker="RESONANCE" title="Log" demo={me?.isDemo} />
      <nav aria-label="Log" className="r-card flex flex-col">
        {ITEMS.map((it, i) => (
          <Link key={it.href} href={it.href}
            className={`flex items-center justify-between gap-3 min-h-[64px] px-4 py-2.5 no-underline text-ink hover:text-ink ${i < ITEMS.length - 1 ? "border-b border-hairline" : ""}`}>
            <span className="flex flex-col gap-0.5">
              <span className="text-15 font-medium">{it.title}</span>
              <span className="text-12 text-muted">{it.sub}</span>
            </span>
            <ChevronIcon className="text-muted shrink-0" />
          </Link>
        ))}
      </nav>
      <Link href="/settings" className="r-link self-start">Settings →</Link>
    </TabScreen>
  );
}
