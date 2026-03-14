"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function NewPostForm({
  boardSlug,
  allowPinNotice = false
}: {
  boardSlug: string;
  allowPinNotice?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinNotice, setPinNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          board_slug: boardSlug,
          title,
          content,
          pin_notice: allowPinNotice ? pinNotice : false
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "글 작성에 실패했습니다.");
        return;
      }

      setTitle("");
      setContent("");
      startTransition(() => {
        router.replace(`/community/${boardSlug}/${payload.id}`);
      });
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
          {loading ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
