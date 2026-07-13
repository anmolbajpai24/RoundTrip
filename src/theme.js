// App-level branding. Per-trip look (leg colours, title) lives in each trip's
// config; this is only the chrome. Change APP_NAME/APP_SLUG here to rebrand
// (also update index.html and the PWA manifest in vite.config.js to match).
export const APP_NAME = "Roundtrip";
export const APP_SLUG = "roundtrip";
export const APP_TAGLINE = "Plan it together, carry it with you.";

// Chrome accent + neutrals (kept from the original design).
export const ACCENT = "#C8102E";
export const INK = "#1D2433";
export const MUTED = "#8A8F98";

// Backup files written by older builds carried this app id; imports must keep
// accepting it (see storage.js).
export const LEGACY_APP_SLUG = "uk-trip-companion";
