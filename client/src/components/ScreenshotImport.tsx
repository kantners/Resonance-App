// Screenshot import: pick one or more screenshots, the server reads them with a
// vision model, you check the numbers, then they are saved. Nothing is saved
// until you confirm, and any value the model was unsure of is flagged.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FieldLabel, FormError, PrimaryButton, UnitInput, num } from "@/components/Fields";
import { errorText, useMe, useSave } from "@/lib/api";
import { isClock, windowToInstants } from "@/lib/sleepTimes";

export type ShotKind = "sleep" | "screen_time";

type Parsed = { data: Record<string, any>; low: string[]; platform?: string | null };
type Def = { key: string; label: string; unit: string; mode?: "numeric" | "decimal" | "time" };

const SLEEP: Def[] = [
  { key: "asleep_h", label: "Hours asleep", unit: "h" },
  { key: "asleep_m", label: "Minutes asleep", unit: "m" },
  { key: "hrv", label: "HRV", unit: "ms", mode: "decimal" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm" },
  { key: "bed_time", label: "Fell asleep", unit: "", mode: "time" },
  { key: "wake_time", label: "Woke", unit: "", mode: "time" },
];
const SCREEN: Def[] = [
  { key: "total_h", label: "Hours", unit: "h" },
  { key: "total_m", label: "Minutes", unit: "m" },
  { key: "pickups", label: "Pickups", unit: "" },
  { key: "social_min", label: "Social (min)", unit: "" },
  { key: "entertainment_min", label: "Entertainment (min)", unit: "" },
  { key: "productivity_min", label: "Productivity (min)", unit: "" },
];

/** The server returns durations as total minutes / decimal hours; the form shows h and m. */
function toForm(kind: ShotKind, d: Record<string, any>): Record<string, string> {
  const o: Record<string, string> = {};
  const s = (v: unknown) => (v == null ? "" : String(v));
  if (kind === "sleep") {
    if (d.hours != null) { const t = Math.round(d.hours * 60); o.asleep_h = String(Math.floor(t / 60)); o.asleep_m = String(t % 60); }
    o.hrv = s(d.hrv); o.resting_hr = s(d.resting_hr);
    for (const k of ["bed_time", "wake_time"]) o[k] = typeof d[k] === "string" && isClock(d[k]) ? d[k] : "";
  } else {
    if (d.total_min != null) { const t = Math.round(d.total_min); o.total_h = String(Math.floor(t / 60)); o.total_m = String(t % 60); }
    for (const k of ["pickups", "social_min", "entertainment_min", "productivity_min"]) o[k] = s(d[k]);
  }
  return o;
}

/** Which form fields a server-side low-confidence key affects. */
const LOW_TO_FORM: Record<string, string[]> = {
  hours: ["asleep_h", "asleep_m"], hrv: ["hrv"], resting_hr: ["resting_hr"], bed_time: ["bed_time"], wake_time: ["wake_time"],
  total_min: ["total_h", "total_m"], pickups: ["pickups"], social_min: ["social_min"],
  entertainment_min: ["entertainment_min"], productivity_min: ["productivity_min"],
};

const intOrNull = (v: string, max: number) => {
  const n = num(v);
  return n == null || Number.isNaN(n) || n < 0 || n > max ? null : Math.round(n);
};

async function parseOne(file: File, kind: ShotKind): Promise<Parsed & { raw: Record<string, any> }> {
  const body = new FormData();
  body.append("image", file);
  body.append("kind", kind);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch("/api/parse-screenshot", { method: "POST", body, credentials: "include", signal: ctl.signal });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${res.status}: ${t}`);
    }
    const j = await res.json();
    return { data: j.data ?? {}, raw: j.data ?? {}, low: j.lowConfidenceFields ?? [], platform: j.platform ?? null };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Reading the screenshot timed out. Try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export default function ScreenshotImport({ kind, date }: { kind: ShotKind; date: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "review">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [low, setLow] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<{ raw: Record<string, any>; platform: string | null }>({ raw: {}, platform: null });
  const [device, setDevice] = useState<string | null>(null);
  const commit = useSave<Record<string, unknown>>("POST", "/api/commit-screenshot");
  const defs = kind === "sleep" ? SLEEP : SCREEN;

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter(f => f.type.startsWith("image/")).slice(0, 4);
    if (!files.length) return;
    setError(null); setPhase("reading");
    // Merge: the first screenshot to supply a value wins; keep prior review work.
    const nextForm = { ...form }, nextLow = new Set(low), raw = { ...extra.raw };
    let platform = extra.platform;
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(files.length > 1 ? ` (${i + 1} of ${files.length})` : "");
        const p = await parseOne(files[i], kind);
        const got = toForm(kind, p.data);
        for (const [k, v] of Object.entries(got)) if (v !== "" && !nextForm[k]) nextForm[k] = v;
        for (const lk of p.low) for (const fk of LOW_TO_FORM[lk] ?? []) if (got[fk]) nextLow.add(fk);
        for (const k of ["top_apps", "hourly_pickups", "notifications", "other_min"]) if (raw[k] == null && p.data[k] != null) raw[k] = p.data[k];
        platform = platform ?? p.platform ?? null;
      }
      setForm(nextForm); setLow(nextLow); setExtra({ raw, platform }); setPhase("review");
      if (!defs.some(d => nextForm[d.key])) setError("I couldn't find any numbers in that image. Try a clearer screenshot, or enter them by hand.");
    } catch (e) {
      setError(errorText(e)); setPhase(Object.keys(form).length ? "review" : "idle");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function edit(key: string, v: string) {
    setForm(f => ({ ...f, [key]: v }));
    setLow(s => { const n = new Set(s); n.delete(key); return n; });
  }

  async function save() {
    setError(null);
    let data: Record<string, unknown>;
    if (kind === "sleep") {
      const h = intOrNull(form.asleep_h ?? "", 24), m = intOrNull(form.asleep_m ?? "", 59);
      const hv = num(form.hrv ?? ""), rh = intOrNull(form.resting_hr ?? "", 200);
      if (hv != null && (Number.isNaN(hv) || hv <= 0 || hv > 400)) return setError("HRV should be between 1 and 400 ms.");
      const bed = form.bed_time ?? "", wk = form.wake_time ?? "";
      if ((bed && !isClock(bed)) || (wk && !isClock(wk))) return setError("Enter bed and wake times as hours and minutes.");
      const win = windowToInstants(date, bed, wk);
      const dev = (device ?? me?.defaultHrvDevice ?? "").trim();
      if (hv != null && !dev) return setError("Add the HRV source (device and app) first, or set it in Settings.");
      data = {
        date,
        hours: h != null || m != null ? (h ?? 0) + (m ?? 0) / 60 : null,
        hrv: hv, resting_hr: rh != null && rh >= 20 ? rh : null,
        sleep_onset: win.sleepOnset, wake_time: win.wakeTime,
        ...(hv != null ? { hrv_device: dev } : {}),
      };
    } else {
      const h = intOrNull(form.total_h ?? "", 24), m = intOrNull(form.total_m ?? "", 59);
      if (h == null && m == null) return setError("Total screen time is needed.");
      const apps = Array.isArray(extra.raw.top_apps)
        ? extra.raw.top_apps.filter((a: any) => a?.name && Number.isFinite(a?.minutes)).slice(0, 20)
            .map((a: any) => ({ name: String(a.name).trim().slice(0, 80), minutes: Math.max(0, Math.min(1440, Math.round(a.minutes))) }))
        : null;
      const hp = extra.raw.hourly_pickups;
      const okHp = Array.isArray(hp) && hp.length === 24 && hp.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 1000);
      const lowKeys = Object.entries(LOW_TO_FORM).filter(([, fs]) => fs.some(f => low.has(f))).map(([k]) => k);
      data = {
        date, totalMin: (h ?? 0) * 60 + (m ?? 0),
        pickups: intOrNull(form.pickups ?? "", 5000),
        socialMin: intOrNull(form.social_min ?? "", 1440),
        entertainmentMin: intOrNull(form.entertainment_min ?? "", 1440),
        productivityMin: intOrNull(form.productivity_min ?? "", 1440),
        notifications: typeof extra.raw.notifications === "number" ? intOrNull(String(extra.raw.notifications), 20000) : null,
        otherMin: typeof extra.raw.other_min === "number" ? intOrNull(String(extra.raw.other_min), 1440) : null,
        topApps: apps?.length ? apps : null,
        hourlyPickups: okHp ? hp : null,
        platform: extra.platform === "ios" || extra.platform === "android" ? extra.platform : null,
        lowConfidenceFields: lowKeys.length ? lowKeys : null,
      };
    }
    try {
      await commit.mutateAsync({ type: kind, data });
      await Promise.all(["/api/exposure", "/api/sleep", "/api/me"].map(p =>
        qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith(p) })));
      navigate("/");
    } catch (e) { setError(errorText(e)); }
  }

  const what = kind === "sleep" ? "a sleep summary from your watch or ring app" : "a Screen Time or Digital Wellbeing screenshot for one day";
  const filled = defs.filter(d => form[d.key]).length;

  return (
    <div className="flex flex-col gap-4">
      <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Choose screenshots"
        onChange={e => onFiles(e.target.files)} />

      {phase === "idle" && (
        <>
          <button type="button" onClick={() => input.current?.click()}
            className="r-card flex flex-col items-center gap-1.5 px-5 py-8 border-dashed border-control cursor-pointer text-center">
            <span className="text-16 font-semibold text-ink">Choose a screenshot</span>
            <span className="text-13 leading-[1.45] text-ink-soft">{what}. You can pick up to four.</span>
          </button>
          <p className="m-0 text-12 leading-[1.45] text-ink-soft">
            The image is sent to OpenAI to read the numbers, then deleted. You check the values before anything is saved.
          </p>
        </>
      )}

      {phase === "reading" && (
        <div role="status" className="r-card px-5 py-6 flex items-center gap-3">
          <span aria-hidden="true" className="inline-block w-4 h-4 rounded-full border-2 border-control border-t-physiology animate-spin" />
          <span className="text-15">Reading{progress}…</span>
        </div>
      )}

      {phase === "review" && (
        <>
          <section aria-label="Values read" className="r-card p-4 flex flex-col gap-3.5">
            <div className="flex justify-between items-baseline gap-3">
              <h2 className="m-0 text-15 font-semibold">Check what I read</h2>
              <span className="font-mono text-12 text-muted">{filled} of {defs.length} found</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5">
              {defs.map(d => (
                <div key={d.key} className="flex flex-col gap-1.5 min-w-0">
                  <FieldLabel htmlFor={`ss-${d.key}`}>
                    {d.label}
                    {low.has(d.key) && <span className="ml-1.5 font-semibold text-exposure-strong">· check</span>}
                  </FieldLabel>
                  <UnitInput id={`ss-${d.key}`} value={form[d.key] ?? ""} onChange={v => edit(d.key, v)} unit={d.unit}
                    inputMode={d.mode === "time" ? "text" : (d.mode ?? "numeric")} type={d.mode === "time" ? "time" : undefined} placeholder="—" />
                </div>
              ))}
            </div>
            {kind === "sleep" && num(form.hrv ?? "") != null && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ss-device">HRV source: device and app</FieldLabel>
                <UnitInput id="ss-device" value={device ?? me?.defaultHrvDevice ?? ""} onChange={setDevice} inputMode="text"
                  placeholder="e.g. Garmin Fenix 7X · overnight HRV" />
              </div>
            )}
            {kind === "screen_time" && (extra.raw.top_apps?.length || extra.raw.hourly_pickups) && (
              <p className="m-0 text-12 leading-[1.45] text-ink-soft">
                Also read: {[extra.raw.top_apps?.length ? `top ${extra.raw.top_apps.length} apps` : null, extra.raw.hourly_pickups ? "hourly pickups" : null].filter(Boolean).join(" and ")}.
              </p>
            )}
            <button type="button" className="r-button-quiet min-h-[44px] self-start px-3 text-13" onClick={() => input.current?.click()}>
              Add another screenshot
            </button>
          </section>
          <FormError>{error}</FormError>
          <PrimaryButton onClick={save} disabled={commit.isPending}>
            {commit.isPending ? "Saving…" : kind === "sleep" ? "Save night" : "Save day"}
          </PrimaryButton>
          <button type="button" className="r-button-quiet min-h-[44px]"
            onClick={() => { setPhase("idle"); setForm({}); setLow(new Set()); setExtra({ raw: {}, platform: null }); setError(null); }}>
            Start over
          </button>
        </>
      )}

      {phase !== "review" && <FormError>{error}</FormError>}
    </div>
  );
}
