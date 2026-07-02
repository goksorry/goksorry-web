import { expect, test } from "@playwright/test";
import {
  buildOverallFromSourceGroupSummaries,
  buildSourceGroupSummaries,
  type FeedRow
} from "../lib/feed-data";

const row = (overrides: Partial<FeedRow>): FeedRow => ({
  post_key: "post",
  source: "toss_stock_community_aapl",
  title: "title",
  clean_title: null,
  url: "https://example.com/post",
  symbol: null,
  symbol_name: null,
  symbol_market: null,
  label: "bullish",
  sentiment_score: 8,
  confidence: 0.9,
  analyzed_at: "2026-07-02T00:00:00.000Z",
  ...overrides
});

test.describe("feed source collection status", () => {
  test("excludes problem source rows while keeping partially healthy group active", () => {
    const summaries = buildSourceGroupSummaries(
      [
        row({ post_key: "stock", source: "toss_stock_community_aapl", label: "bullish", sentiment_score: 8 }),
        row({ post_key: "lounge", source: "toss_lounge_kr_domestic", label: "bearish", sentiment_score: 2 })
      ],
      {
        excludedSourceNames: new Set(["toss_lounge"]),
        collectionStatuses: {
          toss: {
            problem: true,
            disabled: false,
            reason: "no_articles",
            articleCount: 4
          }
        }
      }
    );

    const toss = summaries.find((group) => group.id === "toss");
    expect(toss?.collection_problem).toBe(true);
    expect(toss?.collection_disabled).toBe(false);
    expect(toss?.mentions).toBe(1);
    expect(toss?.bullish).toBe(1);
    expect(toss?.bearish).toBe(0);
    expect(toss?.rows.map((item) => item.post_key)).toEqual(["stock"]);
  });

  test("excludes disabled groups from overall index average", () => {
    const summaries = buildSourceGroupSummaries(
      [row({ post_key: "stock", source: "toss_stock_community_aapl", label: "bullish", sentiment_score: 8 })],
      {
        collectionStatuses: {
          ppomppu: {
            problem: true,
            disabled: true,
            reason: "no_articles",
            articleCount: 0
          },
          blind: {
            problem: true,
            disabled: true,
            reason: "robots_disallow",
            articleCount: null
          },
          dc: {
            problem: true,
            disabled: true,
            reason: "no_articles",
            articleCount: 0
          }
        }
      }
    );

    const overall = buildOverallFromSourceGroupSummaries(summaries);

    expect(summaries.find((group) => group.id === "ppomppu")?.collection_disabled).toBe(true);
    expect(overall.overall_sentiment_score).toBe(9.1);
    expect(overall.overall_goksorry_index).toBe(0);
  });
});
