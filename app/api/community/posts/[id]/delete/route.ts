import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { revalidateCommunityPaths } from "@/lib/community-cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const postId = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(postId)) {
    return jsonMessage(requestId, 400, "Invalid post id");
  }

  const role = await ensureProfileForUser(user);
  const admin = role === "admin" || isAdminEmail(user.email);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,author_id,is_deleted,is_pinned_notice,board_id,boards(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return jsonMessage(requestId, 404, "Post not found");
  }

  if (post.is_deleted) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }

  if (post.author_id !== user.id && !admin) {
    return jsonMessage(requestId, 403, "Only author/admin can delete");
  }

  const { error } = await service
    .from("community_posts")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      content: "[deleted]"
    })
    .eq("id", postId);

  if (error) {
    logApiError("community post delete failed", requestId, error);
    return jsonMessage(requestId, 500, "글을 삭제하지 못했습니다.");
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  if (board?.slug) {
    await revalidateCommunityPaths(service, {
      boardSlug: board.slug,
      postId,
      includeAllBoards: board.slug === "notice" && Boolean(post.is_pinned_notice)
    });
  }

  return NextResponse.json({ ok: true });
}
