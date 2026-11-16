"use client";
import { percent, type WorldSummary } from "@/lib/world";
import { ratioGauge } from "@/lib/world-presentation";
import type { CSSProperties } from "react";
import { WALL_PANELS, wallPanelLoading, type WallModel, type WallPanelId } from "@/lib/world-wall";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import { WALL_SKELETON_COLOR, WALL_SKELETON_WIDTHS } from "./wall-skeleton";

export function SummaryNumbers({ summary }: { summary: Omit<WorldSummary, "evidence"> }) {
  const gauge = ratioGauge(summary);
  return <div className="world-numbers">
    <div className="world-index-number"><strong>{summary.total ? summary.index.toFixed(1) : "—"}</strong><span>/ 10</span></div>
    {/* Same left-to-right gauge as the wall: fear fills from the left, hope from the right. */}
    <div className="world-ratios"><span className="world-fear">공포 <b>{percent(summary.fear_ratio)}</b></span><span className="world-hope">희망 <b>{percent(summary.hope_ratio)}</b></span></div>
    <div className="world-ratio-track" aria-hidden="true"><i className="world-ratio-fear" style={{ width: `${gauge.fear * 100}%` }} /><i className="world-ratio-hope" style={{ width: `${gauge.hope * 100}%` }} /></div>
    <span className="world-sample">분석 표본 {summary.total.toLocaleString()}건 <span>· 중립 {summary.neutral.toLocaleString()}건</span></span>
  </div>;
}

/** DOM twin of the wall texture skeleton: same row rhythm and colour, announced once as loading. */
export function WallSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="world-skeleton" role="status" style={{ "--world-skeleton": WALL_SKELETON_COLOR } as CSSProperties}>
    <span className="sr-only">불러오는 중…</span>
    {Array.from({ length: rows }, (_, i) => <i key={i} aria-hidden="true" style={{ width: `${WALL_SKELETON_WIDTHS[i % WALL_SKELETON_WIDTHS.length] * 100}%` }} />)}
  </div>;
}

const waiting = (state: "loading" | "ready" | "failed", empty: string) => state === "loading" ? <WallSkeleton /> : <p className="world-screen-meta">{state === "failed" ? "조회 실패" : empty}</p>;

/**
 * DOM twin of the WebGL wall. With WebGL the text lives in the scene textures:
 * each section is pinned to its panel's projected rectangle, its copy is only
 * for assistive tech, and its button is the transparent hit target. Without
 * WebGL2 (unsupported browser) or after a renderer failure the same sections are visible cards.
 */
export function WorldWallDom({ model, onOpen, onCommunity, onFocusPanel }: {
  model: WallModel; onOpen: (panel: WallPanelId, origin: DOMRect) => void;
  /** A column of the community board: that community's mood and evidence. */
  onCommunity: (id: SourceGroupId) => void;
  onFocusPanel?: (panel: WallPanelId) => void;
}) {
  const section = (id: WallPanelId, label: string, action: string, body: React.ReactNode, extra: { id?: string; className?: string } = {}) =>
    <section key={id} id={extra.id} tabIndex={-1} className={`world-wall-panel ${extra.className ?? ""}`} data-wall-panel={id} data-section={WALL_PANELS[id].section} aria-label={label}>
      <div className="world-wall-copy"><h2 className="world-screen-title">{label}</h2>{body}</div>
      <button type="button" className="world-wall-open" onFocus={() => onFocusPanel?.(id)} onClick={(event) => onOpen(id, event.currentTarget.closest("section")!.getBoundingClientRect())}><span>{action}</span></button>
    </section>;
  return <div className="world-wall-dom">
    {section("market", "시장 지수", "시장 지수 자세히", model.market.items.length
      ? <ul className="world-wall-market">{model.market.items.map((item) => <li key={item.id} data-tone={item.tone}><span>{item.label}</span><strong>{item.value}</strong><em>{item.delta}</em></li>)}</ul>
      : waiting(model.market.state, "시장 지수 없음"))}
    {section("room", "곡소리방", "곡소리방 열기·글쓰기", model.room.items.length
      ? <ul className="world-wall-list">{model.room.items.map((item) => <li key={item.id}><p>{item.text}</p><span>{item.author}{item.guest ? "*" : ""} · {item.time}{item.replies ? ` · 덧글 ${item.replies}` : ""}</span></li>)}</ul>
      : waiting(model.room.state, "아직 글이 없습니다"))}
    {section("pierrot", "주식 삐에로", "삐에로·지수 자세히", wallPanelLoading(model, "pierrot") ? <WallSkeleton rows={3} /> : <figure className="world-pierrot" data-band={model.pierrot.band}>
      {/* Original 300×200 artwork: no crop, redraw, or substitute character. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={model.pierrot.src} width={300} height={200} alt={`주식 삐에로 · ${model.pierrot.label}`} />
      <figcaption>현재 분위기 · {model.pierrot.label}</figcaption>
    </figure>)}
    {section("index", "곡소리 지수", "산식·시장 지표", wallPanelLoading(model, "index") ? <WallSkeleton rows={3} /> : <>
      <SummaryNumbers summary={model.index.summary} />
      <p className="world-screen-meta">최근 6시간 · <time dateTime={model.index.dataAt ?? undefined}>{model.index.time}</time></p>
      <p className="world-screen-status" role="status" hidden={model.index.status === "관측 중"}>{model.index.status}</p>
    </>, { id: "world-index-wall", className: "world-index-screen" })}
    {section("feed", "곡소리 피드", "곡소리 피드 전체 보기", model.feed.items.length
      ? <ul className="world-wall-list">{model.feed.items.map((item) => <li key={item.key} data-label={item.label}><p>{item.title}</p><span>{[item.source, item.symbol, item.time].filter(Boolean).join(" · ")}</span></li>)}</ul>
      : waiting(model.feed.state, "최근 6시간 글 없음"), { id: "world-feed-wall" })}
    <CommunityBoard model={model.communities} onCommunity={onCommunity} onFocus={() => onFocusPanel?.("communities")} onOpen={(origin) => onOpen("communities", origin)} />
  </div>;
}

/**
 * DOM twin of the community board. Each community is its own hit target, one quarter of the panel like its painted column,
 * opening that community's evidence; without WebGL2 they are the card's buttons. Until there are communities to show, the
 * whole panel opens the index tab like the 곡소리 지수 panel.
 */
function CommunityBoard({ model, onCommunity, onFocus, onOpen }: { model: WallModel["communities"]; onCommunity: (id: SourceGroupId) => void; onFocus: () => void; onOpen: (origin: DOMRect) => void }) {
  const { items, state } = model;
  return <section tabIndex={-1} className="world-wall-panel world-communities-screen" data-wall-panel="communities" data-section={WALL_PANELS.communities.section} aria-label="커뮤니티 현황">
    <div className="world-wall-copy"><h2 className="world-screen-title">커뮤니티 현황</h2>
      {state === "loading" ? <WallSkeleton rows={2} /> : !items.length && <p className="world-screen-meta">{state === "failed" ? "조회 실패" : "커뮤니티 데이터 없음"}</p>}
    </div>
    {state !== "loading" && items.length ? <div className="world-wall-communities">{items.map((c) =>
      <button key={c.id} type="button" data-tone={c.tone} onFocus={onFocus} onClick={() => onCommunity(c.id)}>
        <b>{c.name}</b><span>곡소리 지수 {c.index} / 10 · 표본 {c.total.toLocaleString()}건</span>
        <span>공포 {percent(c.fear_ratio)} · 희망 {percent(c.hope_ratio)}</span><span>{c.status}</span><span className="world-sr-only">근거 보기</span>
      </button>)}</div>
      : <button type="button" className="world-wall-open" onFocus={onFocus} onClick={(event) => onOpen(event.currentTarget.closest("section")!.getBoundingClientRect())}><span>곡소리 지수·커뮤니티 자세히</span></button>}
  </section>;
}
