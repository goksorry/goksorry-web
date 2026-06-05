export type ChartTrendInputTone = "up" | "down" | "flat" | "fear" | "greed" | "mixed";
export type ChartTrendTone = "up" | "down" | "flat" | "mixed";

export type ChartTrendSegment = {
  text: string;
  isTrendToken: boolean;
};

const TREND_TOKEN = "추세";
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
  if (!value.includes(TREND_TOKEN)) {
    return [{ text: value, isTrendToken: false }];
  }

  const segments: ChartTrendSegment[] = [];
  let cursor = 0;
  let nextIndex = value.indexOf(TREND_TOKEN, cursor);

  while (nextIndex !== -1) {
    if (nextIndex > cursor) {
      segments.push({ text: value.slice(cursor, nextIndex), isTrendToken: false });
    }
    segments.push({ text: TREND_TOKEN, isTrendToken: true });
    cursor = nextIndex + TREND_TOKEN.length;
    nextIndex = value.indexOf(TREND_TOKEN, cursor);
  }

  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), isTrendToken: false });
  }

  return segments;
};
