import Link from "next/link";
import { CommunityPostList } from "@/components/community-post-list";
import { fetchCommentCountsByPostId, formatPinnedNoticeTitle } from "@/lib/community-posts";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function CommunityHomePage() {
  const service = getServiceSupabaseClient();

  const [{ data: boards, error: boardsError }, { data: recentPosts, error: postsError }] = await Promise.all([
    service.from("boards").select("id,slug,name,sort_order").order("sort_order", { ascending: true }),
    service
      .from("community_posts")
      .select("id,title,created_at,board_id,author_id,is_pinned_notice,boards(slug,name),profiles(nickname)")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);
  const commentCounts = await fetchCommentCountsByPostId(
    service,
    (recentPosts ?? []).map((post: any) => String(post.id))
  );

  return (
    <>
      <section className="panel">
        <h1>커뮤니티 게시판</h1>

        {boardsError ? <p className="error">게시판 조회 실패: {boardsError.message}</p> : null}

        <div className="board-grid">
          {(boards ?? []).map((board: any) => (
            <Link key={board.id} href={`/community/${board.slug}`} className="card board-card">
              <h3>{board.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>최근 글</h2>
        {postsError ? <p className="error">최근 글 조회 실패: {postsError.message}</p> : null}

        <CommunityPostList
          showBoardName
          emptyMessage="아직 글이 없습니다."
          posts={(recentPosts ?? [])
            .map((post: any) => {
              const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
              const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
              if (!board?.slug) {
                return null;
              }

                return {
                  id: String(post.id),
                  href: `/community/${board.slug}/${post.id}`,
                  title: formatPinnedNoticeTitle(String(post.title ?? ""), Boolean(post.is_pinned_notice)),
                  createdAt: post.created_at ? String(post.created_at) : null,
                  authorNickname: author?.nickname ? String(author.nickname) : null,
                  commentCount: commentCounts.get(String(post.id)) ?? 0,
                  boardLabel: board.name ? String(board.name) : String(board.slug)
                };
            })
            .filter(Boolean) as Array<{
            id: string;
            href: string;
            title: string;
            createdAt: string | null;
            authorNickname: string | null;
            commentCount: number;
            boardLabel?: string | null;
          }>}
        />
      </section>
    </>
  );
}
