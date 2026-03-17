import { FeedFilterControls } from "@/components/feed-filter-controls";
import { SentimentFeed } from "@/components/sentiment-feed";
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
    <>
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor">
        <h1>외부 감성 피드</h1>
        <p className="muted">
          외부 커뮤니티에서 최근 6시간 동안 감지한 글 중 공포와 희망 흐름만 분리해서 보여줍니다. 중립 글은 기본적으로 숨깁니다.
        </p>
        <FeedFilterControls selectedGroupIds={selectedGroupIds} />
      </section>

      <SentimentFeed rows={rows} errorMessage={errorMessage} timezone={timezone} />
    </>
  );
}
