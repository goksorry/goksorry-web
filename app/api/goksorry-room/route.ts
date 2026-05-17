import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import {
  GOKSORRY_ROOM_DEFAULT_LIMIT,
  GOKSORRY_ROOM_MAX_LIMIT
} from "@/lib/goksorry-room";
import { readGoksorryRoomEntries } from "@/lib/goksorry-room-read";
import { applyServerTiming, createServerTimer } from "@/lib/server-timing";

const parseLimit = (value: string | null): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return GOKSORRY_ROOM_DEFAULT_LIMIT;
  }

  return Math.min(parsed, GOKSORRY_ROOM_MAX_LIMIT);
};

const parseCursor = (value: string | null): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? null : normalized;
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const timer = createServerTimer();
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const { payload, error } = await timer.measure("room_entries", () =>
    readGoksorryRoomEntries({
      request,
      cursor,
      limit
    })
  );

  if (error) {
    logApiError("goksorry room entries lookup failed", requestId, error);
    return applyServerTiming(
      jsonMessage(requestId, 500, "곡소리방 의견을 불러오지 못했습니다."),
      timer.headerValue()
    );
  }

  return applyServerTiming(NextResponse.json(payload), timer.headerValue());
}
