"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { formatKstDateTime } from "@/lib/date-time";

const ENTRY_MAX_LENGTH = 160;
const REPLY_MAX_LENGTH = 300;

type RoomReply = {
  id: string;
  entry_id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  can_delete: boolean;
};

type RoomEntry = {
  id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  reply_count: number;
  can_delete: boolean;
  replies: RoomReply[];
};

type RoomPayload = {
  entries?: RoomEntry[];
  next_cursor?: string | null;
  error?: string;
};

type EntryPayload = {
  entry?: RoomEntry;
  error?: string;
};

type ReplyPayload = {
  reply?: RoomReply;
  error?: string;
};

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
  }

  return payload;
};

export function GoksorryRoomClient() {
  const [entries, setEntries] = useState<RoomEntry[]>([]);
  const [entryDraft, setEntryDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyEntryId, setOpenReplyEntryId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [replySubmittingEntryId, setReplySubmittingEntryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = async (cursor?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await fetchJson<RoomPayload>(`/api/goksorry-room${params.size ? `?${params}` : ""}`);
    const nextEntries = payload.entries ?? [];
    setNextCursor(payload.next_cursor ?? null);
    setEntries((current) => (cursor ? [...current, ...nextEntries] : nextEntries));
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchJson<RoomPayload>("/api/goksorry-room");
        if (cancelled) {
          return;
        }

        setEntries(payload.entries ?? []);
        setNextCursor(payload.next_cursor ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "곡소리방을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = entryDraft.trim();
    if (!content) {
      return;
    }

    setEntrySubmitting(true);
    setError(null);
    try {
      const payload = await fetchJson<EntryPayload>("/api/goksorry-room/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content })
      });

      if (payload.entry) {
        setEntryDraft("");
        startTransition(() => {
          setEntries((current) => [payload.entry as RoomEntry, ...current]);
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "의견을 저장하지 못했습니다.");
    } finally {
      setEntrySubmitting(false);
    }
  };

  const submitReply = async (entryId: string) => {
    const content = (replyDrafts[entryId] ?? "").trim();
    if (!content) {
      return;
    }

    setReplySubmittingEntryId(entryId);
    setError(null);
    try {
      const payload = await fetchJson<ReplyPayload>("/api/goksorry-room/replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entry_id: entryId,
          content
        })
      });

      if (payload.reply) {
        setReplyDrafts((current) => ({ ...current, [entryId]: "" }));
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  reply_count: entry.reply_count + 1,
                  replies: [...entry.replies, payload.reply as RoomReply]
                }
              : entry
          )
        );
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "덧글을 저장하지 못했습니다.");
    } finally {
      setReplySubmittingEntryId(null);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setDeletingId(`entry:${entryId}`);
    setError(null);
    try {
      await fetchJson(`/api/goksorry-room/entries/${entryId}/delete`, { method: "POST" });
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "의견을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteReply = async (entryId: string, replyId: string) => {
    setDeletingId(`reply:${replyId}`);
    setError(null);
    try {
      await fetchJson(`/api/goksorry-room/replies/${replyId}/delete`, { method: "POST" });
      setEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                reply_count: Math.max(0, entry.reply_count - 1),
                replies: entry.replies.filter((reply) => reply.id !== replyId)
              }
            : entry
        )
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "덧글을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    try {
      await loadEntries(nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="goksorry-room-shell">
      <form className="goksorry-room-entry-form" onSubmit={submitEntry}>
        <label className="form-row">
          <span>한줄 의견</span>
          <textarea
            value={entryDraft}
            onChange={(event) => setEntryDraft(event.target.value)}
            maxLength={ENTRY_MAX_LENGTH}
            rows={2}
            placeholder="지금 시장에 대한 한두 줄 의견을 남겨보세요."
            required
          />
        </label>
        <div className="goksorry-room-form-footer">
          <span className="muted">
            {entryDraft.length}/{ENTRY_MAX_LENGTH}
          </span>
          <button type="submit" disabled={entrySubmitting || !entryDraft.trim()}>
            {entrySubmitting ? "등록 중..." : "남기기"}
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">곡소리방을 불러오는 중입니다.</p> : null}

      <div className="goksorry-room-list">
        {entries.map((entry) => {
          const replyDraft = replyDrafts[entry.id] ?? "";
          const replyOpen = openReplyEntryId === entry.id;

          return (
            <article key={entry.id} className="goksorry-room-entry">
              <div className="goksorry-room-entry-main">
                <p>{entry.content}</p>
                <div className="goksorry-room-meta">
                  <span>{entry.author_label}</span>
                  <time dateTime={entry.created_at}>{formatKstDateTime(entry.created_at)}</time>
                </div>
              </div>

              <div className="goksorry-room-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setOpenReplyEntryId(replyOpen ? null : entry.id)}
                >
                  덧글 {entry.reply_count}
                </button>
                {entry.can_delete ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={deletingId === `entry:${entry.id}`}
                    onClick={() => deleteEntry(entry.id)}
                  >
                    삭제
                  </button>
                ) : null}
              </div>

              {entry.replies.length > 0 ? (
                <div className="goksorry-room-replies">
                  {entry.replies.map((reply) => (
                    <div key={reply.id} className="goksorry-room-reply">
                      <p>{reply.content}</p>
                      <div className="goksorry-room-meta">
                        <span>{reply.author_label}</span>
                        <time dateTime={reply.created_at}>{formatKstDateTime(reply.created_at)}</time>
                        {reply.can_delete ? (
                          <button
                            type="button"
                            className="site-footer-link-button goksorry-room-inline-delete"
                            disabled={deletingId === `reply:${reply.id}`}
                            onClick={() => deleteReply(entry.id, reply.id)}
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {replyOpen ? (
                <form
                  className="goksorry-room-reply-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitReply(entry.id);
                  }}
                >
                  <label className="form-row">
                    <span>덧글</span>
                    <textarea
                      value={replyDraft}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [entry.id]: event.target.value
                        }))
                      }
                      maxLength={REPLY_MAX_LENGTH}
                      rows={2}
                      placeholder="덧글을 남겨보세요."
                      required
                    />
                  </label>
                  <div className="goksorry-room-form-footer">
                    <span className="muted">
                      {replyDraft.length}/{REPLY_MAX_LENGTH}
                    </span>
                    <button type="submit" disabled={replySubmittingEntryId === entry.id || !replyDraft.trim()}>
                      {replySubmittingEntryId === entry.id ? "등록 중..." : "덧글 등록"}
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>

      {!loading && entries.length === 0 ? <p className="muted">아직 남겨진 의견이 없습니다.</p> : null}

      {nextCursor ? (
        <div className="actions">
          <button type="button" className="btn-secondary" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
