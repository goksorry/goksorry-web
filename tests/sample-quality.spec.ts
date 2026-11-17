import { expect, test } from "@playwright/test";
import { sampleQuality, groupsSampleLimited } from "../lib/sample-quality";
import { buildWallModel } from "../lib/world-wall";
import { buildWorldFrame } from "../lib/world";

test("directional display guard ignores neutral volume and checks every contributing group", () => {
  const thin = { bullish: 20, bearish: 9, neutral: 1000 };
  const enough = { bullish: 20, bearish: 10, neutral: 0 };
  expect(sampleQuality(thin)).toEqual({ total: 1029, directional: 29, limited: true });
  expect(sampleQuality(enough).limited).toBe(false);
  expect(groupsSampleLimited([enough, thin])).toBe(true);
  expect(groupsSampleLimited([enough, { bullish: 0, bearish: 0, neutral: 1000 }])).toBe(false);
  expect(groupsSampleLimited([])).toBe(true);
});

test("wall hides thin scores and gauges without changing stored index, then restores adequate samples", () => {
  const frame = buildWorldFrame([]);
  const summary = { ...frame.overall, total: 29, bullish: 29, bearish: 0, neutral: 0, index: 1.1, hope_ratio: 1, fear_ratio: 0 };
  frame.overall = summary;
  frame.communities[0] = { ...frame.communities[0], ...summary };
  const input = {
    frame, loaded: true, failed: false, status: "관측 중", timezone: "Asia/Seoul",
    filtered: false, scopeLabel: "", cleanFilterEnabled: false, dark: false,
    feed: { data: null, loaded: true, failed: false }, market: { data: null, loaded: true, failed: false }, room: { data: null, loaded: true, failed: false }
  };
  const thin = buildWallModel(input).model;
  expect(thin.index.sampleLimited).toBe(true);
  expect(thin.index.summary.index).toBe(1.1);
  expect(thin.pierrot.band).toBe("neutral");
  expect(thin.communities.items[0]).toMatchObject({ index: "—", hope_ratio: null, fear_ratio: null, tone: "thin" });
  frame.overall = { ...summary, total: 30, bullish: 30 };
  frame.communities[0] = { ...frame.communities[0], ...frame.overall };
  const enough = buildWallModel(input).model;
  expect(enough.index.sampleLimited).toBe(false);
  expect(enough.communities.items[0].index).toBe("1.1");
  expect(enough.pierrot.band).not.toBe("neutral");
});
