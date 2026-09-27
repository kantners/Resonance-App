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

export default function TermsOfService() {
  const [, navigate] = useHashLocation();

  return (
    <div className="legal-page">
      <style>{LEGAL_CSS}</style>

      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 0 }}>
        <img src="/hero_settings.jpg" alt="" className="kewt-cin-hero__img" style={{ objectPosition: "center 45%" }} />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,15)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>KEWT · Legal</div>
          <div className="kewt-cin-hero__title">Terms of Service.</div>
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

        <h2>1. Acceptance of terms</h2>
        <p>
          By creating an account or using KEWT (the "Service"), operated by Blue Ember Intelligence /
          <span className="legal-fillin"> [FILL IN: legal business name]</span>, you agree to these Terms of Service
          and the accompanying Privacy Policy. If you don't agree, please don't use the Service.
        </p>

        <h2>2. What KEWT is</h2>
        <p>
          KEWT (Kinetic Endurance Wellness Tracking) is a wellness and endurance tracking platform covering six
          pillars: fitness and training, sleep and recovery, breathwork and meditation, posture and alignment,
          wellness insights, and nutrition and fueling. KEWT helps you track, understand, and reflect on your own
          logged data. <strong>KEWT is not a medical device and does not provide medical advice, diagnosis, or
          treatment.</strong> See Section 7.
        </p>

        <h2>3. Beta status</h2>
        <p>
          KEWT is currently offered as a <strong>beta product</strong>. By participating in the beta, you understand
          and agree that:
        </p>
        <ul>
          <li>Features may change, break, or be removed without notice</li>
          <li>Data may occasionally be reset, migrated, or lost as the underlying schema evolves</li>
          <li>Uptime is not guaranteed, and the Service may be unavailable at times</li>
          <li>Beta access is offered at no charge and does not guarantee continued free access after general availability</li>
          <li>Your feedback may be used to improve the Service, and by providing feedback you grant us the right to use it for that purpose without compensation</li>
        </ul>

        <h2>4. Eligibility</h2>
        <p>You must be at least 18 years old to use KEWT. By creating an account, you represent that you meet this requirement.</p>

        <h2>5. Your account</h2>
        <p>
          You're responsible for maintaining the confidentiality of your account credentials and for all activity
          under your account. Notify us promptly at <span className="legal-fillin">[FILL IN: contact email]</span> if
          you suspect unauthorized access.
        </p>

        <h2>6. Your data</h2>
        <p>
          <strong>You own your data.</strong> The health, fitness, and personal data you log or import into KEWT
          belongs to you. By using the Service, you grant us a limited license to store, process, and display that
          data back to you as necessary to provide the Service, including generating insights and dashboards from it.
        </p>
        <p>
          You're responsible for the accuracy of data you manually log. Data imported from third-party services
          (such as Strava or Garmin) reflects whatever that service provides to us and may contain that source's own
          errors.
        </p>

        <h2>7. No medical advice</h2>
        <p>
          KEWT is a wellness and fitness tool, not a substitute for professional medical care. Insights,
          interpretations, and any language suggesting patterns in your data (including the Daily Intelligence
          feature) are general and educational, not clinical assessments, diagnoses, or treatment recommendations.
          Always consult a qualified healthcare provider before making decisions about your health, especially
          regarding training intensity, nutrition, fasting, or any condition affecting your safety. <strong>Do not
          use KEWT in place of medical advice, and do not delay seeking medical care because of anything shown in
          the app.</strong>
        </p>

        <h2>8. Third-party services</h2>
        <p>
          KEWT may integrate with third-party services such as Strava and Garmin Connect. Your use of those services
          is governed by their own terms and privacy policies, which we don't control. We're not responsible for the
          availability, accuracy, or practices of third-party services you choose to connect.
        </p>

        <h2>9. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use KEWT for any unlawful purpose</li>
          <li>Attempt to access another user's account or data without authorization</li>
          <li>Reverse-engineer, scrape, or attempt to extract the Service's underlying code or data structures beyond your own account</li>
          <li>Upload data or files that infringe on others' rights or contain malicious code</li>
        </ul>

        <h2>10. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, KEWT and its operator are provided "as is," without warranties of
          any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use
          of the Service, including but not limited to loss of data during the beta period, decisions made based on
          insights shown in the app, or injuries related to physical training, breathwork, fasting, or other
          activities you undertake based on information in KEWT.
          {" "}<span className="legal-fillin">[FILL IN pending attorney review: jurisdiction-appropriate liability cap language]</span>
        </p>

        <h2>11. Termination</h2>
        <p>
          You may stop using KEWT and request account deletion at any time by contacting
          {" "}<span className="legal-fillin">[FILL IN: contact email]</span>. We may suspend or terminate accounts
          that violate these terms, or, during the beta period, as part of ordinary beta management (including
          discontinuing the beta itself).
        </p>

        <h2>12. Changes to these terms</h2>
        <p>
          We may update these Terms as KEWT develops, particularly as it moves from beta toward general
          availability. Material changes will be communicated to active users. Continued use of KEWT after changes
          take effect constitutes acceptance of the updated terms.
        </p>

        <h2>13. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Commonwealth of Virginia, without regard to conflict-of-law
          principles.
          {" "}<span className="legal-fillin">[FILL IN pending attorney review: any venue/arbitration clause you want included]</span>
        </p>

        <div className="legal-contact">
          Questions about these Terms: <span className="legal-fillin">[FILL IN: contact email]</span>
        </div>
      </div>
    </div>
  );
}
