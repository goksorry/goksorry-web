"use client";

import { MobileSentimentSwipeHint } from "@/components/mobile-sentiment-swipe-hint";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useFeedSelection } from "@/components/feed-selection-provider";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { filterRowsBySourceGroups, type FeedRow } from "@/lib/feed-data";
import { SENTIMENT_DISPLAY } from "@/lib/sentiment-display";
import { useEffect, useRef, useState } from "react";

type SymbolBadge = {
  name: string;
  count: number;
};

const getFeedSourceLabel = (source: string): string => {
  if (source === "dc_stock") {
    return "디시 주갤";
  }
  if (source === "dc_krstock") {
    return "디시 국장갤";
  }
  if (source === "dc_usstock") {
    return "디시 미장갤";
  }
  if (source === "dc_tenbagger") {
    return "디시 해주갤";
  }
  if (source.startsWith("toss_lounge_")) {
    return "토스증권 라운지";
  }
  if (source.startsWith("toss_stock_community_")) {
    return "토스증권 종목토론";
  }
  if (source === "ppomppu_stock") {
    return "뽐뿌 증권포럼";
  }
  if (source === "blind_stock_invest") {
    return "블라인드";
  }
  return source;
};

const toLocalTime = (iso: string, timezone: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(date);
};

const buildSymbolBadges = (rows: FeedRow[]) => {
  const symbolCounts = rows.reduce((acc, row) => {
    if (!row.symbol_name) {
      return acc;
    }

    const nextCount = (acc.get(row.symbol_name) ?? 0) + 1;
    acc.set(row.symbol_name, nextCount);
    return acc;
  }, new Map<string, number>());

  return [...symbolCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"))
    .map(([name, count]) => ({
      name,
      count
    }));
};

function SymbolBadgeList({ badges, ariaLabel }: { badges: SymbolBadge[]; ariaLabel: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    const updateOverflow = () => {
      setHasOverflow(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    };

    updateOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => {
        window.removeEventListener("resize", updateOverflow);
      };
    }

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    for (const child of Array.from(element.children)) {
      observer.observe(child);
    }

    return () => {
      observer.disconnect();
    };
  }, [badges]);

  return (
    <div ref={listRef} className={`feed-symbol-badges${hasOverflow ? " feed-symbol-badges-overflow" : ""}`} aria-label={ariaLabel}>
      {badges.map((badge) => (
        <span key={badge.name} className="feed-symbol-badge">
          {badge.name}
          {badge.count > 1 ? <span className="feed-symbol-badge-count">x{badge.count}</span> : null}
        </span>
      ))}
    </div>
  );
}

function SentimentTitleLink({
  row,
  showPrettyTitle
}: {
  row: FeedRow;
  showPrettyTitle: boolean;
}) {
  const displayTitle = resolveDisplayTitle({
    title: row.title,
    cleanTitle: row.clean_title,
    cleanFilterEnabled: showPrettyTitle
  });

  return (
    <a
      className={`sentiment-title${displayTitle.usedFallbackFilter ? " sentiment-title-fallback" : ""}`}
      href={row.url}
      target="_blank"
      rel="noreferrer"
    >
      {displayTitle.text}
    </a>
  );
}

function FeedSkeletonRows({ tone }: { tone: "fear" | "hope" }) {
  return (
    <div className="feed-skeleton-list" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <article key={`${tone}-${index}`} className={`sentiment-card sentiment-card-${tone} feed-skeleton-card`}>
          <div className="sentiment-card-head">
            <div className="sentiment-card-head-tags">
              <span className="feed-skeleton-pill feed-skeleton-pill-source" />
              <span className="feed-skeleton-pill feed-skeleton-pill-symbol" />
            </div>
            <span className="feed-skeleton-pill feed-skeleton-pill-time" />
          </div>
          <div className="sentiment-card-body">
            <span className="feed-skeleton-title" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function SentimentFeed({
  rows,
  errorMessage,
  timezone,
  loading = false
}: {
  rows: FeedRow[];
  errorMessage: string;
  timezone: string;
  loading?: boolean;
}) {
  const { cleanFilterEnabled } = useCleanFilter();
  const { activeGroupIds } = useFeedSelection();
  const filteredRows = filterRowsBySourceGroups(rows, activeGroupIds);
  const actionableRows = filteredRows.filter((row) => row.label !== "neutral");
  const fearRows = actionableRows.filter((row) => row.label === "bearish");
  const hopeRows = actionableRows.filter((row) => row.label === "bullish");
  const fearSymbolBadges = buildSymbolBadges(fearRows);
  const hopeSymbolBadges = buildSymbolBadges(hopeRows);
  const [supportsHoverReveal, setSupportsHoverReveal] = useState(false);
  const [hoverRevealRowKey, setHoverRevealRowKey] = useState<string | null>(null);
  const [mobileRevealRowKeys, setMobileRevealRowKeys] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncSupportsHoverReveal = () => {
      setSupportsHoverReveal(mediaQuery.matches);
    };

    syncSupportsHoverReveal();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncSupportsHoverReveal);
      return () => {
        mediaQuery.removeEventListener("change", syncSupportsHoverReveal);
      };
    }

    mediaQuery.addListener(syncSupportsHoverReveal);
    return () => {
      mediaQuery.removeListener(syncSupportsHoverReveal);
    };
  }, []);

  useEffect(() => {
    if (cleanFilterEnabled) {
      return;
    }

    setHoverRevealRowKey(null);
    setMobileRevealRowKeys([]);
  }, [cleanFilterEnabled]);

  const toggleMobileRevealRow = (postKey: string) => {
    setMobileRevealRowKeys((current) => {
      if (current.includes(postKey)) {
        return current.filter((item) => item !== postKey);
      }

      return [...current, postKey];
    });
  };

  const renderRow = (row: FeedRow, tone: "fear" | "hope") => {
    const isRowRevealActive = cleanFilterEnabled
      ? supportsHoverReveal
        ? hoverRevealRowKey === row.post_key
        : mobileRevealRowKeys.includes(row.post_key)
      : false;
    const showPrettyTitle = cleanFilterEnabled && !isRowRevealActive;

    return (
      <article key={row.post_key} className={`sentiment-card sentiment-card-${tone}`}>
        <div className="sentiment-card-head">
          <div className="sentiment-card-head-tags">
            <span className="tag sentiment-card-tag">{getFeedSourceLabel(row.source)}</span>
            {row.symbol_name ? <span className="tag tag-symbol sentiment-card-tag">{row.symbol_name}</span> : null}
          </div>
          <div className="sentiment-card-head-meta">
            {cleanFilterEnabled ? (
              <button
                type="button"
                className={`sentiment-clean-toggle${!supportsHoverReveal && isRowRevealActive ? " sentiment-clean-toggle-active" : ""}`}
                aria-pressed={!supportsHoverReveal ? isRowRevealActive : undefined}
                title={supportsHoverReveal ? "마우스를 올리면 원문 보기" : isRowRevealActive ? "이 글만 예쁜말 적용" : "이 글만 원문 보기"}
                onMouseEnter={
                  supportsHoverReveal
                    ? () => {
                        setHoverRevealRowKey(row.post_key);
                      }
                    : undefined
                }
                onMouseLeave={
                  supportsHoverReveal
                    ? () => {
                        setHoverRevealRowKey((current) => (current === row.post_key ? null : current));
                      }
                    : undefined
                }
                onFocus={
                  supportsHoverReveal
                    ? () => {
                        setHoverRevealRowKey(row.post_key);
                      }
                    : undefined
                }
                onBlur={
                  supportsHoverReveal
                    ? () => {
                        setHoverRevealRowKey((current) => (current === row.post_key ? null : current));
                      }
                    : undefined
                }
                onClick={
                  supportsHoverReveal
                    ? undefined
                    : () => {
                        toggleMobileRevealRow(row.post_key);
                      }
                }
              >
                <span>필터</span>
                <span>{supportsHoverReveal ? "해제" : isRowRevealActive ? "적용" : "해제"}</span>
              </button>
            ) : null}
            <time className="sentiment-time" dateTime={row.analyzed_at}>
              {toLocalTime(row.analyzed_at, timezone)}
            </time>
          </div>
        </div>
        <div className="sentiment-card-body">
          <SentimentTitleLink row={row} showPrettyTitle={showPrettyTitle} />
        </div>
      </article>
    );
  };

  return (
    <>
      <section className="panel feed-lanes-panel">
        <div className="sentiment-columns">
          <section
            id="fear-lane"
            className={`sentiment-lane sentiment-lane-fear scroll-anchor${
              cleanFilterEnabled ? " sentiment-lane-clean-glow" : ""
            }`}
          >
            <div className="sentiment-lane-head">
              <h2>
                공포
                <span className="tag sentiment-count-tag">{loading ? "로딩" : `${fearRows.length}건`}</span>
              </h2>
              <span className="sentiment-lane-watermark sentiment-lane-watermark-fear" aria-hidden="true">
                {SENTIMENT_DISPLAY.bearish.emoji}
              </span>
            </div>
            {fearSymbolBadges.length > 0 ? <SymbolBadgeList badges={fearSymbolBadges} ariaLabel="공포 등장 종목" /> : null}

            {loading ? <p className="muted feed-loading-status">피드를 불러오는 중입니다.</p> : null}
            {!loading && errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!loading && !errorMessage && fearRows.length === 0 ? <p className="muted">조건에 맞는 공포 글이 없습니다.</p> : null}
            <div className="sentiment-list">{loading ? null : fearRows.map((row) => renderRow(row, "fear"))}</div>
            {loading ? <FeedSkeletonRows tone="fear" /> : null}
          </section>

          <section
            id="hope-lane"
            className={`sentiment-lane sentiment-lane-hope scroll-anchor${
              cleanFilterEnabled ? " sentiment-lane-clean-glow" : ""
            }`}
          >
            <div className="sentiment-lane-head">
              <h2>
                희망
                <span className="tag sentiment-count-tag">{loading ? "로딩" : `${hopeRows.length}건`}</span>
              </h2>
              <span className="sentiment-lane-watermark sentiment-lane-watermark-hope" aria-hidden="true">
                {SENTIMENT_DISPLAY.bullish.emoji}
              </span>
            </div>
            {hopeSymbolBadges.length > 0 ? <SymbolBadgeList badges={hopeSymbolBadges} ariaLabel="희망 등장 종목" /> : null}

            {loading ? <p className="muted feed-loading-status">피드를 불러오는 중입니다.</p> : null}
            {!loading && errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!loading && !errorMessage && hopeRows.length === 0 ? <p className="muted">조건에 맞는 희망 글이 없습니다.</p> : null}
            <div className="sentiment-list">{loading ? null : hopeRows.map((row) => renderRow(row, "hope"))}</div>
            {loading ? <FeedSkeletonRows tone="hope" /> : null}
          </section>
        </div>
        <MobileSentimentSwipeHint />
      </section>

      <nav className="mobile-feed-fabs" aria-label="피드 빠른 이동">
        <a className="mobile-feed-fab mobile-feed-fab-top" href="#page-top">
          ↑
        </a>
        <a className="mobile-feed-fab mobile-feed-fab-fear" href="#fear-lane">
          공포
        </a>
        <a className="mobile-feed-fab mobile-feed-fab-hope" href="#hope-lane">
          희망
        </a>
      </nav>
    </>
  );
}
