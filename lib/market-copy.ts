import { INDEX_MAX_AGE_SEC, INDEX_REFRESH_SEC } from "@/lib/index-cache-policy";

/** Source line of the market block; the timing follows the index cache budget (refresh, and the hard age cap). */
export const MARKET_SOURCE_COPY = `출처: 네이버 금융 · 약 ${Math.round(INDEX_REFRESH_SEC / 60)}분마다 갱신 · 최대 ${Math.round(INDEX_MAX_AGE_SEC / 60)}분 전 값`;
