import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  let body: { title?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { title?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let title: string;
  let content: string;
  try {
    title = sanitizePlainText(body.title, "title", 200);
    content = sanitizePlainText(body.content, "content", 5000);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  const role = await ensureProfileForUser(user);
  const admin = role === "admin" || isAdminEmail(user.email);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,author_id,is_deleted,boards(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.is_deleted) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.author_id !== user.id && !admin) {
    return NextResponse.json({ error: "작성자 또는 관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const { error } = await service
    .from("community_posts")
    .update({
      title,
      content
    })
    .eq("id", postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  revalidatePath("/community");
  if (board?.slug) {
    revalidatePath(`/community/${board.slug}`);
    revalidatePath(`/community/${board.slug}/${postId}`);
    revalidatePath(`/community/${board.slug}/${postId}/edit`);
  }

  return NextResponse.json({ id: postId });
}
