import { NextResponse } from "next/server";
import { getCachedRecentFeedRows } from "@/lib/feed-read";

export const dynamic = "force-dynamic";

const DEFAULT_HOURS = 6;
const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 200;

const parseIntegerParam = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = clamp(parseIntegerParam(url.searchParams.get("hours"), DEFAULT_HOURS), 1, 24);
  const limit = clamp(parseIntegerParam(url.searchParams.get("limit"), DEFAULT_LIMIT), 1, MAX_LIMIT);
  const offset = Math.max(0, parseIntegerParam(url.searchParams.get("offset"), 0));

  try {
    const { rows, errorMessage } = await getCachedRecentFeedRows({
      hours,
      limit: limit + 1,
      offset
    });
    const visibleRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    const response = NextResponse.json({
      rows: visibleRows,
      nextOffset: hasMore && !errorMessage ? offset + limit : null,
      hasMore: hasMore && !errorMessage,
      errorMessage
    });
    response.headers.set("Cache-Control", errorMessage ? "no-store" : "s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    console.error("feed api failed", error);
    const response = NextResponse.json({
      rows: [],
      nextOffset: null,
      hasMore: false,
      errorMessage: "피드 데이터를 준비하지 못했습니다."
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
