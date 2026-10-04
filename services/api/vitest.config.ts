import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "test_better_auth_secret_minimum_32_characters_for_vitest",
          WS_TICKET_SECRET: "test_better_auth_secret_minimum_32_characters_for_vitest",
          BETTER_AUTH_URL: "http://localhost:8787",
          ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:8787",
          GOOGLE_CLIENT_SECRET: "test_google_client_secret_for_vitest",
        },
      },
    }),
  ],
  test: {
    fileParallelism: false,
  },
});
