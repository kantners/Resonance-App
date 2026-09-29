// How the Brief reads you (design/screens/Recovery-Rule.html), with today's
// numbers filled in. Copy changes from the canvas, per Mark (Sep 28):
//   - the label gate is |B| = 14 and |W| ≥ 5 (HANDOFF §3.2), not "21 nights";
//   - with HRV_LOG_SCALE on, the HRV range is described as log-scale.
import type { ReactNode } from "react";
import type { BriefResponse } from "@shared/api";
import { Eyebrow, SubScreen } from "@/components/Layout";
import { useBrief } from "@/lib/api";
import { fmtHeaderDate, localToday } from "@/lib/dates";
import { fmt0, fmt1 } from "@/lib/format";

const LABEL_TEXT = { steady: "Steady", drifting_down: "Drifting down", recovering: "Recovering", building_baseline: "Building your baseline" };

function Card({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="r-card px-[18px] py-4 flex flex-col gap-2.5">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className="m-0 text-17 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const Body = ({ children }: { children: ReactNode }) => <p className="m-0 text-14 leading-[1.5] text-ink-soft">{children}</p>;

function Row({ left, right, last }: { left: ReactNode; right: ReactNode; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] gap-3 items-center min-h-[48px] text-14 leading-[1.4] ${last ? "" : "border-b border-hairline"}`}>
      <span>{left}</span><span className="text-right">{right}</span>
    </div>
  );
}

function lastNightSentence(b: BriefResponse): string {
  const n = b.lastNight;
  if (n.state === "no_data") return "No HRV is logged for last night yet, so there is nothing to note.";
  const values = `HRV ${fmt0(n.hrv)}${n.rhr != null ? `, resting HR ${fmt0(n.rhr)}` : ""}`;
  if (n.state === "in_range") return `Last night both signals were inside your range (${values}).`;
  const which = n.state === "both_out" ? "both signals were" : "one signal was";
  if (n.consecutiveOut <= 1) {
    return `Last night ${which} out of range (${values}). The night before was in range, so it's the first night: noted.`;
  }
  return `Last night ${which} out of range (${values}). It's the ${n.consecutiveOut === 2 ? "second" : `${n.consecutiveOut}th`} night in a row, so the Brief gives a direct nudge.`;
}

export default function RecoveryRuleScreen() {
  const today = localToday();
  const { data: b } = useBrief(today);
  const hrv = b?.week.hrvRange, rhr = b?.week.rhrRange;
  const logScale = b?.hrvLogScale ?? true;

  return (
    <SubScreen back={{ href: "/", label: "Brief" }} title="How the Brief reads you" demo={b?.isDemo}>
      <p className="m-0 -mt-2 text-15 leading-[1.45] text-ink-soft">
        Two signals, compared only with your own recent nights. Weeks set the label. Single nights are noted, never judged.
      </p>

      <Card id="step1" eyebrow="STEP 1" title="Your baseline and normal range">
        <Body>
          Resonance takes the 14 nights before this week and calculates each signal's average and typical night-to-night
          spread (standard deviation, SD).
        </Body>
        <div className="flex flex-col">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_1.2fr] gap-1.5 font-mono text-10 tracking-badge text-muted py-1.5 border-b border-track">
            <span>SIGNAL</span><span className="text-right">AVG</span><span className="text-right">SD</span><span className="text-right">NORMAL RANGE</span>
          </div>
          <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_1.2fr] gap-1.5 text-13 pt-0.5 pb-1.5 border-b border-hairline">
            <span>HRV</span>
            <span className="text-right font-mono">{hrv ? fmt0(hrv.mean) : "—"}</span>
            <span className="text-right font-mono">{hrv ? fmt0(hrv.sd) : "—"}</span>
            <span className="text-right font-mono">{hrv ? `${fmt1(hrv.low)}–${fmt1(hrv.high)} ms` : "building"}</span>
          </div>
          <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_1.2fr] gap-1.5 text-13 py-0.5">
            <span>Resting HR</span>
            <span className="text-right font-mono">{rhr ? fmt0(rhr.mean) : "—"}</span>
            <span className="text-right font-mono">{rhr ? fmt0(rhr.sd) : "—"}</span>
            <span className="text-right font-mono">{rhr ? `${fmt0(rhr.low)}–${fmt0(rhr.high)} bpm` : "building"}</span>
          </div>
        </div>
        <p className="m-0 text-13 leading-[1.5] text-ink-soft">
          {logScale
            ? "HRV range: average ± 0.5 SD, calculated on the logarithm of HRV and converted back to ms, because HRV readings are skewed. Half an SD is the smallest change commonly treated as meaningful in HRV monitoring. "
            : "HRV range: average ± 0.5 SD, the smallest change commonly treated as meaningful in HRV monitoring. "}
          Resting HR: ± 1 SD, so a 1 bpm wobble isn't flagged.
        </p>
      </Card>

      <Card id="step2" eyebrow="STEP 2" title="Your week sets the label">
        <Body>
          The nights logged in the last 7 days (at least 5 of them) are averaged and compared with the normal range. A
          signal is strained when HRV sits below its range or resting HR above it.
        </Body>
        <div className="flex flex-col">
          <Row left="Neither 7-night average strained" right={<span className="font-serif text-20 font-medium">Steady</span>} />
          <Row left="Either 7-night average strained" right={<span className="font-serif text-20 font-medium">Drifting down</span>} />
          <Row left="Drifting down within the last 7 days, back in range now" right={<span className="font-serif text-20 font-medium">Recovering</span>} last />
        </div>
      </Card>

      <Card id="step3" eyebrow="STEP 3" title="When the app speaks up">
        <div className="flex flex-col">
          <Row left="1 night out of range" right="Noted. One small suggestion at most." />
          <Row left="2 in a row" right="A direct nudge, naming the pattern behind them if your logs show one." />
          <Row left="7-night average out" right="The label becomes Drifting down, with the pattern behind it." />
          <Row left="14+ days drifting, resting HR up" right="Said plainly: a pattern this persistent is worth raising with a clinician. No diagnosis, and no softening." last />
        </div>
        <Body>
          Nights you tag (alcohol, late meal, hard workout, illness, travel) still count in every average. The tag only
          changes the wording: a hard ride's dip is shown as expected, not as a problem.
        </Body>
      </Card>

      {b && (
        <Card id="today" eyebrow={`THIS MORNING · ${fmtHeaderDate(today)}`} title="Applied to today">
          {b.week.label === "building_baseline" ? (
            <Body>
              Your baseline is still building: {Math.min(b.firstRun.baselineNights, 14)} of 14 baseline nights, and{" "}
              {b.week.nights} of 7 nights this week. The label appears once there are 14 baseline nights and at least 5
              nights in the week.
            </Body>
          ) : (
            <>
              <div className="flex flex-col">
                <Row left="HRV, 7 nights" right={<span className="flex gap-3 justify-end"><span className="font-mono">{fmt1(b.week.hrv7Avg)}</span><span className="font-semibold">{b.week.hrvStrained ? "Below range" : "In range"}</span></span>} />
                <Row left="Resting HR, 7 nights" right={<span className="flex gap-3 justify-end"><span className="font-mono">{fmt1(b.week.rhr7Avg)}</span><span className="font-semibold">{b.week.rhrStrained ? "Above range" : "In range"}</span></span>} last />
              </div>
              <div className="flex justify-between items-baseline px-3 py-2.5 rounded-control bg-ground">
                <span className="text-14">Your week · {b.week.nights} of 7 nights</span>
                <span className="font-serif text-20 font-medium">{LABEL_TEXT[b.week.label]}</span>
              </div>
            </>
          )}
          <Body>{lastNightSentence(b)}</Body>
        </Card>
      )}

      <Card id="batting" title={`Why "${b && b.consistency.logged ? `${b.consistency.inRange} of ${b.consistency.logged}` : "22 of 30"}", not a streak`}>
        <Body>
          A streak resets to zero after one bad night. A rolling count of the last 30 nights loses one-thirtieth.
          Consistency is what's being measured, not perfection.
        </Body>
      </Card>

      <Card id="excluded" title="What the label leaves out, on purpose">
        <Body><strong className="text-ink">Sleep score.</strong> Each device calculates it differently, and it already folds in HRV and heart rate, which would count them twice.</Body>
        <Body><strong className="text-ink">Screen time.</strong> It's what Resonance compares recovery against. Putting it into the label would make any correlation circular.</Body>
        <Body>
          <strong className="text-ink">Missing nights.</strong> No label until at least 19 nights are logged: 14 for the
          baseline and at least 5 of the 7 nights in the week. A night without an HRV entry is skipped, never estimated.
        </Body>
      </Card>

      <p className="m-0 text-13 leading-[1.5] text-muted">
        A self-monitoring summary, not a medical assessment. Readings from different devices aren't comparable, so the
        baseline restarts when your HRV source changes.
        {b && <> Rule version {b.ruleVersion}.</>}
      </p>
    </SubScreen>
  );
}
