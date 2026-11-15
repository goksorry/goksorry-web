import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { MarketOverviewFallback } from "@/components/market-overview-fallback";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getTimezone } from "@/lib/env";
import { buildPageMetadata } from "@/lib/seo";

type QueryValue = string | string[] | undefined;
const FEED_WINDOW_HOURS = 6;
const INITIAL_FEED_LIMIT = 80;

// 일반모드: the document-style home. Same data as the metaverse room at "/", which stays canonical.
export const metadata: Metadata = buildPageMetadata({
  title: "일반모드",
  description: "곡소리 지수, 시장 지수, 커뮤니티 원문 피드를 일반 페이지로 확인하는 곡소리닷컴 일반모드입니다.",
  path: "/"
});

const pickFirst = (value: QueryValue): string => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function ClassicHome({ searchParams }: { searchParams?: Record<string, QueryValue> }) {
  const selectedChannelsRaw = pickFirst(searchParams?.channels);
  const legacyChannelRaw = pickFirst(searchParams?.channel);
  const selectedGroupIds = selectedChannelsRaw.length > 0
    ? parseSourceGroupSelection(selectedChannelsRaw)
    : isSourceGroupId(legacyChannelRaw) ? [legacyChannelRaw] : parseSourceGroupSelection("");
  return (
    <>
      <Suspense fallback={<MarketOverviewFallback selectedGroupIds={selectedGroupIds} />}>
        <MarketOverviewShell selectedGroupIds={selectedGroupIds} />
      </Suspense>
      <HomeFeedShell timezone={getTimezone()} selectedGroupIds={selectedGroupIds} windowHours={FEED_WINDOW_HOURS} initialLimit={INITIAL_FEED_LIMIT} />
    </>
  );
}
