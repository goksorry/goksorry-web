import { sentimentBandFromGoksorryIndex } from "@/lib/sentiment-score";
import { SENTIMENT_BAND_DISPLAY } from "@/lib/sentiment-display";
import type { WorldSummary } from "@/lib/world";
import { sampleQuality } from "./sample-quality";

export function stockPierrotArt(summary: Pick<WorldSummary, "total" | "index" | "bullish" | "bearish" | "neutral">, dark = false, limited = sampleQuality(summary).limited) {
  const band = limited ? "neutral" : sentimentBandFromGoksorryIndex(summary.index);
  return {
    band,
    label: limited ? "표본 부족 · 관찰 중" : SENTIMENT_BAND_DISPLAY[band].label,
    src: `/images/overview-regimes/overview-regime-${band.replaceAll("_", "-")}-${dark ? "dark" : "light"}.webp`
  };
}
