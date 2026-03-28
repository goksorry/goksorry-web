import "server-only";

import { unstable_cache } from "next/cache";
import { fetchRecentFeedRows } from "@/lib/feed-data";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const FEED_REVALIDATE_SEC = 60;

export const getCachedRecentFeedRows = async ({
  hours = 24,
  limit = 500
}: {
  hours?: number;
  limit?: number;
} = {}) =>
  unstable_cache(
    async () => {
      const service = getServiceSupabaseClient();
      return fetchRecentFeedRows(service, { hours, limit });
    },
    [`recent-feed-rows:${hours}:${limit}`],
    {
      revalidate: FEED_REVALIDATE_SEC
    }
  )();
