// Digital Exposure, manual entry (design/screens/Exposure-Manual.html).
// The day logged defaults to yesterday: the phone day you're looking back on.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { DigitalExposure } from "@shared/schema";
import { DateStepper } from "@/components/DateStepper";
import { FieldLabel, FormError, num, PrimaryButton, UnitInput } from "@/components/Fields";
import { SubScreen } from "@/components/Layout";
import { errorText, useMe, useSave } from "@/lib/api";
import { addDays, localToday } from "@/lib/dates";

type App = { name: string; minutes: number };

export function EntryMethodTabs({ active }: { active: "screenshot" | "manual" }) {
  const tab = (key: "screenshot" | "manual", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={active === key
        ? "flex items-center justify-center min-h-[44px] rounded-[9px] bg-surface shadow-[0_1px_2px_rgb(var(--shadow)/0.12)] text-ink text-14 font-semibold no-underline hover:text-ink"
        : "flex items-center justify-center min-h-[44px] rounded-[9px] text-ink-soft text-14 font-medium no-underline hover:text-ink"}
    >{label}</Link>
  );
  return (
    <nav aria-label="Entry method" className="grid grid-cols-2 gap-1 p-1 bg-track rounded-tile">
      {tab("screenshot", "/log/exposure/screenshot", "Screenshot")}
      {tab("manual", "/log/exposure", "Manual")}
    </nav>
  );
}

const small = "h-12 box-border w-full border border-control rounded-control px-3 bg-surface font-mono text-16";

export default function ExposureManualScreen() {
  const [, navigate] = useLocation();
  const today = localToday();
  const [date, setDate] = useState(addDays(today, -1));
  const { data: me } = useMe();
  const { data: existing } = useQuery<DigitalExposure | null>({ queryKey: [`/api/exposure/${date}`] });

  const [h, setH] = useState(""), [m, setM] = useState(""), [pickups, setPickups] = useState("");
  const [social, setSocial] = useState(""), [ent, setEnt] = useState(""), [prod, setProd] = useState("");
  const [apps, setApps] = useState<App[]>([]);
  const [appName, setAppName] = useState(""), [appMin, setAppMin] = useState("");
  const [touched, setTouched] = useState(false);
  const save = useSave<Record<string, unknown>>("POST", "/api/exposure");

  useEffect(() => {
    const e = existing;
    const s = (v: number | null | undefined) => (v != null ? String(v) : "");
    setH(e ? String(Math.floor(e.totalMin / 60)) : ""); setM(e ? String(e.totalMin % 60) : "");
    setPickups(s(e?.pickups)); setSocial(s(e?.socialMin)); setEnt(s(e?.entertainmentMin)); setProd(s(e?.productivityMin));
    setApps(e?.topApps ? JSON.parse(e.topApps) : []);
    setTouched(false);
  }, [existing?.id, date]);

  const hours = num(h), mins = num(m);
  const total = hours == null && mins == null ? null : (hours ?? 0) * 60 + (mins ?? 0);
  const intBad = (v: string, max = 1440) => { const n = num(v); return n != null && (Number.isNaN(n) || n < 0 || n > max || !Number.isInteger(n)); };
  const bad = {
    total: touched && (total == null || Number.isNaN(total) || total > 1440 || intBad(h, 24) || intBad(m, 59)),
    pickups: touched && intBad(pickups, 5000),
    social: touched && intBad(social), ent: touched && intBad(ent), prod: touched && intBad(prod),
  };

  function addApp() {
    const n = num(appMin);
    if (!appName.trim() || n == null || Number.isNaN(n) || n < 0) return;
    setApps([...apps, { name: appName.trim(), minutes: Math.round(n) }].slice(0, 20));
    setAppName(""); setAppMin("");
  }

  async function submit() {
    setTouched(true);
    if (total == null || Number.isNaN(total) || total > 1440 || [intBad(h, 24), intBad(m, 59), intBad(pickups, 5000), intBad(social), intBad(ent), intBad(prod)].some(Boolean)) return;
    await save.mutateAsync({
      date, source: "manual", totalMin: Math.round(total),
      pickups: num(pickups), socialMin: num(social), entertainmentMin: num(ent), productivityMin: num(prod),
      topApps: apps.length ? apps : null,
    });
    navigate("/");
  }

  return (
    <SubScreen back={{ href: "/", label: "Brief" }} title="Digital Exposure"
      meta={<DateStepper date={date} onChange={setDate} max={today} />} demo={me?.isDemo}>
      <EntryMethodTabs active="manual" />

      <div className="r-tile flex items-center gap-2.5 px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-11 tracking-header text-muted">SOURCE · MANUAL</span>
          <span className="text-13 text-ink-soft">Manual entries are marked as such in Trends.</span>
        </div>
      </div>

      <section aria-label="Totals" className="r-card p-4 flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Total screen time</FieldLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <UnitInput value={h} onChange={setH} unit="h" label="Hours" placeholder="0" invalid={bad.total} />
            <UnitInput value={m} onChange={setM} unit="m" label="Minutes" placeholder="00" invalid={bad.total} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="m-pickups" optional>Pickups</FieldLabel>
          <UnitInput id="m-pickups" value={pickups} onChange={setPickups} placeholder="—" invalid={bad.pickups} />
        </div>
      </section>

      <section aria-label="Categories" className="r-card p-4 flex flex-col gap-2.5">
        <h2 className="m-0 text-15 font-semibold">Minutes by category <span className="font-normal text-13 text-muted">· optional</span></h2>
        <div className="grid grid-cols-3 gap-2.5">
          {([["m-social", "Social", social, setSocial, bad.social], ["m-ent", "Entertainment", ent, setEnt, bad.ent], ["m-prod", "Productivity", prod, setProd, bad.prod]] as const)
            .map(([id, label, v, set, invalid]) => (
              <div key={id} className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor={id} className="text-12 text-ink-soft">{label}</label>
                <input id={id} value={v} onChange={e => set(e.target.value)} placeholder="0" inputMode="numeric"
                  aria-invalid={invalid || undefined} className={invalid ? `${small} border-2 border-exposure bg-exposure-field` : small} />
              </div>
            ))}
        </div>
      </section>

      <section aria-label="Top apps" className="r-card p-4 flex flex-col gap-2.5">
        <h2 className="m-0 text-15 font-semibold">Top apps <span className="font-normal text-13 text-muted">· optional</span></h2>
        {apps.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col">
            {apps.map((a, i) => (
              <li key={i} className="flex justify-between items-center min-h-[44px] border-b border-hairline text-14">
                <span>{a.name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono">{a.minutes}m</span>
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setApps(apps.filter((_, j) => j !== i))}
                    className="bg-transparent border-0 text-muted text-18 cursor-pointer w-8 h-8">×</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_84px_52px] gap-2 items-end">
          <div className="flex flex-col gap-1.5"><label htmlFor="m-app" className="text-12 text-ink-soft">App</label>
            <input id="m-app" value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g. Instagram"
              className="h-12 box-border w-full border border-control rounded-control px-3 bg-surface text-15" /></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="m-app-min" className="text-12 text-ink-soft">Minutes</label>
            <input id="m-app-min" value={appMin} onChange={e => setAppMin(e.target.value)} placeholder="0" inputMode="numeric" className={small} /></div>
          <button type="button" aria-label="Add app" onClick={addApp}
            className="h-12 rounded-control border border-ink bg-surface flex items-center justify-center cursor-pointer text-ink text-22">+</button>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <FormError>{save.error ? errorText(save.error) : touched && Object.values(bad).some(Boolean) ? "Check the highlighted values." : null}</FormError>
        <PrimaryButton onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</PrimaryButton>
        <p className="m-0 text-12 leading-[1.45] text-muted text-center">Only total screen time is required.</p>
      </div>
    </SubScreen>
  );
}
