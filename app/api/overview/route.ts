import { NextResponse } from "next/server";
import { buildGoksorryIndexApiPayload } from "@/lib/goksorry-index-api";
import { getCachedCommunityIndicators } from "@/lib/overview-data";
import { INDEX_CACHE_CONTROL } from "@/lib/index-cache-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const communityIndicators = await getCachedCommunityIndicators();
  const response = NextResponse.json(buildGoksorryIndexApiPayload(communityIndicators));
  response.headers.set("Cache-Control", INDEX_CACHE_CONTROL);
  return response;
}
