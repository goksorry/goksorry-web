"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCleanFilter } from "@/components/clean-filter-provider";

type OverlayBurst = {
  id: number;
  x: string;
  y: string;
  size: string;
  color: string;
  mode: "pretty" | "grim";
  expiresAt: number;
};

const FLASH_INTERVAL_MS = 250;
const FLASH_DURATION_MS = 650;

const PRETTY_COLORS = [
  "rgba(255, 210, 236, 0.42)",
  "rgba(255, 238, 196, 0.34)",
  "rgba(214, 188, 255, 0.32)",
  "rgba(209, 244, 255, 0.28)"
];

const GRIM_COLORS = [
  "rgba(82, 22, 22, 0.42)",
  "rgba(34, 18, 46, 0.38)",
  "rgba(16, 20, 34, 0.4)",
  "rgba(101, 45, 18, 0.34)"
];

const randomBetween = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

const pickRandom = <T,>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)] as T;
};

export function CleanFilterOverlay() {
  const { cleanFilterEnabled, isApplying, animationMode } = useCleanFilter();
  const [bursts, setBursts] = useState<OverlayBurst[]>([]);
  const burstIdRef = useRef(0);

  useEffect(() => {
    if (!animationMode) {
      setBursts([]);
      return;
    }

    const createBurst = () => {
      const now = Date.now();
      const palette = animationMode === "pretty" ? PRETTY_COLORS : GRIM_COLORS;
      const burst: OverlayBurst = {
        id: burstIdRef.current++,
        x: `${randomBetween(8, 92).toFixed(2)}%`,
        y: `${randomBetween(10, 90).toFixed(2)}%`,
        size: `${Math.round(randomBetween(160, 360))}px`,
        color: pickRandom(palette),
        mode: animationMode,
        expiresAt: now + FLASH_DURATION_MS
      };

      setBursts((current) => [...current.filter((item) => item.expiresAt > now), burst]);
    };

    createBurst();
    const interval = window.setInterval(createBurst, FLASH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      setBursts([]);
    };
  }, [animationMode]);

  if (!isApplying && !animationMode) {
    return null;
  }

  return (
    <div
      className={`clean-filter-overlay${isApplying ? " clean-filter-overlay-loading" : ""}${
        animationMode ? ` clean-filter-overlay-${animationMode}` : ""
      }`}
      aria-hidden={!isApplying}
    >
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className={`clean-filter-overlay-burst clean-filter-overlay-burst-${burst.mode}`}
          style={
            {
              "--burst-x": burst.x,
              "--burst-y": burst.y,
              "--burst-size": burst.size,
              "--burst-color": burst.color
            } as CSSProperties
          }
        />
      ))}

      {isApplying ? (
        <div className="clean-filter-overlay-loader" role="status" aria-live="polite">
          <span className="clean-filter-overlay-spinner" aria-hidden="true" />
          <span className="clean-filter-overlay-text">
            {cleanFilterEnabled ? "예쁜말 적용 중..." : "날 것으로 돌리는중"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
