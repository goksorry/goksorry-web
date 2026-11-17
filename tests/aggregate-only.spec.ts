import { expect, test } from "@playwright/test";
import { normalizeAggregateBuckets, summarizeAggregates } from "../lib/community-aggregates";
import { buildSourceGroupSummaries, buildOverallFromSourceGroupSummaries } from "../lib/feed-data";
import { buildWorldFrame } from "../lib/world";
import { buildFeedPage } from "../lib/feed-scope";
const now = new Date("2026-11-17T09:00:00Z");
const bucket = (source = "dc_krstock", extra = {}) => ({ at: "2026-11-17T08:59:00Z", source, market: "kr" as const, symbol: null, bullish: 3, bearish: 1, neutral: 2, score_sum: 26, ...extra });
test("numeric allow-list discards source text, invalid sums, expired and future samples", () => {
  const accepted = normalizeAggregateBuckets([bucket("dc_krstock", { title: "PRIVATE", url: "https://example.com/private", body: "BODY" }), bucket("bad"), bucket("dc_stock", { score_sum: 999 }), bucket("dc_stock", { at: "2026-11-17T03:00:00Z" }), bucket("dc_stock", { at: "2026-11-17T09:00:01Z" })], now);
  expect(accepted).toEqual([bucket("dc_krstock", { at: "2026-11-17T08:59:00.000Z" })]); expect(JSON.stringify(accepted)).not.toContain("PRIVATE");
});
test("all four communities contribute without titles; no samples means no neutral vote", () => {
  const buckets = [bucket("toss_stock_community"), bucket("ppomppu_stock"), bucket("blind_stock_invest"), bucket()];
  const groups = buildSourceGroupSummaries([], { aggregateBuckets: buckets, asOf: now });
  expect(groups.every(g => g.mentions === 4 && g.rows.length === 0)).toBe(true);
  const only = buildSourceGroupSummaries([], { aggregateBuckets: [bucket()], asOf: now });
  expect(buildOverallFromSourceGroupSummaries(only).overall_goksorry_index).toBe(only.find(g => g.id === "dc")!.goksorry_index);
});
test("world counts, stock selection and current feed use aggregates without evidence", () => {
  const buckets = [bucket("toss_stock_community", { symbol: "AAPL", market: "us" as const }), bucket()];
  const rows = [{ post_key: "name-only", source: "toss_stock_community_AAPL", title: "TITLE NOT IN FRAME", clean_title: null, url: "https://www.tossinvest.com/community/post/123", symbol: "AAPL", symbol_name: "애플", symbol_market: "us" as const, label: "bullish" as const, sentiment_score: 8, confidence: .9, analyzed_at: now.toISOString() }];
  const frame = buildWorldFrame(rows, { aggregateBuckets: buckets, now });
  expect(frame.overall.total).toBe(12); expect(frame.stocks[0].total).toBe(6);
  expect(frame.stocks[0].name).toBe("애플"); expect(JSON.stringify(frame)).not.toContain("TITLE NOT IN FRAME");
  expect(frame.communities.find(c => c.id === "dc")!.total).toBe(6);
  expect(frame.overall.evidence).toEqual({ bullish: [], bearish: [], neutral: [] });
  const page = buildFeedPage({ rows: [], aggregateBuckets: buckets, generated_at: now.toISOString(), market_indicators: [], marketAdjustmentSnapshot: null, collectionStatuses: {}, collection: frame.collection }, { symbol: "AAPL", channels: ["toss", "dc"], sentiment: "all" });
  expect(page.rows).toEqual([]); expect(page.summary.total).toBe(6); expect(page.stocks[0].symbol).toBe("AAPL");
});
test("existing one-decimal score formula and neutral exclusion are preserved", () => {
  const a = summarizeAggregates([bucket()], null, now);
  const groups = buildSourceGroupSummaries(Array.from({ length: 4 }, (_, i) => ({ post_key: String(i), source: "dc_krstock", title: "", clean_title: null, url: "", symbol: null, symbol_name: null, symbol_market: null, label: i === 3 ? "bearish" as const : "bullish" as const, sentiment_score: i === 3 ? 2 : 8, confidence: .9, analyzed_at: now.toISOString() })));
  expect(a.goksorry_index).toBe(groups.find(g => g.id === "dc")!.goksorry_index);
});
