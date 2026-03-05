import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/comment-form";
import { DeletePostButton } from "@/components/delete-post-button";
import { ReportForm } from "@/components/report-form";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export default async function PostDetailPage({
  params
}: {
  params: { boardSlug: string; postId: string };
}) {
  const service = getServiceSupabaseClient();

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

  return (
    <>
      <section className="panel">
        <h1>{post.title}</h1>
        <p className="muted">
          board: /{board.slug} | author: {author?.nickname ?? "unknown"} | {new Date(post.created_at).toLocaleString()}
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>

        <div className="actions">
          <DeletePostButton postId={post.id} boardSlug={board.slug} />
          <ReportForm targetType="post" targetId={post.id} />
        </div>

        <p>
          <Link href={`/community/${board.slug}`}>Back to board</Link>
        </p>
      </section>

      <section className="panel">
        <h2>Comments</h2>
        {commentsError ? <p className="error">Comment query failed: {commentsError.message}</p> : null}

        <div className="list">
          {(comments ?? []).map((comment: any) => {
            const commentAuthor = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
            return (
              <article key={comment.id} className="card">
                <p style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
                <p className="muted">
                  by {commentAuthor?.nickname ?? "unknown"} at {new Date(comment.created_at).toLocaleString()}
                </p>
                <ReportForm targetType="comment" targetId={comment.id} compact />
              </article>
            );
          })}
          {(comments ?? []).length === 0 ? <p className="muted">No comments yet.</p> : null}
        </div>

        <CommentForm postId={post.id} />
      </section>
    </>
  );
}
