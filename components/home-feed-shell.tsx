"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import { FeedFilterControls } from "@/components/feed-filter-controls";
import { FeedSelectionProvider } from "@/components/feed-selection-provider";
import { SentimentFeed } from "@/components/sentiment-feed";
import type { FeedRow } from "@/lib/feed-data";

type FeedApiPayload = {
  rows: FeedRow[];
  nextOffset: number | null;
  hasMore: boolean;
  errorMessage: string;
};

const DEFAULT_FEED_ERROR = "피드 데이터를 준비하지 못했습니다.";

const normalizeFeedPayload = (payload: Partial<FeedApiPayload> | null): FeedApiPayload => ({
  rows: Array.isArray(payload?.rows) ? payload.rows : [],
  nextOffset: typeof payload?.nextOffset === "number" ? payload.nextOffset : null,
  hasMore: Boolean(payload?.hasMore),
  errorMessage: typeof payload?.errorMessage === "string" ? payload.errorMessage : ""
});

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

export function HomeFeedShell({
  timezone,
  selectedGroupIds,
  windowHours,
  initialLimit
}: {
  timezone: string;
  selectedGroupIds: SourceGroupId[];
  windowHours: number;
  initialLimit: number;
}) {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const loadFeedPage = useCallback(
    async (offset: number, signal?: AbortSignal): Promise<FeedApiPayload> => {
      const params = new URLSearchParams({
        hours: String(windowHours),
        limit: String(initialLimit),
        offset: String(offset)
      });
      const response = await fetch(`/api/feed?${params.toString()}`, {
        cache: "default",
        signal
      });
      const payload = normalizeFeedPayload((await response.json().catch(() => null)) as Partial<FeedApiPayload> | null);
      if (!response.ok) {
        throw new Error(payload.errorMessage || DEFAULT_FEED_ERROR);
      }
      return payload;
    },
    [initialLimit, windowHours]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    loadMoreControllerRef.current?.abort();
    setRows([]);
    setErrorMessage("");
    setLoadMoreError("");
    setHasMore(false);
    setNextOffset(null);
    setLoadingInitial(true);

    void loadFeedPage(0, controller.signal)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.rows);
        setErrorMessage(payload.errorMessage);
        setHasMore(payload.hasMore && !payload.errorMessage);
        setNextOffset(payload.nextOffset);
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) {
          return;
        }

        setErrorMessage(error instanceof Error && error.message ? error.message : DEFAULT_FEED_ERROR);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadFeedPage, reloadKey]);

  useEffect(() => {
    return () => {
      loadMoreControllerRef.current?.abort();
    };
  }, []);

  const onRetryInitial = () => {
    setReloadKey((current) => current + 1);
  };

  const onLoadMore = async () => {
    if (nextOffset === null || loadingMore || loadingInitial) {
      return;
    }

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadMoreError("");
    setLoadingMore(true);

    try {
      const payload = await loadFeedPage(nextOffset, controller.signal);
      if (payload.errorMessage) {
        setLoadMoreError(payload.errorMessage);
        return;
      }

      setRows((currentRows) => {
        const existingPostKeys = new Set(currentRows.map((row) => row.post_key));
        return [...currentRows, ...payload.rows.filter((row) => !existingPostKeys.has(row.post_key))];
      });
      setHasMore(payload.hasMore);
      setNextOffset(payload.nextOffset);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setLoadMoreError(error instanceof Error && error.message ? error.message : DEFAULT_FEED_ERROR);
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  return (
    <FeedSelectionProvider initialGroupIds={selectedGroupIds}>
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor">
        <h1>외부 감성 피드</h1>
        <p className="muted">
          외부 커뮤니티에서 최근 6시간 동안 감지한 글 중 공포와 희망 흐름만 분리해서 보여줍니다. 중립 글은 기본적으로 숨깁니다. 글
          분류는 AI가 제목과 공개된 범위의 정보만 바탕으로 추정해 진행하므로, 일부 글은 잘못 분류될 수 있습니다.
        </p>
        <FeedFilterControls selectedGroupIds={selectedGroupIds} />
      </section>

      <SentimentFeed rows={rows} errorMessage={errorMessage} timezone={timezone} loading={loadingInitial} />

      <div className="feed-pagination" aria-live="polite">
        {loadMoreError ? <p className="error">추가 피드를 불러오지 못했습니다: {loadMoreError}</p> : null}
        {errorMessage && rows.length === 0 && !loadingInitial ? (
          <button type="button" className="btn btn-secondary" onClick={onRetryInitial}>
            다시 시도
          </button>
        ) : null}
        {hasMore && !errorMessage ? (
          <button type="button" className="btn" onClick={() => void onLoadMore()} disabled={loadingMore || loadingInitial}>
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        ) : null}
        {!loadingInitial && !errorMessage && rows.length > 0 && !hasMore ? (
          <p className="muted">최근 {windowHours}시간 피드를 모두 불러왔습니다.</p>
        ) : null}
      </div>
    </FeedSelectionProvider>
  );
}
