import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.jsx";
import DialogHost from "./components/dialogs.jsx";
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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: 24, textAlign: "center" }}>Something broke — please reload the app.</p>}>
      <App />
    </Sentry.ErrorBoundary>
    <DialogHost />
    <Analytics />
  </StrictMode>
);
