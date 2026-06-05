export type ChartTrendInputTone = "up" | "down" | "flat" | "fear" | "greed" | "mixed";
export type ChartTrendTone = "up" | "down" | "flat" | "mixed";

export type ChartTrendSegment = {
  text: string;
  isTrendToken: boolean;
};

const TREND_PHRASE_PATTERN = /(상승\s*추세|강세\s*추세|급등\s*추세|반등\s*추세|하락\s*추세|약세\s*추세|급락\s*추세|조정\s*추세)/g;
const UP_TREND_PATTERN = /상승|강세|급등|반등/;
const DOWN_TREND_PATTERN = /하락|약세|급락|조정/;

export const resolveChartTrendTone = (value: string, fallbackTone: ChartTrendInputTone): ChartTrendTone => {
  if (UP_TREND_PATTERN.test(value)) {
    return "up";
  }
  if (DOWN_TREND_PATTERN.test(value)) {
    return "down";
  }
  if (fallbackTone === "up" || fallbackTone === "down" || fallbackTone === "flat") {
    return fallbackTone;
  }
  return "mixed";
};

export const splitChartTrendText = (value: string): ChartTrendSegment[] => {
  const matches = [...value.matchAll(TREND_PHRASE_PATTERN)];
  if (matches.length === 0) {
    return [{ text: value, isTrendToken: false }];
  }

  const segments: ChartTrendSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    const text = match[0];
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ text: value.slice(cursor, index), isTrendToken: false });
    }
    segments.push({ text, isTrendToken: true });
    cursor = index + text.length;
  }

  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), isTrendToken: false });
  }

  return segments;
};
