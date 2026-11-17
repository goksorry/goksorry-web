"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { chatConnection } from "@/lib/chat-connection";
import type { PresenceScene } from "@/lib/chat-types";
import type { Point } from "@/lib/world-navigation";
import { applyPresenceEvent, emptyPresence } from "@/lib/world-presence";
import { bubbleDuration } from "./world-speech-bubble";
import type { WorldRenderer } from "./hd2d-renderer";

/** Clicks and arrow-key steps closer together than this send only the last destination. */
const MOVE_GAP_MS = 400;

export type PeerBubble = { id: string; key: number; text: string; ms: number };
export type PlazaPresenceView = {
  /** 0-based room, null until the hub has placed this viewer. */
  room: number | null;
  peers: number;
  bubbles: PeerBubble[];
  /** Last refusal from the hub (full room, too many switches). */
  error: string | null;
  switchRoom: (room: number) => void;
  /** Feed the renderer's `walk` event here. */
  walked: (target: Point) => void;
};

// Each scene's room survives reconnects and scene trips within this tab (the hub keeps it when it still has a place).
const lastRoom: Partial<Record<PresenceScene, number>> = {};

/** Shares the visitor's ant in `scene` (none: not shared) through the chat hub, and shows the other viewers of its room. */
export function usePlazaPresence(renderer: RefObject<WorldRenderer | null>, scene: PresenceScene | null): PlazaPresenceView {
  const active = scene !== null;
  const [room, setRoom] = useState<number | null>(null);
  const [peers, setPeers] = useState(0);
  const [bubbles, setBubbles] = useState<PeerBubble[]>([]);
  const [error, setError] = useState<string | null>(null);
  const move = useRef<{ last: number; timer: number | null; pending: Point | null }>({ last: 0, timer: null, pending: null });
  const bubbleKey = useRef(0);

  useEffect(() => {
    if (!scene) return;
    const release = chatConnection.acquire();
    let presence = emptyPresence(), inside = false;

    const push = () => {
      renderer.current?.setPeers([...presence.peers.values()]);
      setRoom(presence.room);
      setPeers(presence.peers.size);
    };
    const reset = () => {
      presence = emptyPresence();
      setBubbles([]);
      push();
    };
    const enter = () => {
      if (document.hidden) return;
      const at = renderer.current?.position ?? { x: 0, z: .4 };
      const room = lastRoom[scene];
      inside = chatConnection.send({ type: "ant.enter", x: at.x, z: at.z, scene, ...(room !== undefined ? { room } : {}) });
    };
    const leave = () => {
      if (inside) chatConnection.send({ type: "ant.leave" });
      inside = false;
      reset();
    };

    const offOpen = chatConnection.onOpen(() => {
      reset(); // a new socket is a new ant: the hub forgot the old one
      enter();
    });
    const offEvent = chatConnection.onEvent((event) => {
      if (event.type === "ant.error") { setError(event.message); return; }
      if (event.type === "ant.room") {
        if ((event.scene ?? "plaza") !== scene) return; // a late snapshot of the scene this tab just left
        lastRoom[scene] = event.room; setError(null);
      }
      if (!event.type.startsWith("ant.") && event.type !== "chat.message") return;
      if (applyPresenceEvent(presence, event as Parameters<typeof applyPresenceEvent>[1])) push();
      if (event.type === "chat.message" && event.ant_id && presence.peers.has(event.ant_id)) {
        const id = event.ant_id, ms = bubbleDuration(event.message.text), key = ++bubbleKey.current;
        renderer.current?.say(id, ms / 1000);
        setBubbles((current) => [...current.filter((b) => b.id !== id), { id, key, text: event.message.text, ms }]);
        window.setTimeout(() => setBubbles((current) => current.filter((b) => b.key !== key)), ms);
      }
      if (event.type === "ant.leave") setBubbles((current) => current.filter((b) => b.id !== event.id));
    });
    const visibility = () => { if (document.hidden) leave(); else if (chatConnection.isOpen()) enter(); };
    document.addEventListener("visibilitychange", visibility);
    if (chatConnection.isOpen()) enter();

    const pending = move.current;
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      offOpen(); offEvent();
      if (pending.timer !== null) window.clearTimeout(pending.timer);
      pending.timer = null; pending.pending = null;
      leave();
      release();
    };
  }, [scene, renderer]);

  const walked = useCallback((target: Point) => {
    if (!active) return;
    const state = move.current, send = (point: Point) => {
      state.last = Date.now(); state.pending = null;
      chatConnection.send({ type: "ant.move", x: point.x, z: point.z });
    };
    const wait = MOVE_GAP_MS - (Date.now() - state.last);
    if (wait <= 0 && state.timer === null) { send(target); return; }
    state.pending = target;
    if (state.timer === null) state.timer = window.setTimeout(() => {
      state.timer = null;
      if (state.pending) send(state.pending);
    }, Math.max(0, wait));
  }, [active]);

  const switchRoom = useCallback((next: number) => {
    setError(null);
    if (!chatConnection.send({ type: "ant.switch", room: next })) setError("채팅 서버에 연결되지 않았습니다.");
  }, []);

  return { room, peers, bubbles, error, switchRoom, walked };
}
