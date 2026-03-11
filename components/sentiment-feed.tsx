"use client";

import { CrossfadeContent } from "@/components/crossfade-content";
import { MobileSentimentSwipeHint } from "@/components/mobile-sentiment-swipe-hint";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useFeedSelection } from "@/components/feed-selection-provider";
import { CLEAN_FILTER_APPLY_DURATION_MS, resolveDisplayTitle } from "@/lib/clean-filter";
import { filterRowsBySourceGroups, type FeedRow } from "@/lib/feed-data";
import { SENTIMENT_DISPLAY } from "@/lib/sentiment-display";

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
  if (source.startsWith("naver_stock_")) {
    return "네이버종토방";
  }
  if (source.startsWith("toss_stock_community_")) {
    return "토스증권";
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

export function SentimentFeed({
  rows,
  errorMessage,
  timezone
}: {
  rows: FeedRow[];
  errorMessage: string;
  timezone: string;
}) {
  const { cleanFilterEnabled } = useCleanFilter();
  const { activeGroupIds } = useFeedSelection();
  const filteredRows = filterRowsBySourceGroups(rows, activeGroupIds);
  const actionableRows = filteredRows.filter((row) => row.label !== "neutral");
  const fearRows = actionableRows.filter((row) => row.label === "bearish");
  const hopeRows = actionableRows.filter((row) => row.label === "bullish");
  const fearSymbolBadges = buildSymbolBadges(fearRows);
  const hopeSymbolBadges = buildSymbolBadges(hopeRows);
  const cleanFilterModeKey = cleanFilterEnabled ? "pretty" : "grim";

  return (
    <>
      <section className="panel feed-lanes-panel">
        <div className="sentiment-columns">
          <section id="fear-lane" className="sentiment-lane sentiment-lane-fear scroll-anchor">
            <div className="sentiment-lane-head">
              <h2>
                공포
                <span className="tag sentiment-count-tag">{fearRows.length}건</span>
              </h2>
              <span className="sentiment-lane-watermark sentiment-lane-watermark-fear" aria-hidden="true">
                {SENTIMENT_DISPLAY.bearish.emoji}
              </span>
            </div>
            {fearSymbolBadges.length > 0 ? (
              <div className="feed-symbol-badges" aria-label="공포 등장 종목">
                {fearSymbolBadges.map((badge) => (
                  <span key={badge.name} className="feed-symbol-badge">
                    {badge.name}
                    {badge.count > 1 ? <span className="feed-symbol-badge-count">x{badge.count}</span> : null}
                  </span>
                ))}
              </div>
            ) : null}

            {errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!errorMessage && fearRows.length === 0 ? <p className="muted">조건에 맞는 공포 글이 없습니다.</p> : null}

            <CrossfadeContent swapKey={cleanFilterModeKey} durationMs={CLEAN_FILTER_APPLY_DURATION_MS}>
              <div className="sentiment-list">
                {fearRows.map((row) => {
                  const displayTitle = resolveDisplayTitle({
                    title: row.title,
                    cleanTitle: row.clean_title,
                    cleanFilterEnabled
                  });

                  return (
                    <article key={row.post_key} className="sentiment-card sentiment-card-fear">
                      <div className="sentiment-card-head">
                        <div className="sentiment-card-head-tags">
                          <span className="tag sentiment-card-tag">{getFeedSourceLabel(row.source)}</span>
                          {row.symbol_name ? <span className="tag tag-symbol sentiment-card-tag">{row.symbol_name}</span> : null}
                        </div>
                        <time className="sentiment-time" dateTime={row.analyzed_at}>
                          {toLocalTime(row.analyzed_at, timezone)}
                        </time>
                      </div>
                      <a
                        className={`sentiment-title${displayTitle.usedFallbackFilter ? " sentiment-title-fallback" : ""}`}
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {displayTitle.text}
                      </a>
                    </article>
                  );
                })}
              </div>
            </CrossfadeContent>
          </section>

          <section id="hope-lane" className="sentiment-lane sentiment-lane-hope scroll-anchor">
            <div className="sentiment-lane-head">
              <h2>
                희망
                <span className="tag sentiment-count-tag">{hopeRows.length}건</span>
              </h2>
              <span className="sentiment-lane-watermark sentiment-lane-watermark-hope" aria-hidden="true">
                {SENTIMENT_DISPLAY.bullish.emoji}
              </span>
            </div>
            {hopeSymbolBadges.length > 0 ? (
              <div className="feed-symbol-badges" aria-label="희망 등장 종목">
                {hopeSymbolBadges.map((badge) => (
                  <span key={badge.name} className="feed-symbol-badge">
                    {badge.name}
                    {badge.count > 1 ? <span className="feed-symbol-badge-count">x{badge.count}</span> : null}
                  </span>
                ))}
              </div>
            ) : null}

            {errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!errorMessage && hopeRows.length === 0 ? <p className="muted">조건에 맞는 희망 글이 없습니다.</p> : null}

            <CrossfadeContent swapKey={cleanFilterModeKey} durationMs={CLEAN_FILTER_APPLY_DURATION_MS}>
              <div className="sentiment-list">
                {hopeRows.map((row) => {
                  const displayTitle = resolveDisplayTitle({
                    title: row.title,
                    cleanTitle: row.clean_title,
                    cleanFilterEnabled
                  });

                  return (
                    <article key={row.post_key} className="sentiment-card sentiment-card-hope">
                      <div className="sentiment-card-head">
                        <div className="sentiment-card-head-tags">
                          <span className="tag sentiment-card-tag">{getFeedSourceLabel(row.source)}</span>
                          {row.symbol_name ? <span className="tag tag-symbol sentiment-card-tag">{row.symbol_name}</span> : null}
                        </div>
                        <time className="sentiment-time" dateTime={row.analyzed_at}>
                          {toLocalTime(row.analyzed_at, timezone)}
                        </time>
                      </div>
                      <a
                        className={`sentiment-title${displayTitle.usedFallbackFilter ? " sentiment-title-fallback" : ""}`}
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {displayTitle.text}
                      </a>
                    </article>
                  );
                })}
              </div>
            </CrossfadeContent>
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
