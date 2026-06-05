import { expect, test } from "@playwright/test";
import { resolveChartTrendTone, splitChartTrendText } from "../lib/analysis-trend";

test.describe("analysis chart trend text", () => {
  test("resolves trend tone from Korean chart state text first", () => {
    expect(resolveChartTrendTone("상승 추세 · 2D -0.40%", "down")).toBe("up");
    expect(resolveChartTrendTone("하락 추세 · 2D +0.80%", "up")).toBe("down");
    expect(resolveChartTrendTone("횡보 · 2D +0.10%", "up")).toBe("up");
    expect(resolveChartTrendTone("데이터 없음", "greed")).toBe("mixed");
  });

  test("splits the full trend phrase", () => {
    expect(splitChartTrendText("상승 추세 · 2D +1.23%")).toEqual([
      { text: "상승 추세", isTrendToken: true },
      { text: " · 2D +1.23%", isTrendToken: false }
    ]);
    expect(splitChartTrendText("하락 추세 · 2D -1.23%")).toEqual([
      { text: "하락 추세", isTrendToken: true },
      { text: " · 2D -1.23%", isTrendToken: false }
    ]);
    expect(splitChartTrendText("급등")).toEqual([{ text: "급등", isTrendToken: false }]);
  });
});
