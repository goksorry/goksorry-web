import type { Metadata } from "next";
import { SentimentHome } from "@/components/home/sentiment-home";
import { getScopedFeed } from "@/lib/feed-snapshot";
import { emptyFeedPage, readFeedSelection } from "@/lib/feed-scope";
import { getTimezone } from "@/lib/env";
import { buildPageMetadata, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { ...buildPageMetadata({ title: "홈", description: SITE_DESCRIPTION, path: "/" }), title: { absolute: SITE_NAME } };

export default async function Home({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (value) params.set(key, Array.isArray(value) ? value[0] : value);
  const selection = readFeedSelection(params);
  let initial;
  try { initial = await getScopedFeed(selection, { limit: 40 }); }
  catch { initial = emptyFeedPage("피드 데이터를 준비하지 못했습니다."); }
  return <SentimentHome initial={initial} initialSelection={selection} timezone={getTimezone()} />;
}
