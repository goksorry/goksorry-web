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

  const entryId = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(entryId)) {
    return jsonMessage(requestId, 400, "Invalid entry id");
  }

  const { actor } = await resolveExistingGoksorryRoomActor(request);
  const service = getServiceSupabaseClient();
  const { data: entry } = await service
    .from("goksorry_room_entries")
    .select("id,author_kind,author_id,guest_owner_hash,is_deleted")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) {
    return jsonMessage(requestId, 404, "의견을 찾을 수 없습니다.");
  }

  if (entry.is_deleted) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }

  if (!canManageGoksorryRoomItem(actor, entry)) {
    return jsonMessage(requestId, 403, "작성자 또는 관리자만 삭제할 수 있습니다.");
  }

  const { error } = await service
    .from("goksorry_room_entries")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      content: "[deleted]"
    })
    .eq("id", entryId);

  if (error) {
    logApiError("goksorry room entry delete failed", requestId, error);
    return jsonMessage(requestId, 500, "의견을 삭제하지 못했습니다.");
  }

  return NextResponse.json({ ok: true });
}
