import { NextResponse } from "next/server";
import { buildCommunityIndicatorsData } from "@/lib/overview-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildCommunityIndicatorsData();
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return response;
}

