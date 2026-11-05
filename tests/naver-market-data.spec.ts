import { expect, test } from "@playwright/test";
import { parseNaverNasdaqQuote, parseNaverUsdKrwQuote } from "../lib/naver-market-data";

const nasdaq = {
  reutersCode: ".IXIC", closePrice: "24,748.81", compareToPreviousClosePrice: "-987.70",
  fluctuationsRatio: "-3.84", localTradedAt: "2026-11-05T11:37:28-05:00"
};
const fx = {
  marketIndexCode: "FX_USDKRW", saleBaseRate: "1352.60", changePrice: "10.10", changeRate: "0.75",
  date: "2026-11-05", announcedAt: "2026-11-06T01:36:53+09:00"
};

test("NASDAQ uses the previous trading day even when daily rows exclude today's open session", () => {
  expect(parseNaverNasdaqQuote(nasdaq, [
    { localTradedAt: "2026-11-04T17:15:59-05:00" }, { localTradedAt: "2026-11-03T17:15:59-05:00" }
  ])).toEqual({ value: 24748.81, change: -987.7, percent: -3.84, currentDate: "2026-11-05", previousDate: "2026-11-04" });
});

test("NASDAQ skips the current day's closing row when selecting its comparison date", () => {
  expect(parseNaverNasdaqQuote(nasdaq, [
    { localTradedAt: "2026-11-05T17:15:59-05:00" }, { localTradedAt: "2026-11-04T17:15:59-05:00" }
  ])?.previousDate).toBe("2026-11-04");
});

test("FX preserves the trading date across midnight and signed changes", () => {
  expect(parseNaverUsdKrwQuote({ ...fx, changePrice: "-3.50", changeRate: "-0.26" }, {
    items: [{ date: "2026-11-05" }, { date: "2026-11-04" }]
  })).toEqual({ value: 1352.6, change: -3.5, percent: -0.26, currentDate: "2026-11-05", previousDate: "2026-11-04" });
});

test("missing history keeps a valid latest quote", () => {
  expect(parseNaverNasdaqQuote(nasdaq, null)?.value).toBe(24748.81);
  expect(parseNaverUsdKrwQuote(fx, null)?.value).toBe(1352.6);
});

test("invalid quotes and mismatched instruments remain unavailable", () => {
  for (const value of [null, "", "--", "NaN", "Infinity", "0", {}, false]) {
    expect(parseNaverNasdaqQuote({ ...nasdaq, closePrice: value }, [])).toBeNull();
    expect(parseNaverUsdKrwQuote({ ...fx, saleBaseRate: value }, {})).toBeNull();
  }
  expect(parseNaverNasdaqQuote({ ...nasdaq, reutersCode: ".DJI" }, [])).toBeNull();
  expect(parseNaverUsdKrwQuote({ ...fx, marketIndexCode: "FX_JPYKRW" }, {})).toBeNull();
  expect(parseNaverNasdaqQuote({ ...nasdaq, fluctuationsRatio: "" }, [])).toBeNull();
  expect(parseNaverUsdKrwQuote({ ...fx, changePrice: null }, {})).toBeNull();
});
