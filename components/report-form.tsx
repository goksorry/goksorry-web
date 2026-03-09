"use client";

import { useState } from "react";

export function ReportForm({
  targetType,
  targetId,
  compact = false
}: {
  targetType: "post" | "comment";
  targetId: string;
  compact?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "신고에 실패했습니다.");
        return;
      }

      setReason("");
      setMessage("신고되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="inline">
      {!compact ? (
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="신고 사유 (선택)"
        />
      ) : null}
      <button type="submit" className="btn-secondary" disabled={loading}>
        {loading ? "..." : "신고"}
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </form>
  );
}
