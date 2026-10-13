// Theme choice: "system" follows the phone; Light/Dark pin it. Same rule as the
// pre-paint script in index.html: only an explicit choice sets data-theme.
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_KEY = "resonance-theme";

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch { return "system"; }
}

export function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch { /* storage blocked: lasts for this visit only */ }
  const root = document.documentElement;
  root.classList.add("theme-fade");                       // cross-fade, see index.css
  window.setTimeout(() => root.classList.remove("theme-fade"), 450);
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/** What the screen shows right now, whatever the choice. */
export function effectiveTheme(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The easter egg: flip to the opposite of what's showing, and pin it. */
export function toggleTheme(): "light" | "dark" {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  try { navigator.vibrate?.([12, 40, 12]); } catch { /* no haptics */ }
  return next;
}
