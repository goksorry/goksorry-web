"use client";

import { useTheme } from "@/components/theme-provider";
import { useMediaQuery } from "@/components/use-media-query";
import { getThemeOption } from "@/lib/theme";
import { stockPierrotArt } from "@/lib/stock-pierrot";
import type { WorldSummary } from "@/lib/world";

// The existing five-stage Korean stock Pierrot meme is the character source.
// Reuse the original files, including their full composition and theme variants.
export function WorldPierrot({ summary, recorded = false }: { summary: Pick<WorldSummary, "total" | "index">; recorded?: boolean }) {
  const { themeId } = useTheme();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const tone = getThemeOption(themeId).tone;
  const dark = tone === "dark" || (tone === "system" && prefersDark);
  const { band, label, src } = stockPierrotArt(summary, Boolean(dark));
  return <figure className="world-pierrot" data-band={band}>
    {/* Original 300×200 artwork: no crop, redraw, or substitute character. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src}
      width={300} height={200} alt={`주식 삐에로 · ${label}`} fetchPriority="high" />
    <figcaption>{recorded ? "기록 시점" : "현재 분위기"} · {label}</figcaption>
  </figure>;
}
