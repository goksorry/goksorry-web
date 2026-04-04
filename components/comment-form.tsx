"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export type CreatedCommentPayload = {
  id: string;
  content: string;
  created_at: string;
  author_nickname: string | null;
};

export function CommentForm({
  postId,
  onCreated
}: {
  postId: string;
  onCreated?: (comment: CreatedCommentPayload) => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          post_id: postId,
          content
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "댓글 등록에 실패했습니다.");
        return;
      }

      setContent("");
      if (payload.comment?.id && payload.comment?.content && payload.comment?.created_at) {
        onCreated?.({
          id: String(payload.comment.id),
          content: String(payload.comment.content),
          created_at: String(payload.comment.created_at),
          author_nickname:
            typeof payload.comment.author_nickname === "string" ? payload.comment.author_nickname : null
        });
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid" style={{ marginTop: "1rem" }}>
      <label className="form-row">
        <span>댓글 작성</span>
        <textarea
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={3000}
          placeholder="평문만 입력할 수 있습니다"
          required
        />
      </label>
      <p className="muted" style={{ margin: "-0.15rem 0 0" }}>
        같은 글의 댓글을 언급하려면 <code>&gt;&gt;댓글ID</code>를 입력하세요. 각 댓글 아래의{" "}
        <code>ID 1234abcd</code> 값을 쓰면 됩니다.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <div className="actions">
        <button type="submit" disabled={loading}>
          {loading ? "등록 중..." : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}
