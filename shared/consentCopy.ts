// Consent screen copy that goes beyond the design canvas. The Consent screen
// (design/screens/Consent.html) renders these alongside the canvas text.

/**
 * "You're in control" section, after "Leave any time, for any reason, and
 * delete your study data with one tap." Approved by Mark, Sep 28 2026: an
 * anonymised allocation record is kept after withdrawal so the allocation
 * stays balanced (see server/routes/study.ts, withdrawal tombstones).
 */
export const CONSENT_WITHDRAWAL_ALLOCATION_NOTE =
  "If you leave, Resonance keeps one anonymised allocation record (your slot number only, with no readings, answers or name) so the study's random order stays balanced.";
