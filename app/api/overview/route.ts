import { NextResponse } from "next/server";
import { buildOverviewData, hasUsableMarketIndicator } from "@/lib/overview-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildOverviewData();
  const response = NextResponse.json(payload);
  const hasMarketData = payload.market_indicators.some(hasUsableMarketIndicator);
  response.headers.set(
    "Cache-Control",
    hasMarketData ? "s-maxage=60, stale-while-revalidate=300" : "s-maxage=10, stale-while-revalidate=30"
  );
  return response;
}
