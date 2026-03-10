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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async () => {
    const reason = window.prompt("신고 사유를 10자 이상 입력하세요.");
    if (reason === null) {
      return;
    }

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10) {
      setMessage("신고 사유는 10자 이상 입력해야 합니다.");
      return;
    }

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
          reason: normalizedReason
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "신고에 실패했습니다.");
        return;
      }

      setMessage("신고되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline">
      <button type="button" className="btn-secondary" onClick={() => void onSubmit()} disabled={loading}>
        {loading ? "..." : compact ? "신고" : "신고하기"}
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </div>
  );
}
