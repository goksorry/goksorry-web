import { expect, test } from "@playwright/test";

test("a policy hold excludes previously collected titles from current and historical feeds", async ({ request }) => {
  const asOf = new Date(Date.now() - 10 * 60_000).toISOString();
  for (const suffix of ["", `&asOf=${encodeURIComponent(asOf)}`]) {
    const response = await request.get(`/api/feed?channels=toss${suffix}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.rows).toEqual([]);
    expect(data.summary.total).toBe(0);
    expect(data.summary.mood).toBe("watching");
  }
  const world = await (await request.get("/api/internal/world")).text();
  expect(world).not.toContain("테스트 수집 제목");
  expect(world).not.toContain("https://example.com/post");
});

test("a failed policy lookup never exposes feed titles", async ({ request }) => {
  await request.post("http://127.0.0.1:3113/_control", { data: { failPolicy: true } });
  try {
    const asOf = new Date(Date.now() - 17 * 60_000).toISOString();
    const response = await request.get(`/api/feed?asOf=${encodeURIComponent(asOf)}`);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect((await response.json()).rows).toEqual([]);
  } finally {
    await request.post("http://127.0.0.1:3113/_control", { data: {} });
  }
});

test("market collection is separate from community policy holds", async ({ page, request }) => {
  const overview = await (await request.get("/api/internal/overview")).json();
  for (const indicator of overview.market_indicators.slice(0, 4)) {
    expect(indicator.note).not.toBe("출처 이용 범위 확인 중");
  }
  await page.goto("/classic");
  const source = page.locator('.site-footer-source-link[href="https://www.tossinvest.com/"]');
  await expect(source).toHaveAttribute("data-policy-state", "inactive");
  await expect(source).toHaveAttribute("title", /수집·분석·표시 범위 확인 중/);
  await expect(source).toHaveAttribute("href", "https://www.tossinvest.com/");
  await page.getByLabel("출처 기준 안내").click();
  await expect(page.locator(".site-footer-info-copy")).toContainText("이용약관을 각각 확인");
});

test("resumed title-only sources never re-expose records from before minimization", async ({ request }) => {
  const cutoff = new Date(Date.now() - 120_000).toISOString();
  await request.post("http://127.0.0.1:3113/_control", { data: { contentSince: cutoff } });
  try {
    const asOf = new Date(Date.now() - 1000).toISOString();
    const response = await request.get(`/api/feed?channels=toss&asOf=${encodeURIComponent(asOf)}`);
    const data = await response.json();
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.summary.total).toBeLessThan(100);
    expect(data.rows.every((row: { analyzed_at: string }) => Date.parse(row.analyzed_at) >= Date.parse(cutoff))).toBe(true);
  } finally {
    await request.post("http://127.0.0.1:3113/_control", { data: {} });
  }
});

test("detector registration preserves cutoff and rejects limited use without one", async ({ request }) => {
  const cutoff = "2026-11-17T04:58:42Z";
  for (const content_since of [cutoff, "invalid"]) {
    const response = await request.post("/api/v1/detector/register", {
      headers: { authorization: "Bearer local-policy-fixture-token" },
      data: { status: { collection_policy: { sources: [{ source_name: "toss_stock_community", allow_fetch: true,
        reason: "reviewed_limited_use", content_since, article_count: 20 }] } } }
    });
    expect(response.status()).toBe(200);
    const state = await (await request.get("http://127.0.0.1:3113/_control")).json();
    const call = state.calls.filter((item: { table: string; method: string }) => item.table === "detector_status" && item.method === "POST").at(-1);
    expect(call.payload.collection_policy.sources[0]).toMatchObject({
      allow_fetch: content_since === cutoff,
      content_since: content_since === cutoff ? "2026-11-17T04:58:42.000Z" : null
    });
  }
});
