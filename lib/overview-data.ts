import { unstable_cache } from "next/cache";
import { buildMarketAdjustmentSnapshot } from "@/lib/community-market-adjustment";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import {
  buildFeedScoreOverview,
  buildSourceGroupSummaries,
  fetchRecentFeedRows,
  type SourceGroupSummary
} from "@/lib/feed-data";
import type { SentimentBand } from "@/lib/sentiment-score";

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
};

export type OverviewPayload = {
  generated_at: string;
  market_indicators: MarketIndicator[];
  market_adjustment_enabled: boolean;
  overall_base_score: number;
  overall_market_adjustment: number;
  overall_sentiment_score: number;
  overall_sentiment_band: SentimentBand;
  community_indicators: SourceGroupSummary[];
};

export type CommunityIndicatorsPayload = {
  generated_at: string;
  market_adjustment_enabled: boolean;
  overall_base_score: number;
  overall_market_adjustment: number;
  overall_sentiment_score: number;
  overall_sentiment_band: SentimentBand;
  community_indicators: SourceGroupSummary[];
};

type NaverServiceIndexResponse = {
  resultCode?: string;
  result?: {
    areas?: Array<{
      name?: string;
      datas?: Array<{
        nv?: number;
        cv?: number;
        cr?: number;
        ms?: string;
      }>;
    }>;
  };
};

const MARKET_TTL_SEC = 300;
const COMMUNITY_TTL_SEC = 60;
const COMMUNITY_WINDOW_HOURS = 6;

const fetchText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "goksorry-web/1.0"
      },
      next: { revalidate: MARKET_TTL_SEC },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const stripTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
};

const compactInlineNumber = (html: string): string => {
  return stripTags(html).replace(/\s+/g, "");
};

const parseNumber = (value: string): number | null => {
  const normalized = value.replace(/[^0-9+.,-]/g, "").replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const hasExplicitNumericSign = (html: string): boolean => /[+-]/.test(stripTags(html));

const resolveDirectionalValue = (value: number | null, tone: IndicatorTone, html: string): number | null => {
  if (value === null || tone === "flat" || hasExplicitNumericSign(html)) {
    return value;
  }

  return value * (tone === "down" ? -1 : 1);
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

const fallbackIndicator = (id: string, label: string, note: string): MarketIndicator => ({
  id,
  label,
  value_text: "--",
  delta_text: "데이터 없음",
  change_value: null,
  change_percent: null,
  tone: "flat",
  note
});

const fetchServiceIndex = async (code: "KOSPI" | "KOSDAQ", label: string): Promise<MarketIndicator> => {
  try {
    const raw = await fetchText(`https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:${code}`);
    const payload = JSON.parse(raw) as NaverServiceIndexResponse;
    const item = payload.result?.areas?.find((area) => area.name === "SERVICE_INDEX")?.datas?.[0];
    if (!item || typeof item.nv !== "number" || typeof item.cv !== "number" || typeof item.cr !== "number") {
      return fallbackIndicator(code.toLowerCase(), label, "지수 대기 중");
    }

    const value = item.nv / 100;
    const change = item.cv / 100;
    const tone: IndicatorTone = change > 0 ? "up" : change < 0 ? "down" : "flat";

    return {
      id: code.toLowerCase(),
      label,
      value_text: formatNumber(value, 2),
      delta_text: `${change >= 0 ? "+" : ""}${formatNumber(change, 2)} (${item.cr >= 0 ? "+" : ""}${item.cr.toFixed(2)}%)`,
      change_value: change,
      change_percent: item.cr,
      tone,
      note: item.ms === "CLOSE" ? "장 마감 기준" : ""
    };
  } catch {
    return fallbackIndicator(code.toLowerCase(), label, "네이버 지수 응답 지연");
  }
};

const fetchNasdaqIndicator = async (): Promise<MarketIndicator> => {
  try {
    const html = await fetchText("https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC");
    const todayBlock = html.match(/<p class="no_today">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayBlock = html.match(/<p class="no_exday">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayEmMatches = [...exdayBlock.matchAll(/<em[^>]*>([\s\S]*?)<\/em>/gi)];
    const value = compactInlineNumber(todayBlock);
    const tone: IndicatorTone =
      exdayBlock.includes("ico minus") || exdayBlock.includes("no_down")
        ? "down"
        : exdayBlock.includes("no_up")
          ? "up"
          : "flat";
    const deltaHtml = exdayEmMatches[0]?.[1] ?? "";
    const percentHtml = exdayEmMatches[1]?.[1] ?? "";
    const delta = parseNumber(compactInlineNumber(deltaHtml));
    const percent = parseNumber(compactInlineNumber(percentHtml).replace(/[()]/g, ""));
    const signedDelta = resolveDirectionalValue(delta, tone, deltaHtml);
    const signedPercent = resolveDirectionalValue(percent, tone, percentHtml);

    if (!value) {
      return fallbackIndicator("nasdaq", "NASDAQ", "해외 지수 대기 중");
    }

    return {
      id: "nasdaq",
      label: "NASDAQ",
      value_text: value,
      delta_text: formatDeltaWithPercent(signedDelta, signedPercent),
      change_value: signedDelta,
      change_percent: signedPercent,
      tone,
      note: "네이버 해외지수"
    };
  } catch {
    return fallbackIndicator("nasdaq", "NASDAQ", "해외 지수 응답 지연");
  }
};

const fetchUsdKrwIndicator = async (): Promise<MarketIndicator> => {
  try {
    const html = await fetchText("https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW");
    const todayBlock = html.match(/<p class="no_today">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayBlock = html.match(/<p class="no_exday">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayEmMatches = [...exdayBlock.matchAll(/<em[^>]*>([\s\S]*?)<\/em>/gi)];
    const valueNumber = parseNumber(stripTags(todayBlock));
    if (valueNumber === null) {
      return fallbackIndicator("usdkrw", "원/달러 환율", "환율 데이터 대기 중");
    }

    const tone: IndicatorTone =
      exdayBlock.includes('class="ico down"') || exdayBlock.includes("no_down")
        ? "down"
        : exdayBlock.includes('class="ico up"') || exdayBlock.includes("no_up")
          ? "up"
          : "flat";
    const changeHtml = exdayEmMatches[0]?.[1] ?? "";
    const percentHtml = exdayEmMatches[1]?.[1] ?? "";
    const changeNumber = parseNumber(compactInlineNumber(changeHtml));
    const percentNumber = parseNumber(compactInlineNumber(percentHtml).replace(/[()]/g, ""));
    const signedChange = resolveDirectionalValue(changeNumber, tone, changeHtml);
    const signedPercent = resolveDirectionalValue(percentNumber, tone, percentHtml);

    return {
      id: "usdkrw",
      label: "원/달러 환율",
      value_text: formatNumber(valueNumber, 2),
      delta_text:
        signedChange === null && signedPercent === null
          ? "변동 정보 없음"
          : `${signedChange === null ? "" : `${formatSignedNumber(signedChange, 2)} KRW`}${
              signedPercent === null ? "" : ` (${formatSignedNumber(signedPercent, 2)}%)`
            }`.trim(),
      change_value: signedChange,
      change_percent: signedPercent,
      tone,
      note: "네이버 환율"
    };
  } catch {
    return fallbackIndicator("usdkrw", "원/달러 환율", "환율 응답 지연");
  }
};

const buildMarketOverview = async (): Promise<Pick<OverviewPayload, "generated_at" | "market_indicators">> => {
  const marketIndicators = await Promise.all([
    fetchServiceIndex("KOSPI", "KOSPI"),
    fetchServiceIndex("KOSDAQ", "KOSDAQ"),
    fetchNasdaqIndicator(),
    fetchUsdKrwIndicator()
  ]);

  return {
    generated_at: new Date().toISOString(),
    market_indicators: marketIndicators
  };
};

export const getCachedMarketOverview = unstable_cache(buildMarketOverview, ["market-overview"], {
  revalidate: MARKET_TTL_SEC
});

export const buildCommunityIndicatorsData = async (
  marketAdjustmentEnabled = true
): Promise<CommunityIndicatorsPayload> => {
  const service = getServiceSupabaseClient();
  const { rows } = await fetchRecentFeedRows(service, { hours: COMMUNITY_WINDOW_HOURS, limit: 600 });
  const asOf = new Date();
  const marketOverview = marketAdjustmentEnabled ? await getCachedMarketOverview() : null;
  const marketAdjustmentSnapshot = marketOverview
    ? buildMarketAdjustmentSnapshot(marketOverview.generated_at, marketOverview.market_indicators)
    : null;
  const communityIndicators = buildSourceGroupSummaries(rows, {
    marketAdjustmentEnabled,
    marketAdjustmentSnapshot,
    asOf
  });
  const overall = buildFeedScoreOverview(rows, {
    marketAdjustmentEnabled,
    marketAdjustmentSnapshot,
    asOf
  });

  return {
    generated_at: asOf.toISOString(),
    market_adjustment_enabled: marketAdjustmentEnabled,
    overall_base_score: overall.base_score,
    overall_market_adjustment: overall.market_adjustment,
    overall_sentiment_score: overall.score,
    overall_sentiment_band: overall.sentiment_band,
    community_indicators: communityIndicators
  };
};

export const getCachedCommunityIndicators = unstable_cache(buildCommunityIndicatorsData, ["community-indicators"], {
  revalidate: COMMUNITY_TTL_SEC
});

export const buildOverviewData = async (marketAdjustmentEnabled = true): Promise<OverviewPayload> => {
  const [marketOverview, communityOverview] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators(marketAdjustmentEnabled)
  ]);

  return {
    generated_at: marketOverview.generated_at,
    market_indicators: marketOverview.market_indicators,
    market_adjustment_enabled: communityOverview.market_adjustment_enabled,
    overall_base_score: communityOverview.overall_base_score,
    overall_market_adjustment: communityOverview.overall_market_adjustment,
    overall_sentiment_score: communityOverview.overall_sentiment_score,
    overall_sentiment_band: communityOverview.overall_sentiment_band,
    community_indicators: communityOverview.community_indicators
  };
};
