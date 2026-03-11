import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/components/delete-post-button";
import { PostCommentsSection } from "@/components/post-comments-section";
import { ReportForm } from "@/components/report-form";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { formatKstDateTime } from "@/lib/date-time";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params
}: {
  params: { boardSlug: string; postId: string };
}) {
  const service = getServiceSupabaseClient();
  const [viewer, postResult, commentsResult] = await Promise.all([
    getUserFromAuthorization(),
    service
      .from("community_posts")
      .select("id,title,content,created_at,is_deleted,author_id,profiles(nickname),boards!inner(id,slug,name)")
      .eq("id", params.postId)
      .eq("boards.slug", params.boardSlug)
      .maybeSingle(),
    service
      .from("community_comments")
      .select("id,content,created_at,author_id,is_deleted,profiles(nickname)")
      .eq("post_id", params.postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
  ]);
  const { data: post, error: postError } = postResult;

  if (postError || !post || post.is_deleted) {
    notFound();
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  if (!board) {
    notFound();
  }

  const { data: comments, error: commentsError } = commentsResult;
  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const canEdit = viewer && (viewer.role === "admin" || viewer.id === post.author_id);
  const initialComments = (comments ?? []).map((comment: any) => {
    const commentAuthor = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    return {
      id: String(comment.id),
      content: String(comment.content),
      created_at: String(comment.created_at),
      author_nickname: typeof commentAuthor?.nickname === "string" ? commentAuthor.nickname : null
    };
  });

  return (
    <>
      <section className="panel">
        <h1>{post.title}</h1>
        <p className="muted">
          게시판: /{board.slug} | 작성자: {author?.nickname ?? "알 수 없음"} |{" "}
          {formatKstDateTime(post.created_at)}
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>

        <div className="actions">
          {canEdit ? (
            <>
              <Link className="btn btn-secondary" href={`/community/${board.slug}/${post.id}/edit`}>
                글 수정
              </Link>
              <DeletePostButton postId={post.id} boardSlug={board.slug} />
            </>
          ) : null}
          <ReportForm targetType="post" targetId={post.id} />
        </div>

        <p>
          <Link href={`/community/${board.slug}`}>게시판으로 돌아가기</Link>
        </p>
      </section>

      <section className="panel">
        <h2>댓글</h2>
        <PostCommentsSection
          postId={post.id}
          initialComments={initialComments}
          errorMessage={commentsError?.message ?? null}
        />
      </section>
    </>
  );
}
