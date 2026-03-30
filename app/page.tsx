import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { MarketOverviewFallback } from "@/components/market-overview-fallback";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { MARKET_ADJUSTMENT_COOKIE_NAME, parseMarketAdjustmentParam } from "@/lib/community-market-adjustment";
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
  const marketAdjustmentParam = pickFirst(searchParams?.market_adjustment);
  if (!marketAdjustmentParam) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(MARKET_ADJUSTMENT_COOKIE_NAME)?.value ?? "";
    if (!parseMarketAdjustmentParam(cookieValue)) {
      const nextParams = new URLSearchParams();

      for (const [key, value] of Object.entries(searchParams ?? {})) {
        if (key === "market_adjustment") {
          continue;
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item) {
              nextParams.append(key, item);
            }
          }
          continue;
        }
        if (value) {
          nextParams.set(key, value);
        }
      }

      nextParams.set("market_adjustment", "off");
      redirect(`/?${nextParams.toString()}`);
    }
  }

  const selectedChannelsRaw = pickFirst(searchParams?.channels);
  const legacyChannelRaw = pickFirst(searchParams?.channel);
  const selectedGroupIds =
    selectedChannelsRaw.length > 0
      ? parseSourceGroupSelection(selectedChannelsRaw)
      : isSourceGroupId(legacyChannelRaw)
        ? [legacyChannelRaw]
        : parseSourceGroupSelection("");
  const marketAdjustmentEnabled = parseMarketAdjustmentParam(marketAdjustmentParam);

  const { rows, errorMessage } = await getCachedRecentFeedRows({ hours: FEED_WINDOW_HOURS, limit: 500 });
  const timezone = getTimezone();

  return (
    <>
      <Suspense fallback={<MarketOverviewFallback />}>
        <MarketOverviewShell marketAdjustmentEnabled={marketAdjustmentEnabled} />
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
