/** Save feedback: a brief checkmark (SavedMark) plus a light haptic tick. */
const EVENT = "r-saved";

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function signalSaved(label = "Saved") {
  buzz(15);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: label }));
}

export function signalError() {
  buzz([30, 60, 30]);
}

export function onSaved(fn: (label: string) => void) {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
