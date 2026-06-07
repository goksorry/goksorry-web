export type MarketAdjustmentTarget = "all" | "kr" | "us";
export type MarketAdjustmentStatus = "active" | "decaying" | "inactive" | "unavailable";

export type MarketAdjustmentTiming = {
  basis_at: string | null;
  weight: number;
  status: MarketAdjustmentStatus;
};

export type MarketAdjustmentIndicatorLike = {
  id: string;
  change_percent: number | null;
  market_adjustment_weight?: number | null;
  market_adjustment_status?: MarketAdjustmentStatus;
};

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

const MARKET_ADJUSTMENT_LOG_SCALE = 0.43;
const MARKET_ADJUSTMENT_CAP = 1.2;
const KOSPI_WEIGHT = 0.55;
const KOSDAQ_WEIGHT = 0.45;
const KR_FX_RISK_WEIGHT = 0.35;
const ALL_MARKET_KR_WEIGHT = 0.5;
const ALL_MARKET_US_WEIGHT = 0.5;
const MARKET_ADJUSTMENT_DECAY_HOURS = 6;
const MARKET_ADJUSTMENT_DECAY_MS = MARKET_ADJUSTMENT_DECAY_HOURS * 60 * 60 * 1000;

const weightedAverage = (
  entries: Array<{ value: number | null; weight: number }>
): number | null => {
  const availableEntries = entries.filter((entry) => typeof entry.value === "number" && entry.weight > 0);
  if (availableEntries.length === 0) {
    return null;
  }

  const totalWeight = availableEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  return availableEntries.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
};

const parseMarketDateParts = (value: string | undefined): { year: number; month: number; day: number } | null => {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})[.-]?(\d{1,2})[.-]?(\d{1,2})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { year, month, day };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value ?? 0);
  };
  const zonedAsUtc = Date.UTC(
    readPart("year"),
    readPart("month") - 1,
    readPart("day"),
    readPart("hour"),
    readPart("minute"),
    readPart("second")
  );

  return zonedAsUtc - date.getTime();
};

const zonedDateTimeToUtc = ({
  year,
  month,
  day,
  hour,
  minute,
  timeZone
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}): Date => {
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(wallTimeAsUtc);
  const firstOffset = getTimeZoneOffsetMs(firstGuess, timeZone);
  const secondGuess = new Date(wallTimeAsUtc - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(secondGuess, timeZone);

  return new Date(wallTimeAsUtc - secondOffset);
};

const normalizeMarketAdjustmentWeight = (weight: number | null | undefined): number => {
  if (typeof weight !== "number" || !Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(0, Math.min(1, weight));
};

const getEffectiveChangePercent = (indicator: MarketAdjustmentIndicatorLike | undefined): number | null => {
  if (!indicator || typeof indicator.change_percent !== "number" || !Number.isFinite(indicator.change_percent)) {
    return null;
  }

  const weight = normalizeMarketAdjustmentWeight(indicator.market_adjustment_weight);
  if (weight <= 0) {
    return null;
  }

  return indicator.change_percent * weight;
};

export const calculateMarketAdjustmentTiming = ({
  basisDate,
  timeZone,
  closeHour,
  closeMinute,
  asOf = new Date()
}: {
  basisDate: string | undefined;
  timeZone: string;
  closeHour: number;
  closeMinute: number;
  asOf?: Date;
}): MarketAdjustmentTiming => {
  const parts = parseMarketDateParts(basisDate);
  const asOfMs = asOf.getTime();
  if (!parts || !Number.isFinite(asOfMs)) {
    return { basis_at: null, weight: 0, status: "unavailable" };
  }

  const closeAt = zonedDateTimeToUtc({
    ...parts,
    hour: closeHour,
    minute: closeMinute,
    timeZone
  });
  const closeAtMs = closeAt.getTime();
  if (!Number.isFinite(closeAtMs)) {
    return { basis_at: null, weight: 0, status: "unavailable" };
  }

  if (asOfMs <= closeAtMs) {
    return { basis_at: closeAt.toISOString(), weight: 1, status: "active" };
  }

  const elapsedMs = asOfMs - closeAtMs;
  if (elapsedMs >= MARKET_ADJUSTMENT_DECAY_MS) {
    return { basis_at: closeAt.toISOString(), weight: 0, status: "inactive" };
  }

  const weight = Number((1 - elapsedMs / MARKET_ADJUSTMENT_DECAY_MS).toFixed(4));
  return { basis_at: closeAt.toISOString(), weight, status: "decaying" };
};

export const hasActiveMarketAdjustmentInput = (indicators: MarketAdjustmentIndicatorLike[]): boolean => {
  return indicators.some((indicator) => getEffectiveChangePercent(indicator) !== null);
};

export const resolveMarketAdjustmentStatus = (indicators: MarketAdjustmentIndicatorLike[]): MarketAdjustmentStatus => {
  const usableIndicators = indicators.filter(
    (indicator) => typeof indicator.change_percent === "number" && Number.isFinite(indicator.change_percent)
  );
  if (usableIndicators.length === 0) {
    return "unavailable";
  }

  const activeIndicators = usableIndicators.filter((indicator) => normalizeMarketAdjustmentWeight(indicator.market_adjustment_weight) > 0);
  if (activeIndicators.length === 0) {
    return "inactive";
  }

  return activeIndicators.some((indicator) => normalizeMarketAdjustmentWeight(indicator.market_adjustment_weight) < 1)
    ? "decaying"
    : "active";
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

export const buildMarketAdjustmentSnapshot = (
  generatedAt: string,
  indicators: MarketAdjustmentIndicatorLike[]
): MarketAdjustmentSnapshot => {
  const byId = new Map(indicators.map((indicator) => [indicator.id, indicator]));

  return {
    generated_at: generatedAt,
    kospi_change_percent: getEffectiveChangePercent(byId.get("kospi")),
    kosdaq_change_percent: getEffectiveChangePercent(byId.get("kosdaq")),
    nasdaq_change_percent: getEffectiveChangePercent(byId.get("nasdaq")),
    usdkrw_change_percent: getEffectiveChangePercent(byId.get("usdkrw"))
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
