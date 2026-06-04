import { NextResponse } from "next/server";
import { fetchLatestAnalysisReport } from "@/lib/analysis-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await fetchLatestAnalysisReport();
  const response = NextResponse.json({ report });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
