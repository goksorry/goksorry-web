export type SentimentLabel = "bearish" | "neutral" | "bullish";

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

export const TONE_EMOJI: Record<"bearish" | "mixed" | "bullish", string> = {
  bearish: "🤡",
  mixed: "😐",
  bullish: "🥂"
};

