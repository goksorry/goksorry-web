import { expect, test } from "@playwright/test";
import {
  clampSentimentScore,
  euphoriaIndexFromScore,
  fearIndexFromScore,
  goksorryIndexFromScore,
  sentimentBandFromScore,
  sentimentLabelFromScore,
  sentimentToneFromScore
} from "../lib/sentiment-score";

test.describe("sentiment score levels", () => {
  test("clamps sentiment scores to the 0-10 scale", () => {
    expect(clampSentimentScore(-1)).toBe(0);
    expect(clampSentimentScore(0)).toBe(0);
    expect(clampSentimentScore(4.46)).toBe(4.5);
    expect(clampSentimentScore(10)).toBe(10);
    expect(clampSentimentScore(11)).toBe(10);
  });

  test("maps scores to symmetric narrow-neutral bands", () => {
    expect(sentimentBandFromScore(0)).toBe("extreme_bearish");
    expect(sentimentBandFromScore(2.5)).toBe("extreme_bearish");
    expect(sentimentBandFromScore(2.6)).toBe("bearish");
    expect(sentimentBandFromScore(4.5)).toBe("bearish");
    expect(sentimentBandFromScore(4.6)).toBe("neutral");
    expect(sentimentBandFromScore(5.5)).toBe("neutral");
    expect(sentimentBandFromScore(5.6)).toBe("bullish");
    expect(sentimentBandFromScore(7.5)).toBe("bullish");
    expect(sentimentBandFromScore(7.6)).toBe("extreme_bullish");
    expect(sentimentBandFromScore(10)).toBe("extreme_bullish");
  });

  test("keeps labels and tones aligned to the neutral center", () => {
    expect(sentimentLabelFromScore(4.5)).toBe("bearish");
    expect(sentimentLabelFromScore(4.6)).toBe("neutral");
    expect(sentimentLabelFromScore(5.5)).toBe("neutral");
    expect(sentimentLabelFromScore(5.6)).toBe("bullish");
    expect(sentimentToneFromScore(4.5)).toBe("bearish");
    expect(sentimentToneFromScore(4.6)).toBe("mixed");
    expect(sentimentToneFromScore(5.5)).toBe("mixed");
    expect(sentimentToneFromScore(5.6)).toBe("bullish");
  });

  test("derives symmetric fear, euphoria, and goksorry indexes", () => {
    expect(fearIndexFromScore(0)).toBe(100);
    expect(fearIndexFromScore(5)).toBe(50);
    expect(fearIndexFromScore(10)).toBe(0);
    expect(euphoriaIndexFromScore(0)).toBe(0);
    expect(euphoriaIndexFromScore(5)).toBe(50);
    expect(euphoriaIndexFromScore(10)).toBe(100);
    expect(goksorryIndexFromScore(0)).toBe(10);
    expect(goksorryIndexFromScore(2.5)).toBe(7.5);
    expect(goksorryIndexFromScore(5)).toBe(5);
    expect(goksorryIndexFromScore(7.5)).toBe(2.5);
    expect(goksorryIndexFromScore(10)).toBe(0);
  });
});
