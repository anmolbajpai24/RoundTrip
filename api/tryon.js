import { reply } from "./_lib/aiGuard.js";

// Virtual try-on has been removed. It called a public HuggingFace Space whose
// model weights are licensed for non-commercial use only, so every request now
// gets 410 Gone. The `pre-operator-build` git tag keeps the old code. The
// route stays so old installed apps get a clear answer instead of a 404.

export async function runTryOn() {
  return reply(410, "gone", "Try-on has been removed.");
}

// Vercel entrypoint: 410 for every method.
export default async function handler(req, res) {
  const out = await runTryOn();
  res.status(out.status).json(out.body);
}
