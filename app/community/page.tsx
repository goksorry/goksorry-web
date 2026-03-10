import Link from "next/link";
import { formatKstDateTime } from "@/lib/date-time";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function CommunityHomePage() {
  const service = getServiceSupabaseClient();

  const [{ data: boards, error: boardsError }, { data: recentPosts, error: postsError }] = await Promise.all([
    service.from("boards").select("id,slug,name,sort_order").order("sort_order", { ascending: true }),
    service
      .from("community_posts")
      .select("id,title,created_at,board_id,author_id,boards(slug,name),profiles(nickname)")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

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

        <div className="list">
          {(recentPosts ?? []).map((post: any) => {
            const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
            const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
            if (!board) {
              return null;
            }

            return (
              <article key={post.id} className="card">
                <h4>
                  <Link href={`/community/${board.slug}/${post.id}`}>{post.title}</Link>
                </h4>
                <p className="muted">
                  게시판: {board.slug} | 작성자: {author?.nickname ?? "알 수 없음"} |{" "}
                  {formatKstDateTime(post.created_at)}
                </p>
              </article>
            );
          })}

          {(recentPosts ?? []).length === 0 ? <p className="muted">아직 글이 없습니다.</p> : null}
        </div>
      </section>
    </>
  );
}
