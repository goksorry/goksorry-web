"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export function DeletePostButton({ postId, boardSlug }: { postId: string; boardSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    const confirmed = window.confirm("Soft delete this post? (author/admin only)");
    if (!confirmed) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Login required");
        return;
      }

      const response = await fetch(`/api/community/posts/${postId}/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Delete failed");
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
        {loading ? "Deleting..." : "Delete post"}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
