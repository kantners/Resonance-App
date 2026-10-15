// Plain Privacy and Terms pages. Working text for Layer 0, to be reviewed
// before any public release (flagged in the PR). Privacy rewritten Oct 15 2026; have counsel review.
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
      <p>Last updated October 15, 2026. Resonance is operated by Blue Ember Wellness in Richmond, Virginia. It is its own app: it shares no accounts, database or data with any other Blue Ember app. Questions: Mark@BlueEmberWellnessRVA.com.</p>
      <h2>What we collect</h2>
      <p>Your account: your email address and a password, which we keep only as a salted hash. Your entries: sleep, overnight HRV (RMSSD), resting heart rate, screen time and pickups, stillness and reading sessions, fasting windows, and the context tags you choose. If you connect a Bluetooth heart rate sensor, the summary numbers of readings you choose to save: lowest and average heart rate, or the start and end of a stillness session, with the sensor's name. The live beat-by-beat stream stays on your device and is not sent to us. Your settings, such as time zone and theme. The summaries Resonance computes from these, each saved with the rule version that produced it. We do not collect your name, location, contacts, or advertising identifiers, and we do not read other apps on your phone.</p>
      <h2>How we use it</h2>
      <p>Only to show you your own readings, compare them with your own recent nights, and report what they show. We do not sell your data, share it for advertising, or use it to train AI models.</p>
      <h2>Screenshots</h2>
      <p>If you import a screenshot, the image is sent to OpenAI, our service provider, to read the numbers in it. It is processed once and deleted from our server; we do not keep the image. Screen Time and Digital Wellbeing screenshots show app names and usage times, so crop anything you would rather not send. OpenAI handles the image under its own API terms, which we do not control. You review and edit the values before anything is saved, and you can always type the numbers instead.</p>
      <h2>Session studies</h2>
      <p>If you join a practitioner's study, only your on-table readings and answers are shared with that practitioner, under a client code, not your name. Your daily data is never shared. You can leave at any time; your readings, answers and name are deleted. One small record is kept so the study's random order stays balanced: your study code, your place in that order, and the dates you joined and left. It is no longer linked to your Resonance account.</p>
      <h2>Where it lives, and for how long</h2>
      <p>Your data is stored in a managed database hosted in the United States and sent over encrypted connections. We keep it until you delete it. Resonance uses one sign-in cookie, set only to keep you signed in for up to 30 days. There are no advertising or tracking cookies and no third-party analytics.</p>
      <h2>Your choices</h2>
      <p>Settings → Delete account removes your account and everything linked to it. To ask for a copy of your data, or for anything else, email us and we will respond within 30 days.</p>
      <h2>Health information</h2>
      <p>Resonance is a self-monitoring tool, not a medical device or medical care, and it does not diagnose any condition. Blue Ember Wellness is not a healthcare provider here, and Resonance is not offered as a HIPAA-covered service. If that ever changes, for example through a clinic collaboration, this page will change first. If a pattern concerns you, talk to a clinician.</p>
      <h2>Changes and age</h2>
      <p>Resonance is for adults 18 and over. If we change this page in a meaningful way, we will say so in the app before the change takes effect.</p>
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
