import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCommentsSection } from "@/components/post-comments-section";
import { PostDetailActions } from "@/components/post-detail-actions";
import { formatKstDateTime } from "@/lib/date-time";
import { getCachedCommunityPostDetailData } from "@/lib/community-read";
import { buildPageMetadata, summarizeText } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: { boardSlug: string; postId: string };
}): Promise<Metadata> {
  const { post } = await getCachedCommunityPostDetailData(params.boardSlug, params.postId);

  if (!post) {
    return {
      title: "글을 찾을 수 없습니다",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const authorText = post.author_nickname ? `${post.author_nickname} 작성` : "커뮤니티 글";
  const description = summarizeText(`${authorText}. ${post.content}`);

  return buildPageMetadata({
    title: post.title,
    description,
    path: `/community/${post.board.slug}/${post.id}`,
    openGraphType: "article",
    publishedTime: post.created_at,
    modifiedTime: post.created_at
  });
}

export default async function PostDetailPage({
  params
}: {
  params: { boardSlug: string; postId: string };
}) {
  const { post, comments, commentsError } = await getCachedCommunityPostDetailData(params.boardSlug, params.postId);

  if (!post) {
    notFound();
  }

  return (
    <>
      <section className="panel">
        <h1>
          {post.title}{" "}
          {post.board.slug === "notice" && post.is_pinned_notice ? <span className="tag">상단 고정</span> : null}
        </h1>
        <p className="muted">
          게시판: /{post.board.slug} | 작성자: {post.author_nickname ?? "알 수 없음"} |{" "}
          {formatKstDateTime(post.created_at)}
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>

        <PostDetailActions postId={post.id} boardSlug={post.board.slug} authorId={post.author_id} />

        <p>
          <Link href={`/community/${post.board.slug}`}>게시판으로 돌아가기</Link>
        </p>
      </section>

      <section className="panel">
        <h2>댓글</h2>
        <PostCommentsSection
          postId={post.id}
          initialComments={comments}
          errorMessage={commentsError}
        />
      </section>
    </>
  );
}
