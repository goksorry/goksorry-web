"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { SOURCE_GROUP_IDS, type SourceGroupId } from "@/lib/feed-source-groups";
import type { ScopeSummary, FeedPage } from "@/lib/feed-scope";
import { frameStatus } from "@/lib/world-presentation";
import { percent, worldSummary, type WorldFrame, type WorldSummary } from "@/lib/world";
import { WorldPierrot } from "./world-pierrot";

function WallAnts({ mood }: { mood: WorldSummary["mood"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="world-wall-ants" data-mood={mood} data-visible={visible} aria-hidden="true"><i /><i /></div>;
}

export function SummaryNumbers({ summary }: { summary: Omit<WorldSummary, "evidence"> }) {
  return <div className="world-numbers">
    <div className="world-index-number"><strong>{summary.total ? summary.index.toFixed(1) : "—"}</strong><span>/ 10</span></div>
    <div className="world-ratios"><span className="world-hope">희망 <b>{percent(summary.hope_ratio)}</b></span><span className="world-fear">공포 <b>{percent(summary.fear_ratio)}</b></span></div>
    <div className="world-ratio-track" aria-hidden="true"><i style={{ width: `${(summary.hope_ratio ?? 0) * 100}%` }} /><i style={{ width: `${(summary.fear_ratio ?? 0) * 100}%` }} /></div>
    <span className="world-sample">분석 표본 {summary.total.toLocaleString()}건 <span>· 중립 {summary.neutral.toLocaleString()}건</span></span>
  </div>;
}
export function WorldScreens({ frame, loaded, failed, status, timezone, selectedGroupIds, stock, onStock, onSummary, onOpen }: {
  frame: WorldFrame; loaded: boolean; failed: boolean; status: string; timezone: string;
  selectedGroupIds: SourceGroupId[]; stock: string; onStock: (symbol: string) => void;
  onSummary: (summary: ScopeSummary | undefined) => void;
  onOpen: (tab: "index" | "feed") => void;
}) {
  const [scope, setScope] = useState<ScopeSummary>();
  const [feedError, setFeedError] = useState("");
  const [pending, setPending] = useState(true);
  const [stocks, setStocks] = useState<FeedPage["stocks"]>();
  const receiveSummary = useCallback((value: ScopeSummary | undefined, error: string, loading: boolean, options: FeedPage["stocks"] | undefined) => {
    setScope(value); setFeedError(error); setPending(loading); setStocks(options); onSummary(value);
  }, [onSummary]);
  const filtered = !!stock || selectedGroupIds.length !== SOURCE_GROUP_IDS.length;
  const summary = scope ?? (filtered ? worldSummary([]) : frame.overall);
  const dataAt = scope ? scope.data_at : filtered ? null : frame.data_at;
  const scopeStatus = pending && filtered ? "선택 범위 조회 중" : feedError ? (scope ? "조회 실패 · 마지막 정상 데이터" : "데이터 조회 실패")
    : scope ? frameStatus({ ...frame, overall: { ...frame.overall, ...scope }, data_at: scope.data_at }, true, "", Date.now()) : status;
  const options = stocks ?? frame.stocks;
  const time = dataAt ? new Date(dataAt).toLocaleTimeString("ko-KR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }) : null;
  return <div className="world-screens">
    <section id="world-index-wall" tabIndex={-1} className="world-wall-screen world-index-screen" data-screen="index" aria-label="곡소리 지수">
      <header className="world-index-heading"><h2 className="world-screen-title">곡소리 지수</h2><button className="world-index-details" onClick={() => onOpen("index")}>산식·시장 지표</button></header>
      <div className="world-index-layout"><SummaryNumbers summary={summary} /><WorldPierrot summary={summary} /></div>
      <p className="world-screen-meta">최근 6시간 · <time dateTime={dataAt ?? undefined}>{time ? `${time} 기준` : failed ? "데이터 조회 실패" : loaded ? "기준 시각 없음" : "데이터 조회 중"}</time></p>
      <p className="world-screen-status" role="status" hidden={scopeStatus === "관측 중"}>{scopeStatus}</p>
      <WallAnts mood={summary.total < 3 ? "watching" : summary.mood} />
    </section>
    <section id="world-feed-wall" tabIndex={-1} className="world-wall-screen world-feed-screen" data-screen="feed" aria-label="최근 글">
      <header className="world-feed-heading"><h2 className="world-screen-title">최근 글</h2><CleanFilterToggle /></header>
      <div className="world-wall-feed-content">
        <HomeFeedShell timezone={timezone} selectedGroupIds={selectedGroupIds} windowHours={6} initialLimit={20}
          scope={stock ? { symbol: stock } : undefined} embedded scopeControl={<label className="world-wall-stock">종목 <select aria-label="피드 종목" value={stock} onChange={event => onStock(event.target.value)}>
          <option value="">전체 종목</option>
          {stock && !options.some(s => s.symbol === stock) && <option value={stock}>{stock}</option>}
          {options.map(s => <option key={s.symbol} value={s.symbol}>{s.name} · {s.total}건</option>)}
        </select></label>} onSummary={receiveSummary} />
      </div>
    </section>
  </div>;
}
