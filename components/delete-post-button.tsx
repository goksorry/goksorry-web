"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePostButton({ postId, boardSlug }: { postId: string; boardSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    const confirmed = window.confirm("이 글을 삭제 처리할까요? 작성자 또는 관리자만 가능합니다.");
    if (!confirmed) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/community/posts/${postId}/delete`, {
        method: "POST"
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "삭제에 실패했습니다.");
        return;
      }

      router.push(`/community/${boardSlug}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline">
      <button type="button" className="btn-danger" onClick={onDelete} disabled={loading}>
        {loading ? "삭제 중..." : "글 삭제"}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
