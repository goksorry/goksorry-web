"use client";
import { useState } from "react";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { getSourceGroupShortLabel } from "@/lib/feed-source-groups";
import type { WorldSide } from "@/lib/world";
import type { EvidenceSelection } from "./scene-types";
import { WorldPanel } from "./world-panel";

export function WorldEvidence({ selection, onClose }: { selection: EvidenceSelection; onClose: () => void }) {
  const [side, setSide] = useState<WorldSide>(selection.side ?? "bullish");
  const { cleanFilterEnabled } = useCleanFilter();
  return <WorldPanel title={`${selection.title} · 근거 글`} name="evidence" modal onClose={onClose}>
    <p className="world-note">최근 6시간 실제 분석 글 중 각 분류의 최근 3건. 개미는 게시글 분위기를 표현하는 캐릭터입니다.</p>
    <CleanFilterToggle />
    <div className="world-evidence-tabs" aria-label="근거 감성 선택">{(["bullish", "bearish", "neutral"] as const).map((key) => <button key={key} aria-pressed={side === key} onClick={() => setSide(key)}>{key === "bullish" ? "희망" : key === "bearish" ? "공포" : "중립"} {selection.summary[key]}건</button>)}</div>
    <ul className="world-evidence-list">{selection.summary.evidence[side].map((row) => <li key={row.post_key}>
      <span>{getSourceGroupShortLabel(row.source)} · {row.symbol_name ?? "전체 이야기"}</span>
      <a href={/^https?:\/\//i.test(row.url) ? row.url : undefined} target="_blank" rel="noreferrer">{resolveDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled }).text} ↗</a>
      <time dateTime={row.analyzed_at}>{new Date(row.analyzed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</time>
    </li>)}</ul>
    {!selection.summary.evidence[side].length && <p className="world-note">이 분류의 글이 없습니다. 다른 진영을 확인해 보세요.</p>}
    <p className="world-note">AI 분류에는 오류가 있을 수 있습니다. 원문 권리는 각 작성자·서비스에 있습니다.</p>
  </WorldPanel>;
}
