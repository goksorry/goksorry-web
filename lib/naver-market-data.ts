type MarketQuote = {
  value: number;
  change: number;
  percent: number;
  currentDate: string;
  previousDate?: string;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const number = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/,/g, "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const date = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) ? day : undefined;
};

const previousDate = (rows: unknown[], currentDate: string, key: string): string | undefined =>
  rows.map((row) => date(record(row)[key])).filter((day): day is string => Boolean(day && day < currentDate)).sort().at(-1);

export const parseNaverNasdaqQuote = (basic: unknown, prices: unknown): MarketQuote | null => {
  const item = record(basic);
  if (item.reutersCode !== ".IXIC") return null;
  const value = number(item.closePrice);
  const change = number(item.compareToPreviousClosePrice);
  const percent = number(item.fluctuationsRatio);
  const currentDate = date(item.localTradedAt);
  if (value === null || value <= 0 || change === null || percent === null || !currentDate) return null;
  return {
    value, change, percent, currentDate,
    previousDate: previousDate(Array.isArray(prices) ? prices : [], currentDate, "localTradedAt")
  };
};

export const parseNaverUsdKrwQuote = (latest: unknown, daily: unknown): MarketQuote | null => {
  const item = record(latest);
  if (item.marketIndexCode !== "FX_USDKRW") return null;
  const value = number(item.saleBaseRate);
  const change = number(item.changePrice);
  const percent = number(item.changeRate);
  // The trading date can differ from the announcement's calendar date after midnight.
  const currentDate = date(item.date);
  if (value === null || value <= 0 || change === null || percent === null || !currentDate) return null;
  const rows = record(daily).items;
  return {
    value, change, percent, currentDate,
    previousDate: previousDate(Array.isArray(rows) ? rows : [], currentDate, "date")
  };
};
