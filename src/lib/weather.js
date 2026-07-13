import { locationOf } from "./tripConfig.js";
import { saveKey } from "./storage.js";

// Weather data layer (no React). Fetches a daily forecast for every trip
// location from Open-Meteo (free, no API key, CORS-enabled), normalizes it, and
// caches it via the shared storage layer so it syncs to all members + works
// offline. Dates the live forecast doesn't reach fall back to that location's
// climate normals when the trip config provides them; otherwise the day simply
// has no weather yet (the widget shows a placeholder).

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const FORECAST_HORIZON_DAYS = 16;      // Open-Meteo free daily forecast range
const STALE_MS = 3 * 60 * 60 * 1000;   // refetch at most every ~3h
const CACHE_VERSION = 2;               // v2 = days keyed by ISO date

// ---------- WMO weather code buckets ----------
// One place that turns a raw WMO code into a stable bucket key + human label.
// Used by both the icon component and the outfit advisor.
export function WMO(code) {
  if (code === 0) return { key: "clear", label: "Clear" };
  if (code === 1 || code === 2) return { key: "partly", label: "Partly cloudy" };
  if (code === 3) return { key: "overcast", label: "Overcast" };
  if (code === 45 || code === 48) return { key: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { key: "drizzle", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { key: "rain", label: "Rain" };
  if (code >= 71 && code <= 77) return { key: "snow", label: "Snow" };
  if (code >= 80 && code <= 82) return { key: "showers", label: "Rain showers" };
  if (code === 85 || code === 86) return { key: "snow", label: "Snow showers" };
  if (code >= 95) return { key: "thunder", label: "Thunderstorm" };
  return { key: "partly", label: "Mixed" };
}

// A wet bucket → rain gear matters. Shared with the advisor via WMO keys.
export const WET_KEYS = new Set(["drizzle", "rain", "showers", "thunder"]);

// ---------- helpers ----------
function online() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

const fmt = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// The date range the live forecast can actually cover today: overlap of
// [today, today+16d] with the trip window. Null if no overlap.
function fetchableWindow(config, now = new Date()) {
  const tripStart = new Date(`${config.startDate}T00:00:00`);
  const tripEnd = new Date(`${config.endDate}T00:00:00`);
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_HORIZON_DAYS);
  const start = now > tripStart ? now : tripStart;
  const end = horizon < tripEnd ? horizon : tripEnd;
  if (start > end) return null;
  return { start: fmt(start), end: fmt(end) };
}

// Unique locations across all days (day trips dedupe against their leg by coord).
function uniqueLocations(config) {
  const seen = new Map();
  for (const day of config.days) {
    const loc = locationOf(config, day);
    if (loc.lat == null || loc.lon == null) continue;
    const id = `${loc.lat},${loc.lon}`;
    if (!seen.has(id)) seen.set(id, loc);
  }
  return [...seen.values()];
}

const normRecord = (loc, source = "typical") =>
  loc.norm
    ? {
        place: loc.name,
        leg: loc.leg,
        source,
        tempMax: loc.norm.tempMax,
        tempMin: loc.norm.tempMin,
        precipProb: loc.norm.precipProb,
        windMax: null,
        code: loc.norm.code,
        uv: null,
      }
    : null;

// ---------- fetch + normalize + cache ----------
// Returns the (possibly refreshed) weather object. Pass the current cached value
// so we skip the network when it's still fresh or when nothing is fetchable yet.
export async function refreshWeather(current, config) {
  if (!config?.days?.length) return current;
  if (current?.v !== CACHE_VERSION) current = null; // old cache format → refetch
  const fresh = current?.fetchedAt && Date.now() - new Date(current.fetchedAt).getTime() < STALE_MS;
  if (fresh || !online()) return current;

  const window = fetchableWindow(config);
  const locs = uniqueLocations(config);

  // Build the all-typical baseline first; live rows overwrite where available.
  const byLocDays = {};
  const days = {};
  for (const day of config.days) {
    const rec = normRecord(locationOf(config, day));
    if (rec) days[day.date] = rec;
  }

  // Nothing in forecast range yet (true well before the trip) → typical only.
  if (window && locs.length) {
    try {
      const params = new URLSearchParams({
        latitude: locs.map((l) => l.lat).join(","),
        longitude: locs.map((l) => l.lon).join(","),
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max",
        timezone: "auto",
        start_date: window.start,
        end_date: window.end,
      });
      const res = await fetch(`${FORECAST_URL}?${params}`);
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const data = await res.json();
      // Multiple coordinates → array; normalize a single result to an array too.
      const results = Array.isArray(data) ? data : [data];
      results.forEach((r, i) => {
        const loc = locs[i];
        const t = r?.daily?.time || [];
        const byDate = {};
        t.forEach((date, j) => {
          byDate[date] = {
            code: r.daily.weather_code[j],
            tempMax: Math.round(r.daily.temperature_2m_max[j]),
            tempMin: Math.round(r.daily.temperature_2m_min[j]),
            precipProb: r.daily.precipitation_probability_max[j],
            windMax: Math.round(r.daily.wind_speed_10m_max[j]),
            uv: r.daily.uv_index_max[j] == null ? null : Math.round(r.daily.uv_index_max[j]),
          };
        });
        byLocDays[`${loc.lat},${loc.lon}`] = byDate;
      });

      for (const day of config.days) {
        const loc = locationOf(config, day);
        const hit = byLocDays[`${loc.lat},${loc.lon}`]?.[day.date];
        if (hit) days[day.date] = { place: loc.name, leg: loc.leg, source: "forecast", ...hit };
      }
    } catch {
      // Network/parse failure: keep the typical baseline, don't cache a bad fetch.
      return current || { v: CACHE_VERSION, fetchedAt: new Date().toISOString(), days };
    }
  }

  const next = { v: CACHE_VERSION, fetchedAt: new Date().toISOString(), days };
  await saveKey("trip-weather", next);
  return next;
}

// ---------- selector ----------
// One day's normalized record, falling back to that day's climate normal.
// Returns null when there's no forecast yet and the location has no normals.
export function getDayWeather(weather, day, config) {
  const rec = weather?.v === CACHE_VERSION ? weather.days?.[day.date] : null;
  if (rec) return rec;
  return config ? normRecord(locationOf(config, day)) : null;
}
