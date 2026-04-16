export type MarketAdjustmentTarget = "all" | "kr" | "us";

export type MarketAdjustmentSnapshot = {
  generated_at: string;
  kospi_change_percent: number | null;
  kosdaq_change_percent: number | null;
  nasdaq_change_percent: number | null;
  usdkrw_change_percent: number | null;
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
const KR_FX_RISK_WEIGHT = 0.35;
const ALL_MARKET_KR_WEIGHT = 0.5;
const ALL_MARKET_US_WEIGHT = 0.5;

const weightedAverage = (
  entries: Array<{ value: number | null; weight: number }>
): number | null => {
  const availableEntries = entries.filter((entry) => typeof entry.value === "number");
  if (availableEntries.length === 0) {
    return null;
  }

  const totalWeight = availableEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  return availableEntries.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
};

const getKrIndexChangePercent = (snapshot: MarketAdjustmentSnapshot): number | null => {
  return weightedAverage([
    { value: snapshot.kospi_change_percent, weight: KOSPI_WEIGHT },
    { value: snapshot.kosdaq_change_percent, weight: KOSDAQ_WEIGHT }
  ]);
};

const getKrMarketChangePercent = (snapshot: MarketAdjustmentSnapshot): number | null => {
  const krIndexChangePercent = getKrIndexChangePercent(snapshot);
  const usdkrwChangePercent = snapshot.usdkrw_change_percent;

  if (krIndexChangePercent === null && usdkrwChangePercent === null) {
    return null;
  }
  if (krIndexChangePercent === null) {
    return -(usdkrwChangePercent ?? 0) * KR_FX_RISK_WEIGHT;
  }
  if (usdkrwChangePercent === null) {
    return krIndexChangePercent;
  }

  // A rising USDKRW rate usually reflects KR risk-off pressure, so it offsets KR sentiment.
  return krIndexChangePercent - usdkrwChangePercent * KR_FX_RISK_WEIGHT;
};

const getAllMarketChangePercent = (snapshot: MarketAdjustmentSnapshot): number | null => {
  return weightedAverage([
    { value: getKrMarketChangePercent(snapshot), weight: ALL_MARKET_KR_WEIGHT },
    { value: snapshot.nasdaq_change_percent, weight: ALL_MARKET_US_WEIGHT }
  ]);
};

const resolveExplicitTarget = (row: MarketAdjustmentRowLike): MarketAdjustmentTarget => {
  if (row.source === "blind_stock_invest") {
    return "all";
  }
  if (row.source === "dc_stock" || row.source === "dc_krstock") {
    return "kr";
  }
  if (row.source === "dc_usstock" || row.source === "dc_tenbagger") {
    return "us";
  }
  if (row.source.startsWith("toss_stock_community_")) {
    if (row.symbol_market === "kr") {
      return "kr";
    }
    if (row.symbol_market === "us") {
      return "us";
    }
    return "all";
  }
  if (row.source.startsWith("toss_lounge_kr_")) {
    return "kr";
  }
  if (row.source.startsWith("toss_lounge_us_")) {
    return "us";
  }
  if (row.source === "ppomppu_stock") {
    return "kr";
  }
  if (row.source.startsWith("toss_lounge_")) {
    return "all";
  }
  return "all";
};

const getTargetMarketChangePercent = (
  target: MarketAdjustmentTarget,
  snapshot: MarketAdjustmentSnapshot
): number | null => {
  if (target === "kr") {
    return getKrMarketChangePercent(snapshot);
  }
  if (target === "us") {
    return snapshot.nasdaq_change_percent;
  }
  return getAllMarketChangePercent(snapshot);
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
  return enabled ? "on" : null;
};

export const getMarketAdjustmentCookieValue = (enabled: boolean): "on" | "off" => {
  return enabled ? "on" : "off";
};

export const parseMarketAdjustmentCookieValue = (value: string | null | undefined): boolean | null => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }

  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes") {
    return true;
  }

  return null;
};

export const resolveMarketAdjustmentEnabled = ({
  queryValue,
  cookieValue,
  defaultEnabled = false
}: {
  queryValue: string | null | undefined;
  cookieValue?: string | null | undefined;
  defaultEnabled?: boolean;
}): boolean => {
  const normalizedQuery = String(queryValue ?? "").trim();
  if (normalizedQuery) {
    return parseMarketAdjustmentParam(normalizedQuery);
  }

  const cookiePreference = parseMarketAdjustmentCookieValue(cookieValue);
  return cookiePreference ?? defaultEnabled;
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
    nasdaq_change_percent: byId.get("nasdaq") ?? null,
    usdkrw_change_percent: byId.get("usdkrw") ?? null
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
  _date: Date
): number => {
  if (!snapshot) {
    return 0;
  }

  const target = resolveExplicitTarget(row);
  const changePercent = getTargetMarketChangePercent(target, snapshot);
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
