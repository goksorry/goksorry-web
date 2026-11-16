import { NextResponse } from "next/server";
import { buildOverviewData, hasUsableMarketIndicator } from "@/lib/overview-data";
import { INDEX_CACHE_CONTROL } from "@/lib/index-cache-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildOverviewData();
  const response = NextResponse.json(payload);
  const hasMarketData = payload.market_indicators.some(hasUsableMarketIndicator);
  // Without market data, keep the CDN copy short so recovery shows up quickly.
  response.headers.set("Cache-Control", hasMarketData ? INDEX_CACHE_CONTROL : "public, max-age=0, s-maxage=10");
  return response;
}
