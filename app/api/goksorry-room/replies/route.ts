import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import {
  GOKSORRY_ROOM_REPLY_MAX_LENGTH,
  resolveWritableGoksorryRoomActor,
  setGoksorryRoomGuestCookie
} from "@/lib/goksorry-room";
import { sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  let body: { entry_id?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { entry_id?: unknown; content?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  const entryId = String(body.entry_id ?? "").trim();
  if (!UUID_PATTERN.test(entryId)) {
    return jsonMessage(requestId, 400, "Invalid entry_id");
  }

  let content: string;
  try {
    content = sanitizePlainText(body.content, "content", GOKSORRY_ROOM_REPLY_MAX_LENGTH);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const { user, actor } = await resolveWritableGoksorryRoomActor(request);
  if (!actor) {
    return jsonMessage(requestId, 403, user ? "프로필 가입 설정을 먼저 완료해야 합니다." : "작성자를 확인하지 못했습니다.");
  }

  const rateLimitKey = actor.kind === "member" ? actor.id : actor.guestOwnerHash;
  if (!allowRateLimit(`goksorry-room-reply:${rateLimitKey}`, 12)) {
    return jsonMessage(requestId, 429, "덧글이 너무 빠릅니다. 잠시 후 다시 시도하세요.");
  }

  const service = getServiceSupabaseClient();
  const { data: entry } = await service
    .from("goksorry_room_entries")
    .select("id,is_deleted")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry || entry.is_deleted) {
    return jsonMessage(requestId, 404, "의견을 찾을 수 없습니다.");
  }

  const { data, error } = await service
    .from("goksorry_room_replies")
    .insert({
      entry_id: entryId,
      author_kind: actor.kind,
      author_id: actor.kind === "member" ? actor.id : null,
      guest_owner_hash: actor.kind === "guest" ? actor.guestOwnerHash : null,
      author_label: actor.label,
      content
    })
    .select("id,entry_id,author_kind,author_label,content,created_at")
    .single();

  if (error || !data) {
    logApiError("goksorry room reply insert failed", requestId, error ?? "insert failed");
    return jsonMessage(requestId, 500, "덧글을 저장하지 못했습니다.");
  }

  const response = NextResponse.json({
    reply: {
      id: data.id,
      entry_id: data.entry_id,
      content: data.content,
      author_kind: data.author_kind,
      author_label: data.author_label,
      created_at: data.created_at,
      can_delete: true
    }
  });
  setGoksorryRoomGuestCookie(response, actor.kind === "guest" ? actor.cookie : null);
  return response;
}
