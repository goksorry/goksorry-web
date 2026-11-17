// Public quote collection resumed at the operator's request on 2026-11-17.
// This list controls request destinations; it does not represent a license.
const marketHosts = new Set(["stock.naver.com", "m.stock.naver.com"]);

export function getMarketDataAccess(url: string) {
  const allowed = marketHosts.has(new URL(url).hostname);
  return { allowed, reason: allowed ? "configured_market_source" : "unconfigured_market_source" };
}

export async function fetchMarketDataText(url: string): Promise<string> {
  const access = getMarketDataAccess(url);
  if (!access.allowed) throw new Error(`market_data:${access.reason}`);
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
