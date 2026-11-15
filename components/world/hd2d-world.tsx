"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorldScene } from "@/lib/world";
import { WorldPierrot } from "./world-pierrot";
import { crowdCapacity, crowdDistribution } from "@/lib/world-presentation";
import type { RenderState, WorldRenderer } from "./hd2d-renderer";
import { WALL_PANEL_IDS, type WallModel, type WallView } from "@/lib/world-wall";

type Props = RenderState & {
  reduced: boolean; emote: string; children: ReactNode; wall: WallModel | null; view: WallView; styleKey: string;
  onScene: (scene: WorldScene) => void; onStep: () => void;
};
// Plaza entrances sit on the floor strip that every framed view keeps visible.
const ENTRANCES: { scene: WorldScene; x: number; z: number }[] = [{ scene: "ecosystem", x: -6.5, z: .2 }, { scene: "broadcast", x: -2.6, z: .2 }, { scene: "theater", x: 2.6, z: .2 }, { scene: "battle", x: 6.5, z: .2 }];
export default function HD2DWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), avatar = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldRenderer | null>(null), animation = useRef(0), latest = useRef(props);
  latest.current = props;
  const [onScreen, setOnScreen] = useState(true);
  const [mode, setMode] = useState("loading");
  const [nearby, setNearby] = useState<WorldScene | null>(null);
  const nearbyRef = useRef<WorldScene | null>(null);
  useEffect(() => {
    if (props.reduced) { setMode("reduced"); return; }
    let cancelled = false; setMode("loading");
    void import("./hd2d-renderer").then(({ createWorldRenderer }) => cancelled ? null : createWorldRenderer(canvas.current!, latest.current, {
      panels(rects) {
        // Pin each DOM twin (hit target + screen-reader copy) onto its wall panel.
        if (rects) for (const id of WALL_PANEL_IDS) {
          const element = host.current?.querySelector<HTMLElement>(`[data-wall-panel=${id}]`), r = rects[id];
          if (element) Object.assign(element.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
        }
      },
      avatar(x, y, position) {
        if (avatar.current) { avatar.current.style.left = `${x}px`; avatar.current.style.top = `${y}px`; avatar.current.dataset.position = `${position.x.toFixed(2)},${position.z.toFixed(2)}`; }
        const next = latest.current.scene === "plaza" ? ENTRANCES.find((e) => Math.hypot(e.x - position.x, e.z - position.z) < 1.4)?.scene ?? null : null;
        if (nearbyRef.current !== next) { nearbyRef.current = next; setNearby(next); }
      },
      step() { latest.current.onStep(); },
      failure() { setMode("failed"); cancelAnimationFrame(animation.current); }
    })).then((instance) => {
      if (!instance) return;
      if (cancelled) { instance.dispose(); return; }
      renderer.current = instance; instance.setView(latest.current.view); instance.update(latest.current); setMode("webgl");
      // Read-only measurement surface; measures actual renderer.render calls.
      Object.defineProperty(canvas.current!, "worldMetrics", { configurable: true, get: () => instance.metrics });
      // `bare` renders the room without wall data, for the static fallback art.
      Object.defineProperty(canvas.current!, "worldCapture", { configurable: true, value: (bare = false) => {
        if (bare) instance.setWall(null);
        instance.draw(); const image = canvas.current!.toDataURL("image/png");
        if (bare) { instance.setWall(latest.current.wall); instance.draw(); }
        return image;
      } });
      Object.defineProperty(canvas.current!, "worldWallTexture", { configurable: true, value: (id: "market" | "room" | "index" | "feed") => instance.wallTexture(id).toDataURL("image/png") });
      // The canvas is still display:none here; the mode effect draws once it has a layout box.
    }).catch((error) => { if (!cancelled) { console.warn("HD2D renderer unavailable", error); setMode("failed"); } });
    return () => { cancelled = true; cancelAnimationFrame(animation.current); renderer.current?.dispose(); renderer.current = null; };
  }, [props.reduced]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    instance.update({ ...props, paused: props.paused || !onScreen });
  }, [props.frame, props.scene, props.stock, props.mobile, props.color, props.paused, mode, onScreen]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    instance.setView(props.view);
    if (props.paused || !onScreen) instance.draw();
  }, [props.view, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl" || !host.current) return;
    const computed = getComputedStyle(host.current);
    instance.setWall(props.wall, {
      family: computed.fontFamily || "sans-serif",
      up: computed.getPropertyValue("--change-up").trim() || "#e0705f", down: computed.getPropertyValue("--change-down").trim() || "#6fa3e0"
    });
    if (props.paused || !onScreen) instance.draw();
  }, [props.wall, props.styleKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    cancelAnimationFrame(animation.current);
    if (props.paused || !onScreen) return;
    let last = 0;
    const tick = (time: number) => {
      if (document.hidden || latest.current.paused) return;
      // Mobile caps rendered frames, not merely avatar updates.
      if (!latest.current.mobile || time - last >= 1000 / 30 - 1) { instance.draw(time); last = time; }
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation.current);
  }, [props.mobile, props.paused, mode, onScreen]);
  useEffect(() => {
    if (!canvas.current || mode !== "webgl") return;
    const observer = new IntersectionObserver(entries => setOnScreen(entries[0].isIntersecting));
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [mode]);
  useEffect(() => {
    const observer = new ResizeObserver(() => { if (!latest.current.paused) renderer.current?.draw(); });
    if (host.current) observer.observe(host.current); return () => observer.disconnect();
  }, []);
  const summary = (props.scene === "battle" || props.scene === "ecosystem") ? props.frame.stocks.find((s) => s.symbol === props.stock) ?? props.frame.overall : props.frame.overall;
  const counts = crowdDistribution(summary, crowdCapacity(props.scene, props.mobile));
  const sides = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
  const fallback = mode !== "webgl";
  return <div ref={host} className="hd2d-stage" data-renderer={mode} data-population={sides.length + 1} data-hope={counts.bullish} data-fear={counts.bearish} data-neutral={counts.neutral}>
    {fallback && <div className="world-static-scene" aria-hidden="true" style={{ backgroundImage: `url(/world/static-${props.scene === "broadcast" ? "plaza" : props.scene}.png)` }}>
      {sides.map((side, i) => <span key={i} className="world-static-ant" data-side={side} style={{ left: `${21 + i * 17 % 57}%`, top: `${56 + i * 13 % 27}%`, backgroundPosition: `${(props.scene === "plaza" && i % 5 ? 3 : i % 4) / 3 * 100}% ${side === "bearish" ? 75 : side === "bullish" ? 100 : 0}%` }} />)}
    </div>}
    <canvas ref={canvas} className="hd2d-canvas" hidden={fallback} tabIndex={fallback ? -1 : 0} role="group" aria-label="개미 월드. 바닥 클릭 또는 방향키로 이동" onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.focus(); renderer.current?.click(event.clientX - bounds.left, event.clientY - bounds.top);
    }} onKeyDown={(event) => {
      const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (delta[event.key]) { event.preventDefault(); renderer.current?.move(...delta[event.key]); }
    }} />
    <div className="world-atmosphere" aria-hidden="true" data-mood={summary.total < 3 ? "watching" : summary.mood} />
    <div ref={avatar} className="world-avatar-label" data-testid="world-avatar" hidden={fallback}><span>{props.emote || "나"}</span></div>
    {props.scene !== "plaza" && <WorldPierrot summary={summary} recorded={props.scene === "theater"} />}
    {props.children}
    {nearby && <button className="world-nearby" onClick={() => props.onScene(nearby)}>{({ plaza: "광장", ecosystem: "개미 생태계", battle: "심리 전장", broadcast: "재난방송", theater: "개미극장" })[nearby]} 입구 · 들어가기 ↗</button>}
    <p className="world-render-note">{mode === "loading" ? "화면 불러오는 중…" : mode === "reduced" ? "동작 줄이기 · 정적 장면" : mode === "failed" ? "정적 장면 · 정보 탐색 가능" : "바닥 클릭 / 방향키로 이동"}</p>
  </div>;
}
