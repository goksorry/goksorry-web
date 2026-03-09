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

const fallbackIndicator = (id: string, label: string, note: string): MarketIndicator => ({
  id,
  label,
  value_text: "--",
  delta_text: "unavailable",
  tone: "flat",
  note
});

const fetchServiceIndex = async (code: "KOSPI" | "KOSDAQ", label: string): Promise<MarketIndicator> => {
  try {
    const raw = await fetchText(`https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:${code}`);
    const payload = JSON.parse(raw) as NaverServiceIndexResponse;
    const item = payload.result?.areas?.find((area) => area.name === "SERVICE_INDEX")?.datas?.[0];
    if (!item || typeof item.nv !== "number" || typeof item.cv !== "number" || typeof item.cr !== "number") {
      return fallbackIndicator(code.toLowerCase(), label, "feed pending");
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
      note: item.ms === "CLOSE" ? "장마감 기준" : "실시간"
    };
  } catch {
    return fallbackIndicator(code.toLowerCase(), label, "naver index timeout");
  }
};

const fetchNasdaqIndicator = async (): Promise<MarketIndicator> => {
  try {
    const html = await fetchText("https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC");
    const todayBlock = html.match(/<p class="no_today">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayBlock = html.match(/<p class="no_exday">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const exdayEmMatches = [...exdayBlock.matchAll(/<em[^>]*>([\s\S]*?)<\/em>/gi)];
    const value = stripTags(todayBlock);
    const delta = stripTags(exdayEmMatches[0]?.[1] ?? "");
    const percent = stripTags(exdayEmMatches[1]?.[1] ?? "").replace(/[()]/g, "");
    const tone: IndicatorTone =
      exdayBlock.includes("ico minus") || exdayBlock.includes("no_down")
        ? "down"
        : exdayBlock.includes("no_up")
          ? "up"
          : "flat";

    if (!value) {
      return fallbackIndicator("nasdaq", "NASDAQ", "world quote pending");
    }

    return {
      id: "nasdaq",
      label: "NASDAQ",
      value_text: value,
      delta_text: [delta, percent].filter(Boolean).join(" "),
      tone,
      note: "네이버 해외지수"
    };
  } catch {
    return fallbackIndicator("nasdaq", "NASDAQ", "world quote timeout");
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
      return fallbackIndicator("usdkrw", "원/달러 환율", "fx pending");
    }

    const changeNumber = parseNumber(stripTags(change));
    return {
      id: "usdkrw",
      label: "원/달러 환율",
      value_text: valueText,
      delta_text: changeNumber === null ? "변동 정보 없음" : `${changeNumber >= 0 ? "+" : ""}${formatNumber(changeNumber, 2)} KRW`,
      tone,
      note: "네이버 환율"
    };
  } catch {
    return fallbackIndicator("usdkrw", "원/달러 환율", "fx timeout");
  }
};

const fetchFearGreedIndicator = async (): Promise<MarketIndicator> => {
  try {
    const service = getServiceSupabaseClient();
    const { data, error } = await service
      .from("detector_market_state_latest")
      .select("market,asof,regime,fear_index,payload")
      .eq("market", "us")
      .maybeSingle();

    if (error || !data) {
      return fallbackIndicator("fear-greed", "미장 공포탐욕지수", "detector pending");
    }

    const fearIndex = Number(data.fear_index ?? 50);
    const regime = String(data.regime ?? "neutral");
    const tone: IndicatorTone = fearIndex >= 60 ? "fear" : fearIndex <= 40 ? "greed" : "mixed";
    const symbolCount = Number((data.payload as any)?.symbol_count ?? 0);

    return {
      id: "fear-greed",
      label: "미장 공포탐욕지수",
      value_text: `${fearIndex.toFixed(1)} / 100`,
      delta_text: regime.replace(/_/g, " "),
      tone,
      note: symbolCount > 0 ? `감지 심볼 ${symbolCount}개` : "detector snapshot"
    };
  } catch {
    return fallbackIndicator("fear-greed", "미장 공포탐욕지수", "detector timeout");
  }
};

export const buildOverviewData = async (): Promise<OverviewPayload> => {
  const service = getServiceSupabaseClient();
  const { rows } = await fetchRecentFeedRows(service, { hours: 24, limit: 600 });
  const communityIndicators = buildSourceGroupSummaries(rows);

  const marketIndicators = await Promise.all([
    fetchServiceIndex("KOSPI", "KOSPI"),
    fetchServiceIndex("KOSDAQ", "KOSDAQ"),
    fetchNasdaqIndicator(),
    fetchUsdKrwIndicator(),
    fetchFearGreedIndicator()
  ]);

  return {
    generated_at: new Date().toISOString(),
    market_indicators: marketIndicators,
    community_indicators: communityIndicators
  };
};

