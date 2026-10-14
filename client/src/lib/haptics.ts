// Touch feedback: one delegated listener gives every control and card a short
// tick. Two mechanisms, chosen by what the phone supports:
//  • Android (Chrome / installed PWA): the Vibration API.
//  • iPhone (iOS 17.4+): Safari has no vibrate(), but toggling a hidden
//    <input type="checkbox" switch> from a tap makes the system play its switch
//    haptic. It only works inside a real tap, which is why we hook `click`.
// Controls (buttons, links, chips, toggles) get a firm tick; cards a softer one
// (the iPhone switch haptic has a single strength).
export const HAPTICS_KEY = "resonance-haptics";

const CONTROL =
  'button, a[href], summary, select, label[for], [role="button"], [role="tab"], [role="switch"], [role="link"], [role="menuitem"], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="file"]';
const CARD = ".r-card, .r-tile";

export type HapticMode = "vibrate" | "ios-switch" | "none";

export function hapticMode(): HapticMode {
  if (typeof navigator === "undefined") return "none";
  if (typeof navigator.vibrate === "function") return "vibrate";
  if (typeof document !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios-switch";
  return "none";
}

export function hapticsEnabled(): boolean {
  try { return localStorage.getItem(HAPTICS_KEY) !== "off"; } catch { return true; }
}

let switchLabel: HTMLLabelElement | null = null;
function iosSwitchTick() {
  try {
    if (!switchLabel) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      label.appendChild(input);
      document.body.appendChild(label);
      switchLabel = label;
    }
    switchLabel.click();
  } catch { /* unsupported */ }
}

/** Play a tick now. Returns false when the phone can't. */
export function tick(ms = 12): boolean {
  const mode = hapticMode();
  try {
    if (mode === "vibrate") return navigator.vibrate(ms);
    if (mode === "ios-switch") { iosSwitchTick(); return true; }
  } catch { /* blocked */ }
  return false;
}

export function setHaptics(on: boolean) {
  try { if (on) localStorage.removeItem(HAPTICS_KEY); else localStorage.setItem(HAPTICS_KEY, "off"); } catch { /* lasts this visit only */ }
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
}

/** How strong a tap on this target should feel (0 = none). */
function strength(target: EventTarget | null): number {
  const t = target instanceof Element ? target : null;
  if (!t) return 0;
  const control = t.closest(CONTROL);
  if (control) return isDisabled(control) ? 0 : 12;
  return t.closest(CARD) ? 6 : 0;
}

export function installHaptics() {
  if (typeof document === "undefined" || hapticMode() === "none") return;
  let last = 0;
  // Android: tick the instant a finger lands, once the page has been tapped before
  // (Chrome ignores vibrate() until the user has interacted with the page).
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" || !hapticsEnabled() || hapticMode() !== "vibrate") return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const ms = strength(e.target);
    if (ms && tick(ms)) last = performance.now();
  }, { passive: true, capture: true });
  // Everywhere: a completed tap. Covers the very first tap on Android, and is the
  // only path on iPhone. Skipped when pointerdown already ticked for this tap.
  document.addEventListener("click", e => {
    if (!e.isTrusted || !hapticsEnabled()) return;
    if (performance.now() - last < 600) return;
    const ms = strength(e.target);
    if (ms && tick(ms)) last = performance.now();
  }, { capture: true });
}
