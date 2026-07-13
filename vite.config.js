import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Serve api/tryon.js on the dev server so try-on works under `npm run dev`
// (in production Vercel serves it as a serverless function). Server-side env
// vars (HF_TOKEN, GEMINI_API_KEY, ...) come from .env.local via loadEnv.
function tryonDevEndpoint(env) {
  return {
    name: "tryon-dev-endpoint",
    configureServer(server) {
      server.middlewares.use("/api/tryon", (req, res) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", async () => {
          try {
            for (const [k, v] of Object.entries(env)) process.env[k] ||= v;
            const { runTryOn } = await import("./api/tryon.js");
            const out = req.method === "POST"
              ? await runTryOn(JSON.parse(raw || "{}"), req.headers.authorization)
              : { status: 405, body: { error: "method-not-allowed", message: "POST only." } };
            res.statusCode = out.status;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(out.body));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "dev-endpoint", message: String(e?.message || e) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    tryonDevEndpoint(loadEnv(mode, process.cwd(), "")),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Roundtrip",
        short_name: "Roundtrip",
        description: "Shared trip companion — itinerary, outfits, packing, budget, bookings",
        theme_color: "#1D2433",
        background_color: "#F7F5F0",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
}));
