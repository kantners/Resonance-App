// Touch feedback: one delegated listener gives every control and card a short
// haptic tick on touch. Uses the Vibration API (Android Chrome / installed PWA);
// iOS Safari has no web haptics, so it is silently a no-op there.
// Controls (buttons, links, chips, toggles) get a firm tick; cards a softer one.
export const HAPTICS_KEY = "resonance-haptics";

const CONTROL =
  'button, a[href], summary, select, label[for], [role="button"], [role="tab"], [role="switch"], [role="link"], [role="menuitem"], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="file"]';
const CARD = ".r-card, .r-tile";

export function hapticsEnabled(): boolean {
  try { return localStorage.getItem(HAPTICS_KEY) !== "off"; } catch { return true; }
}

export function setHaptics(on: boolean) {
  try { if (on) localStorage.removeItem(HAPTICS_KEY); else localStorage.setItem(HAPTICS_KEY, "off"); } catch { /* lasts this visit only */ }
  if (on) tick(12);
}

function tick(ms: number) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
}

export function installHaptics() {
  if (typeof document === "undefined" || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" || !hapticsEnabled()) return;   // touch and pen only
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const control = t.closest(CONTROL);
    if (control) { if (!isDisabled(control)) tick(12); return; }
    if (t.closest(CARD)) tick(6);
  }, { passive: true });
}
