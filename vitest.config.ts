import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Current Cloudflare Workers Vitest plugin. It runs tests in Miniflare with
 * isolated storage; domain suites may add D1/Queue bindings as they land.
 */
export default defineConfig({
  plugins: [cloudflareTest({
    miniflare: {
      // Miniflare bundled with the Wrangler 4.88-compatible pool supports this date.
      compatibilityDate: "2026-05-11",
      compatibilityFlags: ["nodejs_compat"],
    },
  })],
  test: { include: ["tests/backend/**/*.test.ts"] },
});
