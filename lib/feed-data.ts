import type { SupabaseClient } from "@supabase/supabase-js";
import { SOURCE_GROUPS, getSourceGroupId, matchesSourceGroup, type SourceGroupId } from "@/lib/feed-source-groups";

export type FeedRow = {
  post_key: string;
  source: string;
  title: string;
  url: string;
  label: "bullish" | "bearish" | "neutral";
  confidence: number;
  analyzed_at: string;
};

type SentimentRow = {
  post_key: string;
  label: "bullish" | "bearish" | "neutral";
  confidence: number;
  analyzed_at: string;
};

type ExternalPostRow = {
  post_key: string;
  source: string;
  title: string;
  url: string;
};

export type SourceGroupSummary = {
  id: SourceGroupId;
  label: string;
  shortLabel: string;
  mentions: number;
  bullish: number;
  bearish: number;
  neutral: number;
  score: number;
  tone: "bullish" | "bearish" | "mixed";
  rows: FeedRow[];
};

export const fetchRecentFeedRows = async (
  service: SupabaseClient,
  { hours = 24, limit = 500 }: { hours?: number; limit?: number } = {}
): Promise<{ rows: FeedRow[]; errorMessage: string }> => {
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data: sentimentData, error: sentimentError } = await service
    .from("sentiment_results")
    .select("post_key,label,confidence,analyzed_at")
    .gte("analyzed_at", cutoffIso)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (sentimentError) {
    return { rows: [], errorMessage: sentimentError.message };
  }

  const sentimentRows: SentimentRow[] = (sentimentData ?? []).map((item: any) => ({
    post_key: String(item.post_key),
    label: String(item.label) as SentimentRow["label"],
    confidence: Number(item.confidence ?? 0),
    analyzed_at: String(item.analyzed_at)
  }));

  const postKeys = [...new Set(sentimentRows.map((row) => row.post_key))];
  if (postKeys.length === 0) {
    return { rows: [], errorMessage: "" };
  }

  const { data: externalData, error: externalError } = await service
    .from("external_posts")
    .select("post_key,source,title,url")
    .in("post_key", postKeys);

  if (externalError) {
    return { rows: [], errorMessage: externalError.message };
  }

  const externalRows: ExternalPostRow[] = (externalData ?? []).map((item: any) => ({
    post_key: String(item.post_key),
    source: String(item.source),
    title: String(item.title),
    url: String(item.url)
  }));

  const externalByPostKey = new Map(externalRows.map((row) => [row.post_key, row]));
  const rows = sentimentRows.flatMap((row) => {
    const external = externalByPostKey.get(row.post_key);
    if (!external) {
      return [];
    }

    return [
      {
        post_key: row.post_key,
        source: external.source,
        title: external.title,
        url: external.url,
        label: row.label,
        confidence: row.confidence,
        analyzed_at: row.analyzed_at
      }
    ];
  });

  return { rows, errorMessage: "" };
};

export const filterRowsBySourceGroup = (rows: FeedRow[], groupId: SourceGroupId | ""): FeedRow[] => {
  if (!groupId) {
    return rows;
  }
  return rows.filter((row) => matchesSourceGroup(row.source, groupId));
};

export const buildSourceGroupSummaries = (rows: FeedRow[]): SourceGroupSummary[] => {
  return SOURCE_GROUPS.map((group) => {
    const groupRows = rows.filter((row) => matchesSourceGroup(row.source, group.id));
    const bullish = groupRows.filter((row) => row.label === "bullish").length;
    const bearish = groupRows.filter((row) => row.label === "bearish").length;
    const neutral = groupRows.length - bullish - bearish;
    const score = groupRows.length === 0 ? 50 : Math.max(0, Math.min(100, Math.round(50 + ((bullish - bearish) / groupRows.length) * 50)));
    const tone = score >= 60 ? "bullish" : score <= 40 ? "bearish" : "mixed";

    return {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      mentions: groupRows.length,
      bullish,
      bearish,
      neutral,
      score,
      tone,
      rows: groupRows.slice(0, 12)
    };
  });
};

export const getFeedExactSourceOptions = (rows: FeedRow[]): string[] => {
  return [...new Set(rows.map((row) => row.source))].sort();
};

export const getFeedGroupForRow = (row: FeedRow): SourceGroupId | null => {
  return getSourceGroupId(row.source);
};

