import type { SentimentBand, SentimentLabel } from "@/lib/sentiment-score";

export const SENTIMENT_DISPLAY: Record<
  SentimentLabel,
  { emoji: string; label: string; shortLabel: string }
> = {
  bearish: {
    emoji: "🤡",
    label: "공포",
    shortLabel: "공포"
  },
  neutral: {
    emoji: "😐",
    label: "중립",
    shortLabel: "중립"
  },
  bullish: {
    emoji: "🥂",
    label: "희망",
    shortLabel: "희망"
  }
};

export const SENTIMENT_BAND_DISPLAY: Record<
  SentimentBand,
  { emoji: string; label: string; shortLabel: string }
> = {
  extreme_bearish: {
    emoji: "😱",
    label: "극단적 공포",
    shortLabel: "극공"
  },
  bearish: {
    emoji: "🤡",
    label: "공포",
    shortLabel: "공포"
  },
  neutral: {
    emoji: "😐",
    label: "중립",
    shortLabel: "중립"
  },
  bullish: {
    emoji: "🥂",
    label: "희망",
    shortLabel: "희망"
  },
  extreme_bullish: {
    emoji: "🚀",
    label: "극단적 희망",
    shortLabel: "극희"
  }
};

export const TONE_EMOJI: Record<"bearish" | "mixed" | "bullish", string> = {
  bearish: "🤡",
  mixed: "😐",
  bullish: "🥂"
};
