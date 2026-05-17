import Link from "next/link";
import { formatKstDateTime } from "@/lib/date-time";

type CommunityPostListItem = {
  id: string;
  href: string;
  title: string;
  createdAt: string | null;
  authorNickname: string | null;
  commentCount: number;
  boardLabel?: string | null;
};

type CommunityPostListProps = {
  posts: CommunityPostListItem[];
  emptyMessage: string;
  showBoardName?: boolean;
};

const normalizeBoardLabel = (value: string | null | undefined): string => {
  const label = String(value ?? "").trim();
  return label || "알 수 없는 게시판";
};

export function CommunityPostList({
  posts,
  emptyMessage,
  showBoardName = false
}: CommunityPostListProps) {
  if (posts.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <div className="community-post-list">
      {posts.map((post) => {
        const boardLabel = normalizeBoardLabel(post.boardLabel);

        return (
          <article
            key={post.id}
            className={`community-post-row${showBoardName ? " community-post-row-board" : ""}`}
          >
            {showBoardName ? <span className="community-post-board">{boardLabel}</span> : null}

            <Link href={post.href} className="community-post-title-link">
              <strong className="community-post-title">
                <span>{post.title}</span>
                <span className="community-post-comment-count">[{post.commentCount}]</span>
              </strong>
            </Link>

            {showBoardName ? (
              <span className="community-post-separator community-post-separator-board" aria-hidden="true">
                |
              </span>
            ) : null}

            <span className={`community-post-meta${showBoardName ? " community-post-meta-board" : ""}`}>
              {showBoardName ? <span className="community-post-board-mobile">{boardLabel}</span> : null}
              <span className="community-post-separator community-post-separator-author" aria-hidden="true">
                |
              </span>
              <span className="community-post-author">{post.authorNickname ?? "알 수 없음"}</span>
              <span className="community-post-separator community-post-separator-time" aria-hidden="true">
                |
              </span>
              <time className="community-post-time" dateTime={post.createdAt ?? undefined}>
                {post.createdAt ? formatKstDateTime(post.createdAt) : "-"}
              </time>
            </span>
          </article>
        );
      })}
    </div>
  );
}
