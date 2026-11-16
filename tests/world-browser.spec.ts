import { expect, test, type Page } from "@playwright/test";
import { prepareWorld, worldRows, requireWebGL2 } from "./world-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { buildWorldFrame, worldDate } from "../lib/world";
import type { RenderMetrics } from "../components/world/hd2d-renderer";
import antAtlas from "../components/world/ant-atlas.json";

const stage = (page: Page) => page.locator(".hd2d-stage");
const dialog = (page: Page) => page.locator('[data-world-panel="detail"]');
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "월드 장면 선택" }).getByRole("button", { name, exact: true });
/** Simulates a browser without WebGL2: the only case the world is designed to show its static scene. */
async function withoutWebGL2(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === "webgl2" ? null : (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
}
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
  // The index tab offers communities only; stocks are chosen in the ecosystem/battle scenes and the feed tab.
  await expect(dialog(page).getByRole("heading", { name: "커뮤니티 선택", exact: true })).toBeVisible();
  await expect(dialog(page).locator(".world-detail-selection button")).toHaveText([/^토스증권 ·/, /^뽐뿌 ·/, /^블라인드 ·/, /^디시 4종 ·/]);
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
  // Reduced motion still renders the room in WebGL; only ambient motion stops.
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await webgl(page);
  if (kind === "fear") { await expect(stage(page)).toHaveAttribute("data-fear", "20"); await expect(page.locator(".world-ratios")).toContainText("공포 100%"); }
  if (kind === "hope") { await expect(stage(page)).toHaveAttribute("data-hope", "20"); await expect(page.locator(".world-ratios")).toContainText("희망 100%"); }
  if (kind === "neutral") { await expect(stage(page)).toHaveAttribute("data-neutral", "20"); await expect(page.locator(".world-ratios")).toContainText("—"); }
  if (kind === "sparse") { await expect(stage(page)).toHaveAttribute("data-population", "2"); await expect(page.locator(".world-live-badge")).toContainText("소표본"); }
  if (kind === "empty") { await expect(stage(page)).toHaveAttribute("data-population", "1"); await expect(page.locator(".world-index-number strong")).toHaveText("—"); }
});

test("initial loading, 503 and stale refresh preserve last good values and time", async ({ page }) => {
  const frame = await prepareWorld(page); let release: () => void = () => {}; const pending = new Promise<void>((resolve) => { release = resolve; });
  await withoutWebGL2(page);
  await page.route("**/api/internal/world", async (route) => { await pending; await route.fulfill({ json: frame }); });
  await page.goto("/"); await expect(page.locator(".world-live-badge")).toContainText("최초");
  await expect(stage(page)).toHaveAttribute("data-renderer", "unsupported");
  await expect(page.locator(".world-render-note")).toContainText("WebGL2");
  // Static fallback: the index and portrait wait behind skeletons, never a guessed value.
  await expect(page.locator(".world-index-screen .world-skeleton")).toBeVisible();
  await expect(page.locator('[data-wall-panel="pierrot"] img')).toHaveCount(0);
  release();
  await expect(page.locator(".world-index-screen")).toContainText(`분석 표본 ${frame.overall.total}건`);
  await expect(page.locator(".world-skeleton")).toHaveCount(0);
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

test("reduced motion keeps the WebGL room but stops the crowd's ambient roaming", async ({ page }) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await webgl(page);
  const crowd = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd().map((a) => `${a.x.toFixed(3)},${a.z.toFixed(3)}`).join("|"));
  await expect.poll(async () => (await crowd()).length).toBeGreaterThan(0);
  const before = await crowd(); await page.waitForTimeout(1500);
  expect(await crowd()).toBe(before);
});

test("WebGL wall sweeps a shimmer over panels until their first payload arrives", async ({ page }) => {
  await prepareWorld(page); let release: () => void = () => {}; const pending = new Promise<void>((resolve) => { release = resolve; });
  // Hold the feed poll and the world frame: either one supplies the index and its portrait.
  for (const url of ["**/api/feed?*", "**/api/internal/world"]) await page.route(url, async (route) => { await pending; await route.fallback(); });
  await page.goto("/"); await webgl(page);
  const shimmer = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.wall?.shimmer ?? null);
  // Market and room are fixture-fast; feed, index and portrait wait.
  await expect.poll(shimmer).toEqual(["pierrot", "index", "feed"]);
  release();
  await expect.poll(shimmer).toEqual([]);
});

test("WebGL and asset failures use same static art with working screens", async ({ page }) => {
  await prepareWorld(page); await page.route("**/world/ant*.png", (route) => route.abort()); await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-renderer", "failed");
  await expect(page.locator(".world-static-scene")).toHaveCSS("background-image", /static-plaza.png/);
  // A failure is an error, not a mode: it says so and offers a retry.
  await expect(page.locator(".world-render-note")).toHaveText("3D 화면을 불러오지 못했습니다");
  await page.getByRole("button", { name: "3D 화면 다시 시도" }).click();
  await expect(stage(page)).toHaveAttribute("data-renderer", "failed");
  await page.getByRole("button", { name: "산식·시장 지표" }).click(); await expect(dialog(page)).toBeVisible();
});

test("a dialog opens on the side of the wall panel that opened it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await prepareWorld(page); await page.goto("/"); await webgl(page);
  const centre = async () => { const box = (await dialog(page).boundingBox())!; return box.x + box.width / 2; };
  const settled = async () => { await expect(dialog(page)).toBeVisible(); await expect.poll(async () => dialog(page).evaluate((node) => node.getAnimations().length)).toBe(0); };
  // Left of the wall: market indices and the room.
  for (const name of ["시장 지수 자세히", "곡소리방 열기·글쓰기"]) {
    await page.getByRole("button", { name }).click(); await settled();
    await expect(page.locator(".world-modal-backdrop")).toHaveAttribute("data-side", "left");
    expect(await centre()).toBeLessThan(1440 / 3);
    await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
  }
  // Middle of the wall: the Pierrot portrait and the index.
  for (const name of ["삐에로·지수 자세히", "산식·시장 지표"]) {
    await page.getByRole("button", { name }).click(); await settled();
    await expect(page.locator(".world-modal-backdrop")).toHaveAttribute("data-side", "center");
    const x = await centre(); expect(x).toBeGreaterThan(1440 / 3); expect(x).toBeLessThan(1440 * 2 / 3);
    await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
  }
  // Right of the wall: the feed. Its two-lane tab is wider than a third of the screen, so it is
  // checked against the right edge; the standard-width tab of the same dialog sits in the right third.
  await page.getByRole("button", { name: "곡소리 피드 전체 보기" }).click(); await settled();
  await expect(page.locator(".world-modal-backdrop")).toHaveAttribute("data-side", "right");
  const feed = (await dialog(page).boundingBox())!;
  expect(1440 - (feed.x + feed.width)).toBeLessThanOrEqual(25); expect(feed.x).toBeGreaterThan(1440 - (feed.x + feed.width));
  await dialog(page).getByRole("tab", { name: "지수" }).click();
  await expect.poll(centre).toBeGreaterThan(1440 * 2 / 3);
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
});

test("plaza shows about twenty roaming ants that mostly face the wall; clicking an ant only walks the visitor there", async ({ page }) => {
  test.setTimeout(60_000);
  const crowd = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd());
  const visitor = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.visitor());
  await page.setViewportSize({ width: 1440, height: 900 }); await prepareWorld(page); await page.goto("/"); await webgl(page);
  await expect(stage(page)).toHaveAttribute("data-population", "21");
  // No fixed sleep: the crowd is spread and mostly wall-facing from its first frame, and stays so.
  await expect.poll(async () => (await crowd()).length).toBe(20);
  const ants = await crowd();
  // Spread over the visible floor, not a strip under the wall.
  expect(Math.max(...ants.map((a) => a.z))).toBeGreaterThan(.8);
  expect(Math.min(...ants.map((a) => a.z))).toBeLessThan(-1);
  // Most stand with their backs to the camera (bl, b, br), looking at the wall.
  expect(ants.filter((a) => a.state === "gaze" && a.dir >= 3 && a.dir <= 5).length).toBeGreaterThanOrEqual(10);
  // Ants are not click targets: a click that lands on one opens nothing and the visitor walks there like any floor click.
  await expect(async () => {
    const box = (await page.locator("canvas").boundingBox())!;
    // A standing ant whose legs are not under a HUD element or wall button, away from the visitor, nearest mid-screen.
    const picked = await page.locator("canvas").evaluate((node) => {
      const canvas = node as HTMLCanvasElement & { worldMetrics: RenderMetrics }, bounds = canvas.getBoundingClientRect(), me = canvas.worldMetrics.visitor();
      const ant = canvas.worldMetrics.crowd().filter((a) => a.state === "gaze" && a.z > -1.5 && Math.hypot(a.x - me.x, a.z - me.z) > 2 && document.elementFromPoint(bounds.left + a.sx, bounds.top + a.sy + a.sh * .35) === canvas)
        .sort((a, b) => Math.abs(a.sy - bounds.height / 2) - Math.abs(b.sy - bounds.height / 2))[0] ?? null;
      return ant && { ant, far: Math.hypot(ant.x - me.x, ant.z - me.z) };
    });
    expect(picked).not.toBeNull();
    // On the sprite, low on its legs: the floor under that pixel is right behind the ant's feet.
    await page.mouse.click(box.x + picked!.ant.sx, box.y + picked!.ant.sy + picked!.ant.sh * .35);
    // The click went through the ant to the floor, so the visitor closes most of the distance.
    await expect.poll(async () => { const me = await visitor(); return Math.hypot(picked!.ant.x - me.x, picked!.ant.z - me.z); }, { timeout: 4000 }).toBeLessThan(Math.max(1.6, picked!.far / 2));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await webgl(page);
  await expect(stage(page)).toHaveAttribute("data-population", "13");
  await expect.poll(async () => (await crowd()).length).toBe(12);
  const phone = await crowd();
  expect(phone.filter((a) => a.sx >= 0 && a.sx <= 390).length).toBeGreaterThanOrEqual(5);
  // The zoomed phone view draws the ants smaller: none is taller than about a tenth of the screen.
  const size = await page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.antSize);
  expect(size).toBeGreaterThanOrEqual(.6); expect(size).toBeLessThan(.7);
  expect(Math.max(...phone.map((a) => a.sh), (await visitor()).sh)).toBeLessThan(844 * .1);
  // Whoever walks is drawn in a walk frame of the direction it faces (or its standing frame while it waits for another ant to pass).
  for (const a of phone.filter((a) => a.state === "walk")) expect(a.frame).toMatch(/^(neutral|fear|hope)\.(walk-[abp]|idle)\.(f|fl|l|bl|b|br|r|fr)~?$/);
});

// Samples every animation frame in the page: all frame keys drawn per state, and the most breath puffs drawn at once.
const watchCrowd = (page: Page, seconds: number) => page.locator("canvas").evaluate(async (node, seconds) => {
  const metrics = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics, seen: Record<string, string[]> = {}, cycles: string[][] = [], open: Record<number, string[]> = {};
  let puffs = 0, relievedPuffs = 0;
  for (const end = performance.now() + seconds * 1000; performance.now() < end;) {
    const crowd = metrics.crowd();
    crowd.forEach((a, i) => {
      const key = `${a.state}:${a.dir}`; if (!(seen[key] ??= []).includes(a.frame)) seen[key].push(a.frame);
      // Pose sequence of each uninterrupted walk (consecutive repeats dropped).
      const pose = a.frame.split(".")[1];
      if (a.state === "walk") { const run = open[i] ??= []; if (run[run.length - 1] !== pose) run.push(pose); } else if (open[i]) { cycles.push(open[i]); delete open[i]; }
    });
    puffs = Math.max(puffs, metrics.puffs);
    // A puff belongs to an ant drawn in a real sigh frame (or a stand-in for one), never to the relieved pose.
    if (metrics.puffs > crowd.filter((a) => a.state === "sigh" && !a.frame.includes("-bright.sigh.")).length) relievedPuffs++;
    await new Promise((done) => requestAnimationFrame(done));
  }
  return { seen, cycles: [...cycles, ...Object.values(open)], puffs, relievedPuffs, atlas: metrics.atlas };
}, seconds);
const drawn = (watch: { seen: Record<string, string[]> }, state: string) => Object.entries(watch.seen).filter(([key]) => key.startsWith(`${state}:`)).flatMap(([, frames]) => frames);

test("walkers pass their feet through real passing frames; gazers tip their heads through the in-between; a sigh breathes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 }); await prepareWorld(page); await page.goto("/"); await webgl(page);
  await expect.poll(() => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd().length)).toBe(20);
  const all = { seen: {} as Record<string, string[]>, cycles: [] as string[][], puffs: 0, relievedPuffs: 0, atlas: "" };
  const wanted = [/^hope\.walk-p\.(f|l|r|b)~?$/, /^(neutral|hope)\.walk-p\.(fl|fr|bl|br)$/];
  await expect(async () => {
    const part = await watchCrowd(page, 4);
    for (const [key, frames] of Object.entries(part.seen)) all.seen[key] = [...new Set([...(all.seen[key] ?? []), ...frames])];
    all.cycles.push(...part.cycles); all.puffs = Math.max(all.puffs, part.puffs); all.relievedPuffs += part.relievedPuffs; all.atlas = part.atlas;
    for (const frame of wanted) expect(drawn(all, "walk").some((key) => frame.test(key)), String(frame)).toBe(true);
    expect(drawn(all, "gaze").some((key) => /\.tilt\.b$/.test(key))).toBe(true);
    expect(drawn(all, "sigh").length).toBeGreaterThan(0); expect(all.puffs).toBeGreaterThan(0);
  }).toPass({ timeout: 90_000 });
  // A desktop screen loads the full atlas.
  expect(all.atlas).toBe("/world/ant-atlas.png");
  // Between two strides there is always the passing step. The standing frame only shows while a walker waits, and then
  // never as the bridge from one stride to the other (the old stand-in, which pumped the scarf ant's raised fist).
  expect(all.cycles.length).toBeGreaterThan(3);
  for (const cycle of all.cycles) cycle.forEach((pose, i) => {
    expect(["walk-a", "walk-b", "walk-p", "idle"], cycle.join(" ")).toContain(pose);
    if (pose.startsWith("walk-") && pose !== "walk-p" && cycle[i + 1] && cycle[i + 1] !== "idle") expect(cycle[i + 1], cycle.join(" ")).toBe("walk-p");
    if (pose === "idle" && i > 0 && i + 1 < cycle.length && cycle[i - 1] !== "walk-p" && cycle[i + 1] !== "walk-p") expect(cycle[i + 1], cycle.join(" ")).toBe(cycle[i - 1]);
  });
  // The in-between is only ever drawn for a wall gazer seen from straight behind (dir 4); other states never show it.
  for (const [key, frames] of Object.entries(all.seen)) if (key !== "gaze:4") expect(frames.filter((frame) => frame.includes(".tilt.")), key).toEqual([]);
  // Straight behind, looking up is its own picture next to the level gaze.
  expect(all.seen["gaze:4"].some((key) => /\.look\.b$/.test(key))).toBe(true); expect(all.seen["gaze:4"].some((key) => /\.idle\.b$/.test(key))).toBe(true);
  // Under the default (중립) index nobody is bright: phones and sighs are the dull art, with breath.
  expect(Object.values(all.seen).flat().filter((key) => key.includes("-bright"))).toEqual([]);
  for (const key of drawn(all, "sigh")) expect(key).toMatch(/^(neutral|fear|hope)\.sigh\./);
  expect(all.relievedPuffs).toBe(0);
  // A phone-sized screen loads the two-thirds copy and draws the same frames from it.
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await webgl(page);
  const small = await page.locator("canvas").evaluate((node) => { const m = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics; return { atlas: m.atlas, ants: [...m.crowd(), m.visitor()] }; });
  expect(small.atlas).toBe("/world/ant-atlas-small.png");
  // Nothing is enlarged from it: at pixel ratio 2 every sprite is drawn at no more than two thirds of a screen pixel per atlas pixel.
  const frames = antAtlas.frames as Record<string, number[]>;
  for (const a of small.ants) { const frame = frames[a.frame.replace("~", "")]; expect(a.sh * 2 / (frame[3] * frame[4]), a.frame).toBeLessThanOrEqual(2 / 3); }
});

test("resting ants look up at the wall; when the index turns to hope the faces brighten in place", async ({ page }) => {
  test.setTimeout(180_000);
  const read = () => page.locator("canvas").evaluate((node) => { const m = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics; return { band: m.band, bright: m.bright, crowd: m.crowd(), visitor: m.visitor() }; });
  await page.setViewportSize({ width: 1440, height: 900 }); const frame = await prepareWorld(page); await page.goto("/"); await webgl(page);
  await expect.poll(async () => (await read()).crowd.length).toBe(20);
  // Default fixture: the index panel reads 중립, so nobody wears a bright face.
  const calm = await read();
  expect(calm.band).toBe("neutral"); expect(calm.bright).toBe(false);
  expect([...calm.crowd, calm.visitor].filter((a) => a.frame.includes("-bright"))).toEqual([]);
  // Looking up happens only while gazing at the wall, back to the camera, and some gazer is doing it at any time.
  const looking = (crowd: typeof calm.crowd) => crowd.filter((a) => /\.look\.(bl|b|br)~?$/.test(a.frame));
  await expect.poll(async () => looking((await read()).crowd).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  for (const a of (await read()).crowd) if (a.frame.includes(".look.")) { expect(a.state).toBe("gaze"); expect([3, 4, 5]).toContain(a.dir); }
  // A data refresh moves the index to 희망: same ants, same places, brighter faces.
  const hopeful = buildWorldFrame(worldRows().map((row, i) => row.label === "bearish" && i % 4 ? { ...row, label: "bullish" as const, sentiment_score: 8 } : row));
  expect(hopeful.overall.fear_ratio).toBeGreaterThan(0); expect(frame.overall.mood).toBe("mixed");
  const standing = (await read()).crowd.map((a, i) => ({ ...a, i })).filter((a) => a.state === "gaze");
  await page.route("**/api/internal/world", (route) => route.fulfill({ json: hopeful }));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(async () => (await read()).bright, { timeout: 10_000 }).toBe(true);
  const bright = await read();
  expect(["bullish", "extreme_bullish"]).toContain(bright.band);
  expect(bright.crowd).toHaveLength(20);
  // Nobody was moved by the refresh: whoever stood still stands in the same spot.
  const kept = standing.filter((a) => bright.crowd[a.i].state === "gaze");
  expect(kept.length).toBeGreaterThanOrEqual(5);
  for (const a of kept) expect(Math.hypot(bright.crowd[a.i].x - a.x, bright.crowd[a.i].z - a.z)).toBeLessThan(.01);
  // Neutral and hope ants (and the visitor) show bright frames; fear ants never do; looking up carries on.
  expect(bright.visitor.frame).toMatch(/^neutral-bright\./);
  await expect.poll(async () => (await read()).crowd.filter((a) => /^(neutral|hope)-bright\./.test(a.frame)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(8);
  await expect.poll(async () => looking((await read()).crowd).filter((a) => a.frame.includes("-bright.look.")).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  expect((await read()).crowd.filter((a) => a.frame.startsWith("fear-")).length).toBe(0);
  // On the phone the neutral and hope ants keep the bright face, and what follows is the relieved pose: no sigh frame, no breath.
  const mood = { seen: {} as Record<string, string[]>, relievedPuffs: 0 };
  await expect(async () => {
    const part = await watchCrowd(page, 4);
    for (const [key, frames] of Object.entries(part.seen)) mood.seen[key] = [...new Set([...(mood.seen[key] ?? []), ...frames])];
    mood.relievedPuffs += part.relievedPuffs;
    expect(drawn(mood, "phone").some((key) => /^(neutral|hope)-bright\.phone\./.test(key))).toBe(true);
    expect(drawn(mood, "sigh").some((key) => /^(neutral|hope)-bright\.sigh\./.test(key))).toBe(true);
  }).toPass({ timeout: 100_000 });
  for (const state of ["phone", "sigh"]) for (const key of drawn(mood, state)) expect(key, state).toMatch(new RegExp(`^((neutral|hope)-bright|fear)\\.${state}\\.(f|l|r|b)~?$`));
  expect(mood.relievedPuffs).toBe(0);
  // Walkers keep one face through the cycle: every frame of a bright walk is bright, in one direction.
  const walk = await page.locator("canvas").evaluate(async (node) => {
    const metrics = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics, seen: Record<number, string[]> = {};
    for (let n = 0; n < 90; n++) { metrics.crowd().forEach((a, i) => { if (a.state === "walk") (seen[i] ??= []).push(a.frame); else delete seen[i]; }); await new Promise((done) => requestAnimationFrame(done)); }
    return Object.values(seen);
  });
  // (A walker that turns from b to bl goes from the bright 4-way set to the plain diagonal one, where its face is hidden;
  // within one direction the set never changes.)
  for (const frames of walk) for (const dir of new Set(frames.map((key) => key.replace("~", "").split(".")[2]))) {
    const skins = new Set(frames.filter((key) => key.replace("~", "").split(".")[2] === dir).map((key) => key.split(".")[0]));
    expect(skins.size, frames.join(" ")).toBe(1);
  }
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
