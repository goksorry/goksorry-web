"use client";
import { CommunitySourceLinks } from "@/components/community-source-links";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import { serializeSourceGroupSelection } from "@/lib/feed-source-groups";
import type { FeedPage } from "@/lib/feed-scope";
import { FeedFilterControls } from "@/components/feed-filter-controls";
import { FeedSelectionProvider, useFeedSelection } from "@/components/feed-selection-provider";
import { SentimentFeed } from "@/components/sentiment-feed";
import type { FeedRow } from "@/lib/feed-data";

type FeedApiPayload = {
  rows: FeedRow[];
  summary?: FeedPage["summary"];
  stocks?: FeedPage["stocks"];
  generated_at?: string;
  nextOffset: number | null;
  hasMore: boolean;
  errorMessage: string;
};

const DEFAULT_FEED_ERROR = "피드 데이터를 준비하지 못했습니다.";

const normalizeFeedPayload = (payload: Partial<FeedApiPayload> | null): FeedApiPayload => ({
  summary: payload?.summary,
  stocks: payload?.stocks,
  generated_at: payload?.generated_at,
  rows: Array.isArray(payload?.rows) ? payload.rows : [],
  nextOffset: typeof payload?.nextOffset === "number" ? payload.nextOffset : null,
  hasMore: Boolean(payload?.hasMore),
  errorMessage: typeof payload?.errorMessage === "string" ? payload.errorMessage : ""
});

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

type Props = {
  timezone: string;
  selectedGroupIds: SourceGroupId[];
  windowHours: number;
  initialLimit: number;
  scope?: { symbol?: string; community?: SourceGroupId };
  embedded?: boolean;
  scopeControl?: ReactNode;
  /** Extra control at the right end of the 좌우 보기/통합 보기 row (embedded: the 예쁜말 toggle). */
  viewControlsEnd?: ReactNode;
  onSummary?: (summary: FeedPage["summary"] | undefined, error: string, loading: boolean, stocks: FeedPage["stocks"] | undefined) => void;
};

export function HomeFeedShell(props: Props) {
  return <FeedSelectionProvider initialGroupIds={props.scope?.community ? [props.scope.community] : props.selectedGroupIds}>
    <ScopedFeed {...props} />
  </FeedSelectionProvider>;
}

function ScopedFeed({ timezone, selectedGroupIds, windowHours, initialLimit, scope, embedded = false, scopeControl, viewControlsEnd, onSummary }: Props) {
  const { activeGroupIds } = useFeedSelection();
  const channels = serializeSourceGroupSelection(activeGroupIds);
  const symbol = scope?.symbol ?? "";
  const asOfRef = useRef("");
  const [sentiment, setSentiment] = useState<"all" | "bearish" | "bullish" | "neutral">("all");
  const [summary, setSummary] = useState<FeedPage["summary"]>();
  const [stocks, setStocks] = useState<FeedPage["stocks"]>();
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const loadFeedPage = useCallback(
    async (offset: number, signal?: AbortSignal, asOf = asOfRef.current): Promise<FeedApiPayload> => {
      const params = new URLSearchParams({
        hours: String(windowHours),
        limit: String(initialLimit),
        offset: String(offset),
        channels, symbol, asOf, sentiment
      });
      const response = await fetch(`/api/feed?${params.toString()}`, {
        cache: "no-store",
        signal
      });
      const payload = normalizeFeedPayload((await response.json().catch(() => null)) as Partial<FeedApiPayload> | null);
      if (!response.ok || payload.errorMessage) {
        throw new Error(payload.errorMessage || DEFAULT_FEED_ERROR);
      }
      return payload;
    },
    [initialLimit, windowHours, channels, symbol, sentiment]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    loadMoreControllerRef.current?.abort();
    setRows([]);
    setSummary(undefined);
    asOfRef.current = "";
    setLoadingMore(false);
    setRefreshing(false);
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
        setSummary(payload.summary);
        setStocks(payload.stocks);
        asOfRef.current = payload.generated_at ?? "";
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

  // Refresh the loaded range atomically. A failed page retains the last good list and timestamp.
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden || loadingInitial || loadMoreControllerRef.current || refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      try {
        const first = await loadFeedPage(0, controller.signal, "");
        let last = first;
        const fresh = [...first.rows];
        while (last.hasMore && last.nextOffset !== null && fresh.length < rowsRef.current.length) {
          last = await loadFeedPage(last.nextOffset, controller.signal, first.generated_at ?? "");
          fresh.push(...last.rows);
        }
        if (controller.signal.aborted) return;
        setRows([...new Map(fresh.map(row => [row.post_key, row])).values()]);
        setSummary(first.summary);
        setStocks(first.stocks);
        asOfRef.current = first.generated_at ?? "";
        setHasMore(last.hasMore); setNextOffset(last.nextOffset);
        setErrorMessage(""); setLoadMoreError("");
      } catch (error) {
        if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : DEFAULT_FEED_ERROR);
      } finally { refreshingRef.current = false; if (!controller.signal.aborted) setRefreshing(false); }
    };
    const timer = setInterval(() => void refresh(), 60_000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [loadFeedPage, loadingInitial]);

  useEffect(() => {
    return () => {
      loadMoreControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => { onSummary?.(summary, errorMessage, loadingInitial, stocks); }, [summary, errorMessage, loadingInitial, stocks, onSummary]);

  const onRetryInitial = () => {
    setReloadKey((current) => current + 1);
  };

  const onLoadMore = async () => {
    if (nextOffset === null || loadingMore || loadingInitial || refreshingRef.current) {
      return;
    }

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadMoreError("");
    setLoadingMore(true);

    try {
      const payload = await loadFeedPage(nextOffset, controller.signal);
      if (controller.signal.aborted) return;
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
    <>
      <section id="feed-top" aria-busy={refreshing} className={`panel feed-filter-panel scroll-anchor${embedded ? " feed-embedded-controls" : ""}`}>
        {!embedded && <><h1>커뮤니티 분위기</h1><p className="muted">최근 {windowHours}시간 분위기 집계. AI 분류에는 오류가 있을 수 있습니다.</p></>}
        {embedded ? <div className="feed-scope-controls">{scopeControl}<FeedFilterControls selectedGroupIds={selectedGroupIds} variant="grid" /></div>
          : !scope && <FeedFilterControls selectedGroupIds={selectedGroupIds} />}
      </section>
      {!embedded && summary && <p className="feed-scope-summary">최근 {windowHours}시간 · 표본 {summary.total}건 · 희망 {summary.bullish}건 · 공포 {summary.bearish}건 · 중립 {summary.neutral}건{summary.data_at && <> · <time dateTime={summary.data_at}>{new Date(summary.data_at).toLocaleString("ko-KR", { timeZone: timezone })} 기준</time></>}</p>}
      {rows.length > 0 && <SentimentFeed compact={embedded} sentiment={sentiment} onSentimentChange={setSentiment} summary={summary} rows={rows} errorMessage={errorMessage} timezone={timezone} loading={loadingInitial} />}
      <CommunitySourceLinks groups={activeGroupIds} />

      <div className="feed-pagination" aria-live="polite">
        {loadMoreError ? <p className="error">추가 피드를 불러오지 못했습니다: {loadMoreError}</p> : null}
        {errorMessage && rows.length === 0 && !loadingInitial ? (
          <button type="button" className="btn btn-secondary" onClick={onRetryInitial}>
            다시 시도
          </button>
        ) : null}
        {hasMore && !errorMessage ? (
          <button type="button" className="btn" onClick={() => void onLoadMore()} disabled={loadingMore || loadingInitial || refreshing}>
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        ) : null}
        {!loadingInitial && !errorMessage && rows.length > 0 && !hasMore ? (
          <p className="muted">최근 {windowHours}시간 피드를 모두 불러왔습니다.</p>
        ) : null}
      </div>
    </>
  );
}
