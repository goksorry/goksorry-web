import { test, expect } from "@playwright/test";
import { prepareWorld } from "./world-fixture";

const panel = (page: import("@playwright/test").Page) => page.locator('[data-world-panel="detail"]');

test("original five-stage meme follows index and theme without replacement art", async ({ page }, info) => {
  const frame = await prepareWorld(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const bands = [[1, "extreme-bullish"], [3, "bullish"], [5, "neutral"], [6, "bearish"], [9, "extreme-bearish"]] as const;
  for (const [index, band] of bands) {
    await page.route("**/api/internal/world", route => route.fulfill({ json: { ...frame, overall: { ...frame.overall, index } } }));
    await page.goto("/");
    const portrait = page.locator(".world-pierrot img");
    await expect(portrait).toHaveAttribute("src", `/images/overview-regimes/overview-regime-${band}-light.webp`);
    await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(300);
  }
  await page.goto("/?theme=dark");
  await expect(page.locator(".world-pierrot img")).toHaveAttribute("src", /extreme-bearish-dark.webp$/);
  await page.screenshot({ path: info.outputPath("original-pierrot-desktop.png"), fullPage: true });
});

test("split is default; unified retains scope, shows neutral and original URLs", async ({ page }) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?feed=1");
  const detail = panel(page);
  await expect(detail.getByRole("button", { name: "좌우 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(detail.locator(".sentiment-card").first()).toBeVisible();
  const fear = await detail.locator("#fear-lane").boundingBox(), hope = await detail.locator("#hope-lane").boundingBox();
  expect(hope!.x).toBeGreaterThan(fear!.x + fear!.width - 1); expect(Math.abs(hope!.y - fear!.y)).toBeLessThan(2);
  const selected = await detail.locator(".feed-channel-buttons .filter-chip-active").allTextContents();
  await detail.getByRole("button", { name: "통합 보기", exact: true }).click();
  await expect(detail.locator(".feed-unified-list .sentiment-card-neutral").first()).toBeVisible();
  expect(await detail.locator(".feed-channel-buttons .filter-chip-active").allTextContents()).toEqual(selected);
  await expect(detail.locator(".sentiment-title").first()).toHaveAttribute("href", /^https:\/\/example.com\//);
  const times = await detail.locator(".feed-unified-list time").evaluateAll(nodes => nodes.map(n => n.getAttribute("datetime")!));
  expect(times).toEqual([...times].sort().reverse());
  await detail.getByRole("button", { name: "좌우 보기", exact: true }).click();
  await expect(detail.locator("#fear-lane")).toBeVisible();
});

for (const width of [320, 360, 390, 430, 768]) test(`metaverse and original Pierrot remain visible at ${width}px`, async ({ page }, info) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: 844 }); await page.goto("/");
  const portrait = page.locator(".world-pierrot img");
  await expect(portrait).toBeVisible();
  expect((await portrait.boundingBox())!.width).toBeGreaterThanOrEqual(170);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "오늘의 개미극장", exact: true }).click();
  await expect(page.getByRole("region", { name: "개미극장 재생 제어" })).toBeVisible();
  await expect(page.getByLabel("기록 날짜")).toBeVisible();
  await expect(portrait).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 360) await page.evaluate(() => window.scrollTo(0, 0));
  if (width === 360) await page.screenshot({ path: info.outputPath("original-pierrot-theater-mobile.png"), fullPage: true });
});

test("late stock is server scoped before pagination and sentiment never changes summary", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*"); await page.unroute("**/api/internal/world");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/?scene=ecosystem");
  await page.getByRole("button", { name: /다음 페이지 종목 개미굴/ }).click();
  await page.getByRole("button", { name: "선택 범위 피드 더 보기", exact: true }).click();
  await panel(page).getByRole("button", { name: "통합 보기", exact: true }).click();
  await expect(panel(page).locator(".feed-scope-summary")).toContainText("표본 120건");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(80);
  await panel(page).getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(120);
  const summary = (await panel(page).locator(".feed-scope-summary").textContent())!.split(" · 20")[0];
  await panel(page).getByRole("group", { name: "글 감성 필터" }).getByRole("button", { name: "공포", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(40);
  await expect(panel(page).locator(".feed-scope-summary")).toContainText(summary);
  await panel(page).getByRole("button", { name: "좌우 보기", exact: true }).click();
  await expect(panel(page).locator("#hope-lane .sentiment-card")).toHaveCount(26);
});


test("desktop page scroll, 200 percent text, and keyboard menu remain usable", async ({ page }) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto("/");
  await expect(page.locator(".world-pierrot img")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.getByRole("navigation", { name: "월드 장면 선택" })).toBeInViewport();
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".world-menu-button").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator(".world-menu-button")).toBeFocused();
});

test("feed refresh keeps loaded pages and failure preserves values and actual time", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.clock.install(); await page.goto("/?feed=1");
  await panel(page).getByRole("button", { name: "통합 보기", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(80);
  await panel(page).getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(160);
  let reads = 0; page.on("request", req => { if (new URL(req.url()).pathname === "/api/feed") reads++; });
  await page.clock.fastForward(60_001);
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  await expect(panel(page).locator("#feed-top")).toHaveAttribute("aria-busy", "false");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(160);
  const time = await panel(page).locator(".feed-scope-summary time").getAttribute("datetime");
  await page.route("**/api/feed?*", route => route.fulfill({ json: { rows: [], errorMessage: "테스트 갱신 오류" } }));
  await page.clock.fastForward(60_001);
  await expect(panel(page).locator(".error")).toContainText("테스트 갱신 오류");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(160);
  await expect(panel(page).locator(".feed-scope-summary time")).toHaveAttribute("datetime", time!);
});

test("theater Pierrot uses the replay index rather than current live index", async ({ page }) => {
  const frame = await prepareWorld(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/internal/world/replay?*", route => route.fulfill({ json: {
    date: new URL(route.request().url()).searchParams.get("date"),
    slots: Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date().toISOString(), frame: {
      ...frame, overall: { ...frame.overall, index: i < 72 ? 1 : 9 }
    } }))
  } }));
  await page.goto("/?scene=theater");
  await expect(page.locator(".world-pierrot img")).toHaveAttribute("src", /extreme-bullish-light.webp$/);
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("30");
  await expect(page.locator(".world-pierrot img")).toHaveAttribute("src", /extreme-bearish-light.webp$/);
});
