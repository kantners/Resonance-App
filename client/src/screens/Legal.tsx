// Plain Privacy and Terms pages. Working text for Layer 0, to be reviewed
// before any public release (flagged in the PR).
import type { ReactNode } from "react";
import { SubScreen } from "@/components/Layout";

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SubScreen back={{ href: "/", label: "Back" }} title={title}>
      <article className="r-card px-5 py-4 flex flex-col gap-3 text-14 leading-[1.55] text-ink-soft [&_h2]:m-0 [&_h2]:text-15 [&_h2]:font-semibold [&_h2]:text-ink [&_p]:m-0">
        {children}
      </article>
    </SubScreen>
  );
}

export function PrivacyScreen() {
  return (
    <Doc title="Privacy">
      <p>Resonance is operated by Blue Ember Wellness. It is its own app: it shares no accounts, database or data with any other Blue Ember app.</p>
      <h2>What Resonance stores</h2>
      <p>Your account (email and a hashed password), the readings and logs you enter (sleep, HRV, resting heart rate, screen time, stillness, reading, fasting, context tags), and the summaries Resonance computes from them, each with the rule version that produced it.</p>
      <h2>Screenshots</h2>
      <p>If you import a screenshot, the image is sent to OpenAI to read the numbers, then deleted from our server. Screen Time and Digital Wellbeing screenshots show app names and how long you used them. You check and edit the values before anything is saved. You can always enter the numbers by hand instead.</p>
      <h2>Session studies</h2>
      <p>If you join a practitioner's study, only your on-table readings and answers are shared with the practitioner, under a client code, not your name. Your daily data is never shared. You can leave at any time; your readings, answers and name are deleted. One small record is kept so the study's random order stays balanced: your study code, your place in that order, and the dates you joined and left. It is no longer linked to your Resonance account.</p>
      <h2>Deleting your data</h2>
      <p>Settings → Delete account removes your account and everything linked to it.</p>
      <h2>Not medical care</h2>
      <p>Resonance is a self-monitoring tool. It doesn't diagnose any condition, and it isn't medical care or a substitute for it.</p>
    </Doc>
  );
}

export function TermsScreen() {
  return (
    <Doc title="Terms">
      <p>Resonance compares your own readings with your own recent nights and reports what it observes. Findings are associations in your data, not diagnoses or medical advice.</p>
      <p>You must be 18 or older to use Resonance. You own the data you enter and can delete it at any time.</p>
      <p>Resonance is offered as an early version; features and these terms may change. If a pattern concerns you, talk to a clinician.</p>
    </Doc>
  );
}
