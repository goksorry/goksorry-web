export type SentimentLabel = "bearish" | "neutral" | "bullish";
export type SentimentBand =
  | "extreme_bearish"
  | "bearish"
  | "neutral"
  | "bullish"
  | "extreme_bullish";

export const SENTIMENT_SCORE_MIN = 0;
export const SENTIMENT_SCORE_MAX = 10;
export const SENTIMENT_SCORE_NEUTRAL = 5;

const EXTREME_BEARISH_MAX = 2.5;
const BEARISH_MAX = 4.5;
const NEUTRAL_MAX = 5.5;
const BULLISH_MAX = 7.5;
const EXTREME_HOPE_GOKSORRY_MAX = 2.5;
const HOPE_GOKSORRY_MAX = 4.5;
const NEUTRAL_GOKSORRY_MAX = 5.5;
const EXTREME_FEAR_GOKSORRY_MIN = 7.5;
const AGGREGATE_ACTIONABLE_COUNT_MIN = 2;
const AGGREGATE_DOMINANCE_COUNT_GAP_MIN = 1;
const AGGREGATE_DOMINANCE_SHARE_MIN = 0.54;
const AGGREGATE_SCORE_DRIFT_MULTIPLIER = 1.35;
const EXTREME_INDEX_MULTIPLIER = 1.6;

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

export const sentimentBandFromGoksorryIndex = (index: number): SentimentBand => {
  const normalized = clampSentimentScore(index);
  if (normalized <= EXTREME_HOPE_GOKSORRY_MAX) {
    return "extreme_bullish";
  }
  if (normalized <= HOPE_GOKSORRY_MAX) {
    return "bullish";
  }
  if (normalized <= NEUTRAL_GOKSORRY_MAX) {
    return "neutral";
  }
  if (normalized < EXTREME_FEAR_GOKSORRY_MIN) {
    return "bearish";
  }
  return "extreme_bearish";
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

const dominantAggregateSentimentLabel = (
  bullishCount: number,
  bearishCount: number
): SentimentLabel => {
  const actionableCount = bullishCount + bearishCount;
  if (actionableCount < AGGREGATE_ACTIONABLE_COUNT_MIN) {
    return "neutral";
  }

  const dominanceCount = Math.abs(bullishCount - bearishCount);
  const dominantShare = Math.max(bullishCount, bearishCount) / actionableCount;
  if (
    dominanceCount < AGGREGATE_DOMINANCE_COUNT_GAP_MIN ||
    dominantShare < AGGREGATE_DOMINANCE_SHARE_MIN
  ) {
    return "neutral";
  }

  return bullishCount > bearishCount ? "bullish" : "bearish";
};

export const amplifyAggregateSentimentScore = (score: number): number => {
  const normalized = clampSentimentScore(score);
  const distanceFromNeutral = normalized - SENTIMENT_SCORE_NEUTRAL;
  return clampSentimentScore(
    SENTIMENT_SCORE_NEUTRAL + distanceFromNeutral * AGGREGATE_SCORE_DRIFT_MULTIPLIER
  );
};

export const sentimentToneFromBand = (band: SentimentBand): "bearish" | "mixed" | "bullish" => {
  if (band === "extreme_bearish" || band === "bearish") {
    return "bearish";
  }
  if (band === "bullish" || band === "extreme_bullish") {
    return "bullish";
  }
  return "mixed";
};

export const aggregateSentimentTone = (
  bullishCount: number,
  bearishCount: number
): "bearish" | "mixed" | "bullish" => {
  const dominantLabel = dominantAggregateSentimentLabel(bullishCount, bearishCount);
  if (dominantLabel === "neutral") {
    return "mixed";
  }
  return dominantLabel;
};

export const aggregateSentimentBand = (
  score: number,
  {
    bullishCount,
    bearishCount
  }: {
    bullishCount: number;
    bearishCount: number;
  }
): SentimentBand => {
  const dominantLabel = dominantAggregateSentimentLabel(bullishCount, bearishCount);
  const scoreBand = sentimentBandFromGoksorryIndex(goksorryIndexFromScore(score));

  if (scoreBand === "neutral") {
    return "neutral";
  }

  if (dominantLabel === "neutral") {
    return scoreBand;
  }

  if (scoreBand === "extreme_bearish" || scoreBand === "bearish") {
    return dominantLabel === "bearish" ? scoreBand : "neutral";
  }

  return dominantLabel === "bullish" ? scoreBand : "neutral";
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

const clampIndexValue = (value: number, max: number, digits: number): number => {
  const clamped = Math.min(max, Math.max(0, value));
  return Number(clamped.toFixed(digits));
};

const amplifiedDistanceFromNeutral = (score: number): number => {
  const normalized = clampSentimentScore(score);
  return (normalized - SENTIMENT_SCORE_NEUTRAL) * EXTREME_INDEX_MULTIPLIER;
};

export const fearIndexFromScore = (score: number): number => {
  const index = 50 - amplifiedDistanceFromNeutral(score) * 10;
  return clampIndexValue(index, 100, 2);
};

export const euphoriaIndexFromScore = (score: number): number => {
  const index = 50 + amplifiedDistanceFromNeutral(score) * 10;
  return clampIndexValue(index, 100, 2);
};

export const goksorryIndexFromScore = (score: number): number => {
  const index = SENTIMENT_SCORE_NEUTRAL - amplifiedDistanceFromNeutral(score);
  return clampIndexValue(index, SENTIMENT_SCORE_MAX, 1);
};
