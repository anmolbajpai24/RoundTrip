// Developer-side feature flags — flipped in code by the maintainer, never
// shown to users as settings. Keep this module dependency-free: it is
// imported by both the client bundle and the api/ serverless functions.
export const FEATURES = {
  // Virtual try-on ("See it on me"). false hides every trace of it in the UI
  // (My photo card, editor section, on-me flip chips — including try-on
  // images other members already generated) and disables /api/tryon itself.
  tryOn: false,
  // AI itinerary suggestions in the trip wizard (Gemini free tier). Needs a
  // server-side GEMINI_API_KEY; without one /api/itinerary answers "disabled"
  // and the wizard step degrades gracefully. false hides the step entirely
  // and disables the endpoint.
  aiItinerary: true,
};
