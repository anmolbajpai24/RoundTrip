import { supabase, isConfigured } from "./supabase.js";
import { ensureAuth } from "./session.js";
import { FEATURES } from "../appConfig.js";

// Client side of the AI itinerary features. Generation and import both run
// server-side (/api/itinerary and /api/itinerary-import, Gemini free tier) so
// no key ships in the bundle. The wizard hides these options entirely when the
// flags below are false (flag off or fully-offline app).
export const aiItineraryAvailable = FEATURES.aiItinerary && isConfigured;
export const itineraryImportAvailable = FEATURES.aiItinerary && isConfigured;

// Every error these functions throw carries one of these as `.code`.
const CODES = new Set(["quota", "busy", "unavailable", "unauthorized", "disabled", "bad-input"]);

function aiError(message, code) {
  const err = new Error(message);
  err.code = CODES.has(code) ? code : "unavailable";
  return err;
}

// POST to an AI endpoint with the user's Supabase JWT → the parsed body.
// Server codes outside CODES (misconfigured, method-not-allowed, a dev-server
// crash) and network failures all surface as "unavailable".
async function postAi(path, payload, fallbackMessage) {
  // Wizard users may not have a Supabase session yet (anonymous sign-in
  // normally happens inside createTrip), so establish one before calling.
  await ensureAuth();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
      body: JSON.stringify(payload),
    });
  } catch {
    throw aiError("You're offline. Connect and try again.", "unavailable");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body.error || (res.status === 429 ? "quota" : res.status === 401 ? "unauthorized" : "");
    throw aiError(body.message || fallbackMessage, code);
  }
  return body;
}

// POST the trip outline + traveller's description → [{ date, city, plan }].
// The AI assigns each day a city (it may add cities named in the description).
// Throws Error with `.code` = quota | busy | unavailable | unauthorized | disabled | bad-input.
export async function generateItinerary({ title, startDate, endDate, description, days }) {
  const body = await postAi(
    "/api/itinerary",
    { title, startDate, endDate, description, days },
    "Couldn't draft an itinerary — please try again.",
  );
  if (!Array.isArray(body.days) || !body.days.some((d) => d?.plan)) {
    throw aiError("The AI came back empty — try again.", "unavailable");
  }
  return body.days;
}

// POST pasted itinerary text + the trip's dates → [{ date, city, plan }], one
// entry per date from startDate to endDate inclusive, in order. Same shape and
// error codes as generateItinerary(), so the wizard builds legs the same way.
// Text past 6,000 characters is cut off server-side.
// Throws Error with `.code` = quota | busy | unavailable | unauthorized | disabled | bad-input.
export async function importItinerary({ text, startDate, endDate }) {
  const body = await postAi(
    "/api/itinerary-import",
    { text, startDate, endDate },
    "Couldn't read that itinerary. Please try again.",
  );
  if (!Array.isArray(body.days) || !body.days.some((d) => d?.plan)) {
    throw aiError("Couldn't find a day-by-day itinerary in that text.", "bad-input");
  }
  return body.days;
}
