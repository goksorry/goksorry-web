import { NextResponse } from "next/server";
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
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowRateLimit(`comment:${user.id}`, 8)) {
    return NextResponse.json({ error: "Too many comments. Try again in a minute." }, { status: 429 });
  }

  const ageCheck = checkAccountAge(user, MIN_ACCOUNT_AGE_MINUTES);
  if (!ageCheck.ok) {
    return NextResponse.json(
      { error: `Commenting is blocked for new users. Try again in ${ageCheck.waitMinutes} minute(s).` },
      { status: 403 }
    );
  }

  let body: { post_id?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { post_id?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = String(body.post_id ?? "").trim();
  if (!UUID_PATTERN.test(postId)) {
    return NextResponse.json({ error: "Invalid post_id" }, { status: 400 });
  }

  let content: string;
  try {
    content = sanitizePlainText(body.content, "content", 3000);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,is_deleted")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.is_deleted) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
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
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
