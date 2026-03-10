import type { SupabaseClient } from "@supabase/supabase-js";
import { SOURCE_GROUPS, getSourceGroupId, matchesSourceGroup, type SourceGroupId } from "@/lib/feed-source-groups";

const EXTERNAL_POST_BATCH_SIZE = 100;
const SYMBOL_NAME_TTL_MS = 5 * 60 * 1000;
const symbolNameCache = new Map<string, { name: string | null; expiresAt: number }>();

export type FeedRow = {
  post_key: string;
  source: string;
  title: string;
  clean_title: string | null;
  url: string;
  symbol: string | null;
  symbol_name: string | null;
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
  clean_title: string | null;
  url: string;
};

const getSymbolFromSource = (source: string): string | null => {
  if (source.startsWith("naver_stock_")) {
    return source.replace("naver_stock_", "").trim() || null;
  }

  if (source.startsWith("toss_stock_community_")) {
    return source.replace("toss_stock_community_", "").trim().toUpperCase() || null;
  }

  return null;
};

const fetchSymbolName = async (symbol: string): Promise<string | null> => {
  const now = Date.now();
  const cached = symbolNameCache.get(symbol);
  if (cached && cached.expiresAt > now) {
    return cached.name;
  }

  try {
    const response = await fetch(`https://wts-info-api.tossinvest.com/api/v2/stock-infos/code-or-symbol/${encodeURIComponent(symbol)}`, {
      headers: {
        "User-Agent": "goksorry-web/1.0",
        Accept: "application/json"
      },
      next: { revalidate: SYMBOL_NAME_TTL_MS / 1000 }
    });

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: {
        name?: string;
        detailName?: string;
        companyName?: string;
      };
    };

    const name = String(
      payload.result?.name ?? payload.result?.detailName ?? payload.result?.companyName ?? ""
    ).trim() || null;

    symbolNameCache.set(symbol, {
      name,
      expiresAt: now + SYMBOL_NAME_TTL_MS
    });

    return name;
  } catch {
    symbolNameCache.set(symbol, {
      name: null,
      expiresAt: now + SYMBOL_NAME_TTL_MS
    });
    return null;
  }
};

const resolveSymbolNames = async (symbols: string[]): Promise<Map<string, string | null>> => {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];
  const pairs = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      const name = await fetchSymbolName(symbol);
      return [symbol, name] as const;
    })
  );

  return new Map(pairs);
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
    .select("post_key,label,confidence,analyzed_at")
    .gte("analyzed_at", cutoffIso)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (sentimentError) {
    console.error("feed sentiment query failed", {
      message: sentimentError.message
    });
    return { rows: [], errorMessage: "피드 데이터를 준비하지 못했습니다." };
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

  const externalRows: ExternalPostRow[] = [];
  for (const postKeyBatch of chunk(postKeys, EXTERNAL_POST_BATCH_SIZE)) {
    const { data: externalData, error: externalError } = await service
      .from("external_posts")
      .select("post_key,source,title,clean_title,url")
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
        url: String(item.url)
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
        symbol: getSymbolFromSource(external.source),
        symbol_name: null,
        label: row.label,
        confidence: row.confidence,
        analyzed_at: row.analyzed_at
      }
    ];
  });

  const symbolNames = await resolveSymbolNames(baseRows.map((row) => row.symbol ?? "").filter(Boolean));
  const rows = baseRows.map((row) => ({
    ...row,
    symbol_name: row.symbol ? symbolNames.get(row.symbol) ?? null : null
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
    return rows;
  }

  return rows.filter((row) => groupIds.some((groupId) => matchesSourceGroup(row.source, groupId)));
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
