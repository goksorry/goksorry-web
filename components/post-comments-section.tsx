"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CommentForm, type CreatedCommentPayload } from "@/components/comment-form";
import { ReportForm } from "@/components/report-form";
import { formatKstDateTime } from "@/lib/date-time";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

type PostComment = CreatedCommentPayload;
type CommentJumpEvent = MouseEvent<HTMLAnchorElement>;

const COMMENT_MENTION_PATTERN = />>([0-9a-f-]{8,36})(?![0-9a-f-])/gi;
const COMMENT_HASH_PREFIX = "#comment-";
const COMMENT_HIGHLIGHT_CLASS = "community-comment-card-highlighted";

function resolveCommentMentionId(token: string, commentIds: string[]): string | null {
  const normalizedToken = token.trim().toLowerCase();
  const exactMatch = commentIds.find((commentId) => commentId.toLowerCase() === normalizedToken);
  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = commentIds.filter((commentId) => commentId.toLowerCase().startsWith(normalizedToken));
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function renderCommentContent(
  content: string,
  commentIds: string[],
  onCommentJump: (event: CommentJumpEvent, commentId: string) => void
) {
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
          onClick={(event) => onCommentJump(event, targetCommentId)}
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
  const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());
  const canInteract = status !== "unauthenticated" && Boolean(user?.email) && !user?.profile_setup_required;
  const commentIds = comments.map((comment) => comment.id);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleCommentCreated = (comment: CreatedCommentPayload) => {
    setComments((current) => [...current, comment]);
  };

  const triggerCommentHighlight = (commentId: string, options?: { scroll?: boolean }) => {
    const target = document.getElementById(`comment-${commentId}`);
    if (!target) {
      return;
    }

    if (options?.scroll ?? true) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const existingTimeout = highlightTimeoutsRef.current.get(commentId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    target.classList.remove(COMMENT_HIGHLIGHT_CLASS);
    void target.getBoundingClientRect();
    target.classList.add(COMMENT_HIGHLIGHT_CLASS);

    const timeout = window.setTimeout(() => {
      target.classList.remove(COMMENT_HIGHLIGHT_CLASS);
      highlightTimeoutsRef.current.delete(commentId);
    }, 1000);

    highlightTimeoutsRef.current.set(commentId, timeout);
  };

  const navigateToComment = (commentId: string) => {
    if (window.location.hash !== `${COMMENT_HASH_PREFIX}${commentId}`) {
      window.history.pushState(null, "", `${COMMENT_HASH_PREFIX}${commentId}`);
    }

    triggerCommentHighlight(commentId);
  };

  const handleCommentJump = (event: CommentJumpEvent, commentId: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    navigateToComment(commentId);
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

  useEffect(() => {
    const highlightFromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith(COMMENT_HASH_PREFIX)) {
        return;
      }

      const commentId = decodeURIComponent(hash.slice(COMMENT_HASH_PREFIX.length));
      if (!commentId) {
        return;
      }

      window.requestAnimationFrame(() => {
        triggerCommentHighlight(commentId, { scroll: false });
      });
    };

    highlightFromHash();
    window.addEventListener("hashchange", highlightFromHash);

    return () => {
      window.removeEventListener("hashchange", highlightFromHash);
      for (const timeout of highlightTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }
      highlightTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <>
      {errorMessage ? <p className="error">댓글 조회 실패: {errorMessage}</p> : null}

      <div className="list">
        {comments.map((comment) => (
          <article key={comment.id} id={`comment-${comment.id}`} className="card community-comment-card">
            <p className="community-comment-content">
              {renderCommentContent(comment.content, commentIds, handleCommentJump)}
            </p>
            <div className="community-comment-footer">
              <p className="muted community-comment-meta">
                작성자 {comment.author_nickname ?? "알 수 없음"} · {formatKstDateTime(comment.created_at)}
                {" · "}
                <a
                  href={`#comment-${comment.id}`}
                  className="comment-id-link"
                  title={comment.id}
                  onClick={(event) => handleCommentJump(event, comment.id)}
                >
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
