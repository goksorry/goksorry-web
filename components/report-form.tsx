"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

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
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setMessage("Login required");
        return;
      }

      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Report failed");
        return;
      }

      setReason("");
      setMessage("Reported");
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
          placeholder="reason (optional)"
        />
      ) : null}
      <button type="submit" className="btn-secondary" disabled={loading}>
        {loading ? "..." : "Report"}
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </form>
  );
}
