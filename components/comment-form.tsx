"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentForm({ postId }: { postId: string }) {
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
        setError(payload.error ?? "Failed to add comment");
        return;
      }

      setContent("");
      router.refresh();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid" style={{ marginTop: "1rem" }}>
      <label className="form-row">
        <span>Add comment</span>
        <textarea
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={3000}
          placeholder="Plain text only"
          required
        />
      </label>

      {error ? <p className="error">{error}</p> : null}

      <div className="actions">
        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Add Comment"}
        </button>
      </div>
    </form>
  );
}
