import { createClient } from "@supabase/supabase-js";
import { FEATURES } from "../src/appConfig.js";
import { reportError } from "./_lib/sentry.js";

// AI itinerary endpoint. Takes the trip's title, dates, day/leg list and the
// traveller's free-text description and returns a suggested plan per day.
// Powered by the Gemini free tier (gemini-2.5-flash-lite by default) — the key
// stays server-side; this runs as a Vercel function (and is mounted on the
// Vite dev server by vite.config.js).

export const config = { maxDuration: 60 };

const MAX_DAYS = 60;
const MAX_DESC = 2000;
const MAX_PLAN = 1000; // per-day plan text cap; the LLM never writes the config unclamped
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Host-agnostic core: (body, authorization header) → { status, body }.
export async function runItinerary(body, authHeader) {
  if (!FEATURES.aiItinerary) return reply(404, "disabled", "AI itinerary is not enabled.");
  if (!process.env.GEMINI_API_KEY) return reply(404, "disabled", "AI itinerary is not configured.");

  const { title, startDate, endDate, days } = body || {};
  const description = String(body?.description || "").slice(0, MAX_DESC).trim();
  if (typeof title !== "string" || !title.trim()) return reply(400, "bad-input", "Send the trip `title`.");
  if (!ISO_DATE.test(startDate || "") || !ISO_DATE.test(endDate || "") || endDate < startDate) {
    return reply(400, "bad-input", "Send valid `startDate` and `endDate` (YYYY-MM-DD).");
  }
  if (!Array.isArray(days) || days.length < 1 || days.length > MAX_DAYS) {
    return reply(400, "bad-input", `Send 1-${MAX_DAYS} \`days\` entries.`);
  }
  const cleanDays = [];
  for (const d of days) {
    const date = d?.date;
    if (!ISO_DATE.test(date || "") || date < startDate || date > endDate) {
      return reply(400, "bad-input", "Each day needs a `date` within the trip range.");
    }
    cleanDays.push({ date, legName: String(d?.legName || "").slice(0, 60) });
  }

  // Only signed-in users may spend the free Gemini quota: verify the Supabase
  // JWT. Fail closed — a misconfigured deploy must not become an open endpoint.
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) {
    console.error("itinerary: VITE_SUPABASE_URL/ANON_KEY missing — refusing unauthenticated access");
    return reply(503, "misconfigured", "AI suggestions are temporarily unavailable.");
  }
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, "unauthorized", "Sign in to use AI suggestions.");
  const supa = createClient(supaUrl, supaKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return reply(401, "unauthorized", "Sign in to use AI suggestions.");

  // Per-user daily cap (anonymous sign-in is free, so the JWT alone isn't
  // enough to protect the quota). Counted via a SECURITY DEFINER RPC — see
  // supabase/migrations/006_ai_usage.sql. Fail closed if the RPC errors.
  const cap = Number(process.env.AI_DAILY_CAP) || 10;
  const { data: used, error: capErr } = await supa.rpc("consume_ai_credit");
  if (capErr) {
    console.error("itinerary: consume_ai_credit failed:", capErr.message);
    return reply(503, "misconfigured", "AI suggestions are temporarily unavailable.");
  }
  if (used > cap) {
    return reply(429, "quota", "You've used today's AI suggestions — try again tomorrow.");
  }

  try {
    const byDate = await geminiItinerary({ title: title.trim().slice(0, 80), startDate, endDate, description, days: cleanDays });
    // Each day gets the AI's city (falling back to the typed hint) and plan.
    const out = cleanDays.map((d) => {
      const got = byDate.get(d.date) || {};
      return { date: d.date, city: (got.city || d.legName || "").trim().slice(0, 60), plan: got.plan || "" };
    });
    return { status: 200, body: { days: out } };
  } catch (e) {
    const msg = String(e?.message || e);
    if (/quota|exceeded|resource.?exhausted|429/i.test(msg)) {
      return reply(429, "quota", "The free AI planner has hit its daily limit — try again tomorrow (it resets daily).");
    }
    if (/timeout|timed out|overloaded|busy|503/i.test(msg)) {
      return reply(503, "busy", "The AI planner is busy right now — try again in a minute.");
    }
    console.error("itinerary failed:", msg);
    await reportError(e, { fn: "itinerary" });
    return reply(502, "unavailable", "The AI planner is unavailable right now — try again later.");
  }
}

const reply = (status, error, message) => ({ status, body: { error, message } });

// Ask Gemini for a city + plan per date (JSON mode) → Map(date → { city, plan }).
async function geminiItinerary({ title, startDate, endDate, description, days }) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const hints = [...new Set(days.map((d) => d.legName).filter(Boolean))];
  const dayList = days.map((d) => d.date).join("\n");
  const prompt = [
    "You are a practical travel planner. Draft a day-by-day itinerary.",
    "",
    `Trip: "${title}", ${startDate} to ${endDate} (${days.length} days).`,
    hints.length ? `Places the traveller has already added (keep these in the trip): ${hints.join(", ")}.` : "",
    "Dates to plan (one object each, in this order):",
    dayList,
    "",
    `Traveller's notes: ${description || "No notes — plan a balanced classic itinerary."}`,
    "",
    "Rules:",
    "- Return a JSON array with EXACTLY one object per date listed above, using those exact dates.",
    '- "city": which city/town the traveller is in that day. You MAY add cities mentioned in the notes beyond the ones already added.',
    "  Assign cities in consecutive day-blocks (do not hop back and forth), and allow for travel time between them.",
    '- "plan": 2-4 short lines separated by newlines. Name specific real sights, neighbourhoods and food for that day\'s city.',
    "- Group nearby sights on the same day; keep the first day in each new city lighter (arrival/travel).",
    "- Honour the traveller's interests, pace and must-sees.",
    "- Plain text only — no markdown, and no day numbers or dates inside the plan text.",
  ].filter(Boolean).join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { date: { type: "STRING" }, city: { type: "STRING" }, plan: { type: "STRING" } },
              required: ["date", "city", "plan"],
            },
          },
          temperature: 0.7,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`gemini ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text); // throws → 502 in the caller
  if (!Array.isArray(parsed)) throw new Error("gemini returned non-array JSON");

  const wanted = new Set(days.map((d) => d.date));
  const byDate = new Map();
  for (const item of parsed) {
    if (wanted.has(item?.date)) {
      byDate.set(item.date, {
        city: typeof item?.city === "string" ? item.city.trim().slice(0, 60) : "",
        plan: typeof item?.plan === "string" ? item.plan.trim().slice(0, MAX_PLAN) : "",
      });
    }
  }
  return byDate;
}

// Vercel entrypoint.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method-not-allowed", message: "POST only." });
  const out = await runItinerary(req.body, req.headers.authorization);
  return res.status(out.status).json(out.body);
}
