"use client";
import type { SceneBoardModel } from "@/lib/world-scene-boards";
import { WallSkeleton } from "./world-screens";

const ACTION: Record<SceneBoardModel["scene"], string> = {
  ecosystem: "종목 목록 열기", battle: "진영·근거 보기", broadcast: "커뮤니티 목록 열기", theater: "극장 기록 근거 보기"
};

/** Readable copy of a scene board: what the texture shows, for assistive tech and the no-WebGL2 card. */
function Copy({ model }: { model: SceneBoardModel }) {
  if (model.state === "loading") return <WallSkeleton />;
  if (model.state === "failed") return <p className="world-screen-meta">조회 실패</p>;
  switch (model.scene) {
    case "ecosystem":
      return model.items.length ? <ul className="world-wall-list">{model.items.map((item) => <li key={item.symbol}><p>{item.rank} {item.name}</p><span>{item.count} · {item.hope} · {item.verdict}</span></li>)}</ul>
        : <p className="world-screen-meta">분석된 종목이 없습니다. 새 표본을 기다리고 있습니다.</p>;
    case "broadcast":
      return model.items.length ? <ul className="world-wall-list">{model.items.map((item) => <li key={item.id}><p>{item.name} · {item.index}</p><span>{item.ratios} · {item.status}</span></li>)}</ul>
        : <p className="world-screen-meta">커뮤니티 데이터가 없습니다.</p>;
    case "battle":
      return <>
        <p className="world-screen-meta">전장 종목 · {model.scope}</p>
        <ul className="world-wall-list">{model.camps.map((camp) => <li key={camp.side} data-label={camp.side}><p>{camp.label} {camp.value}</p><span>{camp.sub}</span></li>)}</ul>
        <p className="world-screen-meta">{model.note}</p>
        {model.fresh && <p role="status" className="world-screen-status">{model.fresh}</p>}
      </>;
    case "theater":
      return <><p className="world-screen-meta">{model.date}</p><p className="world-screen-headline">{model.headline}</p>{model.line && <p className="world-screen-meta">{model.line}</p>}
        {model.timeline && <p className="world-screen-meta">{model.timeline.recorded} · {model.timeline.clock} · {model.timeline.state}</p>}</>;
  }
}

/**
 * DOM twin of a non-plaza scene board, pinned like the plaza panels (`data-wall-panel`): screen-reader copy plus one
 * transparent hit target that opens the scene's detail. Without WebGL2 it is a readable card.
 */
export function SceneBoardDom({ model, onOpen }: { model: SceneBoardModel; onOpen: (origin: DOMRect) => void }) {
  const disabled = model.scene === "theater" && !model.line;
  return <div className="world-wall-dom world-scene-dom">
    <section tabIndex={-1} className="world-wall-panel" data-wall-panel={model.id} aria-label={model.title}>
      <div className="world-wall-copy"><h2 className="world-screen-title">{model.title}</h2><Copy model={model} /></div>
      <button type="button" className="world-wall-open" disabled={disabled} onClick={(event) => onOpen(event.currentTarget.closest("section")!.getBoundingClientRect())}><span>{ACTION[model.scene]}</span></button>
    </section>
  </div>;
}
