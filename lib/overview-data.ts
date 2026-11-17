import { fetchMarketDataText as fetchText } from "@/lib/market-data-access";
import { boundedCache } from "@/lib/bounded-cache";
import { COLLECTION_RUN_CACHE_TAG } from "@/lib/index-cache-policy";
import { parseNaverNasdaqQuote, parseNaverUsdKrwQuote } from "@/lib/naver-market-data";
import {
  buildMarketAdjustmentSnapshot,
  calculateMarketAdjustmentTiming,
  hasActiveMarketAdjustmentInput,
  resolveMarketAdjustmentStatus,
  type MarketAdjustmentStatus
} from "@/lib/community-market-adjustment";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import {
  buildOverallFromSourceGroupSummaries,
  buildSourceGroupSummaries,
  fetchRecentFeedRows,
  type SourceGroupCollectionStatus,
  type SourceGroupSummary
} from "@/lib/feed-data";
import {
  COLLECTION_POLICY_CACHE_TAG,
  getFooterCollectionPolicy,
  filterReviewedSourceRows,
  type FooterCollectionPolicy,
  type FooterCollectionPolicySource
} from "@/lib/collection-policy-status";
import { SOURCE_GROUP_IDS, getSourceGroupId, type SourceGroupId } from "@/lib/feed-source-groups";
import { type SentimentBand } from "@/lib/sentiment-score";

type IndicatorTone = "up" | "down" | "flat" | "fear" | "greed" | "mixed";

export type MarketIndicator = {
  id: string;
  label: string;
  value_text: string;
  delta_text: string;
  change_value: number | null;
  change_percent: number | null;
  tone: IndicatorTone;
  note: string;
  market_adjustment_basis_at: string | null;
  market_adjustment_weight: number;
  market_adjustment_status: MarketAdjustmentStatus;
};

export type OverviewPayload = {
  generated_at: string;
  market_indicators: MarketIndicator[];
  market_adjustment_enabled: boolean;
  market_adjustment_status: MarketAdjustmentStatus;
  overall_base_score: number;
  overall_market_adjustment: number;
  overall_sentiment_score: number;
  overall_goksorry_index: number;
  overall_sentiment_band: SentimentBand;
  community_indicators: SourceGroupSummary[];
};

export type CommunityIndicatorsPayload = {
  generated_at: string;
  market_adjustment_enabled: boolean;
  market_adjustment_status: MarketAdjustmentStatus;
  overall_base_score: number;
  overall_market_adjustment: number;
  overall_sentiment_score: number;
  overall_goksorry_index: number;
  overall_sentiment_band: SentimentBand;
  community_indicators: SourceGroupSummary[];
};

type NaverIndexBasicResponse = {
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  fluctuationsRatio?: string;
  compareToPreviousPrice?: {
    code?: string;
    text?: string;
    name?: string;
  };
  localTradedAt?: string;
};

type NaverIndexPriceRow = {
  localTradedAt?: string;
  closePrice?: string;
};

const COMMUNITY_WINDOW_HOURS = 6;
const KR_MARKET_TIME_ZONE = "Asia/Seoul";
const US_MARKET_TIME_ZONE = "America/New_York";

const parseNumber = (value: string): number | null => {
  const normalized = value.replace(/[^0-9+.,-]/g, "").replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const formatMarketBasisDate = (value: string | undefined): string | null => {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})[.-]?(\d{1,2})[.-]?(\d{1,2})/);
  if (!match) {
    return null;
  }

  return `${match[2].padStart(2, "0")}.${match[3].padStart(2, "0")}`;
};

const formatCloseBasisNote = (value: string | undefined): string => {
  const date = formatMarketBasisDate(value);
  return date ? `${date} 종가 대비` : "기준값 없음";
};

const formatExchangeBasisNote = (value: string | undefined): string => {
  const date = formatMarketBasisDate(value);
  return date ? `${date} 매매기준율 대비` : "기준값 없음";
};

const parseIndexTradeDates = (raw: string): { currentDate?: string; previousDate?: string } => {
  try {
    const rows = JSON.parse(raw) as NaverIndexPriceRow[];
    return Array.isArray(rows)
      ? { currentDate: rows[0]?.localTradedAt, previousDate: rows[1]?.localTradedAt }
      : {};
  } catch {
    return {};
  }
};

const formatNumber = (value: number, digits = 2): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
};

const formatSignedNumber = (value: number, digits = 2): string => {
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
};

const formatDeltaWithPercent = (delta: number | null, percent: number | null): string => {
  if (delta === null && percent === null) {
    return "변동 정보 없음";
  }

  if (delta === null) {
    return `${formatSignedNumber(percent ?? 0)}%`;
  }

  if (percent === null) {
    return formatSignedNumber(delta, 2);
  }

  return `${formatSignedNumber(delta, 2)} (${formatSignedNumber(percent, 2)}%)`;
};

const formatRegime = (value: string): string => {
  switch (value.toLowerCase()) {
    case "bullish":
    case "bull_run":
    case "risk_on":
      return "희망 우세";
    case "bearish":
    case "bear_risk":
    case "risk_off":
      return "공포 우세";
    case "neutral":
      return "중립";
    default:
      return value.replace(/_/g, " ");
  }
};

const fallbackIndicator = (id: string, label: string): MarketIndicator => ({
  id,
  label,
  value_text: "--",
  delta_text: "데이터 없음",
  change_value: null,
  change_percent: null,
  tone: "flat",
  note: "기준값 없음",
  market_adjustment_basis_at: null,
  market_adjustment_weight: 0,
  market_adjustment_status: "unavailable"
});

export const hasUsableMarketIndicator = (indicator: MarketIndicator): boolean => {
  return indicator.value_text !== "--" && indicator.delta_text !== "데이터 없음";
};

const fetchServiceIndex = async (code: "KOSPI" | "KOSDAQ", label: string, asOf: Date): Promise<MarketIndicator> => {
  try {
    const [raw, priceRaw] = await Promise.all([
      fetchText(`https://m.stock.naver.com/api/index/${code}/basic`),
      fetchText(`https://m.stock.naver.com/api/index/${code}/price?page=1&pageSize=2`)
    ]);
    const item = JSON.parse(raw) as NaverIndexBasicResponse;
    const tradeDates = parseIndexTradeDates(priceRaw);
    const value = parseNumber(String(item.closePrice ?? ""));
    const change = parseNumber(String(item.compareToPreviousClosePrice ?? ""));
    const percent = parseNumber(String(item.fluctuationsRatio ?? ""));
    if (value === null || change === null || percent === null) {
      return fallbackIndicator(code.toLowerCase(), label);
    }

    const tone: IndicatorTone = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const adjustmentTiming = calculateMarketAdjustmentTiming({
      basisDate: item.localTradedAt ?? tradeDates.currentDate,
      timeZone: KR_MARKET_TIME_ZONE,
      closeHour: 15,
      closeMinute: 30,
      asOf
    });

    return {
      id: code.toLowerCase(),
      label,
      value_text: formatNumber(value, 2),
      delta_text: `${change >= 0 ? "+" : ""}${formatNumber(change, 2)} (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%)`,
      change_value: change,
      change_percent: percent,
      tone,
      note: formatCloseBasisNote(tradeDates.previousDate),
      market_adjustment_basis_at: adjustmentTiming.basis_at,
      market_adjustment_weight: adjustmentTiming.weight,
      market_adjustment_status: adjustmentTiming.status
    };
  } catch {
    return fallbackIndicator(code.toLowerCase(), label);
  }
};

const fetchNasdaqIndicator = async (asOf: Date): Promise<MarketIndicator> => {
  try {
    const [raw, prices] = await Promise.all([
      fetchText("https://stock.naver.com/api/securityService/index/.IXIC/basic"),
      fetchText("https://stock.naver.com/api/securityService/index/.IXIC/price?page=1&pageSize=2")
        .then((raw): unknown => JSON.parse(raw)).catch(() => [])
    ]);
    const quote = parseNaverNasdaqQuote(JSON.parse(raw), prices);
    if (!quote) return fallbackIndicator("nasdaq", "NASDAQ");
    const { value, change, percent, currentDate, previousDate } = quote;
    const tone: IndicatorTone = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const adjustmentTiming = calculateMarketAdjustmentTiming({
      basisDate: currentDate,
      timeZone: US_MARKET_TIME_ZONE,
      closeHour: 16,
      closeMinute: 0,
      asOf
    });

    return {
      id: "nasdaq",
      label: "NASDAQ",
      value_text: formatNumber(value, 2),
      delta_text: formatDeltaWithPercent(change, percent),
      change_value: change,
      change_percent: percent,
      tone,
      note: formatCloseBasisNote(previousDate),
      market_adjustment_basis_at: adjustmentTiming.basis_at,
      market_adjustment_weight: adjustmentTiming.weight,
      market_adjustment_status: adjustmentTiming.status
    };
  } catch {
    return fallbackIndicator("nasdaq", "NASDAQ");
  }
};

const fetchUsdKrwIndicator = async (asOf: Date): Promise<MarketIndicator> => {
  try {
    const [raw, daily] = await Promise.all([
      fetchText("https://stock.naver.com/api/stockSecurity/exchange-rates/v2/market-index/FX_USDKRW/latest"),
      fetchText("https://stock.naver.com/api/stockSecurity/exchange-rates/v2/USD/daily?bankType=hana&size=2")
        .then((raw): unknown => JSON.parse(raw)).catch(() => ({}))
    ]);
    const quote = parseNaverUsdKrwQuote(JSON.parse(raw), daily);
    if (!quote) return fallbackIndicator("usdkrw", "원/달러 환율");
    const { value, change, percent, currentDate, previousDate } = quote;
    const tone: IndicatorTone = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const adjustmentTiming = calculateMarketAdjustmentTiming({
      basisDate: currentDate,
      timeZone: KR_MARKET_TIME_ZONE,
      closeHour: 15,
      closeMinute: 30,
      asOf
    });

    return {
      id: "usdkrw",
      label: "원/달러 환율",
      value_text: formatNumber(value, 2),
      delta_text: `${formatSignedNumber(change, 2)} KRW (${formatSignedNumber(percent, 2)}%)`,
      change_value: change,
      change_percent: percent,
      tone,
      note: formatExchangeBasisNote(previousDate),
      market_adjustment_basis_at: adjustmentTiming.basis_at,
      market_adjustment_weight: adjustmentTiming.weight,
      market_adjustment_status: adjustmentTiming.status
    };
  } catch {
    return fallbackIndicator("usdkrw", "원/달러 환율");
  }
};

const buildMarketOverview = async (): Promise<Pick<OverviewPayload, "generated_at" | "market_indicators">> => {
  const asOf = new Date();
  const marketIndicators = await Promise.all([
    fetchServiceIndex("KOSPI", "KOSPI", asOf),
    fetchServiceIndex("KOSDAQ", "KOSDAQ", asOf),
    fetchNasdaqIndicator(asOf),
    fetchUsdKrwIndicator(asOf)
  ]);

  return {
    generated_at: asOf.toISOString(),
    market_indicators: marketIndicators
  };
};

const collectionProblemReason = (source: FooterCollectionPolicySource): string | null => {
  if (!source.allowFetch || source.postponed) {
    return source.reason ?? "collection_policy";
  }
  if (source.articleCount === 0 || source.collectionProblem) {
    return source.reason ?? "no_articles";
  }
  return null;
};

const isCollectionProblemSource = (source: FooterCollectionPolicySource): boolean => {
  return Boolean(collectionProblemReason(source));
};

export const buildCollectionStatusFilters = (
  policy: FooterCollectionPolicy | null
): {
  excludedSourceNames: Set<string>;
  collectionStatuses: Partial<Record<SourceGroupId, SourceGroupCollectionStatus>>;
} => {
  const excludedSourceNames = new Set<string>();
  const statusesByGroup = new Map<SourceGroupId, FooterCollectionPolicySource[]>();

  for (const source of policy?.sources ?? []) {
    const groupId = getSourceGroupId(source.sourceName);
    if (!groupId) {
      continue;
    }

    const groupStatuses = statusesByGroup.get(groupId) ?? [];
    groupStatuses.push(source);
    statusesByGroup.set(groupId, groupStatuses);

    if (!source.allowFetch || source.postponed) {
      excludedSourceNames.add(source.sourceName);
    }
  }

  const collectionStatuses: Partial<Record<SourceGroupId, SourceGroupCollectionStatus>> = {};
  for (const groupId of SOURCE_GROUP_IDS) {
    const statuses = statusesByGroup.get(groupId) ?? [];
    if (!statuses.length) {
      continue;
    }

    const problemStatuses = statuses.filter(isCollectionProblemSource);
    const articleCounts = statuses
      .map((source) => source.articleCount)
      .filter((count): count is number => typeof count === "number");
    collectionStatuses[groupId] = {
      problem: problemStatuses.length > 0,
      disabled: statuses.every(source => !source.allowFetch || source.postponed),
      reason: problemStatuses.map(collectionProblemReason).find((reason): reason is string => Boolean(reason)) ?? null,
      articleCount: articleCounts.length > 0 ? articleCounts.reduce((sum, count) => sum + count, 0) : null
    };
  }

  return { excludedSourceNames, collectionStatuses };
};

type MarketOverview = Pick<OverviewPayload, "generated_at" | "market_indicators">;
const MARKET_FALLBACK: [string, string][] = [["kospi", "KOSPI"], ["kosdaq", "KOSDAQ"], ["nasdaq", "NASDAQ"], ["usdkrw", "원/달러 환율"]];

// An overview with no usable indicator (upstream down) is not cached, so the next
// request retries instead of keeping the failure for a refresh interval.
// Versioned key starts a fresh cache when public quote collection resumes.
const cachedMarketOverview = boundedCache(async (): Promise<MarketOverview> => {
  const overview = await buildMarketOverview();
  if (!overview.market_indicators.some(hasUsableMarketIndicator)) throw new Error("market overview unavailable");
  return overview;
}, ["market-overview-public-v4"]);

export const getCachedMarketOverview = async (): Promise<MarketOverview> => {
  try {
    return await cachedMarketOverview();
  } catch {
    return { generated_at: new Date().toISOString(), market_indicators: MARKET_FALLBACK.map(([id, label]) => fallbackIndicator(id, label)) };
  }
};

export const buildCommunityIndicatorsData = async (): Promise<CommunityIndicatorsPayload> => {
  const service = getServiceSupabaseClient();
  const [{ rows }, collectionPolicy] = await Promise.all([
    fetchRecentFeedRows(service, { hours: COMMUNITY_WINDOW_HOURS, limit: 600 }),
    getFooterCollectionPolicy()
  ]);
  const asOf = new Date();
  const marketOverview = await getCachedMarketOverview();
  const marketAdjustmentSnapshot = buildMarketAdjustmentSnapshot(marketOverview.generated_at, marketOverview.market_indicators);
  const marketAdjustmentEnabled = hasActiveMarketAdjustmentInput(marketOverview.market_indicators);
  const marketAdjustmentStatus = resolveMarketAdjustmentStatus(marketOverview.market_indicators);
  const { excludedSourceNames, collectionStatuses } = buildCollectionStatusFilters(collectionPolicy);
  const communityIndicators = buildSourceGroupSummaries(filterReviewedSourceRows(rows, collectionPolicy), {
    marketAdjustmentSnapshot,
    aggregateBuckets: collectionPolicy?.aggregateBuckets ?? [],
    asOf,
    excludedSourceNames,
    collectionStatuses
  });
  const overall = buildOverallFromSourceGroupSummaries(communityIndicators);

  return {
    generated_at: asOf.toISOString(),
    market_adjustment_enabled: marketAdjustmentEnabled,
    market_adjustment_status: marketAdjustmentStatus,
    overall_base_score: overall.overall_base_score,
    overall_market_adjustment: overall.overall_market_adjustment,
    overall_sentiment_score: overall.overall_sentiment_score,
    overall_goksorry_index: overall.overall_goksorry_index,
    overall_sentiment_band: overall.overall_sentiment_band,
    community_indicators: communityIndicators
  };
};

export const getCachedCommunityIndicators = boundedCache(buildCommunityIndicatorsData, ["community-indicators-v2"], {
  tags: [COLLECTION_POLICY_CACHE_TAG, COLLECTION_RUN_CACHE_TAG]
});

export const buildOverviewData = async (): Promise<OverviewPayload> => {
  const [marketOverview, communityOverview] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators()
  ]);

  return {
    generated_at: marketOverview.generated_at,
    market_indicators: marketOverview.market_indicators,
    market_adjustment_enabled: communityOverview.market_adjustment_enabled,
    market_adjustment_status: communityOverview.market_adjustment_status,
    overall_base_score: communityOverview.overall_base_score,
    overall_market_adjustment: communityOverview.overall_market_adjustment,
    overall_sentiment_score: communityOverview.overall_sentiment_score,
    overall_goksorry_index: communityOverview.overall_goksorry_index,
    overall_sentiment_band: communityOverview.overall_sentiment_band,
    community_indicators: communityOverview.community_indicators
  };
};
