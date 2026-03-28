import { HomeFeedShell } from "@/components/home-feed-shell";
import { fetchRecentFeedRows } from "@/lib/feed-data";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getTimezone } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type QueryValue = string | string[] | undefined;
const FEED_WINDOW_HOURS = 6;

const pickFirst = (value: QueryValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
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

  const service = getServiceSupabaseClient();
  const { rows, errorMessage } = await fetchRecentFeedRows(service, { hours: FEED_WINDOW_HOURS, limit: 500 });
  const timezone = getTimezone();

  return (
    <HomeFeedShell
      rows={rows}
      errorMessage={errorMessage}
      timezone={timezone}
      selectedGroupIds={selectedGroupIds}
    />
  );
}
