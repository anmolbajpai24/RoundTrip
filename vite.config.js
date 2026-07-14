import { defineConfig, loadEnv } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Serve the api/ functions on the dev server so they work under `npm run dev`
// (in production Vercel serves them as serverless functions). Server-side env
// vars (HF_TOKEN, GEMINI_API_KEY, ...) come from .env.local via loadEnv.
function apiDevEndpoints(env) {
  // Absolute file URLs: Vite executes this config from a transpiled temp
  // file, so relative dynamic imports would resolve from the wrong directory.
  const routes = {
    "/api/tryon": ["api/tryon.js", "runTryOn"],
    "/api/itinerary": ["api/itinerary.js", "runItinerary"],
  };
  return {
    name: "api-dev-endpoints",
    configureServer(server) {
      for (const [path, [mod, fn]] of Object.entries(routes)) {
        server.middlewares.use(path, (req, res) => {
          let raw = "";
          req.on("data", (c) => (raw += c));
          req.on("end", async () => {
            try {
              for (const [k, v] of Object.entries(env)) process.env[k] ||= v;
              const run = (await import(pathToFileURL(resolve(mod)).href))[fn];
              const out = req.method === "POST"
                ? await run(JSON.parse(raw || "{}"), req.headers.authorization)
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
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    apiDevEndpoints(loadEnv(mode, process.cwd(), "")),
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
