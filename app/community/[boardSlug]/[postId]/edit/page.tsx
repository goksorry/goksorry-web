import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditPostForm } from "@/components/edit-post-form";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { buildNoIndexMetadata } from "@/lib/seo";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildNoIndexMetadata("글 수정", "곡소리닷컴 게시판 글 수정 화면입니다.");

export default async function EditPostPage({
  params
}: {
  params: { boardSlug: string; postId: string };
}) {
  const service = getServiceSupabaseClient();
  const viewer = await getUserFromAuthorization();

  const { data: board } = await service
    .from("boards")
    .select("id,slug,name")
    .eq("slug", params.boardSlug)
    .maybeSingle();

  if (!board) {
    notFound();
  }

  const { data: post, error: postError } = await service
    .from("community_posts")
    .select("id,title,content,author_id,is_deleted,is_pinned_notice")
    .eq("id", params.postId)
    .eq("board_id", board.id)
    .maybeSingle();

  if (postError || !post || post.is_deleted) {
    notFound();
  }

  const canEdit = viewer && (viewer.role === "admin" || viewer.id === post.author_id);

  return (
    <section className="panel">
      <h1>글 수정</h1>
      {!viewer ? (
        <GoogleSignInButton callbackUrl={`/community/${board.slug}/${post.id}/edit`} />
      ) : canEdit ? (
        <>
          <p className="muted">입력은 평문만 허용됩니다.</p>
          <EditPostForm
            postId={post.id}
            boardSlug={board.slug}
            initialTitle={post.title}
            initialContent={post.content}
            allowPinNotice={board.slug === "notice" && viewer.role === "admin"}
            initialPinNotice={Boolean(post.is_pinned_notice)}
          />
        </>
      ) : (
        <p className="error">글 수정 권한이 없습니다. 작성자 또는 관리자만 수정할 수 있습니다.</p>
      )}
      <p>
        <Link href={`/community/${board.slug}/${post.id}`}>글로 돌아가기</Link>
      </p>
    </section>
  );
}
