import { cookies } from "next/headers";
import { FeedFilterControls } from "@/components/feed-filter-controls";
import { MobileSentimentSwipeHint } from "@/components/mobile-sentiment-swipe-hint";
import { CLEAN_FILTER_COOKIE, isCleanFilterEnabled, resolveDisplayTitle } from "@/lib/clean-filter";
import { fetchRecentFeedRows, filterRowsBySourceGroups } from "@/lib/feed-data";
import {
  getSourceGroupShortLabel,
  isSourceGroupId,
  parseSourceGroupSelection,
  type SourceGroupId
} from "@/lib/feed-source-groups";
import { SENTIMENT_DISPLAY } from "@/lib/sentiment-display";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { getTimezone } from "@/lib/env";

type QueryValue = string | string[] | undefined;

const pickFirst = (value: QueryValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const rangeHoursMap: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24
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

export default async function Home({
  searchParams
}: {
  searchParams?: Record<string, QueryValue>;
}) {
  const selectedChannelsRaw = pickFirst(searchParams?.channels);
  const legacyChannelRaw = pickFirst(searchParams?.channel);
  const selectedGroupIds =
    selectedChannelsRaw.length > 0
      ? parseSourceGroupSelection(selectedChannelsRaw)
      : isSourceGroupId(legacyChannelRaw)
        ? [legacyChannelRaw]
        : parseSourceGroupSelection("");
  const selectedRange = pickFirst(searchParams?.range) || "24h";
  const rangeHours = rangeHoursMap[selectedRange] ?? 24;
  const cleanFilterEnabled = isCleanFilterEnabled(cookies().get(CLEAN_FILTER_COOKIE)?.value);

  const service = getServiceSupabaseClient();
  const { rows, errorMessage } = await fetchRecentFeedRows(service, { hours: rangeHours, limit: 500 });

  const timezone = getTimezone();
  const channelFilteredRows = filterRowsBySourceGroups(rows, selectedGroupIds);
  const nowMs = Date.now();
  const filteredRows = channelFilteredRows.filter((row) => {
    const analyzedAtMs = new Date(row.analyzed_at).getTime();
    if (Number.isNaN(analyzedAtMs)) {
      return false;
    }

    return nowMs - analyzedAtMs <= rangeHours * 60 * 60 * 1000;
  });
  const actionableRows = filteredRows.filter((row) => row.label !== "neutral");
  const fearRows = actionableRows.filter((row) => row.label === "bearish");
  const hopeRows = actionableRows.filter((row) => row.label === "bullish");

  const buildSymbolBadges = (rowsToCount: typeof actionableRows) => {
    const symbolCounts = rowsToCount.reduce(
      (acc, row) => {
        if (!row.symbol_name) {
          return acc;
        }

        const nextCount = (acc.get(row.symbol_name) ?? 0) + 1;
        acc.set(row.symbol_name, nextCount);
        return acc;
      },
      new Map<string, number>()
    );

    return [...symbolCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"))
      .map(([name, count]) => ({
        name,
        count
      }));
  };

  const fearSymbolBadges = buildSymbolBadges(fearRows);
  const hopeSymbolBadges = buildSymbolBadges(hopeRows);

  return (
    <>
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor">
        <h1>외부 감성 피드</h1>
        <p className="muted">
          외부 커뮤니티에서 감지한 글 중 공포와 희망 흐름만 분리해서 보여줍니다. 중립 글은 기본적으로 숨깁니다.
        </p>
        <FeedFilterControls selectedGroupIds={selectedGroupIds} selectedRange={selectedRange} />
      </section>

      <section className="panel feed-lanes-panel">
        <div className="sentiment-columns">
          <section id="fear-lane" className="sentiment-lane sentiment-lane-fear scroll-anchor">
            <div className="sentiment-lane-head">
              <h2>
                {SENTIMENT_DISPLAY.bearish.emoji} 공포
              </h2>
              <span className="tag">{fearRows.length}건</span>
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
                      <span className="tag">{getSourceGroupShortLabel(row.source)}</span>
                      {row.symbol_name ? <span className="tag tag-symbol">{row.symbol_name}</span> : null}
                    </div>
                    <a
                      className={`sentiment-title${displayTitle.usedFallbackFilter ? " sentiment-title-fallback" : ""}`}
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {displayTitle.text}
                    </a>
                    <p className="sentiment-meta">
                      <span>확신도 {row.confidence.toFixed(2)}</span>
                      <span>{toLocalTime(row.analyzed_at, timezone)}</span>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="hope-lane" className="sentiment-lane sentiment-lane-hope scroll-anchor">
            <div className="sentiment-lane-head">
              <h2>
                {SENTIMENT_DISPLAY.bullish.emoji} 희망
              </h2>
              <span className="tag">{hopeRows.length}건</span>
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
                      <span className="tag">{getSourceGroupShortLabel(row.source)}</span>
                      {row.symbol_name ? <span className="tag tag-symbol">{row.symbol_name}</span> : null}
                    </div>
                    <a
                      className={`sentiment-title${displayTitle.usedFallbackFilter ? " sentiment-title-fallback" : ""}`}
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {displayTitle.text}
                    </a>
                    <p className="sentiment-meta">
                      <span>확신도 {row.confidence.toFixed(2)}</span>
                      <span>{toLocalTime(row.analyzed_at, timezone)}</span>
                    </p>
                  </article>
                );
              })}
            </div>
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
