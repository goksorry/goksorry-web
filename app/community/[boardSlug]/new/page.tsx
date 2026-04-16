import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { NewPostForm } from "@/components/new-post-form";
import { buildNoIndexMetadata } from "@/lib/seo";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const metadata: Metadata = buildNoIndexMetadata("글쓰기", "곡소리닷컴 커뮤니티 글 작성 화면입니다.");

export default async function NewPostPage({ params }: { params: { boardSlug: string } }) {
  const service = getServiceSupabaseClient();
  const session = await getServerSession(authOptions);
  const viewer = await getUserFromAuthorization();
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
      {board.slug === "notice" ? (
        !viewer ? (
          <GoogleSignInButton callbackUrl={`/community/${board.slug}/new`} />
        ) : viewer.role === "admin" ? (
          <>
            <p className="muted">입력은 평문만 허용됩니다.</p>
            <NewPostForm boardSlug={board.slug} allowPinNotice />
          </>
        ) : (
          <p className="error">공지 작성 권한이 없습니다. 공지는 관리자만 작성할 수 있습니다.</p>
        )
      ) : session?.user?.email ? (
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
