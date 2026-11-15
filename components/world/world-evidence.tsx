"use client";
import { useState } from "react";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { getSourceGroupShortLabel } from "@/lib/feed-source-groups";
import type { WorldSide } from "@/lib/world";
import type { EvidenceSelection } from "./scene-types";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { SOURCE_GROUP_IDS } from "@/lib/feed-source-groups";

export function WorldEvidence({ selection }: { selection: EvidenceSelection }) {
  const [side, setSide] = useState<WorldSide>(selection.side ?? (!selection.summary.bearish && !selection.summary.bullish ? "neutral" : selection.summary.bearish >= selection.summary.bullish ? "bearish" : "bullish"));
  const [expanded, setExpanded] = useState(false);
  const { cleanFilterEnabled } = useCleanFilter();
  return <section aria-label={`${selection.title} 근거 글`}>
    <p className="world-note">{selection.recordedAt ? `저장 시점 ${new Date(selection.recordedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST 기준, ` : ""}최근 6시간 실제 분석 글 중 각 분류의 최근 3건. 개미는 게시글 분위기를 표현하는 캐릭터입니다.</p>
    <CleanFilterToggle />
    <div className="world-evidence-tabs" aria-label="근거 감성 선택">{(["bullish", "bearish", "neutral"] as const).map((key) => <button key={key} aria-pressed={side === key} onClick={() => setSide(key)}>{key === "bullish" ? "희망" : key === "bearish" ? "공포" : "중립"} {selection.summary[key]}건</button>)}</div>
    <ul className="world-evidence-list">{selection.summary.evidence[side].map((row) => <li key={row.post_key}>
      <span>{getSourceGroupShortLabel(row.source)} · {row.symbol_name ?? "전체 이야기"}</span>
      <a href={/^https?:\/\//i.test(row.url) ? row.url : undefined} target="_blank" rel="noreferrer">{resolveDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled }).text} ↗</a>
      <time dateTime={row.analyzed_at}>{new Date(row.analyzed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</time>
    </li>)}</ul>
    {!selection.summary.evidence[side].length && <p className="world-note">이 분류의 글이 없습니다. 다른 진영을 확인해 보세요.</p>}
    {!selection.recordedAt && (selection.symbol || selection.community) && <button className="world-more-evidence" onClick={() => setExpanded((value) => !value)}>{expanded ? "최근 근거만 보기" : "선택 범위 피드 더 보기"}</button>}
    {expanded && <HomeFeedShell timezone="Asia/Seoul" selectedGroupIds={selection.community ? [selection.community] : SOURCE_GROUP_IDS} windowHours={6} initialLimit={80} scope={selection.symbol ? { symbol: selection.symbol } : { community: selection.community }} />}
    <p className="world-note">AI 분류에는 오류가 있을 수 있습니다. 원문 권리는 각 작성자·서비스에 있습니다.</p>
  </section>;
}
