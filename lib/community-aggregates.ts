import { calculateRowMarketAdjustment, type MarketAdjustmentSnapshot } from "./community-market-adjustment";
import { amplifyAggregateSentimentScore, clampSentimentScore, goksorryIndexFromScore } from "./sentiment-score";

const SOURCES = new Set(["dc_stock", "dc_krstock", "dc_usstock", "dc_tenbagger", "ppomppu_stock", "blind_stock_invest", "toss_stock_community", "toss_lounge"]);
export type CommunityAggregate = { at: string; source: string; market: "kr" | "us" | "all"; symbol: string | null; bullish: number; bearish: number; neutral: number; score_sum: number };

/** Allow-list every field: a detector payload must never persist source text here. */
export function normalizeAggregateBuckets(value: unknown, now = new Date()): CommunityAggregate[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5000).flatMap((raw): CommunityAggregate[] => {
    if (!raw || typeof raw !== "object") return [];
    const b = raw as Record<string, unknown>;
    const at = Date.parse(String(b.at ?? ""));
    const source = String(b.source ?? "");
    const market = b.market;
    const counts = [b.bullish, b.bearish, b.neutral];
    if (!SOURCES.has(source) || !["kr", "us", "all"].includes(String(market)) || !Number.isFinite(at) || at > now.getTime() || at <= now.getTime() - 6 * 3600000) return [];
    if (!counts.every(n => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1000000)) return [];
    const [bullish, bearish, neutral] = counts as number[];
    if (bullish + bearish + neutral === 0 || typeof b.score_sum !== "number" || !Number.isFinite(b.score_sum) || b.score_sum < bullish * 6 + bearish || b.score_sum > bullish * 10 + bearish * 4) return [];
    const symbol = typeof b.symbol === "string" && /^(?:[A-Z]{1,5}|[0-9]{6})$/.test(b.symbol) ? b.symbol : null;
    return [{ at: new Date(at).toISOString(), source, market: market as CommunityAggregate["market"], symbol, bullish, bearish, neutral, score_sum: b.score_sum }];
  });
}

export function summarizeAggregates(buckets: CommunityAggregate[], market: MarketAdjustmentSnapshot | null = null, now = new Date()) {
  const bullish = buckets.reduce((n, b) => n + b.bullish, 0);
  const bearish = buckets.reduce((n, b) => n + b.bearish, 0);
  const neutral = buckets.reduce((n, b) => n + b.neutral, 0);
  const mentions = bullish + bearish;
  const average = mentions ? Math.round(buckets.reduce((n, b) => n + b.score_sum, 0) / mentions * 10) / 10 : 5;
  const base_score = amplifyAggregateSentimentScore(average);
  const adjustment = buckets.reduce((n, b) => n + (b.bullish + b.bearish) * calculateRowMarketAdjustment({ source: b.market === "kr" ? "dc_krstock" : b.market === "us" ? "dc_usstock" : "blind_stock_invest", symbol_market: b.market === "all" ? null : b.market }, market, now), 0);
  const market_adjustment = mentions ? Number((adjustment / mentions).toFixed(2)) : 0;
  const score = clampSentimentScore(base_score + market_adjustment);
  return { bullish, bearish, neutral, mentions, total: mentions + neutral, base_score, market_adjustment, score, goksorry_index: goksorryIndexFromScore(score), data_at: buckets.map(b => b.at).sort().at(-1) ?? null };
}
