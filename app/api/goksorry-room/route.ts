import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import {
  GOKSORRY_ROOM_DEFAULT_LIMIT,
  GOKSORRY_ROOM_MAX_LIMIT,
  canManageGoksorryRoomItem,
  resolveExistingGoksorryRoomActor
} from "@/lib/goksorry-room";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

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

const mapReply = (reply: any, actor: Awaited<ReturnType<typeof resolveExistingGoksorryRoomActor>>["actor"]) => ({
  id: String(reply.id),
  entry_id: String(reply.entry_id),
  content: String(reply.content),
  author_kind: reply.author_kind === "member" ? "member" : "guest",
  author_label: String(reply.author_label ?? "익명"),
  created_at: String(reply.created_at),
  can_delete: canManageGoksorryRoomItem(actor, {
    author_kind: String(reply.author_kind ?? ""),
    author_id: reply.author_id ? String(reply.author_id) : null,
    guest_owner_hash: reply.guest_owner_hash ? String(reply.guest_owner_hash) : null
  })
});

const mapEntry = (
  entry: any,
  replies: any[],
  actor: Awaited<ReturnType<typeof resolveExistingGoksorryRoomActor>>["actor"]
) => ({
  id: String(entry.id),
  content: String(entry.content),
  author_kind: entry.author_kind === "member" ? "member" : "guest",
  author_label: String(entry.author_label ?? "익명"),
  created_at: String(entry.created_at),
  reply_count: replies.length,
  can_delete: canManageGoksorryRoomItem(actor, {
    author_kind: String(entry.author_kind ?? ""),
    author_id: entry.author_id ? String(entry.author_id) : null,
    guest_owner_hash: entry.guest_owner_hash ? String(entry.guest_owner_hash) : null
  }),
  replies: replies.map((reply) => mapReply(reply, actor))
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const { actor } = await resolveExistingGoksorryRoomActor(request);
  const service = getServiceSupabaseClient();

  let query = service
    .from("goksorry_room_entries")
    .select("id,author_kind,author_id,guest_owner_hash,author_label,content,created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: entries, error: entriesError } = await query;
  if (entriesError) {
    logApiError("goksorry room entries lookup failed", requestId, entriesError);
    return jsonMessage(requestId, 500, "곡소리방 의견을 불러오지 못했습니다.");
  }

  const entryIds = (entries ?? []).map((entry: any) => String(entry.id));
  const { data: replies, error: repliesError } = entryIds.length
    ? await service
        .from("goksorry_room_replies")
        .select("id,entry_id,author_kind,author_id,guest_owner_hash,author_label,content,created_at")
        .in("entry_id", entryIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (repliesError) {
    logApiError("goksorry room replies lookup failed", requestId, repliesError);
    return jsonMessage(requestId, 500, "곡소리방 덧글을 불러오지 못했습니다.");
  }

  const repliesByEntryId = new Map<string, any[]>();
  for (const reply of replies ?? []) {
    const entryId = String((reply as any).entry_id);
    repliesByEntryId.set(entryId, [...(repliesByEntryId.get(entryId) ?? []), reply]);
  }

  const mappedEntries = (entries ?? []).map((entry: any) =>
    mapEntry(entry, repliesByEntryId.get(String(entry.id)) ?? [], actor)
  );
  const lastEntry = mappedEntries[mappedEntries.length - 1];

  return NextResponse.json({
    entries: mappedEntries,
    next_cursor: mappedEntries.length === limit && lastEntry ? lastEntry.created_at : null
  });
}
