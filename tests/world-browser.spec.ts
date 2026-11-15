import { expect, test, type Page } from "@playwright/test";
import { prepareWorld, worldRows, requireWebGL2 } from "./world-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { buildWorldFrame, worldDate } from "../lib/world";
import type { RenderMetrics } from "../components/world/hd2d-renderer";

const stage = (page: Page) => page.locator(".hd2d-stage");
const dialog = (page: Page) => page.locator('[data-world-panel="detail"]');
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "월드 장면 선택" }).getByRole("button", { name, exact: true });
async function webgl(page: Page) { await requireWebGL2(page); await expect(stage(page)).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 }); }

test("wall carries live data without a modal; panels open details with keyboard and focus restore", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const frame = await prepareWorld(page); await page.goto("/");
  const index = page.locator("#world-index-wall"), feed = page.locator("#world-feed-wall");
  await expect(index).toContainText(`분석 표본 ${frame.overall.total}건`);
  await expect(feed.locator("li p").first()).toContainText("오늘의 생각");
  await expect(feed).not.toContainText("시발");
  await expect(page.locator('[data-wall-panel="market"]')).toContainText("1,234.56");
  await expect(page.locator('[data-wall-panel="room"]')).toContainText("존버는 승리한다");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Game shell: fixed header, the scene fills the rest, the document never scrolls.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const header = (await page.locator(".world-topbar").boundingBox())!, scene = (await page.locator(".world-scene-stage").boundingBox())!;
  expect(header.y).toBe(0); expect(Math.abs(scene.y - header.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(scene.y + scene.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);
  const details = index.getByRole("button", { name: "산식·시장 지표" });
  await details.click(); await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("tab", { name: "지수", exact: true }).focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End"); await expect(page.getByRole("tab", { name: "곡소리방", exact: true })).toBeFocused();
  await page.keyboard.press("Home"); await expect(page.getByRole("tab", { name: "지수", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0); await expect(details).toBeFocused();
  await details.click(); await page.locator(".world-modal-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(dialog(page)).toHaveCount(0); await expect(details).toBeFocused();
  // Each wall region opens its own detail: feed → full feed with original links, room → posting UI.
  await feed.getByRole("button", { name: "곡소리 피드 전체 보기" }).click();
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog(page).locator(".sentiment-title").first()).toHaveAttribute("href", /^https:\/\/example.com/);
  await page.keyboard.press("Escape");
  await page.locator('[data-wall-panel="room"]').getByRole("button", { name: "곡소리방 열기·글쓰기" }).click();
  await expect(page.getByRole("tab", { name: "곡소리방", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog(page).locator(".goksorry-room-list-region")).toContainText("존버는 승리한다");
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("stock and community scope stays in same layer; evidence filter and original URL", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?scene=ecosystem");
  await expect(page.getByRole("button", { name: /개미굴 ·/ })).toHaveCount(12);
  await page.getByRole("button", { name: /삼성전자 개미굴/ }).click();
  await expect(dialog(page)).toHaveAccessibleName("삼성전자 · 분위기와 근거");
  await expect(page.getByRole("link", { name: /삼성전자 오늘의 생각/ }).first()).toHaveAttribute("href", /^https:\/\/example.com/);
  await page.getByRole("button", { name: "클린필터 끄기", exact: true }).click();
  await expect(page.getByRole("link", { name: /삼성전자 시발/ }).first()).toBeVisible();
  await page.getByRole("tab", { name: "지수", exact: true }).click();
  await page.getByRole("button", { name: /^토스증권 ·/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1); await expect(dialog(page)).toHaveAccessibleName(/토스증권/);
  await page.keyboard.press("Tab");
  expect(await dialog(page).evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect(dialog(page)).toHaveAccessibleName("전체 커뮤니티 · 지수와 피드");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/stock=S0/);
  await nav(page, "곡소리 재난방송").click(); await expect(page.getByRole("heading", { name: "커뮤니티별 현황", level: 1 })).toBeVisible();
  await page.locator(".world-community-list").getByRole("button").first().click(); await expect(dialog(page)).toHaveAccessibleName(/현장/);
});

test("existing feed deep links, filters, more, theme and auth stay accessible", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?channels=toss&feed=1");
  // ?feed=1 opens the full feed dialog; filters and paging live there, not on the wall.
  const wall = dialog(page);
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true");
  await wall.locator(".feed-source-picker summary").click();
  await expect(wall.locator(".feed-channel-buttons .filter-chip-active")).toHaveText("토스증권");
  while (await wall.getByRole("button", { name: "더 보기", exact: true }).count()) {
    await wall.getByRole("button", { name: "더 보기", exact: true }).click();
    await expect(wall.getByRole("button", { name: "불러오는 중...", exact: true })).toHaveCount(0);
  }
  await expect(wall.locator(".feed-pagination")).toContainText("최근 6시간 피드를 모두 불러왔습니다.");
  await page.getByRole("tab", { name: "지수", exact: true }).click();
  await expect(dialog(page).locator(".overview-value").first()).toHaveText("1,234.56");
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  const menu = page.locator('[data-world-panel="menu"]');
  await expect(menu.getByRole("button", { name: "구글 로그인", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "이용약관", exact: true })).toBeVisible();
  await menu.getByRole("button", { name: /테마 선택/ }).click();
  await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible(); await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /테마 선택/ }).click(); await page.getByRole("button", { name: "테마 VS Code", exact: true }).click();
  await page.getByRole("button", { name: "색상 다크", exact: true }).click(); await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "vscode-dark"); await expect(page.getByTestId("program-shell")).toHaveCount(0);
});

test("portrait frames one wall section; arrows, overview, header shortcuts and 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareWorld(page); await page.goto("/");
  const root = page.locator(".world-root");
  await expect(root).toHaveAttribute("data-layout", "sectioned");
  await expect(stage(page)).not.toHaveAttribute("data-renderer", "loading");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.locator(".world-topbar").evaluate((node) => node.getBoundingClientRect().top)).toBe(0);
  await expect(root).toHaveAttribute("data-wall-section", "1");
  const left = page.locator('.world-wall-arrow[data-dir="left"]'), right = page.locator('.world-wall-arrow[data-dir="right"]');
  await right.click(); await expect(root).toHaveAttribute("data-wall-section", "2");
  await expect(right).toHaveAttribute("aria-disabled", "true"); await right.click({ force: true }); await expect(root).toHaveAttribute("data-wall-section", "2");
  await left.click(); await left.click(); await expect(root).toHaveAttribute("data-wall-section", "0");
  if (await stage(page).getAttribute("data-renderer") === "webgl") {
    await page.getByRole("button", { name: "전체보기", exact: true }).click(); await expect(root).toHaveAttribute("data-wall-overview", "true");
    await expect(left).toBeHidden();
    await page.getByRole("button", { name: "확대", exact: true }).click(); await expect(root).toHaveAttribute("data-wall-overview", "false");
  }
  await page.locator(".world-index-toggle").click();
  await expect(page.getByRole("tab", { name: "지수", exact: true })).toHaveAttribute("aria-selected", "true"); await page.keyboard.press("Escape");
  await page.locator(".world-feed-toggle").click();
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true"); await page.keyboard.press("Escape");
  await nav(page, "개미 생태계").click();
  const labels = await page.locator(".world-stock-list strong").evaluateAll((elements) => elements.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(labels.every((value) => value >= 14)).toBe(true);
  const targets = await page.locator(".world-stock-list button,.world-hud-actions button,.world-hud-actions a,.world-bottom button").evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().height));
  expect(targets.every((value) => value >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("phone landscape keeps the full wall like desktop", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 }); await prepareWorld(page); await page.goto("/");
  await expect(page.locator(".world-root")).toHaveAttribute("data-layout", "wide");
  await expect(page.locator(".world-wall-arrow")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test("battle uses total counts, avatar moves and survives details, preferences in menu", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?scene=battle"); await webgl(page);
  await expect(stage(page)).toHaveAttribute("data-population", "48");
  const avatar = page.getByTestId("world-avatar"), before = await avatar.getAttribute("data-position");
  await page.locator(".hd2d-canvas").focus(); await page.keyboard.press("ArrowRight");
  await expect(avatar).not.toHaveAttribute("data-position", before!);
  await page.waitForTimeout(600); const moved = await avatar.getAttribute("data-position");
  await page.locator('.world-camps button[data-side="bearish"]').click();
  await expect(page.getByRole("button", { name: /^공포 \d+건$/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape"); await expect(avatar).toHaveAttribute("data-position", moved!);
  await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  await page.getByRole("button", { name: "내 개미 색상 3" }).click();
  expect(await page.evaluate(() => localStorage.getItem("goksorry-world-avatar-color"))).toBe("#efa5ac");
  await page.getByRole("button", { name: "♡ 감정 표현" }).click(); await page.keyboard.press("Escape"); await expect(avatar).toContainText("♡");
});

test("replay gaps, date changes, 0-10 axis, share and rendered PNG", async ({ page }) => {
  test.setTimeout(60_000); await prepareWorld(page); await page.goto("/?scene=theater");
  const yesterday = worldDate(new Date(Date.now() - 86_400_000)); await page.getByLabel("기록 날짜").fill(yesterday);
  await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeEnabled();
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("0.3"); await expect(page.getByText("이 구간은 기록이 없습니다", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "재생", exact: true }).click(); await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); await page.getByLabel("극장 시간 탐색", { exact: true }).fill("30");
  await page.locator(".world-replay-screen button").click();
  await expect(dialog(page)).toContainText("저장 시점"); await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe(`goksorry-${yesterday}.png`);
  const png = await readFile((await download.path())!); expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(800); expect(png.length).toBeGreaterThan(100_000);
  await page.getByRole("button", { name: "링크 공유", exact: true }).click(); await expect(page.getByLabel("극장 공유 링크")).toHaveValue(/scene=theater.*date=/);
});

for (const kind of ["fear", "hope", "neutral", "sparse", "empty"] as const) test(`${kind} sample matches crowd and screen`, async ({ page }) => {
  await prepareWorld(page); const rows = worldRows();
  const filtered = kind === "empty" ? [] : kind === "sparse" ? rows.slice(0, 1) : rows.map((r) => ({ ...r, label: kind === "fear" ? "bearish" as const : kind === "hope" ? "bullish" as const : "neutral" as const }));
  await page.route("**/api/internal/world", (route) => route.fulfill({ json: buildWorldFrame(filtered) }));
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-renderer", "reduced");
  if (kind === "fear") { await expect(stage(page)).toHaveAttribute("data-fear", "47"); await expect(page.locator(".world-ratios")).toContainText("공포 100%"); }
  if (kind === "hope") { await expect(stage(page)).toHaveAttribute("data-hope", "47"); await expect(page.locator(".world-ratios")).toContainText("희망 100%"); }
  if (kind === "neutral") { await expect(stage(page)).toHaveAttribute("data-neutral", "47"); await expect(page.locator(".world-ratios")).toContainText("—"); }
  if (kind === "sparse") { await expect(stage(page)).toHaveAttribute("data-population", "2"); await expect(page.locator(".world-live-badge")).toContainText("소표본"); }
  if (kind === "empty") { await expect(stage(page)).toHaveAttribute("data-population", "1"); await expect(page.locator(".world-index-number strong")).toHaveText("—"); }
});

test("initial loading, 503 and stale refresh preserve last good values and time", async ({ page }) => {
  const frame = await prepareWorld(page); let release: () => void = () => {}; const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/internal/world", async (route) => { await pending; await route.fulfill({ json: frame }); });
  await page.goto("/"); await expect(page.locator(".world-live-badge")).toContainText("최초"); release();
  await expect(page.locator(".world-index-screen")).toContainText(`분석 표본 ${frame.overall.total}건`);
  const time = await page.locator(".world-live-badge time").getAttribute("datetime");
  await page.route("**/api/internal/world", (route) => route.fulfill({ status: 503, json: { error: "테스트 데이터 장애" } }));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-live-badge")).toContainText("마지막 정상");
  await expect(page.locator(".world-live-badge time")).toHaveAttribute("datetime", time!);
  await expect(page.locator(".world-index-screen")).toContainText(`분석 표본 ${frame.overall.total}건`);
  await page.route("**/api/internal/world", (route) => route.fulfill({ json: { ...frame, data_at: new Date(Date.now() - 3_600_000).toISOString() } }));
  await page.getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(page.locator(".world-live-badge")).toContainText("갱신 지연");
});

test("WebGL and asset failures use same static art with working screens", async ({ page }) => {
  await prepareWorld(page); await page.route("**/world/ants.png", (route) => route.abort()); await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-renderer", "failed");
  await expect(page.locator(".world-static-scene")).toHaveCSS("background-image", /static-plaza.png/);
  await page.getByRole("button", { name: "산식·시장 지표" }).click(); await expect(dialog(page)).toBeVisible();
});

test("first visit guidance lives inside menu; cookie banner does not cover information", async ({ page }) => {
  await prepareWorld(page); await page.context().clearCookies(); await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.getByRole("note", { name: "초기 설정 안내" })).toHaveCount(0);
  // The banner floats over the floor at the bottom; it never covers the fixed header or the wall centre.
  await expect(page.locator(".cookie-consent-banner")).toHaveCSS("position", "fixed");
  const banner = (await page.locator(".cookie-consent-banner").boundingBox())!, header = (await page.locator(".world-topbar").boundingBox())!;
  expect(banner.y).toBeGreaterThan(header.y + header.height);
  await page.locator(".world-index-toggle").click();
  await expect(page.locator(".cookie-consent-banner")).toBeHidden();
  await page.keyboard.press("Escape"); await expect(page.locator(".cookie-consent-banner")).toBeVisible();
  await page.locator(".world-index-toggle").click(); await expect(dialog(page)).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  await expect(page.getByRole("note", { name: "초기 설정 안내" })).toBeVisible();
});

test("hidden tab stops actual render and polling; resumes once visible", async ({ page }) => {
  await prepareWorld(page); let reads = 0; page.on("request", (req) => { if (new URL(req.url()).pathname === "/api/internal/world") reads++; });
  await page.goto("/"); await webgl(page);
  const readRenders = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.renders);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  await page.waitForTimeout(200); const hiddenRenders = await readRenders(), hiddenReads = reads;
  await page.clock.install(); await page.clock.fastForward(120_000);
  expect(await readRenders()).toBe(hiddenRenders); expect(reads).toBe(hiddenReads);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => reads).toBe(hiddenReads + 1);
});

test("measure actual render throughput at 48/24 ants during movement, detail and replay", async ({ page }, testInfo) => {
  test.setTimeout(90_000); await prepareWorld(page); const results: unknown[] = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto("/?scene=battle"); await webgl(page);
    await expect(stage(page)).toHaveAttribute("data-population", viewport.width > 760 ? "48" : "24");
    for (const scenario of ["movement", "detail", "replay"]) {
      if (scenario === "movement") { await page.locator("canvas").focus(); await page.keyboard.press("ArrowRight"); }
      if (scenario === "detail") await page.locator('.world-camps button[data-side="bearish"]').click();
      if (scenario === "replay") { await page.keyboard.press("Escape"); await nav(page, "오늘의 개미극장").click(); await page.getByRole("button", { name: "재생", exact: true }).click(); }
      const measure = await page.evaluate(async () => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement & { worldMetrics: RenderMetrics };
        const m = canvas.worldMetrics, start = performance.now(), before = m.renders;
        m.frames.length = 0; m.cpu.length = 0; m.gpu.length = 0;
        const raf: number[] = []; let previous = 0, request = 0; const tick = (now: number) => { if (previous) raf.push(now - previous); previous = now; request = requestAnimationFrame(tick); }; request = requestAnimationFrame(tick);
        await new Promise((resolve) => setTimeout(resolve, 2500)); cancelAnimationFrame(request);
        const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length * .95)] ?? null;
        return { renderer: m.renderer, population: m.population, renderedFps: (m.renders - before) / ((performance.now() - start) / 1000), renderIntervalP95: p95(m.frames), renderCpuP95: p95(m.cpu), gpuP95: p95(m.gpu), rafIntervalP95: p95(raf), calls: m.calls, triangles: m.triangles };
      });
      expect(measure.renderedFps).toBeGreaterThan(0); results.push({ ...viewport, scenario, ...measure });
    }
  }
  const path = testInfo.outputPath("world-render-performance.json"); await writeFile(path, JSON.stringify(results, null, 2)); await testInfo.attach("render-performance", { path, contentType: "application/json" });
});

test("mode switch moves between the metaverse room and the classic page, keeping the feed scope", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*"); await page.goto("/?channels=toss");
  await page.locator(".world-topbar .mode-switch").getByRole("link", { name: /일반/ }).click();
  await expect(page).toHaveURL(/\/classic\?channels=toss$/);
  await expect(page.locator(".world-root")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "최근 글", level: 1 })).toBeVisible();
  await expect(page.locator(".header .mode-switch a[aria-current=page]")).toContainText("일반");
  // Filters on the classic page stay on the classic page.
  await page.locator(".feed-channel-buttons").getByRole("button", { name: "뽐뿌", exact: true }).click();
  await expect(page).toHaveURL(/\/classic\?channels=toss%2Cppomppu/);
  await page.locator(".header .mode-switch").getByRole("link", { name: /메타버스/ }).click();
  await expect(page).toHaveURL(/:3100\/\?channels=toss%2Cppomppu/);
  await expect(page.locator(".world-root")).toBeVisible();
  await expect(page.locator(".world-topbar .mode-switch a[aria-current=page]")).toContainText("메타버스");
});
