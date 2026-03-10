import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/plain-text";
import {
  checkAccountAge,
  ensureProfileForUser,
  getUserFromAuthorization,
  MIN_ACCOUNT_AGE_MINUTES
} from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  if (!allowRateLimit(`comment:${user.id}`, 8)) {
    return jsonMessage(requestId, 429, "Too many comments. Try again in a minute.");
  }

  const ageCheck = checkAccountAge(user, MIN_ACCOUNT_AGE_MINUTES);
  if (!ageCheck.ok) {
    return jsonMessage(
      requestId,
      403,
      `Commenting is blocked for new users. Try again in ${ageCheck.waitMinutes} minute(s).`
    );
  }

  let body: { post_id?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { post_id?: unknown; content?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  const postId = String(body.post_id ?? "").trim();
  if (!UUID_PATTERN.test(postId)) {
    return jsonMessage(requestId, 400, "Invalid post_id");
  }

  let content: string;
  try {
    content = sanitizePlainText(body.content, "content", 3000);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,is_deleted,boards(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.is_deleted) {
    return jsonMessage(requestId, 404, "Post not found");
  }

  const { data, error } = await service
    .from("community_comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content
    })
    .select("id")
    .single();

  if (error || !data) {
    logApiError("community comment insert failed", requestId, error ?? "insert failed");
    return jsonMessage(requestId, 500, "댓글을 저장하지 못했습니다.");
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  if (board?.slug) {
    revalidatePath(`/community/${board.slug}/${postId}`);
  }

  return NextResponse.json({ id: data.id });
}
