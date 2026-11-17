import { expect, test } from "@playwright/test";
import { fetchMarketDataText, getMarketDataAccess } from "../lib/market-data-access";
import { collectionPolicyReasonText } from "../lib/collection-policy-copy";

test("configured public market endpoints fetch without adding a second cache", async () => {
  const original = globalThis.fetch;
  const calls: RequestInit[] = [];
  globalThis.fetch = async (_url, init) => { calls.push(init ?? {}); return new Response('{"price":1234}', { status: 200 }); };
  try {
    for (const url of [
      "https://stock.naver.com/api/securityService/index/.IXIC/basic",
      "https://m.stock.naver.com/api/index/KOSPI/basic"
    ]) {
      expect(getMarketDataAccess(url).allowed).toBe(true);
      expect(await fetchMarketDataText(url)).toBe('{"price":1234}');
    }
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.cache === "no-store" && call.redirect === "error")).toBe(true);
    await expect(fetchMarketDataText("https://unconfigured.example/market")).rejects.toThrow("market_data:unconfigured_market_source");
    expect(calls).toHaveLength(2);
  } finally {
    globalThis.fetch = original;
  }
});

test("upstream failures remain errors instead of fabricated quotes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    await expect(fetchMarketDataText("https://stock.naver.com/api/securityService/index/.IXIC/basic")).rejects.toThrow("upstream 503");
  } finally {
    globalThis.fetch = original;
  }
});

test("policy holds distinguish access restrictions from pending review", () => {
  expect(collectionPolicyReasonText("terms_disallow")).toBe("출처 약관의 수집 제한");
  expect(collectionPolicyReasonText("terms_review_required")).toBe("수집·분석·표시 범위 확인 중");
  expect(collectionPolicyReasonText("robots_unavailable")).toBe("자동 접근 정책 확인 대기");
});
