import { expect, test } from "@playwright/test";
import { worldDate } from "../lib/world";

test.describe.configure({ mode: "serial" });
test("world API reads every page without creating visitor snapshots", async ({ request }) => {
  // Clear the server read cache through the same collection path used in production.
  await request.post("/api/v1/detector/register", { data: { status: {} }, headers: { authorization: "Bearer local-dev-detector-token" } });
  await request.post("http://127.0.0.1:3101/_control", { data: { reset: true } });
  const response = await request.get("/api/internal/world");
  expect(response.status()).toBe(200);
  const frame = await response.json();
  expect(frame.overall.total).toBe(620);
  expect(frame.stocks[0]).toMatchObject({ symbol: "LATE", total: 120 });
  const state = await (await request.get("http://127.0.0.1:3101/_control")).json();
  expect(state.snapshots).toHaveLength(0);
  expect(state.calls.filter((call: { table: string }) => call.table === "sentiment_results")).toHaveLength(2);
});
test("detector auth, same-bucket update and snapshot failure isolation", async ({ request }) => {
  expect((await request.post("/api/v1/detector/register", { data: { status: {} } })).status()).toBe(401);
  const data = { status: { collector_last_run_at: new Date().toISOString(), llm_last_run_at: new Date().toISOString() } };
  for (let i = 0; i < 2; i++) {
    const response = await request.post("/api/v1/detector/register", { data, headers: { authorization: "Bearer local-dev-detector-token" } });
    expect(response.status()).toBe(200); expect((await response.json()).status_updated).toBe(true);
  }
  let state = await (await request.get("http://127.0.0.1:3101/_control")).json();
  expect(state.snapshots).toHaveLength(1);
  // The record holds index data only: no evidence lists, no post titles or links.
  const stored = state.snapshots[0].frame;
  expect(stored.overall.total).toBe(620); expect(stored.overall.evidence).toBeUndefined();
  expect(JSON.stringify(stored)).not.toMatch(/테스트 수집 제목|example\.com|post_key/);
  await request.post("http://127.0.0.1:3101/_control", { data: { failWrite: true } });
  const response = await request.post("/api/v1/detector/register", { data, headers: { authorization: "Bearer local-dev-detector-token" } });
  expect(response.status()).toBe(200); expect((await response.json()).status).toBe("ok");
  state = await (await request.get("http://127.0.0.1:3101/_control")).json();
  expect(state.snapshots).toHaveLength(1);
  await request.post("http://127.0.0.1:3101/_control", { data: {} });
});
test("replay validates dates and preserves gaps and read failure", async ({ request }) => {
  expect((await request.get("/api/internal/world/replay?date=2026-02-30")).status()).toBe(400);
  expect((await request.get("/api/internal/world/replay?date=2000-01-01")).status()).toBe(400);
  const response = await request.get(`/api/internal/world/replay?date=${worldDate()}`);
  expect(response.status()).toBe(200);
  const replay = await response.json();
  expect(replay.slots).toHaveLength(144);
  expect(replay.slots.filter((slot: { frame: unknown }) => slot.frame)).toHaveLength(1);
  const recorded = replay.slots.find((slot: { frame: unknown }) => slot.frame).frame;
  expect(recorded.overall.evidence).toEqual({ bullish: [], bearish: [], neutral: [] });
  await request.post("http://127.0.0.1:3101/_control", { data: { failRead: true } });
  const failed = await request.get(`/api/internal/world/replay?date=${worldDate()}`);
  expect(failed.status()).toBe(503); expect((await failed.json()).slots.every((slot: { frame: unknown }) => slot.frame === null)).toBe(true);
  await request.post("http://127.0.0.1:3101/_control", { data: {} });
});
