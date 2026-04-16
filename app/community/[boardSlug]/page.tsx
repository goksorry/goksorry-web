import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityBoardActions } from "@/components/community-board-actions";
import { CommunityPostList } from "@/components/community-post-list";
import { getCachedCommunityBoardPageData } from "@/lib/community-read";
import { buildPageMetadata, summarizeText } from "@/lib/seo";

export async function generateMetadata({ params }: { params: { boardSlug: string } }): Promise<Metadata> {
  const { board } = await getCachedCommunityBoardPageData(params.boardSlug);

  if (!board) {
    return {
      title: "게시판을 찾을 수 없습니다",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const description = board.description
    ? summarizeText(board.description)
    : `${board.name} 게시판의 최신 글과 공지를 확인할 수 있습니다.`;

  return buildPageMetadata({
    title: `${board.name} 게시판`,
    description,
    path: `/community/${board.slug}`
  });
}

export default async function BoardPage({ params }: { params: { boardSlug: string } }) {
  const { board, posts, postsError } = await getCachedCommunityBoardPageData(params.boardSlug);

  if (!board) {
    notFound();
  }

  return (
    <section className="panel">
      <h1>
        {board.name} <span className="tag">/{board.slug}</span>
      </h1>
      {board.description ? <p className="muted">{board.description}</p> : null}

      <CommunityBoardActions boardSlug={board.slug} />

      {postsError ? <p className="error">글 목록 조회 실패: {postsError}</p> : null}

      <CommunityPostList
        emptyMessage="이 게시판에는 아직 글이 없습니다."
        posts={posts}
      />
    </section>
  );
}
