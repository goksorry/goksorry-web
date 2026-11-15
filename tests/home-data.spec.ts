import { test, expect } from "@playwright/test";
import { buildFeedPage, readFeedSelection, type FeedSnapshot } from "../lib/feed-scope";
import { SOURCE_GROUP_IDS } from "../lib/feed-source-groups";
import { worldRows } from "./world-fixture";
import { buildWorldFrame } from "../lib/world";
const selection = { symbol: "", channels: [...SOURCE_GROUP_IDS], sentiment: "all" as const };
const snapshot = (): FeedSnapshot => ({ rows: worldRows().sort((a,b)=>b.analyzed_at.localeCompare(a.analyzed_at)), generated_at: new Date().toISOString(), market_indicators: [], marketAdjustmentSnapshot: null, collectionStatuses: {}, collection: { last_run_at: null, errors: 0, degraded: false, unavailable: false } });

test("scope before pagination; sentiment leaves counts, ratios and index intact", () => {
  const input = snapshot();
  const scoped = { ...selection, symbol: "S10", channels: ["ppomppu", "dc"] as typeof SOURCE_GROUP_IDS };
  const all = buildFeedPage(input, scoped, { limit: 2 });
  const bearish = buildFeedPage(input, { ...scoped, sentiment: "bearish" }, { limit: 2 });
  expect(all.summary.total).toBe(10);
  expect(all.rows).toHaveLength(2);
  expect(bearish.summary).toEqual(all.summary);
  expect(bearish.rows.every(row => row.label === "bearish")).toBe(true);
  expect(all.summary.total).toBe(all.summary.bullish + all.summary.bearish + all.summary.neutral);
  expect(all.summary.hope_ratio! + all.summary.fear_ratio!).toBe(1);
  expect(buildFeedPage(input, selection).summary.index).toBe(buildWorldFrame(input.rows).overall.index);
});
test("neutral-only, empty and small scopes never invent direction", () => {
  const input = snapshot();
  input.rows = input.rows.filter(row => row.label === "neutral");
  const neutral = buildFeedPage(input, selection);
  expect(neutral.summary).toMatchObject({ mood: "neutral", hope_ratio: null, fear_ratio: null });
  expect(neutral.summary.neutral).toBe(neutral.summary.total);
  expect(buildFeedPage(input, { ...selection, symbol: "MISSING" }).summary).toMatchObject({ total: 0, data_at: null, mood: "watching" });
  input.rows = input.rows.slice(0,2);
  expect(buildFeedPage(input, selection).summary.mood).toBe("watching");
  expect(buildFeedPage(input, { ...selection, channels: [] }).rows).toEqual([]);
});
test("old links and plural channels retain selections", () => {
  expect(readFeedSelection(new URLSearchParams("scene=battle&stock=aapl&channel=toss&feed=1"))).toEqual({ symbol: "AAPL", channels: ["toss"], sentiment: "all" });
  expect(readFeedSelection(new URLSearchParams("channels=ppomppu,dc&sentiment=neutral"))).toMatchObject({ channels: ["ppomppu","dc"], sentiment: "neutral" });
  expect(readFeedSelection(new URLSearchParams("channels=none"))).toMatchObject({ channels: [] });
});
