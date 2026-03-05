import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export default async function BoardPage({ params }: { params: { boardSlug: string } }) {
  const service = getServiceSupabaseClient();

  const { data: board, error: boardError } = await service
    .from("boards")
    .select("id,slug,name,description")
    .eq("slug", params.boardSlug)
    .maybeSingle();

  if (boardError || !board) {
    notFound();
  }

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
        <Link className="btn" href={`/community/${board.slug}/new`}>
          Write Post
        </Link>
        <Link className="btn btn-secondary" href="/community">
          Back to boards
        </Link>
      </div>

      {postsError ? <p className="error">Post query failed: {postsError.message}</p> : null}

      <div className="list">
        {(posts ?? []).map((post: any) => {
          const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          return (
            <article key={post.id} className="card">
              <h3>
                <Link href={`/community/${board.slug}/${post.id}`}>{post.title}</Link>
              </h3>
              <p className="muted">
                by {author?.nickname ?? "unknown"} at {new Date(post.created_at).toLocaleString()}
              </p>
            </article>
          );
        })}

        {(posts ?? []).length === 0 ? <p className="muted">No posts in this board.</p> : null}
      </div>
    </section>
  );
}
