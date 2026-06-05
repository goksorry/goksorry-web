const KOREAN_COMMON_STOCK_SUFFIX_PATTERN = /\s*보통주(?=\s*(?:\(\d{6}\)|$|[·ㆍ,;/|]|[-+]\d))/gu;
const KOREAN_STOCK_SYMBOL_PATTERN = /^\d{6}$/;

type Market = "kr" | "us" | null;

export const formatKoreanStockDisplayText = (value: string): string => {
  return value.replace(KOREAN_COMMON_STOCK_SUFFIX_PATTERN, "").replace(/\s{2,}/g, " ").trim();
};

export const isKoreanStockSymbol = (symbol: string): boolean => {
  return KOREAN_STOCK_SYMBOL_PATTERN.test(symbol.trim());
};

export const formatSymbolDisplayName = ({
  symbol,
  displayName,
  market
}: {
  symbol: string;
  displayName?: string | null;
  market: Market;
}): string => {
  const fallback = symbol.trim().toUpperCase();
  const baseName = (displayName ?? "").replace(/\s+/g, " ").trim() || fallback;

  if (market === "kr" || isKoreanStockSymbol(fallback)) {
    return formatKoreanStockDisplayText(baseName);
  }

  return baseName;
};
