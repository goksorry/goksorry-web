import { sentimentBandFromGoksorryIndex } from "@/lib/sentiment-score";
import { SENTIMENT_BAND_DISPLAY } from "@/lib/sentiment-display";
import type { WorldSummary } from "@/lib/world";

export function stockPierrotArt(summary: Pick<WorldSummary, "total" | "index">, dark = false) {
  const band = summary.total < 3 ? "neutral" : sentimentBandFromGoksorryIndex(summary.index);
  return {
    band,
    label: summary.total < 3 ? "표본 부족 · 관찰 중" : SENTIMENT_BAND_DISPLAY[band].label,
    src: `/images/overview-regimes/overview-regime-${band.replaceAll("_", "-")}-${dark ? "dark" : "light"}.webp`
  };
}
