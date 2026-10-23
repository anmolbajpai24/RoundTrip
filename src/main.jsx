import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.jsx";
import DialogHost from "./components/dialogs.jsx";
import InstallHint from "./components/InstallHint.jsx";
import { initTheme } from "./theme.js";

// Crash reporting — only in production builds and only when a DSN is deployed,
// so local dev and forks without Sentry stay silent. No session replay, no
// tracing: errors only, keeping the payload (and the privacy policy) small.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

initTheme();

// /demo is a static, read-only trip from bundled data. It branches here,
// before App, so no session is loaded and nothing syncs. Lazy so the demo
// fixture and its frame stay out of the main chunk.
const isDemo = /^\/demo\/?$/.test(window.location.pathname);
const DemoTrip = lazy(() => import("./demo/DemoTrip.jsx"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: 24, textAlign: "center" }}>Something broke. Please reload the app.</p>}>
      {isDemo ? <Suspense fallback={null}><DemoTrip /></Suspense> : <App />}
    </Sentry.ErrorBoundary>
    {!isDemo && <InstallHint />}
    <DialogHost />
    <Analytics />
  </StrictMode>
);
