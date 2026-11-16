/**
 * Freshness budget for index data: market indices (KOSPI, KOSDAQ, NASDAQ, USD/KRW)
 * and the 곡소리 지수 with everything derived from it (world frame, feed summary,
 * community indicators).
 *
 * Every layer between the database / Naver and a reloaded page is listed here so the
 * total staleness stays explicit:
 *
 * 1. Server data cache (`unstable_cache`): a value older than INDEX_REFRESH_SEC is still
 *    served once while it refreshes in the background. On its own that is unbounded
 *    after a quiet period, so the cache key also carries a wall-clock window of
 *    INDEX_WINDOW_SEC: once the window rolls over the old entry can no longer match and
 *    the next request recomputes instead of serving it.
 * 2. Shared CDN cache: INDEX_CDN_FRESH_SEC fresh, then INDEX_CDN_STALE_SEC served stale
 *    while revalidating. Browsers never keep the response (max-age=0) and the client
 *    polls with `cache: "no-store"`.
 *
 * Worst case after a reload: window + CDN fresh + CDN stale = INDEX_MAX_AGE_SEC.
 */
export const INDEX_MAX_AGE_SEC = 600;
export const INDEX_REFRESH_SEC = 60;
export const INDEX_CDN_FRESH_SEC = 30;
export const INDEX_CDN_STALE_SEC = 30;
export const INDEX_WINDOW_SEC = INDEX_MAX_AGE_SEC - INDEX_CDN_FRESH_SEC - INDEX_CDN_STALE_SEC;

/** Cache-Control for responses carrying index data. */
export const INDEX_CACHE_CONTROL =
  `public, max-age=0, s-maxage=${INDEX_CDN_FRESH_SEC}, stale-while-revalidate=${INDEX_CDN_STALE_SEC}`;

/** Revalidated after every collection run, so a finished run shows up on the next reload. */
export const COLLECTION_RUN_CACHE_TAG = "collection-run";

/** The wall-clock window a cached value belongs to. Aligned to the epoch so every server instance agrees. */
export const indexCacheWindow = (nowMs: number, windowSec = INDEX_WINDOW_SEC): number =>
  Math.floor(nowMs / (windowSec * 1000));

/** Oldest index data a reload can show under the layers above, in seconds. */
export const indexWorstCaseAgeSec = (): number => INDEX_WINDOW_SEC + INDEX_CDN_FRESH_SEC + INDEX_CDN_STALE_SEC;
