export type MarketAdjustmentTarget = "kr" | "us";

export type MarketAdjustmentSnapshot = {
  generated_at: string;
  kospi_change_percent: number | null;
  kosdaq_change_percent: number | null;
  nasdaq_change_percent: number | null;
};

export type MarketAdjustmentRowLike = {
  source: string;
  symbol_market: "kr" | "us" | null;
};

export const MARKET_ADJUSTMENT_COOKIE_NAME = "goksorry_market_adjustment";

const MARKET_ADJUSTMENT_LOG_SCALE = 0.43;
const MARKET_ADJUSTMENT_CAP = 1.2;
const KOSPI_WEIGHT = 0.55;
const KOSDAQ_WEIGHT = 0.45;
const KOREA_TIMEZONE = "Asia/Seoul";
const US_TIMEZONE = "America/New_York";

const getTimeParts = (date: Date, timeZone: string): { weekday: string; hour: number; minute: number } => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    weekday: values.get("weekday") ?? "",
    hour: Number(values.get("hour") ?? "0"),
    minute: Number(values.get("minute") ?? "0")
  };
};

const isWeekday = (weekday: string): boolean => !["Sat", "Sun"].includes(weekday);

const toMinutes = (hour: number, minute: number): number => hour * 60 + minute;

const isKoreanCashSessionOpen = (date: Date): boolean => {
  const { weekday, hour, minute } = getTimeParts(date, KOREA_TIMEZONE);
  const minutes = toMinutes(hour, minute);
  return isWeekday(weekday) && minutes >= 9 * 60 && minutes < 15 * 60 + 30;
};

const isUsCashSessionOpen = (date: Date): boolean => {
  const { weekday, hour, minute } = getTimeParts(date, US_TIMEZONE);
  const minutes = toMinutes(hour, minute);
  return isWeekday(weekday) && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
};

const getKrCompositeChangePercent = (snapshot: MarketAdjustmentSnapshot): number | null => {
  const hasKospi = typeof snapshot.kospi_change_percent === "number";
  const hasKosdaq = typeof snapshot.kosdaq_change_percent === "number";

  if (hasKospi && hasKosdaq) {
    return snapshot.kospi_change_percent! * KOSPI_WEIGHT + snapshot.kosdaq_change_percent! * KOSDAQ_WEIGHT;
  }
  if (hasKospi) {
    return snapshot.kospi_change_percent;
  }
  if (hasKosdaq) {
    return snapshot.kosdaq_change_percent;
  }
  return null;
};

const resolveExplicitTarget = (
  row: MarketAdjustmentRowLike
): MarketAdjustmentTarget | null => {
  if (row.source === "dc_stock" || row.source === "dc_krstock") {
    return "kr";
  }
  if (row.source === "dc_usstock" || row.source === "dc_tenbagger") {
    return "us";
  }
  if (row.source.startsWith("naver_stock_") || row.source.startsWith("toss_stock_community_")) {
    return row.symbol_market;
  }
  return null;
};

const resolveTimeBasedTarget = (date: Date): MarketAdjustmentTarget | null => {
  if (isKoreanCashSessionOpen(date)) {
    return "kr";
  }
  if (isUsCashSessionOpen(date)) {
    return "us";
  }
  return null;
};

const getLiveMarketChangePercent = (
  target: MarketAdjustmentTarget,
  snapshot: MarketAdjustmentSnapshot,
  date: Date
): number | null => {
  if (target === "kr") {
    if (!isKoreanCashSessionOpen(date)) {
      return null;
    }
    return getKrCompositeChangePercent(snapshot);
  }

  if (!isUsCashSessionOpen(date)) {
    return null;
  }
  return snapshot.nasdaq_change_percent;
};

export const parseMarketAdjustmentParam = (value: string | null | undefined): boolean => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }

  return true;
};

export const getMarketAdjustmentQueryValue = (enabled: boolean): string | null => {
  return enabled ? null : "off";
};

export const getMarketAdjustmentCookieValue = (enabled: boolean): "on" | "off" => {
  return enabled ? "on" : "off";
};

export const buildMarketAdjustmentSnapshot = (
  generatedAt: string,
  indicators: Array<{ id: string; change_percent: number | null }>
): MarketAdjustmentSnapshot => {
  const byId = new Map(indicators.map((indicator) => [indicator.id, indicator.change_percent]));

  return {
    generated_at: generatedAt,
    kospi_change_percent: byId.get("kospi") ?? null,
    kosdaq_change_percent: byId.get("kosdaq") ?? null,
    nasdaq_change_percent: byId.get("nasdaq") ?? null
  };
};

export const calculateContinuousMarketAdjustment = (changePercent: number): number => {
  if (!Number.isFinite(changePercent) || changePercent === 0) {
    return 0;
  }

  const direction = changePercent > 0 ? 1 : -1;
  const magnitude = Math.min(
    MARKET_ADJUSTMENT_CAP,
    MARKET_ADJUSTMENT_LOG_SCALE * Math.log1p(Math.abs(changePercent))
  );

  return Number((direction * magnitude).toFixed(2));
};

export const calculateRowMarketAdjustment = (
  row: MarketAdjustmentRowLike,
  snapshot: MarketAdjustmentSnapshot | null,
  date: Date
): number => {
  if (!snapshot) {
    return 0;
  }

  const target = resolveExplicitTarget(row) ?? resolveTimeBasedTarget(date);
  if (!target) {
    return 0;
  }

  const changePercent = getLiveMarketChangePercent(target, snapshot, date);
  if (changePercent === null) {
    return 0;
  }

  return calculateContinuousMarketAdjustment(changePercent);
};

export const averageRowMarketAdjustment = (
  rows: MarketAdjustmentRowLike[],
  snapshot: MarketAdjustmentSnapshot | null,
  date: Date
): number => {
  if (rows.length === 0 || !snapshot) {
    return 0;
  }

  const total = rows.reduce((sum, row) => sum + calculateRowMarketAdjustment(row, snapshot, date), 0);
  return Number((total / rows.length).toFixed(2));
};
