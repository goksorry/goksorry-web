import "server-only";
import { unstable_cache } from "next/cache";
import { INDEX_REFRESH_SEC, INDEX_WINDOW_SEC, indexCacheWindow } from "@/lib/index-cache-policy";

/**
 * `unstable_cache` with a hard age limit. Plain `unstable_cache` refreshes stale values
 * in the background but still returns the stale one, however old, to the first caller
 * after a quiet period. Keying each call by a wall-clock window caps that: a value is
 * never served past the window it was computed in.
 *
 * Arguments must be JSON-serialisable; they are part of the cache key.
 */
export function boundedCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  { refreshSec = INDEX_REFRESH_SEC, windowSec = INDEX_WINDOW_SEC, tags = [] as string[] } = {}
): (...args: A) => Promise<R> {
  const cached = unstable_cache((_window: number, ...args: A) => fn(...args), keyParts, { revalidate: refreshSec, tags });
  return (...args: A) => cached(indexCacheWindow(Date.now(), windowSec), ...args);
}
