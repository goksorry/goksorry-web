import { unstable_cache } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { buildSourceGroupSummaries, fetchRecentFeedRows, type SourceGroupSummary } from "@/lib/feed-data";

type IndicatorTone = "up" | "down" | "flat" | "fear" | "greed" | "mixed";

export type MarketIndicator = {
  id: string;
  label: string;
  value_text: string;
  delta_text: string;
  tone: IndicatorTone;
  note: string;
};

export type OverviewPayload = {
  generated_at: string;
  market_indicators: MarketIndicator[];
  community_indicators: SourceGroupSummary[];
};

export type CommunityIndicatorsPayload = {
  generated_at: string;
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

const formatNumber = (value: number, digits = 2): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
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
      tone,
      note: item.ms === "CLOSE" ? "장 마감 기준" : "5분 캐시"
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
    const delta = compactInlineNumber(exdayEmMatches[0]?.[1] ?? "");
    const percent = compactInlineNumber(exdayEmMatches[1]?.[1] ?? "").replace(/[()]/g, "");
    const tone: IndicatorTone =
      exdayBlock.includes("ico minus") || exdayBlock.includes("no_down")
        ? "down"
        : exdayBlock.includes("no_up")
          ? "up"
          : "flat";

    if (!value) {
      return fallbackIndicator("nasdaq", "NASDAQ", "해외 지수 대기 중");
    }

    return {
      id: "nasdaq",
      label: "NASDAQ",
      value_text: value,
      delta_text: [delta, percent].filter(Boolean).join(" "),
      tone,
      note: "네이버 해외지수 · 5분 캐시"
    };
  } catch {
    return fallbackIndicator("nasdaq", "NASDAQ", "해외 지수 응답 지연");
  }
};

const fetchUsdKrwIndicator = async (): Promise<MarketIndicator> => {
  try {
    const html = await fetchText("https://finance.naver.com/marketindex/");
    const blockMatch = html.match(
      /<a href="\/marketindex\/exchangeDetail\.naver\?marketindexCd=FX_USDKRW"[\s\S]*?<div class="head_info ([^"]+)">([\s\S]*?)<\/div>/i
    );
    const className = blockMatch?.[1] ?? "";
    const inner = blockMatch?.[2] ?? "";
    const value = inner.match(/<span class="value">([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const change = inner.match(/<span class="change">\s*([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const tone: IndicatorTone = className.includes("point_up") ? "up" : className.includes("point_dn") ? "down" : "flat";

    const valueText = stripTags(value);
    if (!valueText) {
      return fallbackIndicator("usdkrw", "원/달러 환율", "환율 데이터 대기 중");
    }

    const changeNumber = parseNumber(stripTags(change));
    return {
      id: "usdkrw",
      label: "원/달러 환율",
      value_text: valueText,
      delta_text: changeNumber === null ? "변동 정보 없음" : `${changeNumber >= 0 ? "+" : ""}${formatNumber(changeNumber, 2)} KRW`,
      tone,
      note: "네이버 환율 · 5분 캐시"
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

export const buildCommunityIndicatorsData = async (): Promise<CommunityIndicatorsPayload> => {
  const service = getServiceSupabaseClient();
  const { rows } = await fetchRecentFeedRows(service, { hours: 24, limit: 600 });
  const communityIndicators = buildSourceGroupSummaries(rows);

  return {
    generated_at: new Date().toISOString(),
    community_indicators: communityIndicators
  };
};

export const buildOverviewData = async (): Promise<OverviewPayload> => {
  const [marketOverview, communityOverview] = await Promise.all([
    getCachedMarketOverview(),
    buildCommunityIndicatorsData()
  ]);

  return {
    generated_at: marketOverview.generated_at,
    market_indicators: marketOverview.market_indicators,
    community_indicators: communityOverview.community_indicators
  };
};
