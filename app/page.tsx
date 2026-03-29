import { Suspense } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { MarketOverviewFallback } from "@/components/market-overview-fallback";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { getCachedRecentFeedRows } from "@/lib/feed-read";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getTimezone } from "@/lib/env";

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

  const { rows, errorMessage } = await getCachedRecentFeedRows({ hours: FEED_WINDOW_HOURS, limit: 500 });
  const timezone = getTimezone();

  return (
    <>
      <Suspense fallback={<MarketOverviewFallback />}>
        <MarketOverviewShell />
      </Suspense>
      <HomeFeedShell
        rows={rows}
        errorMessage={errorMessage}
        timezone={timezone}
        selectedGroupIds={selectedGroupIds}
      />
    </>
  );
}
