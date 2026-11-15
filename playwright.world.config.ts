import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: /(?:world-(data|api|presentation|crowd|atlas|browser|hd2d|wall)|home-(data|browser|api))\.spec\.ts/,
  testIgnore: [],
  workers: 1,
  webServer: [
    { command: "node tests/support/world-backend.mjs", url: "http://127.0.0.1:3101/_control", reuseExistingServer: process.env.WORLD_TEST_REUSE_SERVER === "1" },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3100", env: {
      SUPABASE_URL: "http://127.0.0.1:3101", SUPABASE_SERVICE_ROLE_KEY: "local-dev-service-role-key",
      NEXTAUTH_SECRET: "local-dev-nextauth-secret", NEXTAUTH_URL: "http://127.0.0.1:3100",
      GOOGLE_CLIENT_ID: "local-dev-google-client-id", GOOGLE_CLIENT_SECRET: "local-dev-google-client-secret",
      DETECTOR_WRITE_TOKEN: "local-dev-detector-token", CHAT_TOKEN_SECRET: "", CHAT_WS_BASE_URL: ""
    }, url: "http://127.0.0.1:3100", reuseExistingServer: process.env.WORLD_TEST_REUSE_SERVER === "1", timeout: 120_000 }
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } }
  ]
});
