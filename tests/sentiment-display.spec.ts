import { expect, test } from "@playwright/test";
import { SENTIMENT_BAND_DISPLAY } from "../lib/sentiment-display";

test.describe("sentiment display", () => {
  test("uses clown emoji for extreme fear and a different emoji for fear", () => {
    expect(SENTIMENT_BAND_DISPLAY.extreme_bearish).toMatchObject({
      emoji: "🤡",
      label: "극단적 공포"
    });
    expect(SENTIMENT_BAND_DISPLAY.bearish).toMatchObject({
      emoji: "😱",
      label: "공포"
    });
  });
});
