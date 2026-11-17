import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["collection-policy-browser.spec.ts", "market-data-access.spec.ts", "feed-data.spec.ts", "home-data.spec.ts"],
  workers: 1, timeout: 60_000, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3112", ...devices["Desktop Chrome"], launchOptions: { args: ["--no-sandbox"] } },
  webServer: [
    { command: "node tests/support/world-backend.mjs", url: "http://127.0.0.1:3113/_control", env: { TEST_BACKEND_PORT: "3113", POLICY_TEST_BLOCKED: "1" } },
    { command: "npm run start -- --hostname 127.0.0.1 --port 3112", url: "http://127.0.0.1:3112/classic", env: {
      SUPABASE_URL: "http://127.0.0.1:3113", SUPABASE_SERVICE_ROLE_KEY: "local-policy-fixture-key",
      NEXTAUTH_SECRET: "local-policy-fixture-secret", NEXTAUTH_URL: "http://127.0.0.1:3112",
      DETECTOR_WRITE_TOKEN: "local-policy-fixture-token",
      GOOGLE_CLIENT_ID: "local-policy-client", GOOGLE_CLIENT_SECRET: "local-policy-secret"
    } }
  ]
});
