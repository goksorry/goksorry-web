import Link from "next/link";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

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
        <h1>Community Boards</h1>
        <p className="muted">Google login users can write posts/comments. Input is plain text only.</p>

        {boardsError ? <p className="error">Board query failed: {boardsError.message}</p> : null}

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
        <h2>Recent posts</h2>
        {postsError ? <p className="error">Recent post query failed: {postsError.message}</p> : null}

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
                  board: {board.slug} | author: {author?.nickname ?? "unknown"} | {new Date(post.created_at).toLocaleString()}
                </p>
              </article>
            );
          })}

          {(recentPosts ?? []).length === 0 ? <p className="muted">No posts yet.</p> : null}
        </div>
      </section>
    </>
  );
}
