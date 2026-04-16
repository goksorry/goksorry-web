import type { Metadata } from "next";
import Link from "next/link";
import { CommunityPostList } from "@/components/community-post-list";
import { getCachedCommunityHomeData } from "@/lib/community-read";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "커뮤니티",
  description: "게시판별 최신 글과 공지, 최근 커뮤니티 반응을 확인할 수 있는 곡소리닷컴 커뮤니티 홈입니다.",
  path: "/community"
});

export default async function CommunityHomePage() {
  const { boards, boardsError, recentPosts, postsError } = await getCachedCommunityHomeData();

  return (
    <>
      <section className="panel">
        <h1>커뮤니티 게시판</h1>

        {boardsError ? <p className="error">게시판 조회 실패: {boardsError}</p> : null}

        <div className="board-grid">
          {boards.map((board) => (
            <Link key={board.id} href={`/community/${board.slug}`} className="card board-card">
              <h3>{board.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>최근 글</h2>
        {postsError ? <p className="error">최근 글 조회 실패: {postsError}</p> : null}

        <CommunityPostList
          showBoardName
          emptyMessage="아직 글이 없습니다."
          posts={recentPosts}
        />
      </section>
    </>
  );
}
