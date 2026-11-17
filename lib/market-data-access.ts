// Reviewed 2026-11-17. Re-enable only after documenting an applicable grant or
// replacing the provider. A working endpoint is not a reuse permission.
const reviews: Record<string, { allowed: boolean; reason: string; robotsUrl: string }> = {
  "stock.naver.com": { allowed: false, reason: "robots_disallow", robotsUrl: "https://stock.naver.com/robots.txt" },
  "m.stock.naver.com": { allowed: false, reason: "robots_disallow", robotsUrl: "https://m.stock.naver.com/robots.txt" }
};

export const MARKET_SOURCE_HOLD_MESSAGE = "출처 이용 범위 확인 중";

export function getMarketDataAccess(url: string) {
  return reviews[new URL(url).hostname] ?? { allowed: false, reason: "source_review_required", robotsUrl: null };
}

export async function fetchMarketDataText(url: string): Promise<string> {
  const review = getMarketDataAccess(url);
  if (!review.allowed) throw new Error(`collection_policy:${review.reason}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "goksorry-web/1.0" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
