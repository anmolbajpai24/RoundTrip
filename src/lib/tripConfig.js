import { createContext, useContext } from "react";

// Per-trip configuration. Every trip stores its definition (title, dates,
// currency, legs, days, packing template) as one shared kv row under the
// `trip-config` key — see the shape produced by buildLegacyConfig() and the
// TripWizard. Days are keyed by their ISO date string (YYYY-MM-DD), which is
// also the suffix of per-day kv keys like `outfit:2026-08-07`.

export const CONFIG_KEY = "trip-config";

export const TripConfigContext = createContext(null);
export const useTripConfig = () => useContext(TripConfigContext);

// ---------- local-date helpers ----------
// ISO strings are treated as *local* calendar dates. Comparisons are done on
// the strings themselves (lexicographic order matches date order) to avoid
// timezone drift from Date parsing.

export const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const toISO = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const todayISO = () => toISO(new Date());

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

// Whole days from date a to date b (positive when b is later).
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

export const dayOfMonth = (iso) => Number(iso.slice(8, 10));

export const weekday = (iso) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parseISO(iso));

// "7 Aug"
export const dateLabel = (iso) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(parseISO(iso));

// "7 – 30 August 2026" / "28 Sep – 4 Oct 2026" / "30 Dec 2026 – 2 Jan 2027"
export function dateRangeLabel(config) {
  const s = parseISO(config.startDate);
  const e = parseISO(config.endDate);
  const f = (opts, d) => new Intl.DateTimeFormat(undefined, opts).format(d);
  if (s.getFullYear() !== e.getFullYear()) {
    return `${f({ day: "numeric", month: "short", year: "numeric" }, s)} – ${f({ day: "numeric", month: "short", year: "numeric" }, e)}`;
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${f({ day: "numeric", month: "short" }, s)} – ${f({ day: "numeric", month: "short" }, e)} ${e.getFullYear()}`;
  }
  return `${s.getDate()} – ${e.getDate()} ${f({ month: "long", year: "numeric" }, e)}`;
}

export const listDates = (startISO, endISO) => {
  const out = [];
  for (let iso = startISO; iso <= endISO; iso = addDays(iso, 1)) out.push(iso);
  return out;
};

// ---------- trip-relative helpers ----------
export const isDuringTrip = (config, iso = todayISO()) => iso >= config.startDate && iso <= config.endDate;

// 1-based day number of the trip for a date inside the trip window.
export const tripDayNumber = (config, iso = todayISO()) => diffDays(config.startDate, iso) + 1;

// Days until the trip starts (negative once started).
export const daysToGo = (config, iso = todayISO()) => diffDays(iso, config.startDate);

// Default day to show: today while travelling, otherwise the first day.
export const defaultDay = (config) => (isDuringTrip(config) ? todayISO() : config.days[0]?.date);

export const findDay = (config, iso) => config.days.find((d) => d.date === iso) || config.days[0];

// Resolve the weather location for a day: a per-day override (day trips) wins,
// otherwise fall back to the day's leg. Always returns { name, lat, lon, norm }.
export function locationOf(config, day) {
  const L = config.legs[day.leg] || {};
  return {
    name: day.place || L.name,
    leg: day.leg,
    lat: day.lat ?? L.lat,
    lon: day.lon ?? L.lon,
    norm: day.norm || L.norm || null,
  };
}

// ---------- trip building ----------
// Pastel background derived from a leg colour (mixed towards white).
export function softOf(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.88);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

export const slugify = (name) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "place";

// Generate the days array for a date range. `legForDate(iso)` returns the leg
// key a date belongs to. Existing days (by date) keep their title/plan/overrides.
export function generateDays(startISO, endISO, legForDate, existingDays = []) {
  const byDate = Object.fromEntries(existingDays.map((d) => [d.date, d]));
  return listDates(startISO, endISO).map((iso, i) => {
    const prev = byDate[iso];
    if (prev) return { ...prev, leg: legForDate(iso) ?? prev.leg };
    return { date: iso, leg: legForDate(iso), title: `Day ${i + 1}`, plan: "" };
  });
}

// ---------- money ----------
const symbolCache = {};
export function currencySymbol(code) {
  if (!symbolCache[code]) {
    try {
      symbolCache[code] = new Intl.NumberFormat(undefined, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
        .formatToParts(0).find((p) => p.type === "currency")?.value || code;
    } catch { symbolCache[code] = code; }
  }
  return symbolCache[code];
}

export function fmtMoney(amount, code, maxFrac = 0) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: code, currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0, maximumFractionDigits: maxFrac,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(maxFrac)}`;
  }
}

// Amount converted to the home currency, or null when no home currency is set.
export function fmtHome(config, amount) {
  if (!config?.homeCurrency || !config?.homeRate) return null;
  return fmtMoney(amount * config.homeRate, config.homeCurrency);
}
