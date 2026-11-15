import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldShell } from "@/components/world/world-shell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { isSourceGroupId, parseSourceGroupSelection } from "@/lib/feed-source-groups";
import { getTimezone } from "@/lib/env";
import { buildPageMetadata, SITE_NAME } from "@/lib/seo";

type QueryValue = string | string[] | undefined;

const homeMetadata = buildPageMetadata({
  title: "홈",
  description: "커뮤니티의 희망과 공포가 살아 움직이는 곡소리 개미 월드. 개미굴, 심리 전장, 삐에로 재난방송과 하루 30초 개미극장을 탐색하세요.",
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
    <Suspense fallback={<p className="world-loading">개미 광장을 여는 중…</p>}>
      <WorldShell timezone={timezone} selectedGroupIds={selectedGroupIds}
        menu={<><SiteHeader /><Suspense fallback={null}><SiteFooter /></Suspense></>} />
    </Suspense>
  );
}
