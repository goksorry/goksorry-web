import "server-only";

import { unstable_cache } from "next/cache";
import { fetchRecentFeedRows } from "@/lib/feed-data";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const FEED_REVALIDATE_SEC = 60;

export const getCachedRecentFeedRows = async ({
  hours = 24,
  limit = 500,
  offset = 0
}: {
  hours?: number;
  limit?: number;
  offset?: number;
} = {}) =>
  unstable_cache(
    async () => {
      const service = getServiceSupabaseClient();
      return fetchRecentFeedRows(service, { hours, limit, offset });
    },
    [`recent-feed-rows:${hours}:${limit}:${offset}`],
    {
      revalidate: FEED_REVALIDATE_SEC
    }
  )();
