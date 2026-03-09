import { NextResponse } from "next/server";
import { buildOverviewData } from "@/lib/overview-data";

export async function GET() {
  const payload = await buildOverviewData();
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return response;
}

