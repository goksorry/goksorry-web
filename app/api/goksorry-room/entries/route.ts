import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import {
  GOKSORRY_ROOM_ENTRY_MAX_LENGTH,
  resolveWritableGoksorryRoomActor,
  setGoksorryRoomGuestCookie
} from "@/lib/goksorry-room";
import { sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  let content: string;
  try {
    content = sanitizePlainText(body.content, "content", GOKSORRY_ROOM_ENTRY_MAX_LENGTH);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const { user, actor } = await resolveWritableGoksorryRoomActor(request);
  if (!actor) {
    return jsonMessage(requestId, 403, user ? "프로필 가입 설정을 먼저 완료해야 합니다." : "작성자를 확인하지 못했습니다.");
  }

  const rateLimitKey = actor.kind === "member" ? actor.id : actor.guestOwnerHash;
  if (!allowRateLimit(`goksorry-room-entry:${rateLimitKey}`, 5)) {
    return jsonMessage(requestId, 429, "의견이 너무 빠릅니다. 잠시 후 다시 시도하세요.");
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("goksorry_room_entries")
    .insert({
      author_kind: actor.kind,
      author_id: actor.kind === "member" ? actor.id : null,
      guest_owner_hash: actor.kind === "guest" ? actor.guestOwnerHash : null,
      author_label: actor.label,
      content
    })
    .select("id,author_kind,author_label,content,created_at")
    .single();

  if (error || !data) {
    logApiError("goksorry room entry insert failed", requestId, error ?? "insert failed");
    return jsonMessage(requestId, 500, "의견을 저장하지 못했습니다.");
  }

  const response = NextResponse.json({
    entry: {
      id: data.id,
      content: data.content,
      author_kind: data.author_kind,
      author_label: data.author_label,
      created_at: data.created_at,
      reply_count: 0,
      can_delete: true,
      replies: []
    }
  });
  setGoksorryRoomGuestCookie(response, actor.kind === "guest" ? actor.cookie : null);
  return response;
}
