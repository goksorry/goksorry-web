"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PLAZA_ENTRANCES, entranceAt, swipeStep } from "@/lib/world-navigation";
import type { WorldScene } from "@/lib/world";
import { WorldPierrot } from "./world-pierrot";
import { WorldSpeechBubble } from "./world-speech-bubble";
import { WorldPeerBubbles, type PeerBubblesHandle } from "./world-peer-bubbles";
import { WorldRoomBadge } from "./world-room-badge";
import { usePlazaPresence } from "./use-plaza-presence";
import { useSessionSnapshot } from "@/components/use-session-snapshot";
import { crowdCapacity, crowdDistribution } from "@/lib/world-presentation";
import type { RenderState, WorldRenderer } from "./hd2d-renderer";
import { supportsWebGL2 } from "./webgl-support";
import { useWorldSnack } from "./world-snackbar";
import { boardSpecs, type BoardSource } from "./board-specs";
import type { BoardSpec } from "./board-layer";
import { type WallModel, type WallSection, type WallView } from "@/lib/world-wall";

type Props = RenderState & {
  emote: string; children: ReactNode; board: BoardSource; view: WallView; styleKey: string;
  /** Theater: the day's records are still loading (the no-WebGL card says so rather than "기록 없음"). */
  pending?: boolean;
  /** The plaza shares the visitor's ant with other viewers (the chat hub is deployed). */
  shared?: boolean;
  onScene: (scene: WorldScene) => void; onStep: () => void;
  /** The zoomed section view follows the visitor into another wall section. */
  onSection?: (section: WallSection) => void;
};
/** `unsupported` (no WebGL2) is the only designed static view; `failed` is a runtime error that offers a retry. */
type RenderMode = "loading" | "webgl" | "unsupported" | "failed";
const NOTE: Record<RenderMode, string> = {
  loading: "화면 불러오는 중…", webgl: "바닥 클릭 / 방향키로 이동",
  unsupported: "이 브라우저는 3D 화면(WebGL2)을 지원하지 않아 간단한 화면으로 보여줍니다", failed: "3D 화면 오류 · 간단한 화면"
};
export default function HD2DWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), avatar = useRef<HTMLDivElement>(null), bubble = useRef<HTMLDivElement>(null);
  const specs = useRef<BoardSpec[]>([]);
  const renderer = useRef<WorldRenderer | null>(null), animation = useRef(0), latest = useRef(props);
  latest.current = props;
  const [onScreen, setOnScreen] = useState(true);
  const [mode, setMode] = useState<RenderMode>("loading"), [attempt, setAttempt] = useState(0);
  const [nearby, setNearby] = useState<WorldScene | null>(null);
  // Other viewers on the plaza: shared through the chat hub while the 3D plaza is shown.
  const { user } = useSessionSnapshot();
  const presence = usePlazaPresence(renderer, !!props.shared && !user?.profile_setup_required && mode === "webgl" && props.scene === "plaza");
  const peerBubbles = useRef<PeerBubblesHandle>(null), walked = useRef(presence.walked);
  walked.current = presence.walked;
  const nearbyRef = useRef<WorldScene | null>(null), nearButton = useRef<HTMLButtonElement>(null);
  // Last screen rectangles of the painted tags; the entrance button is pinned over its sign.
  const tagRects = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  // Touch swipes on the zoomed phone view step through the wall sections like the arrow buttons.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null), swiped = useRef(false);
  const swipeable = props.scene === "plaza" && props.view.layout === "sectioned" && !props.view.overview;
  const pinEntrance = () => {
    const button = nearButton.current, r = button && tagRects.current[`entrance-${nearbyRef.current}`];
    if (button && r) Object.assign(button.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  useEffect(() => {
    if (!supportsWebGL2()) { setMode("unsupported"); return; }
    let cancelled = false; setMode("loading");
    void import("./hd2d-renderer").then(({ createWorldRenderer }) => cancelled ? null : createWorldRenderer(canvas.current!, latest.current, {
      panels(rects) {
        // Pin each DOM twin (hit target + screen-reader copy) onto its wall panel.
        if (rects) for (const [id, r] of Object.entries(rects)) {
          const element = host.current?.querySelector<HTMLElement>(`[data-wall-panel=${id}]`);
          if (element) Object.assign(element.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
        }
      },
      avatar(x, y, position) {
        if (avatar.current) { avatar.current.style.left = `${x}px`; avatar.current.style.top = `${y}px`; avatar.current.dataset.position = `${position.x.toFixed(2)},${position.z.toFixed(2)}`; }
        if (bubble.current) { bubble.current.style.left = `${x}px`; bubble.current.style.top = `${y}px`; }
        const next = entranceAt(latest.current.scene, position)?.scene ?? null;
        if (nearbyRef.current !== next) { nearbyRef.current = next; setNearby(next); }
      },
      labels(rects) { tagRects.current = rects; pinEntrance(); },
      step() { latest.current.onStep(); },
      walk(target) { walked.current(target); },
      peers(heads) { peerBubbles.current?.place(heads); },
      section(next) { latest.current.onSection?.(next); },
      enter(scene) { latest.current.onScene(scene); },
      failure() { setMode("failed"); cancelAnimationFrame(animation.current); }
    })).then((instance) => {
      if (!instance) return;
      if (cancelled) { instance.dispose(); return; }
      renderer.current = instance; instance.setView(latest.current.view); instance.update(latest.current); setMode("webgl");
      // Read-only measurement surface; measures actual renderer.render calls.
      Object.defineProperty(canvas.current!, "worldMetrics", { configurable: true, get: () => instance.metrics });
      // `bare` renders the room without wall data or the visitor's tag, for the static fallback art (door plates are scenery).
      Object.defineProperty(canvas.current!, "worldCapture", { configurable: true, value: (bare = false) => {
        if (bare) { instance.setBoards([]); instance.setVisitorTag(null); }
        instance.draw(); const image = canvas.current!.toDataURL("image/png");
        if (bare) { instance.setBoards(specs.current); instance.setVisitorTag(latest.current.emote); instance.draw(); }
        return image;
      } });
      Object.defineProperty(canvas.current!, "worldWallTexture", { configurable: true, value: (id: string) => instance.wallTexture(id)?.toDataURL("image/png") ?? null });
      // The canvas is still display:none here; the mode effect draws once it has a layout box.
    }).catch((error) => { if (!cancelled) { console.warn("HD2D renderer unavailable", error); setMode("failed"); } });
    return () => { cancelled = true; cancelAnimationFrame(animation.current); renderer.current?.dispose(); renderer.current = null; };
  }, [attempt]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    instance.update({ ...props, paused: props.paused || !onScreen });
  }, [props.frame, props.absent, props.scene, props.stock, props.mobile, props.color, props.paused, props.reduced, mode, onScreen]);
  useLayoutEffect(pinEntrance, [nearby]);
  useWorldSnack("renderer", mode === "failed" ? { text: "3D 화면을 불러오지 못했습니다", tone: "error", action: { label: "3D 화면 다시 시도", run: () => setAttempt((n) => n + 1) } } : null);
  useEffect(() => { renderer.current?.setVisitorTag(props.emote); }, [props.emote, mode]);
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl") return;
    instance.setView(props.view);
    if (props.paused || !onScreen) instance.draw();
  }, [props.view, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const instance = renderer.current; if (!instance || mode !== "webgl" || !host.current) return;
    const computed = getComputedStyle(host.current);
    const style = {
      family: computed.fontFamily || "sans-serif",
      up: computed.getPropertyValue("--change-up").trim() || "#e0705f", down: computed.getPropertyValue("--change-down").trim() || "#6fa3e0"
    };
    specs.current = boardSpecs(props.board, style); instance.setFont(style.family);
    instance.setBoards(specs.current); instance.setBand(props.board?.kind === "plaza" ? props.board.model.pierrot.band : null);
    if (props.paused || !onScreen) instance.draw();
  }, [props.board, props.styleKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const summary = props.scene === "battle" ? props.frame.stocks.find((s) => s.symbol === props.stock) ?? props.frame.overall : props.frame.overall;
  const counts = crowdDistribution(summary, crowdCapacity(props.scene, props.mobile));
  const sides = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
  const fallback = mode !== "webgl", designedStatic = mode === "unsupported" || mode === "failed";
  return <div ref={host} className="hd2d-stage" data-renderer={mode} data-static={designedStatic || undefined} data-population={sides.length + 1} data-hope={counts.bullish} data-fear={counts.bearish} data-neutral={counts.neutral} onPointerDownCapture={(event) => {
      swipe.current = event.pointerType !== "mouse" && swipeable ? { x: event.clientX, y: event.clientY, t: event.timeStamp } : null;
    }} onPointerUpCapture={(event) => {
      const start = swipe.current; swipe.current = null;
      const step = start ? swipeStep(event.clientX - start.x, event.clientY - start.y, event.timeStamp - start.t) : 0;
      if (!step) return;
      // The click that may follow the gesture opens nothing and is not a floor click.
      swiped.current = true; setTimeout(() => { swiped.current = false; }, 400);
      props.onSection?.(Math.max(0, Math.min(2, props.view.section + step)) as WallSection);
    }} onPointerCancel={() => { swipe.current = null; }} onClickCapture={(event) => {
      if (swiped.current) { swiped.current = false; event.preventDefault(); event.stopPropagation(); }
    }}>
    {fallback && <div className="world-static-scene" aria-hidden="true" style={{ backgroundImage: `url(/world/static-${props.scene}.png)` }}>
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
    {!fallback && <WorldSpeechBubble ref={bubble} />}
    {!fallback && props.scene === "plaza" && <WorldPeerBubbles ref={peerBubbles} bubbles={presence.bubbles} />}
    {!fallback && props.scene === "plaza" && <WorldRoomBadge room={presence.room} peers={presence.peers} error={presence.error} onSwitch={presence.switchRoom} />}
    {/* With WebGL the portrait is painted on the scene board; the card is for the no-WebGL2 view. */}
    {props.scene !== "plaza" && designedStatic && <WorldPierrot summary={summary} recorded={props.scene === "theater"} missing={props.scene !== "theater" ? "" : props.pending ? "기록 확인 중…" : props.absent ? "기록 없음" : ""} />}
    {props.children}
    {/* With WebGL the prompt is painted over the entrance; this button is its pinned hit target (visible without WebGL). */}
    {nearby && <button ref={nearButton} className="world-nearby" onClick={() => props.onScene(nearby)}>{PLAZA_ENTRANCES.find((e) => e.scene === nearby)?.name} 입구 · 들어가기 ↗</button>}
    <p className="world-render-note" role={mode === "loading" ? "status" : undefined}>{NOTE[mode]}</p>
  </div>;
}
