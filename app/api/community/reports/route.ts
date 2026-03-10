import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/plain-text";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
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

  if (!allowRateLimit(`report:${user.id}`, 10)) {
    return jsonMessage(requestId, 429, "Too many reports. Try again in a minute.");
  }

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { target_type?: unknown; target_id?: unknown; reason?: unknown };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  let targetType: string;
  let reason: string;
  try {
    targetType = sanitizePlainText(body.target_type, "target_type", 20).toLowerCase();
    reason = sanitizePlainText(body.reason, "reason", 300);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  if (reason.length < 10) {
    return jsonMessage(requestId, 400, "신고 사유는 10자 이상 입력해야 합니다.");
  }

  if (targetType !== "post" && targetType !== "comment") {
    return jsonMessage(requestId, 400, "target_type must be post or comment");
  }

  const targetId = String(body.target_id ?? "").trim();
  if (!UUID_PATTERN.test(targetId)) {
    return jsonMessage(requestId, 400, "Invalid target_id");
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  if (targetType === "post") {
    const { data: post } = await service
      .from("community_posts")
      .select("id,is_deleted")
      .eq("id", targetId)
      .maybeSingle();
    if (!post || post.is_deleted) {
      return jsonMessage(requestId, 404, "Target post not found");
    }
  }

  if (targetType === "comment") {
    const { data: comment } = await service
      .from("community_comments")
      .select("id,is_deleted")
      .eq("id", targetId)
      .maybeSingle();
    if (!comment || comment.is_deleted) {
      return jsonMessage(requestId, 404, "Target comment not found");
    }
  }

  const { data, error } = await service
    .from("reports")
    .insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason
    })
    .select("id")
    .single();

  if (error || !data) {
    logApiError("community report insert failed", requestId, error ?? "insert failed");
    return jsonMessage(requestId, 500, "신고를 접수하지 못했습니다.");
  }

  return NextResponse.json({ id: data.id });
}
