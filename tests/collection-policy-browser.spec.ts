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

test("market placeholders and source links explain policy holds", async ({ page, request }) => {
  const overview = await (await request.get("/api/internal/overview")).json();
  for (const indicator of overview.market_indicators.slice(0, 4)) {
    expect(indicator.value_text).toBe("--");
    expect(indicator.note).toBe("출처 이용 범위 확인 중");
  }
  await page.goto("/classic");
  const source = page.locator('.site-footer-source-link[href="https://www.tossinvest.com/"]');
  await expect(source).toHaveAttribute("data-policy-state", "inactive");
  await expect(source).toHaveAttribute("title", /수집·분석·표시 범위 확인 중/);
  await expect(source).toHaveAttribute("href", "https://www.tossinvest.com/");
  await page.getByLabel("출처 기준 안내").click();
  await expect(page.locator(".site-footer-info-copy")).toContainText("이용약관을 각각 확인");
});
