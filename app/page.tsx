import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldShell } from "@/components/world/world-shell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getChatServerEnv, getTimezone } from "@/lib/env";
import { buildPageMetadata, SITE_NAME } from "@/lib/seo";

type QueryValue = string | string[] | undefined;

const homeMetadata = buildPageMetadata({
  title: "홈",
  description: "곡소리 지수와 커뮤니티 원문을 한 화면에서 확인하세요. 삐에로와 개미 월드, 공포·희망 좌우 피드와 통합 보기, 개미극장 기록을 제공합니다.",
  path: "/"
});

export const metadata: Metadata = {
  ...homeMetadata,
  title: {
    absolute: SITE_NAME
  },
  openGraph: homeMetadata.openGraph
    ? {
        ...homeMetadata.openGraph,
        title: SITE_NAME
      }
    : undefined,
  twitter: homeMetadata.twitter
    ? {
        ...homeMetadata.twitter,
        title: SITE_NAME
      }
    : undefined
};

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

  const timezone = getTimezone();

  return (
    <Suspense fallback={<p className="world-loading">데이터 조회 중…</p>}>
      <WorldShell timezone={timezone} selectedGroupIds={selectedGroupIds} chatEnabled={getChatServerEnv().enabled}
        menu={<><SiteHeader themes={false} /><Suspense fallback={null}><SiteFooter /></Suspense></>} />
    </Suspense>
  );
}
