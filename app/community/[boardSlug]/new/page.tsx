import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { NewPostForm } from "@/components/new-post-form";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export default async function NewPostPage({ params }: { params: { boardSlug: string } }) {
  const service = getServiceSupabaseClient();
  const session = await getServerSession(authOptions);
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
      {session?.user?.email ? (
        <>
          <p className="muted">입력은 평문만 허용됩니다.</p>
          <NewPostForm boardSlug={board.slug} />
        </>
      ) : (
        <GoogleSignInButton callbackUrl={`/community/${board.slug}/new`} />
      )}
      <p>
        <Link href={`/community/${board.slug}`}>게시판으로 돌아가기</Link>
      </p>
    </section>
  );
}
