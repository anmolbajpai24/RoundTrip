import { createClient } from "@supabase/supabase-js";

// Shared guard for the AI endpoints (itinerary suggestions, itinerary import).
// Vercel ignores _-prefixed paths under api/, so this never becomes a route.
//
// Only signed-in users may spend the free Gemini quota, so the Supabase JWT is
// verified first. Anonymous sign-in is free, so the JWT alone isn't enough:
// each call also charges one credit through the consume_ai_credit RPC (see
// supabase/migrations/006_ai_usage.sql) against a daily cap of AI_DAILY_CAP.
// Everything fails closed: a misconfigured deploy must not become an open
// endpoint, and an RPC error refuses the call rather than skipping the cap.

export const reply = (status, error, message) => ({ status, body: { error, message } });

// (authorization header, log label) → { ok: true, user } or { ok: false, out },
// where `out` is the { status, body } reply to send back unchanged.
export async function guardAiRequest(authHeader, fn = "ai") {
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) {
    console.error(`${fn}: VITE_SUPABASE_URL/ANON_KEY missing — refusing unauthenticated access`);
    return { ok: false, out: reply(503, "misconfigured", "AI suggestions are temporarily unavailable.") };
  }
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, out: reply(401, "unauthorized", "Sign in to use AI suggestions.") };
  const supa = createClient(supaUrl, supaKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return { ok: false, out: reply(401, "unauthorized", "Sign in to use AI suggestions.") };

  const cap = Number(process.env.AI_DAILY_CAP) || 10;
  const { data: used, error: capErr } = await supa.rpc("consume_ai_credit");
  if (capErr) {
    console.error(`${fn}: consume_ai_credit failed:`, capErr.message);
    return { ok: false, out: reply(503, "misconfigured", "AI suggestions are temporarily unavailable.") };
  }
  if (used > cap) {
    return { ok: false, out: reply(429, "quota", "You've used today's AI suggestions — try again tomorrow.") };
  }
  return { ok: true, user: data.user };
}
