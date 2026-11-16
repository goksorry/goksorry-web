"use client";
import { forwardRef, useEffect, useState } from "react";
import { onOwnChatMessage } from "@/lib/chat-own-message";

const MIN_MS = 3000, MAX_MS = 10000, PER_CHAR_MS = 70;
/** How long a bubble stays: grows with the text, 3s..10s (100 chars reach the cap). */
export const bubbleDuration = (text: string) => Math.min(MAX_MS, Math.max(MIN_MS, MIN_MS + text.length * PER_CHAR_MS));

type Bubble = { id: number; text: string; ms: number };

/** The visitor's last sent chat line over their ant; the parent pins the outer box to the head. */
export const WorldSpeechBubble = forwardRef<HTMLDivElement>(function WorldSpeechBubble(_, ref) {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  useEffect(() => onOwnChatMessage((text) => setBubble((last) => ({ id: (last?.id ?? 0) + 1, text, ms: bubbleDuration(text) }))), []);
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble((current) => current?.id === bubble.id ? null : current), bubble.ms);
    return () => clearTimeout(timer);
  }, [bubble]);
  return <div ref={ref} className="world-speech-bubble" aria-hidden="true" hidden={!bubble}>
    {bubble && <p key={bubble.id} style={{ ["--bubble-ms" as string]: `${bubble.ms}ms` }}>{bubble.text}</p>}
  </div>;
});
