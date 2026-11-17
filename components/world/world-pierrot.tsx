"use client";

import { stockPierrotArt } from "@/lib/stock-pierrot";
import type { WorldSummary } from "@/lib/world";

// The existing five-stage Korean stock Pierrot meme is the character source.
// Reuse the original files, including their full composition. The room has no theme and is a night scene,
// so it always takes the dark variants.
export const PIERROT_DARK = true;
// `missing`: the theater where no record can be shown (or none is known yet) has no mood to picture, so the frame says
// so instead, with this text ("기록 없음", "기록 확인 중…").
export function WorldPierrot({ summary, recorded = false, missing = "" }: { summary: Pick<WorldSummary, "total" | "index" | "bullish" | "bearish" | "neutral">; recorded?: boolean; missing?: string }) {
  if (missing) return <figure className="world-pierrot" data-band="missing"><p className="world-pierrot-missing">{missing}</p><figcaption>기록 시점</figcaption></figure>;
  const { band, label, src } = stockPierrotArt(summary, PIERROT_DARK);
  return <figure className="world-pierrot" data-band={band}>
    {/* Original 300×200 artwork: no crop, redraw, or substitute character. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src}
      width={300} height={200} alt={`주식 삐에로 · ${label}`} fetchPriority="high" />
    <figcaption>{recorded ? "기록 시점" : "현재 분위기"} · {label}</figcaption>
  </figure>;
}
