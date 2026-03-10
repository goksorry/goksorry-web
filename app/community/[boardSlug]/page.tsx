import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { formatKstDateTime } from "@/lib/date-time";
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

  const { data: posts, error: postsError } = await service
    .from("community_posts")
    .select("id,title,created_at,author_id,profiles(nickname)")
    .eq("board_id", board.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(200);

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

      <div className="list">
        {(posts ?? []).map((post: any) => {
          const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          return (
            <article key={post.id} className="card">
              <h3>
                <Link href={`/community/${board.slug}/${post.id}`}>{post.title}</Link>
              </h3>
              <p className="muted">
                작성자 {author?.nickname ?? "알 수 없음"} · {formatKstDateTime(post.created_at)}
              </p>
            </article>
          );
        })}

        {(posts ?? []).length === 0 ? <p className="muted">이 게시판에는 아직 글이 없습니다.</p> : null}
      </div>
    </section>
  );
}
