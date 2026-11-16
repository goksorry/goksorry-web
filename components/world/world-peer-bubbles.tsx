"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PeerBubble } from "./use-plaza-presence";

export type PeerBubblesHandle = { place: (heads: Record<string, { x: number; y: number }>) => void };

/** Chat lines over other viewers' ants. The renderer reports each peer's head every frame; bubbles follow it. */
export const WorldPeerBubbles = forwardRef<PeerBubblesHandle, { bubbles: PeerBubble[] }>(function WorldPeerBubbles({ bubbles }, ref) {
  const nodes = useRef(new Map<number, { id: string; node: HTMLDivElement }>());
  useImperativeHandle(ref, () => ({
    place(heads) {
      for (const { id, node } of nodes.current.values()) {
        const head = heads[id];
        node.hidden = !head;
        if (head) { node.style.left = `${head.x}px`; node.style.top = `${head.y}px`; }
      }
    }
  }), []);
  return <>{bubbles.map((bubble) => <div key={bubble.key} hidden className="world-speech-bubble world-peer-bubble" aria-hidden="true" ref={(node) => {
    if (node) nodes.current.set(bubble.key, { id: bubble.id, node }); else nodes.current.delete(bubble.key);
  }}>
    <p style={{ ["--bubble-ms" as string]: `${bubble.ms}ms` }}>{bubble.text}</p>
  </div>)}</>;
});
