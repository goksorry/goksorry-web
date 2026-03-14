import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPostList } from "@/components/community-post-list";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { fetchCommentCountsByPostId, formatPinnedNoticeTitle } from "@/lib/community-posts";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: { boardSlug: string } }) {
  const service = getServiceSupabaseClient();
  const viewer = await getUserFromAuthorization();

  const { data: board, error: boardError } = await service
    .from("boards")
    .select("id,slug,name,description")
    .eq("slug", params.boardSlug)
    .maybeSingle();

  if (boardError || !board) {
    notFound();
  }

  const canWrite = board.slug !== "notice" || viewer?.role === "admin";

  const [postsResult, pinnedNoticesResult] = await Promise.all([
    service
      .from("community_posts")
      .select("id,title,created_at,author_id,is_pinned_notice,profiles(nickname)")
      .eq("board_id", board.id)
      .eq("is_deleted", false)
      .order(board.slug === "notice" ? "is_pinned_notice" : "created_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    board.slug === "notice"
      ? Promise.resolve({ data: [], error: null })
      : service
          .from("community_posts")
          .select("id,title,created_at,author_id,is_pinned_notice,profiles(nickname),boards!inner(slug)")
          .eq("boards.slug", "notice")
          .eq("is_deleted", false)
          .eq("is_pinned_notice", true)
          .order("created_at", { ascending: false })
          .limit(20)
  ]);
  const { data: posts, error: postsError } = postsResult;
  const pinnedNoticeRows = board.slug === "notice" ? [] : pinnedNoticesResult.data ?? [];
  const mergedPosts = [...pinnedNoticeRows, ...(posts ?? [])];
  const commentCounts = await fetchCommentCountsByPostId(
    service,
    mergedPosts.map((post: any) => String(post.id))
  );

  return (
    <section className="panel">
      <h1>
        {board.name} <span className="tag">/{board.slug}</span>
      </h1>
      {board.description ? <p className="muted">{board.description}</p> : null}

      <div className="actions" style={{ marginBottom: "0.9rem" }}>
        {canWrite ? (
          <Link className="btn" href={`/community/${board.slug}/new`}>
            글쓰기
          </Link>
        ) : null}
        <Link className="btn btn-secondary" href="/community">
          게시판 목록
        </Link>
      </div>
      {board.slug === "notice" && !canWrite ? <p className="muted">공지 작성은 관리자만 가능합니다.</p> : null}

      {postsError ? <p className="error">글 목록 조회 실패: {postsError.message}</p> : null}

      <CommunityPostList
        emptyMessage="이 게시판에는 아직 글이 없습니다."
        posts={mergedPosts.map((post: any) => {
          const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          const isPinnedNotice = Boolean(post.is_pinned_notice);
          const hrefBoardSlug = isPinnedNotice && board.slug !== "notice" ? "notice" : board.slug;

          return {
            id: String(post.id),
            href: `/community/${hrefBoardSlug}/${post.id}`,
            title: formatPinnedNoticeTitle(String(post.title ?? ""), isPinnedNotice),
            createdAt: post.created_at ? String(post.created_at) : null,
            authorNickname: author?.nickname ? String(author.nickname) : null,
            commentCount: commentCounts.get(String(post.id)) ?? 0
          };
        })}
      />
    </section>
  );
}
