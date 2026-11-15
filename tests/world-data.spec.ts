import { expect, test } from "@playwright/test";
import type { FeedRow } from "../lib/feed-data";
import { buildSourceGroupSummaries, buildOverallFromSourceGroupSummaries } from "../lib/feed-data";
import { buildWorldFrame, buildWorldReplay, worldBucket, worldDate, worldDayBounds, worldHealth, worldSummary } from "../lib/world";
import { storeWorldSnapshot } from "../lib/world-store";
import type { SupabaseClient } from "@supabase/supabase-js";

const now = new Date("2026-11-15T01:00:00Z");
const post = (i: number, override: Partial<FeedRow> = {}): FeedRow => ({
  post_key: `post-${i}`, source: "toss_stock_community_AAPL", title: "실제 수집 제목", clean_title: "정제 제목",
  url: "https://example.com/post", symbol: "AAPL", symbol_name: "애플", symbol_market: "us", label: "bullish",
  sentiment_score: 8, confidence: .9, analyzed_at: now.toISOString(), ...override
});
test("world ratios exclude neutral; small samples never declare a winner", () => {
  const rows = [post(1), post(2), post(3, { label: "bearish", sentiment_score: 2 }), ...[4,5,6].map((i) => post(i, { label: "neutral", sentiment_score: 5 }))];
  const summary = worldSummary(rows);
  expect(summary).toMatchObject({ total: 6, bullish: 2, bearish: 1, neutral: 3, mood: "hope", hope_ratio: 2/3, fear_ratio: 1/3 });
  expect(worldSummary([post(1), post(2)]).mood).toBe("watching");
  expect(worldSummary(rows.slice(3)).hope_ratio).toBeNull();
  expect(worldSummary(rows.slice(3)).mood).toBe("neutral");
  expect(worldSummary([post(1), post(2), post(3, { label: "bearish" }), post(4, { label: "bearish" })]).mood).toBe("mixed");
});
test("world scans, deduplicates, ranks 12 stocks and reuses existing index formula", () => {
  const rows = Array.from({ length: 15 }, (_, i) => post(i, { symbol: `S${i}`, symbol_name: `종목${i}` }));
  rows.push(post(21, { symbol: "S14" }), post(22, { symbol: "S14", label: "bearish", sentiment_score: 2 }));
  const frame = buildWorldFrame([...rows, rows[0], post(90, { analyzed_at: "2026-11-14T18:59:59Z" }), post(91, { analyzed_at: "2026-11-15T01:00:01Z" }), post(92, { source: "untracked" })], { now });
  expect(frame.overall.total).toBe(17);
  expect(frame.stocks).toHaveLength(12);
  expect(frame.stocks[0]).toMatchObject({ symbol: "S14", total: 3 });
  expect(frame.overall.index).toBe(buildOverallFromSourceGroupSummaries(buildSourceGroupSummaries(rows)).overall_goksorry_index);
});
test("collection exclusions and exact stale boundary survive missing data", () => {
  const rows = [post(1), post(2, { source: "toss_lounge_us" })];
  const frame = buildWorldFrame(rows, { now, excludedSourceNames: new Set(["toss_lounge"]), collectionStatuses: { toss: { problem: true, disabled: false, reason: "no_articles", articleCount: 1 } } });
  expect(frame.overall.total).toBe(1);
  expect(frame.communities[0].collection_problem).toBe(true);
  expect(worldHealth(frame, now.getTime())).toBe("watching");
  expect(worldHealth(frame, now.getTime() + 30 * 60_000 - 1)).toBe("watching");
  expect(worldHealth(frame, now.getTime() + 30 * 60_000)).toBe("delayed");
  expect(worldHealth(buildWorldFrame([], { now }))).toBe("waiting");
});
test("KST day boundaries, invalid dates and missing replay slots", () => {
  expect(worldDate(new Date("2026-11-14T15:00:00Z"))).toBe("2026-11-15");
  expect(worldDayBounds("2026-11-15")).toEqual({ start: "2026-11-14T15:00:00.000Z", end: "2026-11-15T15:00:00.000Z" });
  expect(worldDayBounds("2026-02-29")).toBeNull();
  expect(worldDayBounds("2026-2-03")).toBeNull();
  expect(worldBucket(new Date("2026-11-14T15:09:59.999Z"))).toBe("2026-11-14T15:00:00.000Z");
  const frame = buildWorldFrame([post(1)], { now });
  const replay = buildWorldReplay("2026-11-15", [{ bucket_at: "2026-11-14T15:00:00.000Z", frame }, { bucket_at: "2026-11-15T15:00:00.000Z", frame }]);
  expect(replay.slots).toHaveLength(144);
  expect(replay.slots.filter((slot) => slot.frame)).toHaveLength(1);
  expect(replay.slots[1].frame).toBeNull();
  expect(replay.slots[143].bucket_at).toBe("2026-11-15T14:50:00.000Z");
});
test("snapshot writer upserts same bucket, prunes seven days and surfaces failure", async () => {
  const snapshots = new Map<string, unknown>();
  const cutoffs: string[] = [];
  let fail = false;
  const service = { from: (table: string) => {
    expect(table).toBe("world_snapshots");
    return {
      upsert: async (row: { bucket_at: string; frame: unknown }, options: { onConflict: string }) => {
        expect(options.onConflict).toBe("bucket_at"); if (!fail) snapshots.set(row.bucket_at, row.frame);
        return { error: fail ? { message: "write failed" } : null };
      },
      delete: () => ({ lt: async (_: string, cutoff: string) => { cutoffs.push(cutoff); return { error: null }; } })
    };
  }} as unknown as SupabaseClient;
  const frame = buildWorldFrame([post(1)], { now });
  await storeWorldSnapshot(service, frame, new Date("2026-11-15T01:01:00Z"));
  await storeWorldSnapshot(service, { ...frame, data_at: "updated" }, new Date("2026-11-15T01:09:00Z"));
  expect(snapshots.size).toBe(1);
  expect([...snapshots.values()][0]).toMatchObject({ data_at: "updated" });
  expect(cutoffs[0]).toBe("2026-11-08T01:01:00.000Z");
  fail = true;
  await expect(storeWorldSnapshot(service, frame, now)).rejects.toThrow("write failed");
});

test("PostgREST timestamp offsets match generated replay slots", () => {
  const frame = buildWorldFrame([post(1)], { now });
  const replay = buildWorldReplay("2026-11-15", [{ bucket_at: "2026-11-15T01:00:00+00:00", frame }]);
  expect(replay.slots[60].frame).toEqual(frame);
});
