// Session Study, practitioner view (design/screens/Study.html), plus what the
// canvas doesn't show: drafting a protocol from a template and locking it
// (with the ethics reminder, HANDOFF §8.5), the allocation hash, the fixed
// analysis scale and reading device, and reading-device mismatch flags (A1–A3).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ContrastDto, ProtocolDto, StudyArmDto, StudyResultsDto } from "@shared/api";
import { STUDY_TEMPLATES, type StudyTemplate } from "@shared/studyTemplates";
import { FormError, PrimaryButton } from "@/components/Fields";
import { AlertIcon, LockIcon } from "@/components/Icons";
import { DemoTag, Eyebrow, TabHeader, TabScreen } from "@/components/Layout";
import { errorText, useMe } from "@/lib/api";
import { fmtMonthDay } from "@/lib/dates";
import { apiRequest } from "@/lib/queryClient";

export default function StudyScreen() {
  const { data: me } = useMe();
  const { data: protocols, isLoading } = useQuery<ProtocolDto[]>({ queryKey: ["/api/study/protocols"], enabled: !!me?.isPractitioner });

  const [picked, setPicked] = useState<number | null>(null);

  if (me && !me.isPractitioner) return <SetUpPractitioner />;
  // Default: the running study; the switcher shows the others (e.g. a completed one).
  const running = protocols?.find(p => p.lockedAt && !p.completedAt) ?? protocols?.[0];
  const current = protocols?.find(p => p.id === picked) ?? running;
  return (
    <TabScreen label="Session Study">
      <TabHeader kicker="PRACTITIONER" title="Session Study" />
      {isLoading && <p className="m-0 text-14 text-muted">Loading…</p>}
      {protocols && protocols.length > 1 && (
        <div role="radiogroup" aria-label="Study" className="flex flex-wrap gap-1.5">
          {protocols.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={current?.id === p.id} className="r-chip"
              onClick={() => setPicked(p.id)}>
              {!p.lockedAt ? "Draft" : p.completedAt ? "Completed" : "Running"} · v{p.version}
            </button>
          ))}
        </div>
      )}
      {protocols && !current && <DraftProtocol />}
      {current && !current.lockedAt && <DraftProtocol draft={current} />}
      {current?.lockedAt && <LockedStudy key={current.id} protocol={current} />}
    </TabScreen>
  );
}

function SetUpPractitioner() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  return (
    <TabScreen label="Session Study">
      <TabHeader kicker="PRACTITIONER" title="Session Study" />
      <section className="r-card px-5 py-4 flex flex-col gap-3">
        <p className="m-0 text-14 leading-[1.5] text-ink-soft">
          Practitioner mode runs a controlled session study in your practice: a locked protocol, random allocation, and
          readings kept under client codes. Your clients' daily data is never visible to you.
        </p>
        <PrimaryButton onClick={async () => {
          try { await apiRequest("POST", "/api/practitioner", {}); await qc.invalidateQueries({ queryKey: ["/api/me"] }); }
          catch (e) { setErr(errorText(e)); }
        }}>Set up practitioner mode</PrimaryButton>
        <FormError>{err}</FormError>
      </section>
    </TabScreen>
  );
}

// ─── Draft → lock ────────────────────────────────────────────────────────────
function DraftProtocol({ draft }: { draft?: ProtocolDto }) {
  const qc = useQueryClient();
  const [template, setTemplate] = useState<StudyTemplate>(STUDY_TEMPLATES[0]);
  const [includeRest, setIncludeRest] = useState(false);
  const [f, setF] = useState({
    question: draft?.question ?? template.question,
    withholdingProcedure: draft?.withholdingProcedure ?? "",
    commitmentText: draft?.commitmentText ?? "I can withhold intention. If A and B don't differ, I'll conclude that intention didn't measurably change this outcome, and present it that way.",
    readingDevice: draft?.readingDevice ?? "",
    targetClients: String(draft?.targetClients ?? 12),
    minDaysBetween: draft?.minDaysBetween != null ? String(draft.minDaysBetween) : "",
    analysisScale: draft?.analysisScale ?? "ln",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  function body() {
    const conditions: StudyArmDto[] = draft ? draft.conditions
      : [...template.conditions, ...(includeRest && template.optionalArm ? [template.optionalArm] : [])];
    return {
      question: f.question.trim(),
      primaryOutcome: draft?.primaryOutcome ?? template.primaryOutcome,
      primaryContrast: draft?.primaryContrast ?? template.primaryContrast,
      secondaryContrast: draft?.secondaryContrast ?? template.secondaryContrast,
      conditions,
      targetClients: Number(f.targetClients),
      minDaysBetween: f.minDaysBetween.trim() ? Number(f.minDaysBetween) : null,
      withholdingProcedure: f.withholdingProcedure,
      commitmentText: f.commitmentText.trim(),
      readingDevice: f.readingDevice.trim() || null,
      analysisScale: f.analysisScale,
    };
  }

  async function run(action: "save" | "lock") {
    setBusy(true); setErr(null);
    try {
      const saved: ProtocolDto = draft
        ? await apiRequest("PATCH", `/api/study/protocols/${draft.id}`, (({ conditions, primaryOutcome, primaryContrast, secondaryContrast, ...rest }) => rest)(body()))
        : await apiRequest("POST", "/api/study/protocols", body());
      if (action === "lock") await apiRequest("POST", `/api/study/protocols/${saved.id}/lock`, {});
      await qc.invalidateQueries({ queryKey: ["/api/study/protocols"] });
      setConfirming(false);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const input = "h-12 box-border w-full border border-control rounded-control px-3.5 bg-surface text-15";
  const area = "box-border w-full border border-control rounded-control px-3.5 py-3 bg-surface text-15 leading-[1.45] resize-y";
  const arms = draft?.conditions ?? [...template.conditions, ...(includeRest && template.optionalArm ? [template.optionalArm] : [])];

  return (
    <section aria-label="Protocol draft" className="r-card px-[18px] py-4 flex flex-col gap-3">
      <div className="flex justify-between items-baseline">
        <Eyebrow>PROTOCOL · DRAFT</Eyebrow>
        <span className="text-12 text-muted">Nothing is fixed until you lock it</span>
      </div>
      {!draft && (
        <div role="radiogroup" aria-label="Template" className="flex flex-wrap gap-1.5">
          {STUDY_TEMPLATES.map(t => (
            <button key={t.key} type="button" role="radio" aria-checked={template.key === t.key} className="r-chip"
              onClick={() => { setTemplate(t); setF({ ...f, question: t.question }); setIncludeRest(false); }}>{t.name}</button>
          ))}
        </div>
      )}
      <ArmList arms={arms} />
      {!draft && template.optionalArm && (
        <label className="flex items-center gap-2 text-14 min-h-[44px]">
          <input type="checkbox" checked={includeRest} onChange={e => setIncludeRest(e.target.checked)} />
          Add the optional {template.optionalArm.label.toLowerCase()} arm (its comparisons are exploratory)
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Question
        <textarea rows={2} value={f.question} onChange={set("question")} className={area} /></label>
      <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Withholding procedure, in your own words
        <textarea rows={4} value={f.withholdingProcedure} onChange={set("withholdingProcedure")} className={area}
          placeholder="What you do in your mind at the start of the session to withhold intention, and what you return to when you notice drift. Same words every time." /></label>
      <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Your commitment
        <textarea rows={3} value={f.commitmentText} onChange={set("commitmentText")} className={area} /></label>
      <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Reading device and app (every session uses it)
        <input value={f.readingDevice} onChange={set("readingDevice")} placeholder="e.g. Polar H10 + Elite HRV" className={input} /></label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Target clients
          <input value={f.targetClients} onChange={set("targetClients")} inputMode="numeric" className={`${input} font-mono`} /></label>
        <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Days between sessions
          <input value={f.minDaysBetween} onChange={set("minDaysBetween")} inputMode="numeric" placeholder="—" className={`${input} font-mono`} /></label>
      </div>
      <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Analysis scale
        <select value={f.analysisScale} onChange={set("analysisScale")} className={input}>
          <option value="ln">ln(rMSSD): changes as percentages (recommended)</option>
          <option value="linear">rMSSD in ms</option>
        </select></label>

      <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-control bg-exposure-wash text-13 leading-[1.45] text-exposure-strong">
        <AlertIcon className="shrink-0 mt-0.5" />
        <span>
          <strong>Ethics review.</strong> If results will go beyond a practice talk (for example a journal), get IRB
          approval or exemption before the first enrollment. Resonance can't check this for you.
        </span>
      </div>

      <FormError>{err}</FormError>
      {!confirming ? (
        <div className="flex flex-col gap-2">
          <button type="button" className="r-button-quiet" disabled={busy} onClick={() => run("save")}>Save draft</button>
          <PrimaryButton disabled={busy} onClick={() => setConfirming(true)}>Lock protocol…</PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-3 py-3 rounded-control bg-ground">
          <p className="m-0 text-13 leading-[1.45]">
            Locking fixes the question, conditions, contrasts, analysis scale and reading device, and generates the
            random allocation for every client now. After this, any change is a new version.
          </p>
          <PrimaryButton disabled={busy} onClick={() => run("lock")}>{busy ? "Locking…" : "Lock it"}</PrimaryButton>
          <button type="button" className="r-button-quiet" onClick={() => setConfirming(false)}>Not yet</button>
        </div>
      )}
    </section>
  );
}

function ArmList({ arms }: { arms: StudyArmDto[] }) {
  const describe = (a: StudyArmDto) => [
    a.touch ? "client's touch profile" : "no touch",
    a.intention ? "intention on" : "intention withheld",
    a.breathPacing ? "paced breathing" : null,
  ].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-1.5">
      {arms.map(a => (
        <div key={a.code} className="grid grid-cols-[24px_1fr] gap-2 text-14 leading-[1.4]">
          <span className="font-mono font-medium">{a.code}</span>
          <span><strong className="font-semibold">{a.label}.</strong> <span className="text-ink-soft">{describe(a)}{a.optional ? " · optional, exploratory" : ""}</span></span>
        </div>
      ))}
    </div>
  );
}

// ─── A locked, running study ─────────────────────────────────────────────────
function LockedStudy({ protocol: p }: { protocol: ProtocolDto }) {
  const { data: r } = useQuery<StudyResultsDto>({ queryKey: [`/api/study/protocols/${p.id}/results`] });
  const label = (code: string) => p.conditions.find(a => a.code === code)?.label ?? code;
  const [x, y] = p.primaryContrast.split("-");
  const unit = p.analysisScale === "ln" ? "%" : "ms";
  const eff = (v: number | null | undefined) => v == null ? "—"
    : p.analysisScale === "ln" ? `${v >= 0 ? "+" : "−"}${Math.abs((Math.exp(v) - 1) * 100).toFixed(1)}%`
      : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} ms`;

  return (
    <>
      {r?.isDemo && <div><DemoTag /></div>}
      <section aria-label="Protocol" className="r-card px-[18px] py-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Eyebrow>PROTOCOL · VERSION {p.version}</Eyebrow>
          <span className="flex items-center gap-1.5 text-12 font-semibold"><LockIcon />Locked {fmtMonthDay(p.lockedAt!.slice(0, 10))}</span>
        </div>
        <p className="m-0 font-serif text-20 font-medium leading-[1.3]">{p.question}</p>
        <ArmList arms={p.conditions} />
        <dl className="m-0 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-13 leading-[1.4]">
          <dt className="text-muted">Design</dt><dd className="m-0">Each client has one session of each, in random order</dd>
          <dt className="text-muted">Outcome</dt><dd className="m-0">HRV change, before → after, face-up 60-second reading</dd>
          <dt className="text-muted">Primary</dt><dd className="m-0">{label(x)} minus {label(y)}, within each client</dd>
          {p.secondaryContrast && <><dt className="text-muted">Secondary</dt><dd className="m-0">{p.secondaryContrast.split("-").map(label).join(" minus ")}</dd></>}
          <dt className="text-muted">Stops at</dt><dd className="m-0">{p.targetClients} clients, {p.targetClients * p.conditions.length} sessions</dd>
          <dt className="text-muted">Scale</dt><dd className="m-0">{p.analysisScale === "ln" ? "ln(rMSSD), fixed at lock" : "rMSSD in ms, fixed at lock"}</dd>
          <dt className="text-muted">Device</dt><dd className="m-0">{p.readingDevice}, fixed at lock</dd>
          <dt className="text-muted">Allocation</dt><dd className="m-0 font-mono text-11 break-all">SHA-256 {p.allocationSha256}</dd>
        </dl>
        <blockquote className="m-0 px-3.5 py-3 rounded-control bg-ground flex flex-col gap-1 text-14 leading-[1.45]">
          <Eyebrow>PRACTITIONER'S COMMITMENT</Eyebrow>
          {p.commitmentText}
        </blockquote>
      </section>

      {r && (
        <>
          <section aria-label="Progress" className="r-card px-[18px] py-4 flex flex-col gap-2.5">
            <h2 className="m-0 text-15 font-semibold">Progress</h2>
            <ProgressRow label="Clients complete" n={r.progress.clientsComplete} of={r.progress.targetClients} />
            <ProgressRow label="Sessions" n={r.progress.sessionsComplete} of={r.progress.targetSessions} />
          </section>

          <section aria-label={`${label(y)} versus ${label(x)}`} className="r-card px-[18px] py-4 flex flex-col gap-3">
            <h2 className="m-0 text-15 font-semibold">Same client, {label(y).toLowerCase()} → {label(x).toLowerCase()}</h2>
            {r.resultsLocked || !r.primary ? (
              // Mark, Sep 28: no interim peeking. The server sends no contrasts until completion.
              <p className="m-0 text-14 leading-[1.45] text-ink-soft">
                Results unlock when the study is complete (prevents interim peeking).
              </p>
            ) : (
              <>
                <SlopeChart results={r} x={x} y={y} labelX={label(x)} labelY={label(y)} scale={p.analysisScale} />
                <ContrastLine title={`Primary · ${x} minus ${y}`} c={r.primary} eff={eff} unit={unit} />
                {r.secondary && <ContrastLine title={`Secondary · ${r.secondary.contrast.replace("-", " minus ")}`} c={r.secondary} eff={eff} unit={unit} />}
                {r.exploratory.map(c => <ContrastLine key={c.contrast} title={`Exploratory · ${c.contrast.replace("-", " minus ")}`} c={c} eff={eff} unit={unit} />)}
                {r.verdicts && <Verdicts verdicts={r.verdicts} primary={r.primary} labelX={label(x)} labelY={label(y)} />}
              </>
            )}
          </section>

          <section aria-label="Quality checks" className="r-card px-[18px] py-4 flex flex-col gap-2">
            <h2 className="m-0 text-15 font-semibold">Is the study holding?</h2>
            {/* Counts guesses (one per A or B session), not clients. */}
            <span className="text-14">
              <span className="font-mono font-medium">{r.quality.blinding.correct} of {r.quality.blinding.guesses}</span>
              {" "}guesses correct ({x} vs {y})
            </span>
            <span className="text-12 text-ink-soft -mt-1">
              {r.quality.blinding.guesses === 0 ? "No guesses yet." : r.quality.blinding.correct / r.quality.blinding.guesses <= 0.6
                ? "Chance is about half. No sign clients can tell."
                : "Chance is about half. More correct guesses than that so far; worth watching."}
            </span>
            <QualityRow label="Intention held as assigned, your rating" value={r.quality.meanIntentionHeld != null ? `${r.quality.meanIntentionHeld.toFixed(1)} / 10` : "—"} />
            <QualityRow label="Sessions with a logged deviation" value={`${r.quality.sessionsWithDeviations} of ${r.quality.totalSessions}`} />
            <QualityRow label="Readings not on the protocol's device" value={String(r.quality.deviceMismatches.length)}
              flag={r.quality.deviceMismatches.length > 0} />
            {r.quality.deviceMismatches.length > 0 && (
              <ul className="m-0 pl-4 text-12 leading-[1.5] text-exposure-strong">
                {r.quality.deviceMismatches.map(m => (
                  <li key={m.sessionId}>{m.clientCode}, session {m.sessionId}: {[m.preReadingDevice, m.postReadingDevice].filter(d => d && d !== p.readingDevice).join(", ")}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="flex flex-col gap-2">
        <Link href="/study/session" className="r-button no-underline hover:text-surface">Start a session</Link>
        <a href={`/api/study/protocols/${p.id}/export`} className="r-button-quiet no-underline">Export methods and data</a>
      </div>
    </>
  );
}

function ProgressRow({ label, n, of }: { label: string; n: number; of: number }) {
  return (
    <div className="grid grid-cols-[1fr_120px_48px] items-center gap-3 text-14">
      <span>{label}</span>
      <div className="h-2 rounded-[4px] bg-track flex"><div className="h-2 rounded-[4px] bg-neutral" style={{ width: `${Math.min(100, (n / Math.max(1, of)) * 100)}%` }} /></div>
      <span className="font-mono text-right">{n}/{of}</span>
    </div>
  );
}

function QualityRow({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-14">
      <span>{label}</span>
      <span className={flag ? "font-mono font-medium text-exposure-strong" : "font-mono font-medium"}>{value}</span>
    </div>
  );
}

function ContrastLine({ title, c, eff, unit }: { title: string; c: ContrastDto; eff: (v: number | null | undefined) => string; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-14 font-medium">{title}</span>
        <span className="font-mono text-16 font-medium text-physiology">{eff(c.ci?.mean)}</span>
      </div>
      <span className="text-12 text-ink-soft">
        {c.ci?.low != null ? `Likely range ${eff(c.ci.low)} to ${eff(c.ci.high)} (95%) · ${c.ci.n} clients` : `${c.pairs.length} clients so far; a range needs at least 2`}
        {unit === "%" ? " · percent change" : ""}
      </span>
    </div>
  );
}

/**
 * One verdict per contrast, from the server. The headline is the primary's
 * alone; the secondary is labelled so it can't be read as the main finding.
 */
function Verdicts({ verdicts: v, primary: c, labelX, labelY }: {
  verdicts: NonNullable<StudyResultsDto["verdicts"]>; primary: ContrastDto; labelX: string; labelY: string;
}) {
  const n = c.pairs.length;
  const counts = n === 0 ? "" : `${c.rose} of ${n} clients rose with ${labelX.toLowerCase()} compared with ${labelY.toLowerCase()}, ${c.unchanged} ${c.unchanged === 1 ? "was" : "were"} unchanged, ${c.fell} fell.`;
  const others = v.lines.filter(l => l.role !== "primary");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 px-3 py-2.5 rounded-control bg-ground">
        <span className="text-12 text-muted">{v.headline.label} · {v.headline.contrast.replace("-", " minus ")}</span>
        <p className="m-0 text-14 leading-[1.45]"><strong>{v.headline.verdictText}</strong>{counts && " "}{counts}</p>
      </div>
      {others.map(l => (
        <div key={l.contrast} className="flex flex-col gap-1 px-3">
          <span className="text-12 text-muted">{l.label} · {l.contrast.replace("-", " minus ")}</span>
          <p className="m-0 text-13 leading-[1.45] text-ink-soft">{l.verdictText}</p>
        </div>
      ))}
    </div>
  );
}

/** Each client's change under the two compared conditions (design: "Same client, intention off → on"). */
function SlopeChart({ results, x, y, labelX, labelY, scale }: {
  results: StudyResultsDto; x: string; y: string; labelX: string; labelY: string; scale: "linear" | "ln";
}) {
  const show = (d: number) => (scale === "ln" ? (Math.exp(d) - 1) * 100 : d);
  const pairs = results.clientDeltas
    .filter(c => c.deltas[x] != null && c.deltas[y] != null)
    .map(c => ({ code: c.clientCode, from: show(c.deltas[y]), to: show(c.deltas[x]) }));
  if (!pairs.length) return <p className="m-0 text-13 text-muted">No client has both sessions yet.</p>;
  const vals = pairs.flatMap(p => [p.from, p.to]);
  const lo = Math.min(0, ...vals), hi = Math.max(...vals, lo + 1);
  const yPos = (v: number) => 130 - ((v - lo) / (hi - lo)) * 110;
  const avg = (k: "from" | "to") => pairs.reduce((a, p) => a + p[k], 0) / pairs.length;
  const u = scale === "ln" ? "%" : "";
  const tick = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}${u}`;
  return (
    <svg width="100%" viewBox="0 0 310 150" role="img"
      aria-label={`${pairs.length} clients. Change with ${labelY} versus ${labelX}: ${pairs.map(p => `${p.from.toFixed(1)} to ${p.to.toFixed(1)}`).join(", ")}. Average ${avg("from").toFixed(1)} to ${avg("to").toFixed(1)}.`}>
      <g className="fill-muted font-mono" fontSize={10}>
        <text x={20} y={yPos(lo) + 3}>{tick(lo)}</text>
        <text x={20} y={yPos(hi) + 3}>{tick(hi)}</text>
      </g>
      <line x1={90} y1={20} x2={90} y2={130} className="stroke-track" strokeWidth={1} />
      <line x1={220} y1={20} x2={220} y2={130} className="stroke-track" strokeWidth={1} />
      <g className="stroke-neutral-line" strokeWidth={1.5} fill="none">
        {pairs.map(p => <line key={p.code} x1={90} y1={yPos(p.from)} x2={220} y2={yPos(p.to)} />)}
      </g>
      <g className="fill-surface stroke-neutral" strokeWidth={1.5}>
        {pairs.map(p => <circle key={`f${p.code}`} cx={90} cy={yPos(p.from)} r={3.5} />)}
        {pairs.map(p => <circle key={`t${p.code}`} cx={220} cy={yPos(p.to)} r={3.5} />)}
      </g>
      <line x1={90} y1={yPos(avg("from"))} x2={220} y2={yPos(avg("to"))} className="stroke-physiology" strokeWidth={3} strokeLinecap="round" />
      <g className="fill-ink" fontSize={11} textAnchor="middle">
        <text x={90} y={146}>{y} · {labelY}</text>
        <text x={220} y={146}>{x} · {labelX}</text>
      </g>
      <g className="fill-physiology font-mono" fontSize={10}>
        <text x={228} y={yPos(avg("to")) - 3}>avg {avg("to").toFixed(1)}{u}</text>
        <text x={36} y={yPos(avg("from")) - 3}>avg {avg("from").toFixed(1)}{u}</text>
      </g>
    </svg>
  );
}
