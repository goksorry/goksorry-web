import { NextResponse } from "next/server";
import { getCachedCommunityIndicators } from "@/lib/overview-data";
import { INDEX_CACHE_CONTROL } from "@/lib/index-cache-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getCachedCommunityIndicators();
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", INDEX_CACHE_CONTROL);
  return response;
}
