// App-level branding. Per-trip look (leg colours, title) lives in each trip's
// config; this is only the chrome. Change APP_NAME/APP_SLUG here to rebrand
// (also update index.html and the PWA manifest in vite.config.js to match).
export const APP_NAME = "Roundtrip";
export const APP_SLUG = "roundtrip";
export const APP_TAGLINE = "Plan it together, carry it with you.";

// Chrome accent + neutrals. All three resolve through the CSS theme tokens
// in src/styles/tokens.css so every usage follows light/dark automatically
// (the dark accent is a softened rosé, not the light wine).
export const ACCENT = "var(--accent)";
export const INK = "var(--ink)";
export const MUTED = "var(--muted)";

// Backup files written by older builds carried this app id; imports must keep
// accepting it (see storage.js).
export const LEGACY_APP_SLUG = "uk-trip-companion";

// ---------- appearance (system | light | dark) ----------
const THEME_KEY = "roundtrip:theme";

export function getThemePref() {
  try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; }
}

export function setThemePref(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* private mode */ }
  applyTheme(pref);
}

export function applyTheme(pref = getThemePref()) {
  const dark = pref === "dark" ||
    (pref === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // Must match --bg in src/styles/tokens.css (and the manifest colours in
  // vite.config.js + index.html for the light value).
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1A140D" : "#F5EFE4");
}

// Apply the saved theme at boot and follow the OS while pref is "system".
export function initTheme() {
  applyTheme();
  window.matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener?.("change", () => { if (getThemePref() === "system") applyTheme(); });
}
