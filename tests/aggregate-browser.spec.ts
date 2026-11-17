import { expect, test } from "@playwright/test";
test("classic shows indices and board links with limited title links and no pretty-title filter", async ({ page, request }) => {
  const data = await (await request.get("/api/internal/overview")).json();
  expect(data.community_indicators).toHaveLength(4);
  expect(data.community_indicators.every((g: { mentions: number; rows: unknown[] }) => g.mentions === 4 && g.rows.length > 0)).toBe(true);
  const feed = await (await request.get("/api/feed")).json();
  expect(feed.rows.length).toBeGreaterThan(0); expect(feed.summary.total).toBe(24);
  await page.goto("/classic");
  await expect(page.getByRole("heading", { name: "곡소리 지수", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /예쁜말|이쁜말/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "출처 게시판" })).toBeVisible();
  await expect(page.locator("body")).toContainText("테스트 수집 제목");
});
test("ingest rejects bodies and unapproved hosts behind authentication and aggregate registration strips arbitrary text", async ({ request }) => {
  expect((await request.post("/api/ingest", { data: { items: [] } })).status()).toBe(401);
  expect((await request.post("/api/ingest", { headers: { authorization: "Bearer local-policy-fixture-token" }, data: { items: [{ title: "PRIVATE" }] } })).status()).toBe(200);
  const response = await request.post("/api/v1/detector/register", { headers: { authorization: "Bearer local-policy-fixture-token" }, data: { status: { collection_policy: { processing_mode: "aggregate_only", sources: [], aggregate_buckets: [{ at: new Date(Date.now()-1000).toISOString(), source: "dc_krstock", market: "kr", symbol: null, bullish: 1, bearish: 0, neutral: 0, score_sum: 8, title: "PRIVATE", body: "SECRET", url: "https://example.com/post" }] } } } });
  expect(response.status()).toBe(200);
  const state = await (await request.get("http://127.0.0.1:3113/_control")).json();
  const payload = state.calls.filter((x: { table: string; method: string }) => x.table === "detector_status" && x.method === "POST").at(-1).payload;
  expect(payload.collection_policy.aggregate_buckets).toHaveLength(1);
  expect(JSON.stringify(payload)).not.toContain("PRIVATE"); expect(JSON.stringify(payload)).not.toContain("SECRET"); expect(JSON.stringify(payload)).not.toContain("example.com/post");
});

test("every scoped community can send title links; body and host mismatch are rejected", async ({ request }) => {
  const examples = [ ["toss_stock_community_AAPL", "https://www.tossinvest.com/community/posts/123"], ["dc_krstock", "https://gall.dcinside.com/mgallery/board/view/?id=krstock&no=123"], ["blind_stock_invest", "https://www.teamblind.com/kr/post/test"], ["ppomppu_stock", "https://www.ppomppu.co.kr/zboard/view.php?id=stock&no=123"] ];
  const headers = { authorization: "Bearer local-policy-fixture-token" };
  const at = new Date(Date.now() - 1000).toISOString();
  const items = examples.map(([source, url]) => ({ source, url, post_key: url, title: "공개 제목", clean_title: "must discard", fetched_at: at, analysis: { sentiment_score: 8, confidence: .8 } }));
  const accepted = await (await request.post("/api/ingest", { headers, data: { items } })).json();
  expect(accepted.upserted).toBe(4);
  const rejected = await (await request.post("/api/ingest", { headers, data: { items: [{ ...items[0], preview: "BODY" }, { ...items[1], url: "https://evil.invalid/post" }] } })).json();
  expect(rejected).toMatchObject({ upserted: 0, skipped: 2 });
  const state = await (await request.get("http://127.0.0.1:3113/_control")).json();
  const rows = state.calls.filter((x: { table: string; method: string }) => x.table === "external_posts" && x.method === "POST").at(-1).payload;
  expect(rows.every((x: { preview: unknown; clean_title: unknown }) => x.preview === null && x.clean_title === null)).toBe(true);
  const results = state.calls.filter((x: { table: string; method: string }) => x.table === "sentiment_results" && x.method === "POST").at(-1).payload;
  expect(results.every((x: { analyzed_at: string }) => x.analyzed_at === at)).toBe(true);
});

test("mobile world opens restored source titles without a pretty-title control", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "출처", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("테스트 수집 제목").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /예쁜말|이쁜말/ })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/goksorry-scoped-titles-mobile.png", fullPage: true });
});
