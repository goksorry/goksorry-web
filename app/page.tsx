import { cookies } from "next/headers";
import { Suspense } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { MarketOverviewFallback } from "@/components/market-overview-fallback";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { MARKET_ADJUSTMENT_COOKIE_NAME, resolveMarketAdjustmentEnabled } from "@/lib/community-market-adjustment";
import { getCachedRecentFeedRows } from "@/lib/feed-read";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getTimezone } from "@/lib/env";
import { buildPageMetadata } from "@/lib/seo";

type QueryValue = string | string[] | undefined;
const FEED_WINDOW_HOURS = 6;

export const metadata = buildPageMetadata({
  title: "홈",
  description: "곡소리 지수, 시장 개요, 커뮤니티 체감 데이터를 한 화면에서 확인할 수 있는 곡소리닷컴 홈입니다.",
  path: "/"
});

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
  const cookieStore = await cookies();
  const marketAdjustmentCookieValue = cookieStore.get(MARKET_ADJUSTMENT_COOKIE_NAME)?.value ?? "";

  const selectedChannelsRaw = pickFirst(searchParams?.channels);
  const legacyChannelRaw = pickFirst(searchParams?.channel);
  const selectedGroupIds =
    selectedChannelsRaw.length > 0
      ? parseSourceGroupSelection(selectedChannelsRaw)
      : isSourceGroupId(legacyChannelRaw)
        ? [legacyChannelRaw]
        : parseSourceGroupSelection("");
  const marketAdjustmentEnabled = resolveMarketAdjustmentEnabled({
    queryValue: marketAdjustmentParam,
    cookieValue: marketAdjustmentCookieValue,
    defaultEnabled: false
  });

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
