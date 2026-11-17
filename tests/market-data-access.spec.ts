import { expect, test } from "@playwright/test";
import { fetchMarketDataText, getMarketDataAccess } from "../lib/market-data-access";
import { collectionPolicyReasonText } from "../lib/collection-policy-copy";

test("blocked and unreviewed market endpoints are rejected before any network request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected outbound request"); };
  try {
    for (const url of [
      "https://stock.naver.com/api/securityService/index/.IXIC/basic",
      "https://m.stock.naver.com/api/index/KOSPI/basic",
      "https://unreviewed.example/market"
    ]) {
      expect(getMarketDataAccess(url).allowed).toBe(false);
      await expect(fetchMarketDataText(url)).rejects.toThrow("collection_policy:");
    }
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});

test("policy holds distinguish access restrictions from pending review", () => {
  expect(collectionPolicyReasonText("terms_disallow")).toBe("출처 약관의 수집 제한");
  expect(collectionPolicyReasonText("terms_review_required")).toBe("수집·분석·표시 범위 확인 중");
  expect(collectionPolicyReasonText("robots_unavailable")).toBe("자동 접근 정책 확인 대기");
});
