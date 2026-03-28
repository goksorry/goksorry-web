"use client";

import type { SourceGroupId } from "@/lib/feed-source-groups";
import { FeedFilterControls } from "@/components/feed-filter-controls";
import { FeedSelectionProvider } from "@/components/feed-selection-provider";
import { SentimentFeed } from "@/components/sentiment-feed";
import type { FeedRow } from "@/lib/feed-data";

export function HomeFeedShell({
  rows,
  errorMessage,
  timezone,
  selectedGroupIds
}: {
  rows: FeedRow[];
  errorMessage: string;
  timezone: string;
  selectedGroupIds: SourceGroupId[];
}) {
  return (
    <FeedSelectionProvider initialGroupIds={selectedGroupIds}>
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor">
        <h1>외부 감성 피드</h1>
        <p className="muted">
          외부 커뮤니티에서 최근 6시간 동안 감지한 글 중 공포와 희망 흐름만 분리해서 보여줍니다. 중립 글은 기본적으로 숨깁니다.
        </p>
        <FeedFilterControls selectedGroupIds={selectedGroupIds} />
      </section>

      <SentimentFeed rows={rows} errorMessage={errorMessage} timezone={timezone} />
    </FeedSelectionProvider>
  );
}
