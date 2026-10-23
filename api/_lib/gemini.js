// Shared Gemini call for the AI endpoints: JSON mode with a response schema,
// so the model's output is parsed, never scraped out of free text. The key
// stays server-side and the default model is the free-tier flash-lite alias.

// (prompt, responseSchema, temperature) → parsed JSON. Throws on HTTP errors
// and on output that isn't valid JSON.
export async function geminiJson({ prompt, responseSchema, temperature = 0.7, maxOutputTokens = 16384 }) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature,
          maxOutputTokens,
          // 3.x models (what the -latest alias now resolves to) reject
          // thinkingBudget with a bare 400 INVALID_ARGUMENT; use thinkingLevel.
          thinkingConfig: { thinkingLevel: "minimal" },
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
  // JSON.parse errors quote a snippet of the input, and the model's output can
  // echo user text (phone numbers in a pasted itinerary), so the error that
  // reaches logs and Sentry carries no content.
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("gemini returned invalid JSON");
  }
}

// Gemini error message → "quota", "busy" or null (anything else is "unavailable").
export function classifyGeminiError(msg) {
  if (/quota|exceeded|resource.?exhausted|429/i.test(msg)) return "quota";
  if (/timeout|timed out|overloaded|busy|503/i.test(msg)) return "busy";
  return null;
}
