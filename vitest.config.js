import { defineConfig } from "vitest/config";

// Standalone test config: keeps vite.config.js (PWA plugin, dev API mounts)
// out of the test pipeline. Tests cover pure logic in src/lib and the api/
// function cores, node env.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "api/**/*.test.js"],
  },
});
