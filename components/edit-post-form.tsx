"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditPostForm({
  postId,
  boardSlug,
  initialTitle,
  initialContent,
  allowPinNotice = false,
  initialPinNotice = false
}: {
  postId: string;
  boardSlug: string;
  initialTitle: string;
  initialContent: string;
  allowPinNotice?: boolean;
  initialPinNotice?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [pinNotice, setPinNotice] = useState(initialPinNotice);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          content,
          pin_notice: allowPinNotice ? pinNotice : false
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "글 수정에 실패했습니다.");
        return;
      }

      router.push(`/community/${boardSlug}/${postId}`);
      router.refresh();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid">
      <label className="form-row">
        <span>제목</span>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="평문 제목을 입력하세요"
          required
        />
      </label>

      <label className="form-row">
        <span>내용</span>
        <textarea
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          placeholder="평문 내용을 입력하세요"
          required
        />
      </label>

      {allowPinNotice ? (
        <label className="form-row-checkbox">
          <input
            type="checkbox"
            checked={pinNotice}
            onChange={(event) => setPinNotice(event.target.checked)}
          />
          <span>공지에 걸기</span>
        </label>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="actions">
        <button type="submit" disabled={loading}>
          {loading ? "수정 중..." : "수정 저장"}
        </button>
      </div>
    </form>
  );
}
