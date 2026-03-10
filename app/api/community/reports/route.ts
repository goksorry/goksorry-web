import { NextResponse } from "next/server";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/plain-text";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowRateLimit(`report:${user.id}`, 10)) {
    return NextResponse.json({ error: "Too many reports. Try again in a minute." }, { status: 429 });
  }

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { target_type?: unknown; target_id?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let targetType: string;
  let reason: string;
  try {
    targetType = sanitizePlainText(body.target_type, "target_type", 20).toLowerCase();
    reason = sanitizePlainText(body.reason, "reason", 300);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: "신고 사유는 10자 이상 입력해야 합니다." }, { status: 400 });
  }

  if (targetType !== "post" && targetType !== "comment") {
    return NextResponse.json({ error: "target_type must be post or comment" }, { status: 400 });
  }

  const targetId = String(body.target_id ?? "").trim();
  if (!UUID_PATTERN.test(targetId)) {
    return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
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
      return NextResponse.json({ error: "Target post not found" }, { status: 404 });
    }
  }

  if (targetType === "comment") {
    const { data: comment } = await service
      .from("community_comments")
      .select("id,is_deleted")
      .eq("id", targetId)
      .maybeSingle();
    if (!comment || comment.is_deleted) {
      return NextResponse.json({ error: "Target comment not found" }, { status: 404 });
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
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
