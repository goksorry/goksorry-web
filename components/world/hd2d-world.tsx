"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorldScene, WorldSide } from "@/lib/world";
import { WorldPierrot } from "./world-pierrot";
import { crowdDistribution } from "@/lib/world-presentation";
import type { RenderState, WorldRenderer } from "./hd2d-renderer";

type Props = RenderState & { reduced: boolean; emote: string; children: ReactNode; onEvidence: (side: WorldSide) => void; onScene: (scene: WorldScene) => void; onStep: () => void };
export default function HD2DWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), avatar = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldRenderer | null>(null), animation = useRef(0), latest = useRef(props);
  latest.current = props;
  const [mode, setMode] = useState("loading");
  const [nearby, setNearby] = useState<WorldScene | null>(null);
  const nearbyRef = useRef<WorldScene | null>(null);
  useEffect(() => {
    if (props.reduced) { setMode("reduced"); return; }
    let cancelled = false; setMode("loading");
    void import("./hd2d-renderer").then(({ createWorldRenderer }) => cancelled ? null : createWorldRenderer(canvas.current!, latest.current, {
      anchor(name, x, y, width) {
        const element = host.current?.querySelector<HTMLElement>(`[data-screen=${name}]`);
        if (element) { element.style.setProperty("--anchor-x", `${x}px`); element.style.setProperty("--anchor-y", `${y}px`); element.style.setProperty("--screen-width", `${width}px`); }
      },
      avatar(x, y, position) {
        if (avatar.current) { avatar.current.style.left = `${x}px`; avatar.current.style.top = `${y}px`; avatar.current.dataset.position = `${position.x.toFixed(2)},${position.z.toFixed(2)}`; }
        const entrances: { scene: WorldScene; x: number; z: number }[] = [{ scene: "ecosystem", x: -6, z: 1.4 }, { scene: "battle", x: 6, z: 1.4 }, { scene: "broadcast", x: -6, z: 5 }, { scene: "theater", x: 6, z: 5 }];
        const next = latest.current.scene === "plaza" ? entrances.find((e) => Math.hypot(e.x - position.x, e.z - position.z) < 2)?.scene ?? null : null;
        if (nearbyRef.current !== next) { nearbyRef.current = next; setNearby(next); }
      },
      evidence(side) { latest.current.onEvidence(side); }, step() { latest.current.onStep(); },
      failure() { setMode("failed"); cancelAnimationFrame(animation.current); }
    })).then((instance) => {
      if (!instance) return;
      if (cancelled) { instance.dispose(); return; }
      renderer.current = instance; instance.update(latest.current); setMode("webgl");
      // Read-only measurement surface; measures actual renderer.render calls.
      Object.defineProperty(canvas.current!, "worldMetrics", { configurable: true, get: () => instance.metrics });
      Object.defineProperty(canvas.current!, "worldCapture", { configurable: true, value: () => { instance.draw(); return canvas.current!.toDataURL("image/png"); } });
      instance.draw();
    }).catch((error) => { if (!cancelled) { console.warn("HD2D renderer unavailable", error); setMode("failed"); } });
    return () => { cancelled = true; cancelAnimationFrame(animation.current); renderer.current?.dispose(); renderer.current = null; };
  }, [props.reduced]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    instance.update(props);
  }, [props.frame, props.scene, props.stock, props.mobile, props.color, props.paused, mode]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    cancelAnimationFrame(animation.current);
    if (props.paused) return;
    let last = 0;
    const tick = (time: number) => {
      if (document.hidden || latest.current.paused) return;
      // Mobile caps rendered frames, not merely avatar updates.
      if (!latest.current.mobile || time - last >= 1000 / 30 - 1) { instance.draw(time); last = time; }
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation.current);
  }, [props.mobile, props.paused, mode]);
  useEffect(() => {
    const observer = new ResizeObserver(() => { if (!latest.current.paused) renderer.current?.draw(); });
    if (host.current) observer.observe(host.current); return () => observer.disconnect();
  }, []);
  const summary = (props.scene === "battle" || props.scene === "ecosystem") ? props.frame.stocks.find((s) => s.symbol === props.stock) ?? props.frame.overall : props.frame.overall;
  const counts = crowdDistribution(summary, props.mobile ? 23 : 47);
  const sides = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
  const fallback = mode !== "webgl";
  return <div ref={host} className="hd2d-stage" data-renderer={mode} data-population={sides.length + 1} data-hope={counts.bullish} data-fear={counts.bearish} data-neutral={counts.neutral}>
    {fallback && <div className="world-static-scene" aria-hidden="true" style={{ backgroundImage: `url(/world/static-${props.scene === "broadcast" ? "plaza" : props.scene}.png)` }}>
      {sides.map((side, i) => <span key={i} className="world-static-ant" data-side={side} style={{ left: `${21 + i * 17 % 57}%`, top: `${56 + i * 13 % 27}%`, backgroundPosition: `${i % 4 / 3 * 100}% ${side === "bearish" ? 75 : side === "bullish" ? 100 : 0}%` }} />)}
    </div>}
    <canvas ref={canvas} className="hd2d-canvas" hidden={fallback} tabIndex={fallback ? -1 : 0} role="group" aria-label="개미 월드. 바닥 클릭 또는 방향키로 이동" onPointerDown={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.focus(); renderer.current?.click(event.clientX - bounds.left, event.clientY - bounds.top);
    }} onKeyDown={(event) => {
      const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (delta[event.key]) { event.preventDefault(); renderer.current?.move(...delta[event.key]); }
    }} />
    <div className="world-atmosphere" aria-hidden="true" data-mood={summary.total < 3 ? "watching" : summary.mood} />
    <div ref={avatar} className="world-avatar-label" data-testid="world-avatar" hidden={fallback}><span>{props.emote || "나"}</span></div>
    <WorldPierrot summary={summary} recorded={props.scene === "theater"} />
    {props.children}
    {nearby && <button className="world-nearby" onClick={() => props.onScene(nearby)}>{({ plaza: "광장", ecosystem: "개미 생태계", battle: "심리 전장", broadcast: "재난방송", theater: "개미극장" })[nearby]} 입구 · 들어가기 ↗</button>}
    <p className="world-render-note">{mode === "loading" ? "골목을 여는 중…" : mode === "reduced" ? "동작 줄이기 · 정적 장면" : mode === "failed" ? "정적 장면 · 정보 탐색 가능" : "바닥 클릭 / 방향키로 이동 · 개미 선택으로 근거 확인"}</p>
  </div>;
}
