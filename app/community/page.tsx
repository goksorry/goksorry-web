import Link from "next/link";
import { formatKstDateTime } from "@/lib/date-time";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function CommunityHomePage() {
  const service = getServiceSupabaseClient();

  const [{ data: boards, error: boardsError }, { data: recentPosts, error: postsError }] = await Promise.all([
    service.from("boards").select("id,slug,name,description,sort_order").order("sort_order", { ascending: true }),
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
        <p className="muted">구글 로그인 사용자는 글과 댓글을 작성할 수 있습니다. 입력은 평문만 허용됩니다.</p>

        {boardsError ? <p className="error">게시판 조회 실패: {boardsError.message}</p> : null}

        <div className="list">
          {(boards ?? []).map((board: any) => (
            <article key={board.id} className="card">
              <h3>
                <Link href={`/community/${board.slug}`}>{board.name}</Link>
              </h3>
              <p className="muted">/{board.slug}</p>
              {board.description ? <p>{board.description}</p> : null}
            </article>
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
