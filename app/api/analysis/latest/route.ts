import { NextResponse } from "next/server";
import { fetchLatestAnalysisReport } from "@/lib/analysis-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await fetchLatestAnalysisReport();
  const response = NextResponse.json({ report });
  response.headers.set("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  return response;
}
