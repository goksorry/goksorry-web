import Link from "next/link";
import { notFound } from "next/navigation";
import { NewPostForm } from "@/components/new-post-form";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export default async function NewPostPage({ params }: { params: { boardSlug: string } }) {
  const service = getServiceSupabaseClient();
  const { data: board } = await service
    .from("boards")
    .select("id,slug,name")
    .eq("slug", params.boardSlug)
    .maybeSingle();

  if (!board) {
    notFound();
  }

  return (
    <section className="panel">
      <h1>Write post in {board.name}</h1>
      <p className="muted">Google login is required. Plain text only.</p>
      <NewPostForm boardSlug={board.slug} />
      <p>
        <Link href={`/community/${board.slug}`}>Back to board</Link>
      </p>
    </section>
  );
}
