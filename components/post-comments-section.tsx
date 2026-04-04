"use client";

import { useEffect, useState } from "react";
import { CommentForm, type CreatedCommentPayload } from "@/components/comment-form";
import { ReportForm } from "@/components/report-form";
import { formatKstDateTime } from "@/lib/date-time";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

type PostComment = CreatedCommentPayload;

const COMMENT_MENTION_PATTERN = />>([0-9a-f-]{8,36})(?![0-9a-f-])/gi;

function resolveCommentMentionId(token: string, commentIds: string[]): string | null {
  const normalizedToken = token.trim().toLowerCase();
  const exactMatch = commentIds.find((commentId) => commentId.toLowerCase() === normalizedToken);
  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = commentIds.filter((commentId) => commentId.toLowerCase().startsWith(normalizedToken));
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function renderCommentContent(content: string, commentIds: string[]) {
  COMMENT_MENTION_PATTERN.lastIndex = 0;

  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COMMENT_MENTION_PATTERN.exec(content)) !== null) {
    const [rawMatch, token] = match;
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    const targetCommentId = resolveCommentMentionId(token, commentIds);
    if (targetCommentId) {
      nodes.push(
        <a
          key={`${targetCommentId}:${match.index}`}
          href={`#comment-${targetCommentId}`}
          className="comment-mention"
          title={targetCommentId}
        >
          {rawMatch}
        </a>
      );
    } else {
      nodes.push(rawMatch);
    }

    lastIndex = match.index + rawMatch.length;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

export function PostCommentsSection({
  postId,
  initialComments,
  errorMessage
}: {
  postId: string;
  initialComments: PostComment[];
  errorMessage: string | null;
}) {
  const { user, status } = useSessionSnapshot();
  const [comments, setComments] = useState(initialComments);
  const canInteract = status !== "unauthenticated" && Boolean(user?.email) && !user?.profile_setup_required;
  const commentIds = comments.map((comment) => comment.id);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleCommentCreated = (comment: CreatedCommentPayload) => {
    setComments((current) => [...current, comment]);
  };

  return (
    <>
      {errorMessage ? <p className="error">댓글 조회 실패: {errorMessage}</p> : null}

      <div className="list">
        {comments.map((comment) => (
          <article key={comment.id} id={`comment-${comment.id}`} className="card community-comment-card">
            <p className="community-comment-content">{renderCommentContent(comment.content, commentIds)}</p>
            <p className="muted community-comment-meta">
              작성자 {comment.author_nickname ?? "알 수 없음"} · {formatKstDateTime(comment.created_at)}
              {" · "}
              <a href={`#comment-${comment.id}`} className="comment-id-link" title={comment.id}>
                ID {comment.id.slice(0, 8)}
              </a>
            </p>
            {canInteract ? <ReportForm targetType="comment" targetId={comment.id} compact /> : null}
          </article>
        ))}
        {comments.length === 0 ? <p className="muted">아직 댓글이 없습니다.</p> : null}
      </div>

      {canInteract ? <CommentForm postId={postId} onCreated={handleCommentCreated} /> : null}
    </>
  );
}
