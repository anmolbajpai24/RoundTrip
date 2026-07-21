import * as Sentry from "@sentry/node";

// Error reporting for the serverless functions. Vercel ignores _-prefixed
// paths under api/, so this never becomes a route. No-op unless SENTRY_DSN is
// set. Serverless freezes the process right after the response, so callers
// must await the returned flush.

let inited = false;

export function reportError(error, extra) {
  if (!process.env.SENTRY_DSN) return Promise.resolve();
  if (!inited) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV || "development",
    });
    inited = true;
  }
  Sentry.captureException(error, { extra });
  return Sentry.flush(2000).catch(() => {});
}
