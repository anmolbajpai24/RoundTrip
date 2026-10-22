// Join links: app.roundtrip.one/j/ABC123 opens a trip directly. vercel.json
// rewrites every path to index.html (and the service worker does the same
// offline), so the code is read from location.pathname on the client.

// Always the production host: a link shared from a preview or localhost would
// strand the people it's sent to on a dev database.
export const APP_ORIGIN = "https://app.roundtrip.one";

// "/j/abc123" or "/j/ABC123/" -> "ABC123". Anything else -> null. Codes are
// letters and digits; a wrong length is still returned so the gate can show
// a plain "that link doesn't look right" instead of the normal app.
export function parseJoinPath(pathname) {
  const m = /^\/j\/([A-Za-z0-9]{1,16})\/?$/.exec(pathname || "");
  return m ? m[1].toUpperCase() : null;
}

export function joinUrl(code) {
  return `${APP_ORIGIN}/j/${String(code || "").trim().toUpperCase()}`;
}
