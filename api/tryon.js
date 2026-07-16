import { createClient } from "@supabase/supabase-js";
import { Client, handle_file } from "@gradio/client";
import { FEATURES } from "../src/appConfig.js";

// Virtual try-on endpoint. Takes the caller's base photo + a garment photo and
// returns a generated "wearing it" image. The engine is free-first: a public
// HuggingFace ZeroGPU Space (IDM-VTON) called with the server's HF token; if
// GEMINI_API_KEY is set, Gemini 2.5 Flash Image (~$0.04/image) is used instead.
// All keys stay server-side — this runs as a Vercel function (and is mounted on
// the Vite dev server by vite.config.js).

export const config = { maxDuration: 60 }; // HF queue + diffusion can take ~30-60s

const DEFAULT_SPACE = "yisol/IDM-VTON";
const MAX_BODY = 3_500_000; // two compressed data-URLs; well under Vercel's 4.5MB

// Host-agnostic core: (body, authorization header) → { status, body }.
export async function runTryOn(body, authHeader) {
  if (!FEATURES.tryOn) return reply(404, "disabled", "Try-on is not enabled.");
  const { person, garment, desc } = body || {};
  if (!isImageDataUrl(person) || !isImageDataUrl(garment)) {
    return reply(400, "bad-input", "Send `person` and `garment` as image data-URLs.");
  }
  if (person.length + garment.length > MAX_BODY) {
    return reply(413, "too-large", "Photos are too large — please retry (they should be compressed client-side).");
  }

  // Only trip members may spend the GPU quota: verify the Supabase JWT.
  // Fail closed — a misconfigured deploy must not become an open endpoint.
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) {
    console.error("tryon: VITE_SUPABASE_URL/ANON_KEY missing — refusing unauthenticated access");
    return reply(503, "misconfigured", "Try-on is temporarily unavailable.");
  }
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, "unauthorized", "Sign in to use try-on.");
  const { data, error } = await createClient(supaUrl, supaKey).auth.getUser(token);
  if (error || !data?.user) return reply(401, "unauthorized", "Sign in to use try-on.");

  try {
    const photo = process.env.GEMINI_API_KEY
      ? await geminiTryOn(person, garment, desc)
      : await hfTryOn(person, garment, desc);
    return { status: 200, body: { photo } };
  } catch (e) {
    const msg = String(e?.message || e);
    if (/quota|exceeded|no gpu/i.test(msg)) {
      return reply(429, "quota", "The free try-on engine has hit its daily GPU limit. Try again later (it resets daily).");
    }
    if (/queue|timeout|timed out|busy/i.test(msg)) {
      return reply(503, "busy", "The free try-on engine is busy right now — try again in a minute.");
    }
    console.error("tryon failed:", msg);
    return reply(502, "unavailable", "The try-on engine is unavailable right now — try again later.");
  }
}

const reply = (status, error, message) => ({ status, body: { error, message } });
const isImageDataUrl = (s) => typeof s === "string" && s.startsWith("data:image/");

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  return new Blob([Buffer.from(dataUrl.slice(comma + 1), "base64")], { type: mime });
}

// ---------- free engine: IDM-VTON on HuggingFace ZeroGPU ----------
async function hfTryOn(person, garment, desc) {
  const space = process.env.HF_TRYON_SPACE || DEFAULT_SPACE;
  const opts = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
  const client = await Client.connect(space, opts);
  const res = await client.predict("/tryon", {
    dict: { background: handle_file(dataUrlToBlob(person)), layers: [], composite: null },
    garm_img: handle_file(dataUrlToBlob(garment)),
    garment_des: (desc || "an outfit").slice(0, 120),
    is_checked: true,       // auto-mask the person
    is_checked_crop: true,  // auto-crop & resize arbitrary phone photos
    denoise_steps: 30,
    seed: Math.floor(Math.random() * 2 ** 31),
  });
  const url = res?.data?.[0]?.url;
  if (!url) throw new Error("space returned no image");
  const img = await fetch(url);
  if (!img.ok) throw new Error(`result fetch failed (${img.status})`);
  const buf = Buffer.from(await img.arrayBuffer());
  const mime = img.headers.get("content-type") || "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ---------- paid opt-in: Gemini 2.5 Flash Image (~$0.04/image) ----------
async function geminiTryOn(person, garment, desc) {
  const part = (dataUrl) => {
    const comma = dataUrl.indexOf(",");
    return { inline_data: { mime_type: dataUrl.slice(5, dataUrl.indexOf(";")), data: dataUrl.slice(comma + 1) } };
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            part(person),
            part(garment),
            { text: `Edit the first photo so the person is wearing the outfit shown in the second photo${desc ? ` (${desc})` : ""}. Keep the person's face, pose, body and the background exactly the same; only change the clothes. Photorealistic.` },
          ],
        }],
      }),
    }
  );
  if (res.status === 429) throw new Error("quota");
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const inline = out?.inlineData || out?.inline_data;
  if (!inline?.data) throw new Error("gemini returned no image");
  return `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}`;
}

// Vercel entrypoint.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed", message: "POST only." });
    return;
  }
  const out = await runTryOn(req.body, req.headers.authorization);
  res.status(out.status).json(out.body);
}
