// Consent screen copy that goes beyond the design canvas. The Consent screen
// (design/screens/Consent.html) renders these alongside the canvas text.
// Never call the withdrawal record "anonymised" or "anonymous" here: it is
// pseudonymised (a study code), not anonymous (Mark, Sep 29 2026).

/**
 * "You're in control" section, after "Leave any time, for any reason, and
 * delete your study data with one tap." Wording approved by Mark, Sep 29 2026.
 * It must match what withdrawal keeps (server/storage withdrawEnrollment):
 * the client code, the allocation row, the consent version and the
 * consent and withdrawal dates, with the account link, touch profile and
 * sessions removed.
 */
export const CONSENT_WITHDRAWAL_ALLOCATION_NOTE =
  "If you leave, Resonance keeps one small record so the study's random order stays balanced: your study code, your place in that order, and the dates you joined and left. Your readings, answers and name are deleted, and the record is no longer linked to your Resonance account.";
