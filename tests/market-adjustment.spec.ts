import { expect, test } from "@playwright/test";
import {
  buildMarketAdjustmentSnapshot,
  calculateContinuousMarketAdjustment,
  calculateMarketAdjustmentTiming,
  calculateRowMarketAdjustment,
  hasActiveMarketAdjustmentInput,
  resolveMarketAdjustmentStatus
} from "../lib/community-market-adjustment";

test.describe("market adjustment decay", () => {
  test("decays Korean market adjustment for six hours after close", () => {
    expect(
      calculateMarketAdjustmentTiming({
        basisDate: "2026-06-08",
        timeZone: "Asia/Seoul",
        closeHour: 15,
        closeMinute: 30,
        asOf: new Date("2026-06-08T06:29:59.000Z")
      })
    ).toMatchObject({ status: "active", weight: 1 });

    expect(
      calculateMarketAdjustmentTiming({
        basisDate: "2026-06-08",
        timeZone: "Asia/Seoul",
        closeHour: 15,
        closeMinute: 30,
        asOf: new Date("2026-06-08T09:30:00.000Z")
      })
    ).toMatchObject({ status: "decaying", weight: 0.5 });

    expect(
      calculateMarketAdjustmentTiming({
        basisDate: "2026-06-08",
        timeZone: "Asia/Seoul",
        closeHour: 15,
        closeMinute: 30,
        asOf: new Date("2026-06-08T12:30:00.000Z")
      })
    ).toMatchObject({ status: "inactive", weight: 0 });
  });

  test("uses New York close time for NASDAQ decay", () => {
    expect(
      calculateMarketAdjustmentTiming({
        basisDate: "2026-06-05",
        timeZone: "America/New_York",
        closeHour: 16,
        closeMinute: 0,
        asOf: new Date("2026-06-05T23:00:00.000Z")
      })
    ).toMatchObject({
      basis_at: "2026-06-05T20:00:00.000Z",
      status: "decaying",
      weight: 0.5
    });
  });

  test("applies decay weight and excludes inactive indicators from averages", () => {
    const krRow = { source: "dc_stock", symbol_market: "kr" as const };
    const usRow = { source: "dc_usstock", symbol_market: "us" as const };
    const snapshot = buildMarketAdjustmentSnapshot("2026-06-08T09:30:00.000Z", [
      { id: "kospi", change_percent: 2, market_adjustment_weight: 1 },
      { id: "kosdaq", change_percent: 10, market_adjustment_weight: 0 },
      { id: "nasdaq", change_percent: 4, market_adjustment_weight: 0 },
      { id: "usdkrw", change_percent: null, market_adjustment_weight: 0 }
    ]);

    expect(calculateRowMarketAdjustment(krRow, snapshot, new Date("2026-06-08T09:30:00.000Z"))).toBe(
      calculateContinuousMarketAdjustment(2)
    );
    expect(calculateRowMarketAdjustment(usRow, snapshot, new Date("2026-06-08T09:30:00.000Z"))).toBe(0);
  });

  test("marks all-zero adjustment inputs inactive", () => {
    const inactiveIndicators = [
      { id: "kospi", change_percent: 2, market_adjustment_weight: 0 },
      { id: "kosdaq", change_percent: -1, market_adjustment_weight: 0 },
      { id: "nasdaq", change_percent: 3, market_adjustment_weight: 0 },
      { id: "usdkrw", change_percent: 0.4, market_adjustment_weight: 0 }
    ];
    const snapshot = buildMarketAdjustmentSnapshot("2026-06-08T12:30:00.000Z", inactiveIndicators);

    expect(hasActiveMarketAdjustmentInput(inactiveIndicators)).toBe(false);
    expect(resolveMarketAdjustmentStatus(inactiveIndicators)).toBe("inactive");
    expect(calculateRowMarketAdjustment({ source: "blind_stock_invest", symbol_market: null }, snapshot, new Date())).toBe(0);
  });

  test("reports decaying status when any usable input is partially weighted", () => {
    expect(
      resolveMarketAdjustmentStatus([
        { id: "kospi", change_percent: 1, market_adjustment_weight: 1 },
        { id: "nasdaq", change_percent: -1, market_adjustment_weight: 0.5 }
      ])
    ).toBe("decaying");
  });
});
