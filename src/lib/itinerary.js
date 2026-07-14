import { supabase, isConfigured } from "./supabase.js";
import { ensureAuth } from "./session.js";
import { FEATURES } from "../appConfig.js";

// Client side of the AI itinerary feature. Generation happens server-side via
// /api/itinerary (Gemini free tier) so no key ships in the bundle. The wizard
// hides the step entirely when this is false (flag off or fully-offline app).
export const aiItineraryAvailable = FEATURES.aiItinerary && isConfigured;

// POST the trip outline + traveller's description → [{ date, city, plan }].
// The AI assigns each day a city (it may add cities named in the description).
// Throws Error with `.code` = quota | busy | unavailable | unauthorized | disabled | ...
export async function generateItinerary({ title, startDate, endDate, description, days }) {
  // Wizard users may not have a Supabase session yet (anonymous sign-in
  // normally happens inside createTrip), so establish one before calling.
  await ensureAuth();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  const res = await fetch("/api/itinerary", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ title, startDate, endDate, description, days }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || "Couldn't draft an itinerary — please try again.");
    err.code = body.error;
    throw err;
  }
  if (!Array.isArray(body.days) || !body.days.some((d) => d?.plan)) {
    throw new Error("The AI came back empty — try again.");
  }
  return body.days;
}
