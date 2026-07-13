// Place search via Open-Meteo's free geocoding API (no key, CORS-enabled —
// same vendor as the weather forecasts).
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, count: "5", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error("Place search failed — try again.");
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    country: r.country || "",
    admin1: r.admin1 || "",
    lat: r.latitude,
    lon: r.longitude,
  }));
}
