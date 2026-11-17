import { defineConfig } from "@playwright/test";
import base from "./playwright.collection.config";
export default defineConfig({ ...base, testMatch: ["aggregate-only.spec.ts", "aggregate-browser.spec.ts", "world-data.spec.ts", "sample-quality.spec.ts"], webServer: [
  { command: "node tests/support/world-backend.mjs", url: "http://127.0.0.1:3113/_control", env: { TEST_BACKEND_PORT: "3113", AGGREGATE_TEST_MODE: "1" } },
  ...(Array.isArray(base.webServer) ? base.webServer.slice(1) : [])
] });
