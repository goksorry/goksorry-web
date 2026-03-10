import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/comment-form";
import { DeletePostButton } from "@/components/delete-post-button";
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
    .select("id,title,content,created_at,is_deleted,author_id,profiles(nickname)")
    .eq("id", params.postId)
    .eq("board_id", board.id)
    .maybeSingle();

  if (postError || !post || post.is_deleted) {
    notFound();
  }

  const { data: comments, error: commentsError } = await service
    .from("community_comments")
    .select("id,content,created_at,author_id,is_deleted,profiles(nickname)")
    .eq("post_id", post.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const canEdit = viewer && (viewer.role === "admin" || viewer.id === post.author_id);

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
        {commentsError ? <p className="error">댓글 조회 실패: {commentsError.message}</p> : null}

        <div className="list">
          {(comments ?? []).map((comment: any) => {
            const commentAuthor = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
            return (
              <article key={comment.id} className="card">
                <p style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
                <p className="muted">
                  작성자 {commentAuthor?.nickname ?? "알 수 없음"} · {formatKstDateTime(comment.created_at)}
                </p>
                <ReportForm targetType="comment" targetId={comment.id} compact />
              </article>
            );
          })}
          {(comments ?? []).length === 0 ? <p className="muted">아직 댓글이 없습니다.</p> : null}
        </div>

        <CommentForm postId={post.id} />
      </section>
    </>
  );
}
