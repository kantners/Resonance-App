// Screens scheduled after October 4 (build step 9b). Their server routes
// already exist; the screens themselves are next.
import { SubScreen, TabHeader, TabScreen } from "@/components/Layout";

export function PendingSubScreen({ title, back = { href: "/log", label: "Log" } }: { title: string; back?: { href: string; label: string } }) {
  return (
    <SubScreen back={back} title={title}>
      <section className="r-card px-5 py-4">
        <p className="m-0 text-14 leading-[1.5] text-ink-soft">This screen is being built next.</p>
      </section>
    </SubScreen>
  );
}

export function PendingTabScreen({ title }: { title: string }) {
  return (
    <TabScreen label={title}>
      <TabHeader kicker="RESONANCE" title={title} />
      <section className="r-card px-5 py-4">
        <p className="m-0 text-14 leading-[1.5] text-ink-soft">This screen is being built next.</p>
      </section>
    </TabScreen>
  );
}
