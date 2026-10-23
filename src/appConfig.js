// Developer-side feature flags — flipped in code by the maintainer, never
// shown to users as settings. Keep this module dependency-free: it is
// imported by both the client bundle and the api/ serverless functions.
export const FEATURES = {
  // Virtual try-on is retired: the client is deleted and /api/tryon now
  // answers 410. The flag stays false and is kept only so old references
  // don't break; do not turn it back on.
  tryOn: false,
  // AI itinerary suggestions in the trip wizard (Gemini free tier). Needs a
  // server-side GEMINI_API_KEY; without one /api/itinerary answers "disabled"
  // and the wizard step degrades gracefully. false hides the step entirely
  // and disables the endpoint.
  aiItinerary: true,
};
