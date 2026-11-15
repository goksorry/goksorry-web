import { test, expect, type Page } from "@playwright/test";
import { buildFeedPage, type FeedSnapshot } from "../lib/feed-scope";
import { readFeedSelection } from "../lib/feed-scope";
import { worldRows } from "./world-fixture";
import { SOURCE_GROUP_IDS } from "../lib/feed-source-groups";
async function prepare(page: Page) {
  await page.context().addCookies([
    { name: "goksorry-cookie-consent", value: "v1:essential", domain: "127.0.0.1", path: "/" },
    { name: "goksorry-clean-filter", value: "on", domain: "127.0.0.1", path: "/" },
    { name: "goksorry-theme-mode", value: "light", domain: "127.0.0.1", path: "/" }
  ]);
  await page.addInitScript(() => localStorage.setItem("goksorry-theme", "light"));
  await page.route("**/api/auth/session", route => route.fulfill({ json: {} }));
}
const settle = async (page: Page) => expect(page.locator(".home-current")).toHaveAttribute("aria-busy", "false");
for (const width of [320,360,390,430,768]) test(`mobile ${width}: compact status, page scrolling, first post`, async ({ page }, info) => {
  await prepare(page); await page.setViewportSize({ width, height: 640 }); await page.goto("/"); await settle(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect((await page.locator(".home-current").boundingBox())!.height).toBeLessThanOrEqual(220);
  await expect(page.locator(".pierrot-stage")).toBeVisible();
  const smallButtons = await page.locator(".home-tabs button, .header button").evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height < 44).length);
  expect(smallButtons).toBe(0);
  if (width === 360) { const box = (await page.locator(".home-post-title").first().boundingBox())!; expect(box.y + box.height).toBeLessThanOrEqual(640); }
  await page.screenshot({ path: info.outputPath(`home-${width}.png`) });
  await page.getByText("종목별 언급", { exact: false }).first().click();
  await page.getByRole("button", { name: /다음 페이지 종목/ }).click(); await settle(page);
  await expect(page.locator(".home-counts")).toContainText("120건");
  await page.getByRole("button", { name: "전체 복귀" }).click(); await settle(page);
  await expect(page.locator(".home-counts")).toContainText("620건");
});
test("stock, sentiment, direct original, more pages and back navigation", async ({ page }) => {
  await prepare(page); await page.goto("/?scene=ecosystem&stock=LATE&channel=toss&feed=1"); await settle(page);
  await expect(page.locator(".home-counts")).toContainText("120건");
  await expect(page.locator(".home-post-title").first()).toHaveAttribute("target", "_blank");
  await expect(page.locator(".home-post-title").first()).toHaveAttribute("href", "https://example.com/post");
  await page.getByRole("button", { name: "더 보기", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-post")).toHaveCount(80);
  await page.getByRole("button", { name: "더 보기", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-post")).toHaveCount(120);
  await page.getByRole("button", { name: "공포", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-counts")).toContainText("120건");
  await expect(page.locator(".home-hope")).toContainText("50%");
  await expect(page.locator(".home-post:not([data-sentiment=bearish])")).toHaveCount(0);
  await page.goBack(); await settle(page); await expect(page.getByRole("button", { name: "전체", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "전체 복귀" }).click(); await settle(page);
  await expect(page.locator(".home-counts")).toContainText("620건");
});
test("failure preserves scope and actual timestamp, retry recovers; theater notice", async ({ page }) => {
  await prepare(page); await page.goto("/?scene=theater"); await settle(page);
  await expect(page.getByText("개미극장은 종료되었습니다. 현재 현황을 표시합니다.")).toBeVisible();
  const at = await page.locator(".home-current-foot time").getAttribute("datetime");
  await page.route("**/api/feed?*", route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole("button", { name: "공포", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-notice[role=alert]")).toContainText("마지막 정상 데이터");
  await expect(page.locator(".home-counts")).toContainText("620건");
  await expect(page.locator(".home-current-foot time")).toHaveAttribute("datetime", at!);
  await page.unroute("**/api/feed?*"); await page.getByRole("button", { name: "다시 조회" }).click(); await settle(page);
  await expect(page.locator(".home-notice[role=alert]")).toHaveCount(0);
});
test("five readable poses, reduced motion, offscreen pause and no Three.js modules", async ({ page }, info) => {
  await prepare(page); const scripts: string[] = [];
  page.on("response", response => { if (/\.js(?:\?|$)/.test(response.url())) scripts.push(response.url()); });
  await page.goto("/"); await settle(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const rows = worldRows();
  for (const [mood, subset] of Object.entries({ hope: rows.filter(r=>r.label==="bullish"), fear: rows.filter(r=>r.label==="bearish"), neutral: rows.filter(r=>r.label==="neutral"), mixed: rows, watching: rows.slice(0,1) })) {
    const snapshot: FeedSnapshot = { rows: subset, generated_at: new Date().toISOString(), market_indicators: [], collectionStatuses: {}, marketAdjustmentSnapshot: null, collection: { last_run_at: null, errors: 0, degraded: false, unavailable: false } };
    await page.route("**/api/feed?*", route=>route.fulfill({ json: buildFeedPage(snapshot, { symbol: "", channels: [...SOURCE_GROUP_IDS], sentiment: "all" }) }));
    await page.getByRole("button", { name: mood === "hope" || mood === "neutral" || mood === "watching" ? "희망" : "공포", exact: true }).click(); await settle(page);
    await expect(page.locator(".pierrot-stage")).toHaveAttribute("data-mood", mood);
    await expect(page.locator(".pierrot-stage")).toHaveAttribute("data-paused", "true");
    await page.locator(".pierrot-stage").screenshot({ path: info.outputPath(`pierrot-${mood}.png`) });
    expect(await page.locator(".pierrot-actor").evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
    await page.unroute("**/api/feed?*");
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".home-market").scrollIntoViewIfNeeded();
  await expect(page.locator(".pierrot-stage")).toHaveAttribute("data-paused", "true");
  for (const url of scripts) { const body = await (await page.request.get(url)).text(); expect(body).not.toMatch(/three\/build|WebGLRenderer|hd2d-world/); }
});
for (const theme of ["light","dark","excel-light","excel-dark","docs-light","docs-dark","vscode-light","vscode-dark"]) test(`theme ${theme}: mobile scrolling, desktop, links and keyboard`, async ({ page }, info) => {
  await prepare(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/?theme=${theme}`); await settle(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('a[href="/analysis"]')).toHaveCount(0);
  await expect(page.locator('a[href="/community"]').first()).toBeAttached();
  await expect(page.locator('a[href="/goksorry-room"]').first()).toBeAttached();
  await page.screenshot({ path: info.outputPath(`${theme}-mobile.png`) });
  await page.locator(".home-disclosure summary").first().focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".home-disclosure").first()).toHaveAttribute("open", "");
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(()=>document.documentElement.style.fontSize="");
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/?theme=${theme}`); await settle(page);
  await page.screenshot({ path: info.outputPath(`${theme}-desktop.png`) });
});

test("multiple sources apply to summary and list; pretty titles, neutral, stale and empty states", async ({ page }) => {
  await prepare(page); await page.goto("/"); await settle(page);
  let rows = worldRows();
  const snapshot = (): FeedSnapshot => ({ rows, generated_at: new Date().toISOString(), market_indicators: [], collectionStatuses: {}, marketAdjustmentSnapshot: null, collection: { last_run_at: null, errors: 0, degraded: false, unavailable: false } });
  await page.route("**/api/feed?*", route => route.fulfill({ json: buildFeedPage(snapshot(), readFeedSelection(new URL(route.request().url()).searchParams)) }));
  const communities = page.locator(".home-disclosure").nth(1);
  await expect(communities).toHaveAttribute("open", "");
  await communities.getByRole("button", { name: /^토스증권/ }).click(); await settle(page);
  await communities.getByRole("button", { name: /^블라인드/ }).click(); await settle(page);
  await expect(page).toHaveURL(/channels=ppomppu%2Cdc/);
  await expect(page.locator(".home-scope")).toContainText("뽐뿌·디시 4종");
  await expect(page.locator(".home-post").first()).not.toContainText("시발");
  await page.getByRole("button", { name: "클린필터 끄기" }).click();
  await expect(page.locator(".home-post-title").first()).toContainText("시발");
  rows = worldRows().filter(row => row.label === "neutral").map(row => ({ ...row, analyzed_at: new Date(Date.now() - 40 * 60_000).toISOString() }));
  await page.getByRole("button", { name: "중립", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-hope")).toContainText("—");
  await expect(page.locator(".pierrot-stage")).toHaveAttribute("data-mood", "neutral");
  await expect(page.locator(".home-current-foot")).toContainText("갱신 지연");
  rows = [];
  await page.getByRole("button", { name: "전체", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-empty")).toBeVisible();
  await expect(page.locator(".home-current-foot")).toContainText("표본 없음");
});

test("60-second refresh preserves expanded page count and failed refresh preserves rows", async ({ page }) => {
  await prepare(page); await page.clock.install(); await page.goto("/?stock=LATE"); await settle(page);
  await page.getByRole("button", { name: "더 보기", exact: true }).click(); await settle(page);
  await expect(page.locator(".home-post")).toHaveCount(80);
  await page.clock.fastForward(61_000); await settle(page);
  await expect(page.locator(".home-post")).toHaveCount(80);
  const at = await page.locator(".home-current-foot time").getAttribute("datetime");
  await page.route("**/api/feed?*", route => route.fulfill({ status: 503, json: {} }));
  await page.clock.fastForward(61_000); await settle(page);
  await expect(page.locator(".home-post")).toHaveCount(80);
  await expect(page.locator(".home-current-foot time")).toHaveAttribute("datetime", at!);
});
