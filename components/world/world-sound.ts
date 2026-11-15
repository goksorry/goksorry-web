"use client";
import { useCallback, useEffect, useRef } from "react";

export function useWorldSound(muted: boolean, paused: boolean, reduced: boolean) {
  const audio = useRef<AudioContext | null>(null);
  const enabled = useRef(false);
  enabled.current = !muted && !paused && !reduced;
  const play = useCallback((kind: "step" | "signal" | "alarm") => {
    if (!enabled.current) return;
    try {
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      void context.resume();
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = kind === "step" ? "triangle" : "sine";
      const start = context.currentTime;
      oscillator.frequency.setValueAtTime(kind === "step" ? 130 : kind === "alarm" ? 440 : 660, start);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "alarm" ? 320 : 80, start + .11);
      gain.gain.setValueAtTime(.025, start);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .13);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + .14);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio support is optional; world navigation remains available. */ }
  }, []);
  useEffect(() => { if (!enabled.current) void audio.current?.suspend(); }, [muted, paused, reduced]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  return play;
}
