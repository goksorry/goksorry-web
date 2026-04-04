"use client";

import { useEffect, useRef, useState } from "react";
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
  const [draftContent, setDraftContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canInteract = status !== "unauthenticated" && Boolean(user?.email) && !user?.profile_setup_required;
  const commentIds = comments.map((comment) => comment.id);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleCommentCreated = (comment: CreatedCommentPayload) => {
    setComments((current) => [...current, comment]);
  };

  const handleMentionClick = (commentId: string) => {
    const mention = `>>${commentId.slice(0, 8)} `;
    setDraftContent((current) => {
      if (!current.trim()) {
        return mention;
      }

      const separator = current.endsWith(" ") || current.endsWith("\n") ? "" : " ";
      return `${current}${separator}${mention}`;
    });
    textareaRef.current?.focus();
  };

  return (
    <>
      {errorMessage ? <p className="error">댓글 조회 실패: {errorMessage}</p> : null}

      <div className="list">
        {comments.map((comment) => (
          <article key={comment.id} id={`comment-${comment.id}`} className="card community-comment-card">
            <p className="community-comment-content">{renderCommentContent(comment.content, commentIds)}</p>
            <div className="community-comment-footer">
              <p className="muted community-comment-meta">
                작성자 {comment.author_nickname ?? "알 수 없음"} · {formatKstDateTime(comment.created_at)}
                {" · "}
                <a href={`#comment-${comment.id}`} className="comment-id-link" title={comment.id}>
                  ID {comment.id.slice(0, 8)}
                </a>
              </p>
              {canInteract ? (
                <div className="community-comment-actions">
                  <button
                    type="button"
                    className="btn-secondary comment-mention-button"
                    onClick={() => handleMentionClick(comment.id)}
                    title="이 댓글 멘션하기"
                    aria-label="이 댓글 멘션하기"
                  >
                    💬
                  </button>
                  <ReportForm targetType="comment" targetId={comment.id} compact />
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {comments.length === 0 ? <p className="muted">아직 댓글이 없습니다.</p> : null}
      </div>

      {canInteract ? (
        <CommentForm
          postId={postId}
          content={draftContent}
          onContentChange={setDraftContent}
          onCreated={handleCommentCreated}
          textareaRef={textareaRef}
        />
      ) : null}
    </>
  );
}
