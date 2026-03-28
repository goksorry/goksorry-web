"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CommentForm, type CreatedCommentPayload } from "@/components/comment-form";
import { ReportForm } from "@/components/report-form";
import { formatKstDateTime } from "@/lib/date-time";

type PostComment = CreatedCommentPayload;

export function PostCommentsSection({
  postId,
  initialComments,
  errorMessage
}: {
  postId: string;
  initialComments: PostComment[];
  errorMessage: string | null;
}) {
  const { data: session, status } = useSession();
  const [comments, setComments] = useState(initialComments);
  const canInteract = status === "authenticated" && Boolean(session?.user?.email) && !session?.user?.profile_setup_required;

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
          <article key={comment.id} className="card">
            <p style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
            <p className="muted">
              작성자 {comment.author_nickname ?? "알 수 없음"} · {formatKstDateTime(comment.created_at)}
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
