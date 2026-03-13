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

const EXTREME_BEARISH_MAX = 2.4;
const BEARISH_MAX = 4.4;
const NEUTRAL_MAX = 5.5;
const BULLISH_MAX = 7.5;

export const clampSentimentScore = (value: number): number => {
  const clamped = Math.min(SENTIMENT_SCORE_MAX, Math.max(SENTIMENT_SCORE_MIN, value));
  return Number(clamped.toFixed(1));
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
  if (normalized <= BEARISH_MAX) {
    return "bearish";
  }
  if (normalized > NEUTRAL_MAX) {
    return "bullish";
  }
  return "neutral";
};

export const sentimentBandFromScore = (score: number): SentimentBand => {
  const normalized = clampSentimentScore(score);
  if (normalized <= EXTREME_BEARISH_MAX) {
    return "extreme_bearish";
  }
  if (normalized <= BEARISH_MAX) {
    return "bearish";
  }
  if (normalized <= NEUTRAL_MAX) {
    return "neutral";
  }
  if (normalized <= BULLISH_MAX) {
    return "bullish";
  }
  return "extreme_bullish";
};

export const sentimentToneFromScore = (score: number): "bearish" | "mixed" | "bullish" => {
  const normalized = clampSentimentScore(score);
  if (normalized <= BEARISH_MAX) {
    return "bearish";
  }
  if (normalized > NEUTRAL_MAX) {
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
