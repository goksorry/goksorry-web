"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldMood } from "@/lib/world";

const labels: Record<WorldMood, string> = { fear: "손수건을 늘어뜨리고 주저앉은 삐에로", hope: "한 발로 위태롭게 뽐내는 삐에로", mixed: "양쪽을 살피며 허둥대는 삐에로", neutral: "앉아서 기다리는 삐에로", watching: "표본을 기다리는 삐에로" };

export function PierrotStage({ mood }: { mood: WorldMood }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => setPaused(media.matches || document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (ref.current) observer.observe(ref.current);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); media.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return <div ref={ref} className="pierrot-stage" data-mood={mood} data-paused={paused} role="img" aria-label={labels[mood]}>
    <span className="stage-board" aria-hidden="true">{mood === "fear" ? "↘" : mood === "hope" ? "↗" : "↔"}</span>
    <div className="pierrot-actor" key={mood}><img src={`/images/pierrot/${mood}.svg`} alt="" width="96" height="96" draggable={false} /></div>
    <span className="stage-ant stage-ant-left" aria-hidden="true" /><span className="stage-ant stage-ant-right" aria-hidden="true" />
    <span className="stage-paper" aria-hidden="true" />
  </div>;
}
