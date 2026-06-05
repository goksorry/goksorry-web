import { NextResponse } from "next/server";
import { buildGoksorryIndexApiPayload } from "@/lib/goksorry-index-api";
import { getCachedCommunityIndicators } from "@/lib/overview-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const communityIndicators = await getCachedCommunityIndicators();
  const response = NextResponse.json(buildGoksorryIndexApiPayload(communityIndicators));
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return response;
}
