import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { revalidateCommunityPaths } from "@/lib/community-cache";
import { sanitizePlainText } from "@/lib/plain-text";
import {
  checkAccountAge,
  ensureProfileForUser,
  getUserFromAuthorization,
  MIN_ACCOUNT_AGE_MINUTES
} from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const parsePinNotice = (value: unknown): boolean => {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error("pin_notice must be boolean");
};

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

  if (!allowRateLimit(`post:${user.id}`, 3)) {
    return jsonMessage(requestId, 429, "Too many posts. Try again in a minute.");
  }

  const ageCheck = checkAccountAge(user, MIN_ACCOUNT_AGE_MINUTES);
  if (!ageCheck.ok) {
    return jsonMessage(requestId, 403, `Posting is blocked for new users. Try again in ${ageCheck.waitMinutes} minute(s).`);
  }

  let body: { board_slug?: unknown; title?: unknown; content?: unknown; pin_notice?: unknown };
  try {
    body = (await request.json()) as { board_slug?: unknown; title?: unknown; content?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  let boardSlug: string;
  let title: string;
  let content: string;
  let pinNotice: boolean;
  try {
    boardSlug = sanitizePlainText(body.board_slug, "board_slug", 50).toLowerCase();
    title = sanitizePlainText(body.title, "title", 200);
    content = sanitizePlainText(body.content, "content", 5000);
    pinNotice = parsePinNotice(body.pin_notice);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  const { data: board } = await service.from("boards").select("id,slug").eq("slug", boardSlug).maybeSingle();
  if (!board) {
    return jsonMessage(requestId, 404, "Board not found");
  }

  if (board.slug === "notice" && user.role !== "admin") {
    return jsonMessage(requestId, 403, "공지 작성 권한이 없습니다.");
  }

  const isPinnedNotice = board.slug === "notice" && user.role === "admin" ? pinNotice : false;
  const { data, error } = await service
    .from("community_posts")
    .insert({
      board_id: board.id,
      author_id: user.id,
      title,
      content,
      is_pinned_notice: isPinnedNotice
    })
    .select("id")
    .single();

  if (error || !data) {
    logApiError("community post insert failed", requestId, error ?? "insert failed");
    return jsonMessage(requestId, 500, "글을 저장하지 못했습니다.");
  }

  await revalidateCommunityPaths(service, {
    boardSlug: board.slug,
    postId: data.id,
    includeAllBoards: board.slug === "notice" && isPinnedNotice
  });

  return NextResponse.json({ id: data.id });
}
