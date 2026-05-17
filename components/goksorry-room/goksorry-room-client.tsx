"use client";

import { startTransition, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatKstDateTime } from "@/lib/date-time";
import {
  GOKSORRY_ROOM_ENTRY_MAX_LENGTH,
  GOKSORRY_ROOM_REPLY_MAX_LENGTH
} from "@/lib/goksorry-room-limits";
import type {
  GoksorryRoomEntryPayload as RoomEntry,
  GoksorryRoomPayload,
  GoksorryRoomReplyPayload as RoomReply
} from "@/lib/goksorry-room-types";

type RoomPayload = Partial<GoksorryRoomPayload> & {
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

type RepliesPayload = {
  replies?: RoomReply[];
  error?: string;
};

type GoksorryRoomClientProps = {
  initialPayload?: GoksorryRoomPayload | null;
  initialError?: string | null;
};

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
  }

  return payload;
};

const mergeUniqueEntries = (current: RoomEntry[], next: RoomEntry[]): RoomEntry[] => {
  const seenIds = new Set(current.map((entry) => entry.id));
  return [...current, ...next.filter((entry) => !seenIds.has(entry.id))];
};

const removeRecordKey = (record: Record<string, string>, key: string): Record<string, string> => {
  const next = { ...record };
  delete next[key];
  return next;
};

export function GoksorryRoomClient({ initialPayload, initialError = null }: GoksorryRoomClientProps) {
  const listRegionRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const hasInitialPayload = initialPayload !== undefined && initialPayload !== null;
  const [entries, setEntries] = useState<RoomEntry[]>(() => initialPayload?.entries ?? []);
  const [entryDraft, setEntryDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyEntryId, setOpenReplyEntryId] = useState<string | null>(null);
  const [loadedReplyEntryIds, setLoadedReplyEntryIds] = useState<Set<string>>(
    () =>
      new Set(
        (initialPayload?.entries ?? [])
          .filter((entry) => entry.reply_count === 0 || entry.replies.length > 0)
          .map((entry) => entry.id)
      )
  );
  const [nextCursor, setNextCursor] = useState<string | null>(() => initialPayload?.next_cursor ?? null);
  const [loading, setLoading] = useState(!hasInitialPayload);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoLoadSupported, setAutoLoadSupported] = useState(true);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [replySubmittingEntryId, setReplySubmittingEntryId] = useState<string | null>(null);
  const [replyLoadingEntryId, setReplyLoadingEntryId] = useState<string | null>(null);
  const [replyLoadErrors, setReplyLoadErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const loadEntries = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await fetchJson<RoomPayload>(`/api/goksorry-room${params.size ? `?${params}` : ""}`);
    const nextEntries = payload.entries ?? [];
    setNextCursor(payload.next_cursor ?? null);
    setEntries((current) => (cursor ? mergeUniqueEntries(current, nextEntries) : nextEntries));
  }, []);

  const loadReplies = useCallback(
    async (entryId: string) => {
      const entry = entries.find((currentEntry) => currentEntry.id === entryId);
      if (!entry || entry.reply_count <= entry.replies.length || loadedReplyEntryIds.has(entryId)) {
        return;
      }

      setReplyLoadingEntryId(entryId);
      setReplyLoadErrors((current) => removeRecordKey(current, entryId));
      try {
        const payload = await fetchJson<RepliesPayload>(
          `/api/goksorry-room/replies?entry_id=${encodeURIComponent(entryId)}`
        );
        const replies = payload.replies ?? [];
        setEntries((current) =>
          current.map((currentEntry) => (currentEntry.id === entryId ? { ...currentEntry, replies } : currentEntry))
        );
        setLoadedReplyEntryIds((current) => new Set(current).add(entryId));
      } catch (loadError) {
        setReplyLoadErrors((current) => ({
          ...current,
          [entryId]: loadError instanceof Error ? loadError.message : "덧글을 불러오지 못했습니다."
        }));
      } finally {
        setReplyLoadingEntryId((current) => (current === entryId ? null : current));
      }
    },
    [entries, loadedReplyEntryIds]
  );

  const toggleReply = (entry: RoomEntry) => {
    const nextOpen = openReplyEntryId === entry.id ? null : entry.id;
    setOpenReplyEntryId(nextOpen);
    if (nextOpen) {
      void loadReplies(entry.id);
    }
  };

  const loadMore = useCallback(
    async (options?: { retry?: boolean }) => {
      if (!nextCursor || loading || loadingMore || loadingMoreRef.current) {
        return;
      }

      if (loadMoreError && !options?.retry) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);
      setLoadMoreError(null);
      try {
        await loadEntries(nextCursor);
      } catch (loadError) {
        setLoadMoreError(loadError instanceof Error ? loadError.message : "더 불러오지 못했습니다.");
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [loadEntries, loadMoreError, loading, loadingMore, nextCursor]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setAutoLoadSupported(false);
      return;
    }

    setAutoLoadSupported(true);
    const root = listRegionRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !nextCursor || loading || loadingMore || loadMoreError) {
      return;
    }

    const observer = new IntersectionObserver(
      (observedEntries) => {
        if (observedEntries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        root,
        rootMargin: "160px 0px",
        threshold: 0
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, loadMoreError, loading, loadingMore, nextCursor]);

  useEffect(() => {
    if (hasInitialPayload) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setLoadMoreError(null);
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
  }, [hasInitialPayload]);

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
          setEntries((current) => [payload.entry as RoomEntry, ...current.filter((entry) => entry.id !== payload.entry?.id)]);
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
        setOpenReplyEntryId(entryId);
        setReplyLoadErrors((current) => removeRecordKey(current, entryId));
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

  return (
    <section className="goksorry-room-shell">
      <form className="goksorry-room-entry-form" onSubmit={submitEntry}>
        <label className="goksorry-room-input-label">
          <span className="sr-only">한줄 의견</span>
          <input
            type="text"
            value={entryDraft}
            onChange={(event) => setEntryDraft(event.target.value)}
            maxLength={GOKSORRY_ROOM_ENTRY_MAX_LENGTH}
            placeholder="짧게 남기기"
            required
          />
        </label>
        <span className="muted goksorry-room-count">
          {entryDraft.length}/{GOKSORRY_ROOM_ENTRY_MAX_LENGTH}
        </span>
        <button type="submit" disabled={entrySubmitting || !entryDraft.trim()}>
          {entrySubmitting ? "등록 중..." : "등록"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      <div className="goksorry-room-list-region" ref={listRegionRef} aria-label="글 목록" tabIndex={0}>
        {loading ? <p className="muted goksorry-room-list-status">곡소리방을 불러오는 중입니다.</p> : null}

        <div className="goksorry-room-list">
          {entries.map((entry) => {
            const replyDraft = replyDrafts[entry.id] ?? "";
            const replyOpen = openReplyEntryId === entry.id;
            const replyLoadError = replyLoadErrors[entry.id];

            return (
              <article key={entry.id} className="goksorry-room-entry">
                <div className="goksorry-room-entry-main">
                  <p title={entry.content}>{entry.content}</p>
                  <div className="goksorry-room-meta">
                    <span>{entry.author_label}</span>
                    <time dateTime={entry.created_at}>{formatKstDateTime(entry.created_at)}</time>
                  </div>
                </div>

                <div className="goksorry-room-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => toggleReply(entry)}
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

                {replyOpen ? (
                  <>
                    {replyLoadingEntryId === entry.id ? (
                      <p className="muted goksorry-room-list-status" role="status">
                        덧글을 불러오는 중...
                      </p>
                    ) : null}

                    {replyLoadError ? (
                      <div className="goksorry-room-list-status" role="status">
                        <p className="error">{replyLoadError}</p>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={replyLoadingEntryId === entry.id}
                          onClick={() => loadReplies(entry.id)}
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : null}

                    {entry.replies.length > 0 ? (
                      <div className="goksorry-room-replies">
                        {entry.replies.map((reply) => (
                          <div key={reply.id} className="goksorry-room-reply">
                            <p title={reply.content}>{reply.content}</p>
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

                    <form
                      className="goksorry-room-reply-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitReply(entry.id);
                      }}
                    >
                      <label className="goksorry-room-input-label">
                        <span className="sr-only">덧글</span>
                        <input
                          type="text"
                          value={replyDraft}
                          onChange={(event) =>
                            setReplyDrafts((current) => ({
                              ...current,
                              [entry.id]: event.target.value
                            }))
                          }
                          maxLength={GOKSORRY_ROOM_REPLY_MAX_LENGTH}
                          placeholder="덧글"
                          required
                        />
                      </label>
                      <span className="muted goksorry-room-count">
                        {replyDraft.length}/{GOKSORRY_ROOM_REPLY_MAX_LENGTH}
                      </span>
                      <button type="submit" disabled={replySubmittingEntryId === entry.id || !replyDraft.trim()}>
                        {replySubmittingEntryId === entry.id ? "등록 중..." : "등록"}
                      </button>
                    </form>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>

        {!loading && !error && entries.length === 0 ? (
          <p className="muted goksorry-room-list-status">아직 남겨진 의견이 없습니다.</p>
        ) : null}

        {loadMoreError ? (
          <div className="goksorry-room-list-status" role="status">
            <p className="error">{loadMoreError}</p>
            <button type="button" className="btn-secondary" disabled={loadingMore} onClick={() => loadMore({ retry: true })}>
              다시 시도
            </button>
          </div>
        ) : null}

        {loadingMore ? (
          <p className="muted goksorry-room-list-status" role="status">
            불러오는 중...
          </p>
        ) : null}

        <div className="goksorry-room-list-sentinel" ref={sentinelRef} aria-hidden="true" />

        {nextCursor && !loadMoreError && !autoLoadSupported ? (
          <div className="actions goksorry-room-list-status">
            <button type="button" className="btn-secondary" disabled={loadingMore} onClick={() => loadMore({ retry: true })}>
              {loadingMore ? "불러오는 중..." : "더 보기"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
