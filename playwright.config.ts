import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command:
      "bash -lc 'set -a; [ -f ./.env.web ] && source ./.env.web; set +a; GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-build-check-client-id} GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-build-check-client-secret} npm run dev -- --hostname 127.0.0.1 --port 3100'",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
