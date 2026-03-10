import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const role = await ensureProfileForUser(user);
  const admin = role === "admin" || isAdminEmail(user.email);

  const service = getServiceSupabaseClient();
  const { data: post } = await service
    .from("community_posts")
    .select("id,author_id,is_deleted,board_id,boards(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.is_deleted) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }

  if (post.author_id !== user.id && !admin) {
    return NextResponse.json({ error: "Only author/admin can delete" }, { status: 403 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  revalidatePath("/community");
  if (board?.slug) {
    revalidatePath(`/community/${board.slug}`);
    revalidatePath(`/community/${board.slug}/${postId}`);
  }

  return NextResponse.json({ ok: true });
}
