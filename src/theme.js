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

// ---------- people & places palettes (Grand Tour brief §4) ----------
// Member colours identify PEOPLE (badges, notes, packing rows, payers).
// Destination colours identify PLACES (legs, day cards, route line) — a
// separate muted, earthy family so people and places never read as the same
// system. Legacy hexes already stored in trips keep rendering as-is; these
// only drive pickers and auto-assignment.
export const MEMBER_COLORS = ["#3D5A77", "#7E4F79", "#47795A", "#A6444B", "#B98524", "#2E7B76"];
export const DEST_COLORS = ["#1F6E73", "#B26F1C", "#6F4162", "#B25A41", "#56707F", "#7A7038"];

// Legible ink for text sitting on a member/destination colour. Exact
// on-colours from the locked spec first; relative-luminance fallback keeps
// legacy stored colours (old palette, imports) readable.
const ON_COLOR = {
  "#B98524": "#2B1D04", // amber is the one light member colour
  "#1F6E73": "#F2FAF9",
  "#B26F1C": "#251604",
  "#6F4162": "#FAF3F8",
};
export function onColor(hex) {
  const exact = ON_COLOR[String(hex || "").toUpperCase()];
  if (exact) return exact;
  const n = parseInt(String(hex || "").replace("#", ""), 16);
  if (Number.isNaN(n)) return "#FFFFFF";
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.35 ? "#2B1D04" : "#FFFFFF";
}

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
