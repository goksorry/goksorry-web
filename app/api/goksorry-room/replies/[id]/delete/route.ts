import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { canManageGoksorryRoomItem, resolveExistingGoksorryRoomActor } from "@/lib/goksorry-room";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const replyId = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(replyId)) {
    return jsonMessage(requestId, 400, "Invalid reply id");
  }

  const { actor } = await resolveExistingGoksorryRoomActor(request);
  const service = getServiceSupabaseClient();
  const { data: reply } = await service
    .from("goksorry_room_replies")
    .select("id,author_kind,author_id,guest_owner_hash,is_deleted")
    .eq("id", replyId)
    .maybeSingle();

  if (!reply) {
    return jsonMessage(requestId, 404, "덧글을 찾을 수 없습니다.");
  }

  if (reply.is_deleted) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }

  if (!canManageGoksorryRoomItem(actor, reply)) {
    return jsonMessage(requestId, 403, "작성자 또는 관리자만 삭제할 수 있습니다.");
  }

  const { error } = await service
    .from("goksorry_room_replies")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      content: "[deleted]"
    })
    .eq("id", replyId);

  if (error) {
    logApiError("goksorry room reply delete failed", requestId, error);
    return jsonMessage(requestId, 500, "덧글을 삭제하지 못했습니다.");
  }

  return NextResponse.json({ ok: true });
}
