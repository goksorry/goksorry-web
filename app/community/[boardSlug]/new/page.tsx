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
      <h1>{board.name}에 글쓰기</h1>
      <p className="muted">구글 로그인이 필요하며, 입력은 평문만 허용됩니다.</p>
      <NewPostForm boardSlug={board.slug} />
      <p>
        <Link href={`/community/${board.slug}`}>게시판으로 돌아가기</Link>
      </p>
    </section>
  );
}
