"use client";
import { useEffect, useState } from "react";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { getSourceGroupShortLabel } from "@/lib/feed-source-groups";
import type { WorldSide } from "@/lib/world";
import type { FeedRow } from "@/lib/feed-data";
import { theaterEvidenceQuery } from "@/lib/world-theater";
import { SIDE_ORDER } from "@/lib/world-presentation";
import type { EvidenceSelection } from "./scene-types";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { SOURCE_GROUP_IDS, type SourceGroupId } from "@/lib/feed-source-groups";

type Fetched = { rows: FeedRow[]; error: string };

/**
 * Evidence posts of one side. A live selection carries them in its frame; a theater record keeps no posts, so they are
 * read from the feed as of the recorded time (once per side).
 */
function useEvidenceRows(selection: EvidenceSelection, side: WorldSide) {
  const [fetched, setFetched] = useState<Partial<Record<WorldSide, Fetched>>>({});
  const { recordedAt, symbol, community } = selection;
  const done = !!fetched[side];
  useEffect(() => {
    if (!recordedAt || done) return;
    const controller = new AbortController();
    fetch(`/api/feed?${theaterEvidenceQuery({ recordedAt, symbol, community }, side)}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { rows?: FeedRow[]; errorMessage?: string }) => setFetched((value) => ({ ...value, [side]: { rows: Array.isArray(payload.rows) ? payload.rows : [], error: payload.errorMessage ?? "" } })))
      .catch(() => { if (!controller.signal.aborted) setFetched((value) => ({ ...value, [side]: { rows: [], error: "근거 글을 불러오지 못했습니다." } })); });
    return () => controller.abort();
  }, [recordedAt, symbol, community, side, done]);
  if (!recordedAt) return { rows: selection.summary.evidence[side], loading: false, error: "", retry: () => {} };
  const result = fetched[side];
  return {
    rows: result?.rows ?? [], loading: !result, error: result?.error ?? "",
    // Forgetting the failed side fetches it again.
    retry: () => setFetched((value) => ({ ...value, [side]: undefined }))
  };
}

export function WorldEvidence({ selection, selectedGroupIds = SOURCE_GROUP_IDS }: { selection: EvidenceSelection; selectedGroupIds?: SourceGroupId[] }) {
  const [side, setSide] = useState<WorldSide>(selection.side ?? (!selection.summary.bearish && !selection.summary.bullish ? "neutral" : selection.summary.bearish >= selection.summary.bullish ? "bearish" : "bullish"));
  const [expanded, setExpanded] = useState(false);
  const { cleanFilterEnabled } = useCleanFilter();
  const evidence = useEvidenceRows(selection, side);
  return <section aria-label={`${selection.title} 근거 글`}>
    <div className="world-evidence-tabs"><div role="group" aria-label="근거 감성 선택">{SIDE_ORDER.map((key) => <button key={key} aria-pressed={side === key} onClick={() => setSide(key)}><b>{key === "bullish" ? "희망" : key === "bearish" ? "공포" : "중립"}</b> <span>{selection.summary[key]}건</span></button>)}</div><CleanFilterToggle /></div>
    <ul className="world-evidence-list">{evidence.rows.map((row) => <li key={row.post_key}>
      <span>{getSourceGroupShortLabel(row.source)} · {row.symbol_name ?? "전체 이야기"}</span>
      <a href={/^https?:\/\//i.test(row.url) ? row.url : undefined} target="_blank" rel="noreferrer">{resolveDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled }).text} ↗</a>
      <time dateTime={row.analyzed_at}>{new Date(row.analyzed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</time>
    </li>)}</ul>
    {evidence.loading ? <p className="world-note" role="status">기록 시점의 근거 글을 불러오는 중…</p>
      : evidence.error ? <p className="world-note">{evidence.error} <button type="button" onClick={evidence.retry}>다시 시도</button></p>
      : !evidence.rows.length && <p className="world-note">이 분류의 글이 없습니다. 다른 진영을 확인해 보세요.</p>}
    {!selection.recordedAt && (selection.symbol || selection.community) && <button className="world-more-evidence" onClick={() => setExpanded((value) => !value)}>{expanded ? "최근 근거만 보기" : "선택 범위 피드 더 보기"}</button>}
    {expanded && <HomeFeedShell timezone="Asia/Seoul" selectedGroupIds={selection.community ? [selection.community] : selectedGroupIds} windowHours={6} initialLimit={80} scope={selection.symbol ? { symbol: selection.symbol } : { community: selection.community }} />}
    {/* Footnotes sit last so they never push the evidence down. */}
    <p className="world-footnote">{selection.recordedAt ? `저장 시점 ${new Date(selection.recordedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST 기준, ` : ""}최근 6시간 실제 분석 글 중 각 분류의 최근 3건. 개미는 게시글 분위기를 표현하는 캐릭터입니다. AI 분류에는 오류가 있을 수 있습니다. 원문 권리는 각 작성자·서비스에 있습니다.</p>
  </section>;
}
