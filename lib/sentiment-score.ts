export type SentimentLabel = "bearish" | "neutral" | "bullish";
export type SentimentBand =
  | "extreme_bearish"
  | "bearish"
  | "neutral"
  | "bullish"
  | "extreme_bullish";

export const SENTIMENT_SCORE_MIN = 1;
export const SENTIMENT_SCORE_MAX = 10;
export const SENTIMENT_SCORE_NEUTRAL = 5;

export const clampSentimentScore = (value: number): number => {
  return Math.min(SENTIMENT_SCORE_MAX, Math.max(SENTIMENT_SCORE_MIN, Math.round(value)));
};

export const legacyLabelToSentimentScore = (label: string): number => {
  switch (String(label).trim().toLowerCase()) {
    case "bearish":
      return 3;
    case "bullish":
      return 7;
    default:
      return SENTIMENT_SCORE_NEUTRAL;
  }
};

export const sentimentLabelFromScore = (score: number): SentimentLabel => {
  const normalized = clampSentimentScore(score);
  if (normalized <= 4) {
    return "bearish";
  }
  if (normalized >= 7) {
    return "bullish";
  }
  return "neutral";
};

export const sentimentBandFromScore = (score: number): SentimentBand => {
  const normalized = clampSentimentScore(score);
  if (normalized <= 2) {
    return "extreme_bearish";
  }
  if (normalized <= 4) {
    return "bearish";
  }
  if (normalized <= 6) {
    return "neutral";
  }
  if (normalized <= 8) {
    return "bullish";
  }
  return "extreme_bullish";
};

export const sentimentToneFromScore = (score: number): "bearish" | "mixed" | "bullish" => {
  const normalized = clampSentimentScore(score);
  if (normalized <= 4) {
    return "bearish";
  }
  if (normalized >= 7) {
    return "bullish";
  }
  return "mixed";
};

export const resolveSentimentScore = (value: unknown, label?: unknown): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return clampSentimentScore(parsed);
  }
  return legacyLabelToSentimentScore(String(label ?? ""));
};

export const averageSentimentScore = (scores: number[]): number => {
  if (scores.length === 0) {
    return SENTIMENT_SCORE_NEUTRAL;
  }

  const total = scores.reduce((sum, score) => sum + clampSentimentScore(score), 0);
  return Number((total / scores.length).toFixed(1));
};

export const fearIndexFromScore = (score: number): number => {
  const normalized = clampSentimentScore(score);
  return Number((((SENTIMENT_SCORE_MAX - normalized) / (SENTIMENT_SCORE_MAX - SENTIMENT_SCORE_MIN)) * 100).toFixed(2));
};

export const euphoriaIndexFromScore = (score: number): number => {
  const normalized = clampSentimentScore(score);
  return Number((((normalized - SENTIMENT_SCORE_MIN) / (SENTIMENT_SCORE_MAX - SENTIMENT_SCORE_MIN)) * 100).toFixed(2));
};
