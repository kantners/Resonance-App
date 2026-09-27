import { useHashLocation } from "wouter/use-hash-location";
import { ArrowLeft } from "lucide-react";

const LEGAL_CSS = `
.legal-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 0 0 60px;
}
.legal-back-row {
  max-width: 680px;
  margin: 16px auto 0;
  padding: 0 20px;
}
.legal-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 4px;
}
.legal-back-btn:hover { color: var(--color-primary); }
.legal-content {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 20px 0;
}
.legal-updated {
  font-size: 12px;
  color: var(--color-text-faint, var(--color-text-muted));
  margin-bottom: 24px;
}
.legal-content h2 {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
  margin: 28px 0 10px;
  letter-spacing: -0.01em;
}
.legal-content h2:first-of-type { margin-top: 0; }
.legal-content p {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}
.legal-content p strong { color: var(--color-text); }
.legal-content ul {
  margin: 0 0 12px;
  padding-left: 20px;
}
.legal-content li {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}
.legal-fillin {
  color: #d97706;
  font-weight: 600;
}
.legal-contact {
  margin-top: 28px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--color-surface, rgba(0,0,0,0.03));
  border: 1px solid var(--color-border, rgba(0,0,0,0.08));
  font-size: 13px;
  color: var(--color-text-muted);
}
`;

export default function PrivacyPolicy() {
  const [, navigate] = useHashLocation();

  return (
    <div className="legal-page">
      <style>{LEGAL_CSS}</style>

      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 0 }}>
        <img src="/hero_settings.jpg" alt="" className="kewt-cin-hero__img" style={{ objectPosition: "center 45%" }} />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,15)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>KEWT · Legal</div>
          <div className="kewt-cin-hero__title">Privacy Policy.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
        </div>
      </div>

      <div className="legal-back-row">
        <button className="legal-back-btn" onClick={() => navigate("/settings")}>
          <ArrowLeft size={14} /> Back to Settings
        </button>
      </div>

      <div className="legal-content">
        <div className="legal-updated">Last updated: <span className="legal-fillin">[DATE]</span></div>

        <h2>Who we are</h2>
        <p>
          KEWT (Kinetic Endurance Wellness Tracking) is a wellness and endurance tracking platform published by
          Blue Ember Intelligence, operated by <span className="legal-fillin">[FILL IN: legal business name / your name]</span>,
          based in Richmond, Virginia. This Privacy Policy explains what information KEWT collects, how it's used,
          and the choices you have.
        </p>
        <p>
          If you have questions about this policy, contact us at <span className="legal-fillin">[FILL IN: contact email]</span>.
        </p>

        <h2>KEWT is currently in beta</h2>
        <p>
          KEWT is in an active beta period. Features, data structures, and this policy itself may change as the
          product develops. We'll do our best to notify beta users of material changes, but the beta nature of the
          product means less stability than a finished, publicly launched app. See the Terms of Service for
          beta-specific terms.
        </p>

        <h2>What information we collect</h2>
        <p><strong>Account information.</strong> Email address and any other information you provide when creating an account.</p>
        <p><strong>Health and fitness data you provide or import</strong>, which may include:</p>
        <ul>
          <li>Sleep duration, sleep stages, and sleep quality scores</li>
          <li>Heart rate variability (HRV), resting heart rate, and body battery / recovery metrics</li>
          <li>Training and activity data (distance, duration, power, pace, heart rate, elevation, cadence)</li>
          <li>Body composition data (weight, body fat percentage, muscle mass, and related metrics)</li>
          <li>Breathwork and meditation session logs</li>
          <li>Posture and alignment check-in data</li>
          <li>Food and hydration entries you choose to log</li>
          <li>Fasting window data</li>
        </ul>
        <p>
          <strong>Files you upload</strong>, including .FIT, .TCX, .GPX, and .CSV activity files, and screenshots from
          third-party apps (such as Garmin Connect) that you choose to import.
        </p>
        <p>
          <strong>Data from connected third-party services</strong>, if you choose to link them, including Strava and
          (pending integration) Garmin Connect. When you connect a third-party account, we receive the data that
          service's API makes available to us, governed by both this policy and that service's own terms.
        </p>
        <p>
          <strong>Usage data</strong>, such as which features you use and basic device/browser information, collected
          automatically to help us maintain and improve the app.
        </p>

        <h2>What we do not collect</h2>
        <p>
          We do not knowingly collect information from anyone under 18. KEWT is not directed at children, and is not
          intended for use by minors.
        </p>

        <h2>How we use your information</h2>
        <p>We use the information above to:</p>
        <ul>
          <li>Provide the core functionality of the app (tracking, dashboards, insights across your logged data)</li>
          <li>Generate the Daily Intelligence and related insight features, which reflect patterns in your own data back to you</li>
          <li>Maintain, secure, and improve the service</li>
          <li>Communicate with you about your account, beta feedback, or material changes to the service</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p><strong>We do not sell your personal or health information to third parties.</strong></p>

        <h2>KEWT does not provide medical advice</h2>
        <p>
          KEWT is a wellness and fitness tracking tool, not a medical device, and it does not diagnose, treat, or
          provide medical advice. Insights and interpretations shown in the app (including Daily Intelligence) are
          general, educational, pattern-level observations based on your own logged data, not clinical assessments.
          Always consult a qualified healthcare provider for medical concerns, and do not use KEWT as a substitute
          for professional medical guidance.
        </p>

        <h2>Where your data is stored and how it's protected</h2>
        <p>
          Your data is stored using Supabase (PostgreSQL database with Row Level Security policies restricting
          access to your own account) and processed through infrastructure hosted on Railway and Vercel. We use
          industry-standard security practices, but no system is perfectly secure, and we cannot guarantee absolute
          security of your information.
        </p>
        <p className="legal-fillin">[FILL IN: confirm current data storage region/location, and whether backups are encrypted at rest]</p>

        <h2>Important note on health data and applicable law</h2>
        <p>
          KEWT is a direct-to-consumer wellness app, not a healthcare provider, health plan, or clearinghouse, and is
          not currently subject to HIPAA (the U.S. federal law governing medical providers and insurers). Depending
          on your state of residence, other privacy laws may apply to the health-related data KEWT collects, such as
          Washington State's My Health My Data Act or the California Consumer Privacy Act.
          {" "}<span className="legal-fillin">[FILL IN or remove based on attorney review: specific representations about which state privacy laws KEWT complies with]</span>
        </p>

        <h2>Your choices and rights</h2>
        <p>You can:</p>
        <ul>
          <li>Access and export your logged data through the app</li>
          <li>Request deletion of your account and associated data by contacting <span className="legal-fillin">[FILL IN: contact email]</span></li>
          <li>Disconnect any linked third-party service (such as Strava) at any time</li>
          <li>Opt out of non-essential communications</li>
        </ul>

        <h2>Data retention</h2>
        <p>
          We retain your data for as long as your account is active. If you delete your account, we will delete your
          personal data within <span className="legal-fillin">[FILL IN: e.g., 30 days]</span>, except where retention
          is required for legal or security purposes.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this Privacy Policy as KEWT develops, particularly as it moves from beta toward general
          availability. We'll update the "Last updated" date above and, for material changes, notify active users
          directly.
        </p>

        <div className="legal-contact">
          Questions about this policy or your data: <span className="legal-fillin">[FILL IN: contact email]</span>
        </div>
      </div>
    </div>
  );
}
