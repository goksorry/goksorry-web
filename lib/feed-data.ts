import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketAdjustmentSnapshot } from "@/lib/community-market-adjustment";
import { averageRowMarketAdjustment } from "@/lib/community-market-adjustment";
import { SOURCE_GROUPS, getSourceGroupId, matchesSourceGroup, type SourceGroupId } from "@/lib/feed-source-groups";
import {
  aggregateSentimentBand,
  amplifyAggregateSentimentScore,
  clampSentimentScore,
  averageSentimentScore,
  goksorryIndexFromScore,
  resolveSentimentScore,
  sentimentLabelFromScore,
  sentimentToneFromBand,
  type SentimentBand,
  type SentimentLabel
} from "@/lib/sentiment-score";
import { extractSymbolFromSource, loadSymbolMetadataMap } from "@/lib/symbol-metadata";

const EXTERNAL_POST_BATCH_SIZE = 100;

export type FeedRow = {
  post_key: string;
  source: string;
  title: string;
  clean_title: string | null;
  url: string;
  symbol: string | null;
  symbol_name: string | null;
  symbol_market: "kr" | "us" | null;
  label: SentimentLabel;
  sentiment_score: number;
  confidence: number;
  analyzed_at: string;
};

type SentimentRow = {
  post_key: string;
  label: SentimentLabel;
  sentiment_score: number;
  confidence: number;
  analyzed_at: string;
};

type ExternalPostRow = {
  post_key: string;
  source: string;
  title: string;
  clean_title: string | null;
  url: string;
  symbol: string | null;
};

export type SourceGroupSummary = {
  id: SourceGroupId;
  label: string;
  shortLabel: string;
  mentions: number;
  bullish: number;
  bearish: number;
  neutral: number;
  base_score: number;
  market_adjustment: number;
  score: number;
  goksorry_index: number;
  sentiment_band: SentimentBand;
  tone: "bullish" | "bearish" | "mixed";
  rows: FeedRow[];
};

export type FeedScoreOverview = {
  base_score: number;
  market_adjustment: number;
  score: number;
  goksorry_index: number;
  sentiment_band: SentimentBand;
};

type FeedScoreBuildOptions = {
  marketAdjustmentEnabled?: boolean;
  marketAdjustmentSnapshot?: MarketAdjustmentSnapshot | null;
  asOf?: Date;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const fetchRecentFeedRows = async (
  service: SupabaseClient,
  { hours = 24, limit = 500 }: { hours?: number; limit?: number } = {}
): Promise<{ rows: FeedRow[]; errorMessage: string }> => {
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data: sentimentData, error: sentimentError } = await service
    .from("sentiment_results")
    .select("post_key,label,sentiment_score,confidence,analyzed_at")
    .gte("analyzed_at", cutoffIso)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (sentimentError) {
    console.error("feed sentiment query failed", {
      message: sentimentError.message
    });
    return { rows: [], errorMessage: "피드 데이터를 준비하지 못했습니다." };
  }

  const sentimentRows: SentimentRow[] = (sentimentData ?? []).map((item: any) => {
    const sentimentScore = resolveSentimentScore(item.sentiment_score, item.label);
    return {
      post_key: String(item.post_key),
      label: sentimentLabelFromScore(sentimentScore),
      sentiment_score: sentimentScore,
      confidence: Number(item.confidence ?? 0),
      analyzed_at: String(item.analyzed_at)
    };
  });

  const postKeys = [...new Set(sentimentRows.map((row) => row.post_key))];
  if (postKeys.length === 0) {
    return { rows: [], errorMessage: "" };
  }

  const externalRows: ExternalPostRow[] = [];
  for (const postKeyBatch of chunk(postKeys, EXTERNAL_POST_BATCH_SIZE)) {
    const { data: externalData, error: externalError } = await service
      .from("external_posts")
      .select("post_key,source,title,clean_title,url,symbol")
      .in("post_key", postKeyBatch);

    if (externalError) {
      console.error("feed external post query failed", {
        message: externalError.message
      });
      return { rows: [], errorMessage: "피드 데이터를 준비하지 못했습니다." };
    }

    externalRows.push(
      ...(externalData ?? []).map((item: any) => ({
        post_key: String(item.post_key),
        source: String(item.source),
        title: String(item.title),
        clean_title: typeof item.clean_title === "string" ? item.clean_title : null,
        url: String(item.url),
        symbol:
          typeof item.symbol === "string" && item.symbol.trim()
            ? item.symbol.trim().toUpperCase()
            : extractSymbolFromSource(String(item.source))
      }))
    );
  }

  const externalByPostKey = new Map(externalRows.map((row) => [row.post_key, row]));
  const baseRows = sentimentRows.flatMap((row) => {
    const external = externalByPostKey.get(row.post_key);
    if (!external) {
      return [];
    }

    return [
      {
        post_key: row.post_key,
        source: external.source,
        title: external.title,
        clean_title: external.clean_title,
        url: external.url,
        symbol: external.symbol,
        symbol_name: null,
        symbol_market: null,
        label: row.label,
        sentiment_score: row.sentiment_score,
        confidence: row.confidence,
        analyzed_at: row.analyzed_at
      }
    ];
  });

  const symbolMetadata = await loadSymbolMetadataMap(
    service,
    baseRows.map((row) => row.symbol ?? "").filter(Boolean)
  );
  const rows = baseRows.map((row) => ({
    ...row,
    symbol_name: row.symbol ? symbolMetadata.get(row.symbol)?.display_name ?? row.symbol : null,
    symbol_market: row.symbol ? symbolMetadata.get(row.symbol)?.market ?? null : null
  }));

  return { rows, errorMessage: "" };
};

export const filterRowsBySourceGroup = (rows: FeedRow[], groupId: SourceGroupId | ""): FeedRow[] => {
  if (!groupId) {
    return rows;
  }
  return rows.filter((row) => matchesSourceGroup(row.source, groupId));
};

export const filterRowsBySourceGroups = (rows: FeedRow[], groupIds: SourceGroupId[]): FeedRow[] => {
  if (groupIds.length === 0) {
    return [];
  }

  if (groupIds.length === SOURCE_GROUPS.length) {
    return rows.filter((row) => getSourceGroupId(row.source) !== null);
  }

  return rows.filter((row) => groupIds.some((groupId) => matchesSourceGroup(row.source, groupId)));
};

const getActionableRows = (rows: FeedRow[]): FeedRow[] => rows.filter((row) => row.label !== "neutral");

const buildAggregateVisibleScore = (
  actionableRows: FeedRow[],
  {
    marketAdjustmentEnabled = true,
    marketAdjustmentSnapshot = null,
    asOf = new Date()
  }: FeedScoreBuildOptions = {}
): FeedScoreOverview => {
  const baseScore = amplifyAggregateSentimentScore(
    averageSentimentScore(actionableRows.map((row) => row.sentiment_score))
  );
  const marketAdjustment =
    marketAdjustmentEnabled && marketAdjustmentSnapshot
      ? averageRowMarketAdjustment(actionableRows, marketAdjustmentSnapshot, asOf)
      : 0;
  const score = clampSentimentScore(baseScore + marketAdjustment);
  const bullish = actionableRows.filter((row) => row.label === "bullish").length;
  const bearish = actionableRows.filter((row) => row.label === "bearish").length;

  return {
    base_score: baseScore,
    market_adjustment: marketAdjustment,
    score,
    goksorry_index: goksorryIndexFromScore(score),
    sentiment_band: aggregateSentimentBand(score, {
      bullishCount: bullish,
      bearishCount: bearish
    })
  };
};

export const buildSourceGroupSummaries = (
  rows: FeedRow[],
  options?: FeedScoreBuildOptions
): SourceGroupSummary[] => {
  return SOURCE_GROUPS.map((group) => {
    const groupRows = rows.filter((row) => matchesSourceGroup(row.source, group.id));
    const actionableRows = getActionableRows(groupRows);
    const bullish = actionableRows.filter((row) => row.label === "bullish").length;
    const bearish = actionableRows.filter((row) => row.label === "bearish").length;
    const neutral = groupRows.length - actionableRows.length;
    const overview = buildAggregateVisibleScore(actionableRows, options);
    const tone = sentimentToneFromBand(overview.sentiment_band);

    return {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      mentions: actionableRows.length,
      bullish,
      bearish,
      neutral,
      base_score: overview.base_score,
      market_adjustment: overview.market_adjustment,
      score: overview.score,
      goksorry_index: overview.goksorry_index,
      sentiment_band: overview.sentiment_band,
      tone,
      rows: actionableRows.slice(0, 12)
    };
  });
};

export const buildFeedScoreOverview = (
  rows: FeedRow[],
  options?: FeedScoreBuildOptions
): FeedScoreOverview => {
  const actionableRows = getActionableRows(rows);
  return buildAggregateVisibleScore(actionableRows, options);
};

export const getFeedExactSourceOptions = (rows: FeedRow[]): string[] => {
  return [...new Set(rows.map((row) => row.source))].sort();
};

export const getFeedGroupForRow = (row: FeedRow): SourceGroupId | null => {
  return getSourceGroupId(row.source);
};
