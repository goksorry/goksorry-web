"use client";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { SOURCE_GROUP_IDS } from "@/lib/feed-source-groups";
import { CommunitySourceLinks } from "@/components/community-source-links";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import type { EvidenceSelection } from "./scene-types";
export function WorldEvidence({ selection, selectedGroupIds }: { selection: EvidenceSelection; selectedGroupIds?: SourceGroupId[] }) {
  return <section aria-label={`${selection.title} 분위기 표본`}><p>희망 {selection.summary.bullish}건 · 공포 {selection.summary.bearish}건 · 중립 {selection.summary.neutral}건</p><HomeFeedShell timezone="Asia/Seoul" selectedGroupIds={selection.community ? [selection.community] : selectedGroupIds ?? SOURCE_GROUP_IDS} windowHours={6} initialLimit={20} embedded scope={{ symbol: selection.symbol, community: selection.community }} /></section>;
}
