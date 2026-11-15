"use client";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { getSourceGroupShortLabel } from "@/lib/feed-source-groups";
import { percent, type WorldFrame, type WorldSummary } from "@/lib/world";
import { recentEvidence, SIDE_LABEL } from "@/lib/world-presentation";

export function SummaryNumbers({ summary }: { summary: WorldSummary }) {
  return <div className="world-numbers">
    <div className="world-index-number"><strong>{summary.total ? summary.index.toFixed(1) : "—"}</strong><span>/ 10</span></div>
    <div className="world-ratios"><span className="world-hope">희망 <b>{percent(summary.hope_ratio)}</b></span><span className="world-fear">공포 <b>{percent(summary.fear_ratio)}</b></span></div>
    <div className="world-ratio-track" aria-hidden="true"><i style={{ width: `${(summary.hope_ratio ?? 0) * 100}%` }} /><i style={{ width: `${(summary.fear_ratio ?? 0) * 100}%` }} /></div>
    <span className="world-sample">분석 표본 {summary.total.toLocaleString()}건 <span>· 중립 {summary.neutral.toLocaleString()}건</span></span>
  </div>;
}
export function WorldScreens({ frame, loaded, failed, status, onOpen }: { frame: WorldFrame; loaded: boolean; failed: boolean; status: string; onOpen: (tab: "index" | "feed") => void }) {
  const { cleanFilterEnabled } = useCleanFilter();
  const rows = recentEvidence(frame.overall);
  const time = frame.data_at ? new Date(frame.data_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : null;
  return <div className="world-screens">
    <button className="world-wall-screen world-index-screen" data-screen="index" onClick={() => onOpen("index")} aria-label="지수 스크린 · 상세 열기">
      <span className="world-screen-title"><span><i /> 곡소리 지수</span><span>01 / INDEX</span></span>
      <SummaryNumbers summary={frame.overall} />
      <span className="world-screen-meta">최근 6시간 · {time ? `${time} KST 기준` : failed ? "데이터 조회 실패" : loaded ? "기준 시각 없음" : "데이터 조회 중"}</span>
      <span className="world-screen-link">{status} <span>상세 보기 ↗</span></span>
    </button>
    <button className="world-wall-screen world-feed-screen" data-screen="feed" onClick={() => onOpen("feed")} aria-label="피드 스크린 · 실제 글 열기">
      <span className="world-screen-title"><span><i /> 골목의 목소리</span><span>02 / FEED</span></span>
      <span className="world-preview-list">{rows.map((row) => <span key={row.post_key} className="world-preview-row"><span className="world-preview-source"><b data-side={row.label}>{SIDE_LABEL[row.label]}</b> {getSourceGroupShortLabel(row.source)}</span><span className="world-preview-title">{resolveDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled }).text}</span></span>)}</span>
      {!rows.length && <span className="world-preview-empty">{failed && !loaded ? "근거 글을 불러오지 못했습니다. 다시 시도해 주세요." : loaded ? "최근 6시간의 근거 글이 없습니다." : "실제 근거 글을 확인하고 있습니다."}</span>}
      <span className="world-screen-link">대표 근거 중 최신 3건 <span>피드 모두 보기 ↗</span></span>
    </button>
  </div>;
}
