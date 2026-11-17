import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", testMatch: "policies.spec.ts", workers: 1,
  timeout: 60_000, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3102", ...devices["Desktop Chrome"], launchOptions: { args: ["--no-sandbox"] } },
  webServer: [
    { command: "node tests/support/policy-backend.mjs", url: "http://127.0.0.1:3103/_control" },
    { command: "npm run start -- --hostname 127.0.0.1 --port 3102", url: "http://127.0.0.1:3102/terms", timeout: 120_000, env: {
      SUPABASE_URL: "http://127.0.0.1:3103", SUPABASE_SERVICE_ROLE_KEY: "local-policy-fixture-key",
      NEXTAUTH_SECRET: "local-policy-fixture-secret", NEXTAUTH_URL: "http://127.0.0.1:3102",
      GOOGLE_CLIENT_ID: "local-policy-client", GOOGLE_CLIENT_SECRET: "local-policy-secret"
    } }
  ]
});
