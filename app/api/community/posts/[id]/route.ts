import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { revalidateCommunityPaths } from "@/lib/community-cache";
import { sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  let body: { title?: unknown; content?: unknown; pin_notice?: unknown };
  try {
    body = (await request.json()) as { title?: unknown; content?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  let title: string;
  let content: string;
  let pinNotice: boolean | null = null;
  try {
    title = sanitizePlainText(body.title, "title", 200);
    content = sanitizePlainText(body.content, "content", 5000);
    if (body.pin_notice !== undefined) {
      if (typeof body.pin_notice !== "boolean") {
        throw new Error("pin_notice must be boolean");
      }
      pinNotice = body.pin_notice;
    }
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const role = await ensureProfileForUser(user);
  const admin = role === "admin" || isAdminEmail(user.email);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,author_id,is_deleted,is_pinned_notice,boards(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.is_deleted) {
    return jsonMessage(requestId, 404, "Post not found");
  }

  if (post.author_id !== user.id && !admin) {
    return jsonMessage(requestId, 403, "작성자 또는 관리자만 수정할 수 있습니다.");
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  const isPinnedNotice =
    board?.slug === "notice" && admin ? (pinNotice ?? Boolean(post.is_pinned_notice)) : false;
  const { error } = await service
    .from("community_posts")
    .update({
      title,
      content,
      is_pinned_notice: isPinnedNotice
    })
    .eq("id", postId);

  if (error) {
    logApiError("community post update failed", requestId, error);
    return jsonMessage(requestId, 500, "글을 수정하지 못했습니다.");
  }

  if (board?.slug) {
    await revalidateCommunityPaths(service, {
      boardSlug: board.slug,
      postId,
      includeEditPath: true,
      includeAllBoards: board.slug === "notice" && (Boolean(post.is_pinned_notice) || isPinnedNotice)
    });
  }

  return NextResponse.json({ id: postId });
}
