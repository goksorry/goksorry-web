import { expect, test, type Page } from "@playwright/test";
import { prepareWorld, worldRows, requireWebGL2, withoutWebGL2 } from "./world-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { buildWorldFrame, worldDate, type WorldFrame } from "../lib/world";
import type { RenderMetrics } from "../components/world/hd2d-renderer";
import antAtlas from "../components/world/ant-atlas.json";
import { THEATER_AUDIENCE, THEATER_CHAIR, THEATER_DOOR, THEATER_STAGE } from "../lib/world-theater-cast";
import { WALL_COS, WALL_FACE_Z } from "../lib/world-wall";

const stage = (page: Page) => page.locator(".hd2d-stage");
const dialog = (page: Page) => page.locator('[data-world-panel="detail"]');
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "월드 장면 선택" }).getByRole("button", { name, exact: true });
async function webgl(page: Page) { await requireWebGL2(page); await expect(stage(page)).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 }); }
function scopedFeed(frame: WorldFrame) {
  const { evidence, ...summary } = frame.overall;
  return { rows: Object.values(evidence).flat(), summary: { ...summary, data_at: frame.data_at } };
}

const theaterCast = (page: Page) => page.locator("canvas").evaluate((node) => {
  const metrics = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics;
  const cast = metrics.theater();
  return { actors: cast.filter((ant) => ant.role === "actor"), audience: cast.filter((ant) => ant.role === "spectator") };
});

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
  await prepareWorld(page);
  // An old 개미 생태계 link opens the battle, which now carries its mention ranking as the stock picker.
  await page.goto("/?scene=ecosystem"); await expect(page).toHaveURL(/scene=battle/);
  await expect(nav(page, "심리 전장")).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "진영·종목 선택 열기" }).click();
  const picker = page.getByRole("group", { name: "전장 종목" });
  await expect(picker.getByRole("button")).toHaveCount(13);
  await expect(picker.getByRole("button", { name: "전체 커뮤니티" })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: /^삼성전자 ·/ }).click();
  await expect(page).toHaveURL(/stock=S0/); await expect(picker.getByRole("button", { name: /^삼성전자 ·/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".world-battle-scope")).toContainText("삼성전자");
  // The camps follow the picked stock; a camp moves on to its evidence.
  await page.locator(".world-camps").getByRole("button", { name: /희망군/ }).click();
  await expect(dialog(page)).toHaveAccessibleName("삼성전자 희망군 · 분위기와 근거");
  await expect(page.getByRole("link", { name: /삼성전자 오늘의 생각/ }).first()).toHaveAttribute("href", /^https:\/\/example.com/);
  await page.getByRole("button", { name: "클린필터 끄기", exact: true }).click();
  await expect(page.getByRole("link", { name: /삼성전자 시발/ }).first()).toBeVisible();
  await page.getByRole("tab", { name: "지수", exact: true }).click();
  // The index tab offers communities only (the former 재난방송 list); stocks are chosen in the battle and the feed tab.
  await expect(dialog(page).getByRole("heading", { name: "커뮤니티 현황", exact: true })).toBeVisible();
  await expect(dialog(page).locator(".world-community-list button strong")).toHaveText(["토스증권", "뽐뿌", "블라인드", "디시 4종"]);
  await expect(dialog(page).locator(".world-community-list button").first()).toContainText(/\/ 10 · 표본 \d+건.*공포 \d+% · 희망 \d+%.*관심: /);
  await dialog(page).locator(".world-community-list button").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(1); await expect(dialog(page)).toHaveAccessibleName(/토스증권/);
  await page.keyboard.press("Tab");
  expect(await dialog(page).evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect(dialog(page)).toHaveAccessibleName("전체 커뮤니티 · 지수와 피드");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/stock=S0/);
  // An old 재난방송 link opens the plaza, whose wall carries the community board: each community opens its evidence.
  await page.goto("/?scene=broadcast"); await expect(page).not.toHaveURL(/scene=/);
  await expect(nav(page, "광장")).toHaveAttribute("aria-current", "page");
  const board = page.locator('[data-wall-panel="communities"]');
  await expect(board.getByRole("button")).toHaveCount(4);
  await expect(board.getByRole("button").first()).toContainText(/토스증권.*곡소리 지수 \d+\.\d \/ 10.*공포 \d+% · 희망 \d+%/);
  await board.getByRole("button", { name: /^뽐뿌/ }).click(); await expect(dialog(page)).toHaveAccessibleName("뽐뿌 · 분위기와 근거");
});

test("existing feed deep links, filters, more, theme and auth stay accessible", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?channels=toss&feed=1");
  // ?feed=1 opens the full feed dialog; filters and paging live there, not on the wall.
  const wall = dialog(page);
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true");
  // No visible title: the tabs fill the heading row and ✕ sits at its right end.
  const heading = wall.locator(".world-panel-heading");
  await expect(heading.locator("h2")).toHaveCount(0);
  await expect(heading.getByRole("tablist", { name: "정보 전환" })).toBeVisible();
  const close = heading.getByRole("button", { name: "전체 커뮤니티 · 지수와 피드 닫기", exact: true });
  const [bar, x] = [await heading.boundingBox(), await close.boundingBox()];
  expect(bar!.x + bar!.width - (x!.x + x!.width)).toBeLessThan(24);
  // No stock dropdown; the four sources are always shown and 예쁜말 ends the 좌우/통합 row.
  await expect(wall.locator("select")).toHaveCount(0);
  await expect(wall.locator(".feed-channel-buttons .filter-chip-active")).toHaveText("토스증권");
  await expect(wall.locator(".clean-filter-toggle")).toHaveCount(1);
  await expect(wall.getByRole("group", { name: "피드 보기 방식" }).locator(".clean-filter-toggle")).toBeVisible();
  while (await wall.getByRole("button", { name: "더 보기", exact: true }).count()) {
    await wall.getByRole("button", { name: "더 보기", exact: true }).click();
    await expect(wall.getByRole("button", { name: "불러오는 중...", exact: true })).toHaveCount(0);
  }
  await expect(wall.locator(".feed-pagination")).toContainText("최근 6시간 피드를 모두 불러왔습니다.");
  await page.getByRole("tab", { name: "지수", exact: true }).click();
  await expect(dialog(page).locator(".overview-value").first()).toHaveText("1,234.56");
  // 시장 and 곡소리 지수 are spaced apart; the ratio note is a small footnote at the very end.
  const tabpanel = dialog(page).locator("#world-tabpanel-index");
  const [market, goksorry] = [await tabpanel.locator(".overview-market-block").boundingBox(), await tabpanel.locator(".overview-panel").boundingBox()];
  expect(goksorry!.y - (market!.y + market!.height)).toBeGreaterThanOrEqual(16);
  await expect(tabpanel.locator(":scope > :last-child")).toHaveClass("world-footnote");
  await expect(tabpanel.locator(".world-footnote")).toContainText("희망·공포 비율은 중립을 제외한");
  expect(await tabpanel.locator(".world-footnote").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThan(14);
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  const menu = page.locator('[data-world-panel="menu"]');
  // The menu opens with the site header (no account, no theme: the account lives in the top bar), then the settings, then the footer.
  await expect(menu.locator(".world-panel-body > *").first()).toHaveClass(/\bheader\b/);
  await expect(menu.getByRole("button", { name: "구글 로그인", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: /테마 선택|등락률 색상 선택/ })).toHaveCount(0);
  await expect(menu.locator(".clean-filter-toggle")).toHaveCount(1); await expect(menu.locator(".header .clean-filter-toggle")).toHaveCount(1);
  await expect(menu.getByRole("heading", { name: "장면 이동" })).toHaveCount(0);
  await expect(menu.locator(".world-settings p, .world-settings .world-note")).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "이용약관", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".world-topbar .world-account").getByRole("button", { name: "구글 로그인", exact: true })).toBeVisible();
});

test("the room has no theme: ?theme is dropped, the world keeps its palette, classic mode brings the theme back", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?theme=excel-dark&channels=toss");
  await expect.poll(() => new URL(page.url()).searchParams.get("theme")).toBeNull(); await expect(page).toHaveURL(/channels=toss/);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark"); await expect(html).toHaveAttribute("data-theme-shell", "default");
  await expect(page.getByTestId("program-shell")).toHaveCount(0);
  await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  const menu = page.locator('[data-world-panel="menu"]');
  await expect(menu.getByRole("button", { name: /테마 선택/ })).toHaveCount(0);
  await expect(page.locator(".world-panel")).toHaveCSS("background-color", "rgb(16, 27, 34)");
  await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
  // Every frame across the soft navigations must root the look of the page it shows (no frame of the other one's colours).
  await page.evaluate(() => { const w = window as unknown as { mixed: string[] }; w.mixed = []; const tick = () => { const root = document.documentElement, room = !!document.querySelector(".world-page");
    if (room !== (root.dataset.themeShell === "default" && root.dataset.theme === "dark")) w.mixed.push(`${location.pathname} ${root.dataset.themeId}`); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.locator(".world-topbar .mode-switch").getByRole("link", { name: "웹", exact: true }).click();
  await expect(page).toHaveURL(/\/classic\?.*theme=excel-dark/);
  await expect(html).toHaveAttribute("data-theme-id", "excel-dark"); await expect(html).toHaveAttribute("data-theme-shell", "excel");
  await expect(page.getByTestId("program-shell")).toBeVisible();
  await page.goBack(); await expect(page.locator(".world-root")).toBeVisible(); await expect(html).toHaveAttribute("data-theme-shell", "default");
  expect(new URL(page.url()).searchParams.get("theme")).toBeNull();
  await page.goForward(); await expect(page.getByTestId("program-shell")).toBeVisible(); await expect(html).toHaveAttribute("data-theme-id", "excel-dark");
  expect(await page.evaluate(() => (window as unknown as { mixed: string[] }).mixed)).toEqual([]);
});

test("portrait frames one wall section; arrows, overview, header shortcuts and 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareWorld(page); await page.goto("/");
  const root = page.locator(".world-root");
  await expect(root).toHaveAttribute("data-layout", "sectioned");
  await expect(stage(page)).not.toHaveAttribute("data-renderer", "loading");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.locator(".world-topbar").evaluate((node) => node.getBoundingClientRect().top)).toBe(0);
  // Both logos, the shortcuts, the mode switch, the menu and the account fit in one 390px bar; the account sits at its right end.
  const bar = await page.locator(".world-topbar").evaluate((node) => { const box = node.getBoundingClientRect(), parts = [...node.querySelectorAll(".world-brand, .world-hud-actions, .world-account")].map((e) => e.getBoundingClientRect());
    return { fits: node.scrollWidth <= node.clientWidth && parts.every((r) => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom), gap: box.right - parts[2].right, last: node.lastElementChild?.className }; });
  expect(bar.fits).toBe(true); expect(bar.last).toBe("world-account"); expect(bar.gap).toBeLessThanOrEqual(12);
  await expect(page.locator(".world-topbar .world-brand img")).toHaveAttribute("alt", "곡소리닷컴"); await expect(page.locator(".world-topbar .world-brand-mark")).toBeVisible();
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
  // Three scene tabs; the battle's stock picker keeps readable labels and full-size targets.
  await expect(page.getByRole("navigation", { name: "월드 장면 선택" }).locator("button b")).toHaveText(["광장", "전장", "극장"]);
  await nav(page, "심리 전장").click(); await page.getByRole("button", { name: "진영·종목 선택 열기" }).click();
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
  await expect(stage(page)).toHaveAttribute("data-population", "21");
  const avatar = page.getByTestId("world-avatar"), before = await avatar.getAttribute("data-position");
  await page.locator(".hd2d-canvas").focus(); await page.keyboard.press("ArrowRight");
  await expect(avatar).not.toHaveAttribute("data-position", before!);
  await page.waitForTimeout(600); const moved = await avatar.getAttribute("data-position");
  await page.getByRole("button", { name: "진영·종목 선택 열기" }).click();
  // Camps read like the 곡소리 지수 gauge: fear left, neutral between, hope right.
  expect(await page.locator(".world-camps button").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.side))).toEqual(["bearish", "neutral", "bullish"]);
  await page.locator('.world-camps button[data-side="bearish"]').click();
  await expect(page.getByRole("button", { name: /^공포 \d+건$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".world-ratios > span").first()).toHaveClass("world-fear");
  await page.keyboard.press("Escape"); await expect(avatar).toHaveAttribute("data-position", moved!);
  await page.getByRole("button", { name: "메뉴", exact: false }).first().click();
  await page.getByRole("button", { name: "내 개미 색상 3" }).click();
  expect(await page.evaluate(() => localStorage.getItem("goksorry-world-avatar-color"))).toBe("#efa5ac");
  await page.getByRole("button", { name: "등락률 색상 미국식" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-change-color-mode", "us");
  await expect(page.getByRole("button", { name: "등락률 색상 미국식" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "♡ 감정 표현" }).click(); await page.keyboard.press("Escape"); await expect(avatar).toContainText("♡");
});

test("replay gaps, date changes, 0-10 axis, share and rendered PNG", async ({ page }) => {
  test.setTimeout(60_000); await prepareWorld(page); await page.goto("/?scene=theater");
  const yesterday = worldDate(new Date(Date.now() - 86_400_000)); await page.getByLabel("기록 날짜").fill(yesterday);
  await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeEnabled();
  // Slot 1 has no record but lies between two: it is filled between them and marked as a correction, drawn dashed.
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("0.3"); await expect(page.locator(".world-record-state")).toHaveText(/건 · 보정 구간$/);
  await expect(page.locator(".world-scene-dom")).toContainText("보정 구간 · 분석 표본");
  await expect(page.locator(".world-timeline polyline[data-corrected]").first()).toHaveAttribute("stroke-dasharray", "5 5");
  await expect(page.locator(".world-theater-controls")).not.toContainText("보간하지 않습니다");
  await page.getByRole("button", { name: "재생", exact: true }).click(); await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); await page.getByLabel("극장 시간 탐색", { exact: true }).fill("30");
  await page.getByRole("button", { name: "극장 기록 근거 보기" }).click();
  await expect(dialog(page)).toContainText("극장 기록 · 최근 6시간 분석 표본");
  await expect(dialog(page).getByRole("tab", { name: "출처" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog(page).locator(".sentiment-title").first()).toBeVisible();
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe(`goksorry-${yesterday}.png`);
  const png = await readFile((await download.path())!); expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(800); expect(png.length).toBeGreaterThan(100_000);
  await test.info().attach("theater-postcard", { body: png, contentType: "image/png" });
  await page.getByRole("button", { name: "링크 공유", exact: true }).click(); await expect(page.getByLabel("극장 공유 링크")).toHaveValue(/scene=theater.*date=/);
});

test("theater keeps replay controls and PNG export without WebGL2", async ({ page }) => {
  await prepareWorld(page); await withoutWebGL2(page); await page.goto("/?scene=theater");
  await expect(stage(page)).toHaveAttribute("data-renderer", "unsupported");
  await expect(page.locator(".world-static-scene")).toHaveCSS("background-image", /static-theater.png/);
  const play = page.getByRole("button", { name: "재생", exact: true });
  await expect(play).toBeEnabled(); await play.click();
  await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible();
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("30");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  const png = await readFile((await (await downloaded).path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
});

test("theater shows 기록 없음 and only the two actors fade out and back in", async ({ page }) => {
  test.setTimeout(60_000); const frame = await prepareWorld(page);
  // Records from slot 10 to 129 only: nothing to join before or after. The first answer is held back so the loading
  // state can be checked: it must not read as "no record" yet.
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/internal/world/replay?*", async (route) => {
    await held;
    const date = new URL(route.request().url()).searchParams.get("date") ?? worldDate();
    const start = Date.parse(`${date}T00:00:00+09:00`);
    return route.fulfill({ json: { date, timezone: "Asia/Seoul", slots: Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date(start + i * 600_000).toISOString(), frame: i >= 10 && i < 130 ? { ...frame, generated_at: new Date(start + i * 600_000).toISOString() } : null })) } });
  });
  await page.goto("/?scene=theater"); await webgl(page);
  type Metered = HTMLCanvasElement & { worldMetrics: RenderMetrics };
  const cast = () => page.locator("canvas").evaluate((node) => { const m = (node as Metered).worldMetrics; return { cast: m.cast, population: m.population }; });
  const seek = (value: string) => page.getByLabel("극장 시간 탐색", { exact: true }).fill(value);
  await expect(page.locator(".world-record-state")).toHaveText("기록 확인 중…");
  await expect(page.locator(".world-scene-dom")).not.toContainText("기록이 없습니다");
  release();
  await expect(page.locator(".world-record-state")).toHaveText("기록 없음");
  await expect(page.locator(".world-scene-dom")).toContainText("이 구간은 기록이 없습니다");
  await expect.poll(async () => (await cast()).cast).toBe(0);
  await seek("10"); await expect(page.locator(".world-record-state")).toHaveText(/저장된 심리$/);
  await expect.poll(async () => (await cast()).cast).toBe(1);
  expect((await cast()).population).toBe(8);
  // Past the last record the same ants stay and fade: some frame shows them part way, then they are gone.
  await seek("29");
  await expect.poll(async () => { const now = await cast(); return now.cast > 0 && now.cast < 1 && now.population === 8; }, { intervals: [16] }).toBe(true);
  await expect.poll(async () => (await cast()).cast).toBe(0);
  expect((await cast()).population).toBe(6);
  expect((await theaterCast(page)).audience.map((ant) => [ant.state, ant.fade])).toEqual(Array(5).fill(["seated", 1]));
  await page.locator(".hd2d-stage").screenshot({ path: test.info().outputPath("theater-no-record.png") });
});

test("theater without motion swaps its ants at once where records stop", async ({ page }) => {
  const frame = await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/internal/world/replay?*", (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? worldDate();
    const start = Date.parse(`${date}T00:00:00+09:00`);
    return route.fulfill({ json: { date, timezone: "Asia/Seoul", slots: Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date(start + i * 600_000).toISOString(), frame: i < 72 ? frame : null })) } });
  });
  await page.goto("/?scene=theater"); await webgl(page);
  type Metered = HTMLCanvasElement & { worldMetrics: RenderMetrics };
  const cast = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.cast);
  await expect.poll(cast).toBe(1);
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("20"); await expect(page.locator(".world-record-state")).toHaveText("기록 없음");
  await expect.poll(cast).toBe(0);
  expect((await theaterCast(page)).audience.map((ant) => ant.frame)).toEqual(Array(5).fill("neutral.sit.b"));
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`theater stage and audience stay visible while replay reverses at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const frame = await prepareWorld(page);
    const summary = (bullish: number, bearish: number, neutral: number) => ({
      ...frame.overall, total: bullish + bearish + neutral, bullish, bearish, neutral,
      mood: bullish + bearish + neutral < 3 ? "watching" : !bullish && !bearish ? "neutral" : bullish === bearish ? "mixed" : bullish > bearish ? "hope" : "fear",
      hope_ratio: bullish + bearish ? bullish / (bullish + bearish) : null,
      fear_ratio: bullish + bearish ? bearish / (bullish + bearish) : null
    });
    await page.route("**/api/internal/world/replay?*", (route) => {
      const date = worldDate(), start = Date.parse(`${date}T00:00:00+09:00`);
      return route.fulfill({ json: { date, slots: Array.from({ length: 144 }, (_, i) => ({
        bucket_at: new Date(start + i * 600_000).toISOString(),
        frame: i >= 16 && i <= 23 ? null : { ...frame, overall: i < 16 ? summary(10, 0, 0) : i < 40 ? summary(0, 10, 0)
          : i < 50 ? summary(5, 5, 0) : i < 60 ? summary(0, 0, 10) : i < 70 ? summary(2, 0, 0) : summary(7, 3, 0) }
      })) } });
    });
    await page.setViewportSize(viewport); await page.goto("/?scene=theater"); await webgl(page);
    await expect.poll(async () => (await theaterCast(page)).actors.every((actor) => actor.fade === 1)).toBe(true);
    const initial = await theaterCast(page);
    expect(initial.audience.map(({ x, z }) => ({ x, z }))).toEqual(THEATER_AUDIENCE);
    const [, , , seatHeight] = antAtlas.frames["neutral.sit.b"];
    for (const ant of initial.audience) {
      expect(ant.frame).toBe("neutral.sit.b");
      expect(ant.baseY + seatHeight * ant.unit / WALL_COS * .066).toBeCloseTo(THEATER_CHAIR.seatY);
    }
    const canvas = (await page.locator("canvas").boundingBox())!;
    const controls = (await page.locator(".world-theater-controls").boundingBox())!;
    for (const ant of [...initial.audience, ...initial.actors]) {
      expect(ant.sx).toBeGreaterThan(12); expect(ant.sx).toBeLessThan(canvas.width - 12);
      expect(ant.sy - ant.sh / 2).toBeGreaterThan(0);
      expect(canvas.y + ant.sy + ant.sh / 2).toBeLessThan(controls.y);
    }
    const [fear, hope] = initial.actors;
    expect(fear.baseY).toBe(THEATER_STAGE.height); expect(hope.baseY).toBe(fear.baseY);
    expect(hope.z).toBeGreaterThan(fear.z); expect(hope.sh).toBeGreaterThan(fear.sh);
    await page.screenshot({ path: testInfo.outputPath("theater-hope.png") });
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await expect.poll(async () => (await theaterCast(page)).actors[1].frame, { intervals: [32] }).toMatch(/^hope\.smug-/);
    await expect.poll(async () => {
      const [fear, hope] = (await theaterCast(page)).actors;
      return fear.z > hope.z + 1.8 && fear.sh > hope.sh && hope.state === "crouched";
    }, { timeout: 12_000 }).toBe(true);
    await expect(page.locator(".world-record-state")).toContainText("저장된 심리");
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    await expect.poll(async () => (await theaterCast(page)).actors.map((a) => [a.state, a.z])).toEqual([["stand", hope.z], ["crouched", fear.z]]);
    const paused = (await theaterCast(page)).actors;
    expect(paused[0].z).toBeCloseTo(hope.z, 2); expect(paused[1].z).toBeCloseTo(fear.z, 2);
    await page.screenshot({ path: testInfo.outputPath("theater-fear.png") });
    expect((await theaterCast(page)).actors).toEqual(paused);
    const seek = page.getByLabel("극장 시간 탐색", { exact: true });
    await seek.fill("4");
    await expect(page.locator(".world-record-state")).toContainText("보정 구간");
    await expect.poll(async () => {
      const [fear, hope] = (await theaterCast(page)).actors;
      return hope.z > fear.z && hope.z - fear.z < 1;
    }).toBe(true);
    for (const at of ["9", "11", "13"]) {
      await seek.fill(at);
      await expect.poll(async () => (await theaterCast(page)).actors.map((actor) => actor.z)).toEqual([THEATER_STAGE.z, THEATER_STAGE.z]);
    }
  });

  test(`one theater spectator takes the right aisle and returns to its seat at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.clock.install();
    await prepareWorld(page);
    await page.route("**/api/internal/world/replay?*", (route) => route.fulfill({ json: {
      slots: Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date(Date.now() + i * 600_000).toISOString(), frame: null }))
    } }));
    await page.setViewportSize(viewport); await page.goto("/?scene=theater"); await webgl(page);
    await expect(page.locator(".world-record-state")).toHaveText("기록 없음");
    const seatState = ({ x, z, state, frame, fade }: Awaited<ReturnType<typeof theaterCast>>["audience"][number]) => ({ x, z, state, frame, fade });
    const fixed = (await theaterCast(page)).audience.map(seatState);
    expect(fixed.map((ant) => ant.state)).toEqual(Array(5).fill("seated"));
    await page.clock.fastForward(42000);
    expect((await theaterCast(page)).audience.map(seatState)).toEqual(fixed);
    const phases = new Set<string>();
    const lastSeat = fixed[4];
    let aisle = false, outThroughDoor = false, inThroughDoor = false;
    for (let i = 0; i < 150; i++) {
      await page.clock.fastForward(1000);
      const { audience, actors } = await theaterCast(page);
      expect(audience.slice(0, 4).map(seatState)).toEqual(fixed.slice(0, 4));
      expect(actors.every((actor) => actor.fade === 0)).toBe(true);
      const ant = audience[4];
      if (ant.state === "out" && !aisle && ant.x >= THEATER_DOOR.x && ant.z > 0) {
        aisle = true;
        expect(ant.sx).toBeLessThan(viewport.width);
        await page.screenshot({ path: testInfo.outputPath("theater-right-aisle.png") });
      }
      if (ant.x === THEATER_DOOR.x && ant.z < WALL_FACE_Z + 1.5) {
        if (ant.state === "out") outThroughDoor = true;
        if (ant.state === "in") inThroughDoor = true;
      }
      if (ant.state === "away") {
        expect(ant.fade).toBe(0);
        if (!phases.has("away")) await page.clock.fastForward(42_000);
      }
      if (ant.state === "seated" && phases.has("in")) {
        expect(seatState(ant)).toEqual(lastSeat); phases.add("returned"); break;
      }
      phases.add(ant.state);
    }
    expect([aisle, outThroughDoor, inThroughDoor]).toEqual([true, true, true]);
    expect([...phases].filter((phase) => phase !== "seated")).toEqual(["out", "away", "in", "returned"]);
  });
}

for (const kind of ["fear", "hope", "neutral", "sparse", "empty"] as const) test(`${kind} sample matches crowd and screen`, async ({ page }) => {
  await prepareWorld(page); const rows = worldRows();
  const filtered = kind === "empty" ? [] : kind === "sparse" ? rows.slice(0, 1) : rows.map((r) => ({ ...r, label: kind === "fear" ? "bearish" as const : kind === "hope" ? "bullish" as const : "neutral" as const }));
  await page.route("**/api/internal/world", (route) => route.fulfill({ json: buildWorldFrame(filtered) }));
  // Reduced motion still renders the room in WebGL; only ambient motion stops.
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await webgl(page);
  if (kind === "fear") { await expect(stage(page)).toHaveAttribute("data-fear", "20"); await expect(page.locator(".world-ratios")).toContainText("공포 100%"); }
  if (kind === "hope") { await expect(stage(page)).toHaveAttribute("data-hope", "20"); await expect(page.locator(".world-ratios")).toContainText("희망 100%"); }
  if (kind === "neutral") { await expect(stage(page)).toHaveAttribute("data-neutral", "20"); await expect(page.locator(".world-ratios")).toContainText("—"); }
  if (kind === "sparse") {
    await expect(stage(page)).toHaveAttribute("data-population", "2");
    await expect(stage(page)).toHaveAttribute("data-neutral", "1");
    await expect(page.locator(".world-live-badge")).toContainText("표본 부족");
  }
  if (kind === "empty") { await expect(stage(page)).toHaveAttribute("data-population", "1"); await expect(page.locator(".world-index-number strong")).toHaveText("—"); }
});

for (const mode of ["webgl", "unsupported"] as const) test(`the plaza follows scoped fear and hope ratios in ${mode}`, async ({ page }) => {
  const frame = await prepareWorld(page);
  if (mode === "unsupported") {
    await withoutWebGL2(page);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  let overall = { ...frame.overall, index: 5, total: 200, bullish: 30, bearish: 90, neutral: 80, hope_ratio: .25, fear_ratio: .75 };
  await page.route("**/api/feed?*", (route) => route.fulfill({ json: scopedFeed({ ...frame, overall }) }));
  await page.goto("/?channels=toss");
  if (mode === "webgl") await webgl(page);
  else await expect(stage(page)).toHaveAttribute("data-renderer", mode);
  const split = () => mode === "webgl" ? page.locator("canvas").evaluate((node) => {
    const metrics = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics;
    const crowd = metrics.crowd().filter((a) => !a.peer && !a.leaving);
    return {
      fear: crowd.filter((a) => a.frame.startsWith("fear.")).length,
      hope: crowd.filter((a) => /^hope(-bright)?\./.test(a.frame)).length,
      total: crowd.length
    };
  }) : stage(page).evaluate((node) => ({
    fear: node.querySelectorAll(".world-static-ant[data-side=bearish]").length,
    hope: node.querySelectorAll(".world-static-ant[data-side=bullish]").length,
    total: node.querySelectorAll(".world-static-ant").length
  }));
  const total = mode === "webgl" ? 20 : 12;
  await expect.poll(split).toEqual({ fear: total * .75, hope: total * .25, total });
  await expect(page.locator("#world-index-wall .world-ratios")).toContainText("공포 75%");
  const canvas = page.locator("canvas");
  const read = () => canvas.evaluate((node) => {
    const m = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics;
    return { crowd: m.crowd(), visitor: m.visitor().frame, band: m.band };
  });
  const before = mode === "webgl" ? await read() : null;
  if (before) expect(before.crowd.some((a) => a.frame.startsWith("hope-bright."))).toBe(true);
  overall = { ...overall, bullish: 90, bearish: 30, hope_ratio: .75, fear_ratio: .25 };
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  // "data-paused" is also true under reduced motion, so wait for React to process the hidden state.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(split).toEqual({ fear: total * .25, hope: total * .75, total });
  await expect(page.locator("#world-index-wall .world-ratios")).toContainText("희망 75%");
  if (before) {
    const after = await read();
    expect(after.band).toBe(before.band);
    expect(after.visitor).toBe(before.visitor);
    const slots = (crowd: typeof before.crowd) => crowd.map(({ id, x, z }) => ({ id, x, z }));
    expect(slots(after.crowd)).toEqual(slots(before.crowd));
  }
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
  // The failed read surfaced as an error snackbar; its retry recovers and the snackbar goes away.
  const snack = page.locator(".world-snackbar[role=alert]");
  await expect(snack).toContainText("테스트 데이터 장애");
  await snack.getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(page.locator(".world-live-badge")).toContainText("갱신 지연");
  await expect(snack).toHaveCount(0);
});

test("walking to a plaza door turns its plate into a prompt with a pinned hit target", async ({ page }) => {
  await prepareWorld(page); await page.goto("/"); await webgl(page);
  await page.locator(".hd2d-canvas").focus();
  // From the start point (0, .4) over and up to the floor in front of the 심리 전장 door (x -2.3, at the back of the floor).
  for (const key of ["ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowUp", "ArrowUp"]) { await page.keyboard.press(key); await page.waitForTimeout(450); }
  const enter = page.getByRole("button", { name: "심리 전장 입구 · 들어가기 ↗" });
  await expect(enter).toBeVisible();
  // Pinned over the painted prompt on the floor just past the visitor's feet (the door plate is behind the visitor's head),
  // not docked at the bottom of the stage.
  const box = (await enter.boundingBox())!, canvas = (await page.locator(".hd2d-canvas").boundingBox())!, head = (await page.getByTestId("world-avatar").boundingBox())!;
  expect(box.width).toBeGreaterThan(40); expect(box.y + box.height).toBeLessThan(canvas.y + canvas.height - 40);
  expect(box.y).toBeGreaterThan(head.y + head.height + 40);
  await enter.click(); await expect(page).toHaveURL(/scene=battle/);
});

test("clicking a plaza door walks the visitor to it, and a second click goes in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.goto("/"); await webgl(page);
  type Metered = HTMLCanvasElement & { worldMetrics: RenderMetrics };
  const wall = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.wall!);
  const visitor = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.visitor());
  const canvas = (await page.locator(".hd2d-canvas").boundingBox())!;
  const { doors, rects } = await wall();
  expect(Object.keys(doors).sort()).toEqual(["battle", "theater"]);
  // Low doors under the 곡소리 지수 panel: every opening is on screen, below it and within its width, battle on the left.
  for (const r of Object.values(doors)) {
    expect(r.x).toBeGreaterThan(0); expect(r.x + r.width).toBeLessThan(canvas.width); expect(r.height).toBeGreaterThan(40);
    expect(r.y).toBeGreaterThan(rects.index.y + rects.index.height); expect(r.x).toBeGreaterThan(rects.index.x); expect(r.x + r.width).toBeLessThan(rects.index.x + rects.index.width);
  }
  expect(doors.battle.x + doors.battle.width).toBeLessThan(doors.theater.x);
  // The lower part of the opening (under the name plate) is a click target for the door.
  const door = doors.theater, at = { x: canvas.x + door.x + door.width / 2, y: canvas.y + door.y + door.height * .8 };
  await page.mouse.click(at.x, at.y);
  await expect.poll(async () => { const me = await visitor(); return me.state === "idle" && Math.abs(me.x - 2.3) < .05 && Math.abs(me.z + 2.9) < .05; }, { timeout: 15_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "개미극장 입구 · 들어가기 ↗" })).toBeVisible();
  const now = (await wall()).doors.theater;
  await page.mouse.click(canvas.x + now.x + now.width / 2, canvas.y + now.y + now.height * .8);
  await expect(page).toHaveURL(/scene=theater/);
});

test("a floor click marks the walk target with a ring on the ground until the visitor arrives; arrow keys leave none", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.goto("/"); await webgl(page);
  type Metered = HTMLCanvasElement & { worldMetrics: RenderMetrics };
  const visitor = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.visitor());
  const marker = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.marker());
  const box = (await page.locator(".hd2d-canvas").boundingBox())!;
  expect(await marker()).toBeNull();
  /** A floor point `dx` px beside the visitor's feet that only the canvas covers. */
  const floor = async (dx: number) => {
    const me = await visitor(), at = { x: box.x + me.sx + dx, y: box.y + me.sy + me.sh / 2 + 24 };
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("hd2d-canvas"), at)).toBe(true);
    return at;
  };
  const start = await visitor(), first = await floor(260); await page.mouse.click(first.x, first.y);
  // The ring lies on the floor where the click landed (right of the visitor, nearer the camera) and fades in.
  await expect.poll(async () => (await marker())?.opacity ?? 0).toBeGreaterThan(.5);
  const placed = (await marker())!;
  expect(placed.x).toBeGreaterThan(start.x + 1); expect(placed.z).toBeGreaterThan(start.z);
  // A new click replaces it (now left of the visitor) before the visitor gets there.
  const second = await floor(-260); await page.mouse.click(second.x, second.y);
  await expect.poll(async () => (await marker())?.x ?? Infinity).toBeLessThan(start.x);
  const goal = (await marker())!;
  // The visitor arrives on the ring, and then the ring is gone.
  await expect.poll(async () => { const me = await visitor(); return me.state === "idle" && Math.hypot(me.x - goal.x, me.z - goal.z) < .05; }, { timeout: 15_000 }).toBe(true);
  await expect.poll(marker).toBeNull();
  // Arrow-key walks leave no ring, and one cancels a clicked walk's ring.
  await page.locator(".hd2d-canvas").focus();
  const before = await visitor(); await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => { const me = await visitor(); return me.state === "idle" && before.x - me.x > .9; }, { timeout: 5000 }).toBe(true);
  expect(await marker()).toBeNull();
  const third = await floor(220); await page.mouse.click(third.x, third.y);
  await expect.poll(marker).not.toBeNull();
  await page.keyboard.press("ArrowLeft"); await expect.poll(marker).toBeNull();
});

test("under reduced motion the walk-target ring is static", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await webgl(page);
  type Metered = HTMLCanvasElement & { worldMetrics: RenderMetrics };
  const marker = () => page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.marker());
  const box = (await page.locator(".hd2d-canvas").boundingBox())!, me = await page.locator("canvas").evaluate((node) => (node as Metered).worldMetrics.visitor());
  await page.mouse.click(box.x + me.sx + 300, box.y + me.sy + me.sh / 2 + 24);
  await expect.poll(marker).not.toBeNull();
  const looks = [];
  for (let i = 0; i < 4; i++) { const m = await marker(); if (m) looks.push({ opacity: m.opacity, scale: m.scale }); await page.waitForTimeout(120); }
  expect(looks.length).toBeGreaterThan(1);
  for (const look of looks) expect(look).toEqual(looks[0]);
  expect(looks[0].scale).toBe(1);
});

test("reduced motion keeps the WebGL room but stops the crowd's ambient roaming and its comings and goings", async ({ page }) => {
  test.setTimeout(60_000);
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await webgl(page);
  const crowd = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd().map((a) => `${a.x.toFixed(3)},${a.z.toFixed(3)},${a.trip},${a.lap}`).join("|"));
  await expect.poll(async () => (await crowd()).length).toBeGreaterThan(0);
  const before = await crowd(); await page.waitForTimeout(1500);
  expect(await crowd()).toBe(before);
  // Past the latest first trip (settle window plus TURNOVER.first): still nobody has set off through a door or a side.
  await page.waitForTimeout(19_000);
  expect(await crowd()).toBe(before);
});

test("WebGL wall sweeps a shimmer over panels until their first payload arrives", async ({ page }) => {
  await prepareWorld(page); let release: () => void = () => {}; const pending = new Promise<void>((resolve) => { release = resolve; });
  // Hold the feed poll and the world frame: either one supplies the index and its portrait.
  for (const url of ["**/api/feed?*", "**/api/internal/world"]) await page.route(url, async (route) => { await pending; await route.fallback(); });
  await page.goto("/"); await webgl(page);
  const shimmer = () => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.wall?.shimmer ?? null);
  // Market and room are fixture-fast; feed, index, portrait and the community board (from the world frame) wait.
  await expect.poll(shimmer).toEqual(["pierrot", "index", "feed", "communities"]);
  release();
  await expect.poll(shimmer).toEqual([]);
});

test("a renderer that fails once is retried quietly before any failure shows", async ({ page }) => {
  await prepareWorld(page); let aborted = 0;
  // Only the first atlas load drops (a reconnect); the automatic retry loads it.
  await page.route("**/world/ant*.png", (route) => aborted++ ? route.fallback() : route.abort());
  await page.goto("/"); await webgl(page);
  expect(aborted).toBeGreaterThan(1); await expect(page.locator(".world-snackbar")).toHaveCount(0);
});

test("WebGL and asset failures use same static art with working screens", async ({ page }) => {
  await prepareWorld(page); await page.route("**/world/ant*.png", (route) => route.abort()); await page.goto("/");
  // A renderer failure needs a browser that has WebGL2 to begin with; without it the view is "unsupported".
  await requireWebGL2(page);
  // The failure shows only once the automatic retries failed too.
  await expect(stage(page)).toHaveAttribute("data-renderer", "failed", { timeout: 15_000 });
  await expect(page.locator(".world-static-scene")).toHaveCSS("background-image", /static-plaza.png/);
  // A failure is an error, not a mode: a snackbar says so and offers a retry.
  await expect(page.locator(".world-snackbar[role=alert]")).toContainText("3D 화면을 불러오지 못했습니다");
  await page.getByRole("button", { name: "3D 화면 다시 시도" }).click();
  await expect(stage(page)).toHaveAttribute("data-renderer", "loading");
  await expect(stage(page)).toHaveAttribute("data-renderer", "failed", { timeout: 15_000 });
  // Closing the snackbar keeps it closed for the same error; the screens stay usable.
  await page.getByRole("button", { name: "알림 닫기" }).click(); await expect(page.locator(".world-snackbar")).toHaveCount(0);
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
  // The community board under the feed opens a community's evidence on the right too.
  await page.locator('[data-wall-panel="communities"]').getByRole("button", { name: /^블라인드/ }).click(); await settled();
  await expect(page.locator(".world-modal-backdrop")).toHaveAttribute("data-side", "right");
  await expect(dialog(page)).toHaveAccessibleName("블라인드 · 분위기와 근거");
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
      const ant = canvas.worldMetrics.crowd().filter((a) => a.state === "gaze" && !a.trip && a.fade === 1 && a.z > -1.5 && Math.hypot(a.x - me.x, a.z - me.z) > 2 && document.elementFromPoint(bounds.left + a.sx, bounds.top + a.sy + a.sh * .35) === canvas)
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

test("now and then an ant leaves through a door or off a side, and its slot comes back as someone new", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 }); await prepareWorld(page); await page.goto("/"); await webgl(page);
  await expect.poll(() => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd().length)).toBe(20);
  // Every animation frame until the first ant to set off is back on the floor as someone new (its slot's lap went up).
  const watch = await page.locator("canvas").evaluate(async (node) => {
    const metrics = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics, slots = metrics.crowd().map((a) => a.id).join("|");
    const log = { slotsChanged: 0, out: 0, hiddenDrawn: 0, id: "", lap: 0, phases: [] as string[], back: false, door: false };
    for (const end = performance.now() + 100_000; performance.now() < end && !log.back;) {
      const crowd = metrics.crowd();
      if (crowd.map((a) => a.id).join("|") !== slots) log.slotsChanged++;
      log.out = Math.max(log.out, crowd.filter((a) => a.trip === "out").length);
      log.hiddenDrawn += crowd.filter((a) => a.trip === "away" && (a.sh > 0 || a.frame)).length; // out of sight: drawn at zero size
      if (!log.id) { const a = crowd.find((o) => o.trip === "out"); if (a) { log.id = a.id; log.lap = a.lap; } }
      const a = crowd.find((o) => o.id === log.id);
      if (a) {
        const phase = a.trip ?? "floor";
        if (log.phases[log.phases.length - 1] !== phase) log.phases.push(phase);
        if (a.fade > 0 && a.fade < 1) log.door = true;
        if (a.lap > log.lap && !a.trip) log.back = true;
      }
      await new Promise((done) => requestAnimationFrame(done));
    }
    return log;
  });
  expect(watch.id).not.toBe("");
  expect(watch.back, watch.phases.join(" ")).toBe(true);
  expect(watch.phases.slice(0, 2)).toEqual(["out", "away"]);
  expect([["out", "away", "in", "floor"], ["out", "away", "floor"]]).toContainEqual(watch.phases);
  expect([watch.slotsChanged, watch.hiddenDrawn]).toEqual([0, 0]);
  expect(watch.out).toBeLessThanOrEqual(2);
  // A door trip darkens into the doorway (or out of it) instead of popping.
  if (watch.phases.includes("in")) expect(watch.door).toBe(true);
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
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = await prepareWorld(page);
  await page.route("**/api/feed?*", (route) => route.fulfill({ json: scopedFeed(frame) }));
  await page.goto("/?channels=toss"); await webgl(page);
  await expect.poll(() => page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics.crowd().length)).toBe(20);
  const all = { seen: {} as Record<string, string[]>, cycles: [] as string[][], puffs: 0, relievedPuffs: 0, atlas: "" };
  const wanted = [/^hope-bright\.walk-p\.(f|l|r|b)~?$/, /^hope\.walk-p\.(bl|br)$/];
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
  // Fear keeps its sigh and hope uses the relieved pose.
  for (const key of drawn(all, "sigh")) expect(key).toMatch(/^(fear|hope-bright)\.sigh\./);
  expect(all.relievedPuffs).toBe(0);
  // A phone-sized screen loads the two-thirds copy and draws the same frames from it.
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/?channels=toss"); await webgl(page);
  const small = await page.locator("canvas").evaluate((node) => { const m = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics; return { atlas: m.atlas, ants: [...m.crowd(), m.visitor()] }; });
  expect(small.atlas).toBe("/world/ant-atlas-small.png");
  // Nothing is enlarged from it: at pixel ratio 2 every sprite is drawn at no more than two thirds of a screen pixel per atlas pixel.
  const frames = antAtlas.frames as Record<string, number[]>;
  for (const a of small.ants.filter((a) => a.frame)) { const frame = frames[a.frame.replace("~", "")]; expect(a.sh * 2 / (frame[3] * frame[4]), a.frame).toBeLessThanOrEqual(2 / 3); }
});

test("resting ants look up at the wall; more hopeful data increases the bright crowd in place", async ({ page }) => {
  test.setTimeout(180_000);
  const read = () => page.locator("canvas").evaluate((node) => { const m = (node as HTMLCanvasElement & { worldMetrics: RenderMetrics }).worldMetrics; return { band: m.band, bright: m.bright, crowd: m.crowd(), visitor: m.visitor() }; });
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = await prepareWorld(page);
  let scoped = { ...frame, overall: { ...frame.overall, index: 5 } };
  await page.route("**/api/feed?*", (route) => route.fulfill({ json: scopedFeed(scoped) }));
  await page.goto("/?channels=toss"); await webgl(page);
  await expect.poll(async () => (await read()).crowd.length).toBe(20);
  const calm = await read();
  expect(calm.band).toBe("neutral"); expect(calm.bright).toBe(false);
  expect(calm.visitor.frame).toMatch(/^neutral\./);
  expect(calm.crowd.some((a) => a.frame.startsWith("hope-bright."))).toBe(true);
  // Looking up happens only while gazing at the wall, back to the camera, and some gazer is doing it at any time.
  const looking = (crowd: typeof calm.crowd) => crowd.filter((a) => /\.look\.(bl|b|br)~?$/.test(a.frame));
  await expect.poll(async () => looking((await read()).crowd).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  for (const a of (await read()).crowd) if (a.frame.includes(".look.")) { expect(a.state).toBe("gaze"); expect([3, 4, 5]).toContain(a.dir); }
  // A data refresh moves the index to 희망: same ants, same places, brighter faces.
  const hopeful = buildWorldFrame(worldRows().map((row, i) => row.label === "bearish" && i % 4 ? { ...row, label: "bullish" as const, sentiment_score: 8 } : row));
  expect(hopeful.overall.fear_ratio).toBeGreaterThan(0); expect(frame.overall.mood).toBe("mixed");
  const standing = (await read()).crowd.filter((a) => a.state === "gaze" && !a.trip);
  scoped = hopeful;
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(async () => (await read()).bright, { timeout: 10_000 }).toBe(true);
  const bright = await read();
  expect(["bullish", "extreme_bullish"]).toContain(bright.band);
  expect(bright.crowd).toHaveLength(20);
  // Nobody was moved by the refresh: whoever stood still stands in the same spot (by slot; a slot that went on a trip since is someone else).
  const now = new Map(bright.crowd.map((a) => [a.id, a]));
  const kept = standing.filter((a) => { const b = now.get(a.id); return b && b.state === "gaze" && !b.trip && b.lap === a.lap; });
  expect(kept.length).toBeGreaterThanOrEqual(5);
  for (const a of kept) expect(Math.hypot(now.get(a.id)!.x - a.x, now.get(a.id)!.z - a.z)).toBeLessThan(.01);
  // The visitor follows the index band; the crowd's hope ants still use bright frames.
  expect(bright.visitor.frame).toMatch(/^neutral-bright\./);
  await expect.poll(async () => (await read()).crowd.filter((a) => /^(neutral|hope)-bright\./.test(a.frame)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(8);
  await expect.poll(async () => looking((await read()).crowd).filter((a) => a.frame.includes("-bright.look.")).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  expect((await read()).crowd.filter((a) => a.frame.startsWith("fear-")).length).toBe(0);
  // Hope ants keep the bright face on the phone and then use their relieved pose.
  const mood = { seen: {} as Record<string, string[]>, relievedPuffs: 0 };
  await expect(async () => {
    const part = await watchCrowd(page, 4);
    for (const [key, frames] of Object.entries(part.seen)) mood.seen[key] = [...new Set([...(mood.seen[key] ?? []), ...frames])];
    mood.relievedPuffs += part.relievedPuffs;
    expect(drawn(mood, "phone").some((key) => /^hope-bright\.phone\./.test(key))).toBe(true);
    expect(drawn(mood, "sigh").some((key) => /^hope-bright\.sigh\./.test(key))).toBe(true);
  }).toPass({ timeout: 100_000 });
  for (const state of ["phone", "sigh"]) for (const key of drawn(mood, state)) expect(key, state).toMatch(new RegExp(`^(hope-bright|fear)\\.${state}\\.(f|l|r|b)~?$`));
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

test("measure actual render throughput during movement, detail and replay", async ({ page }, testInfo) => {
  test.setTimeout(90_000); await prepareWorld(page); const results: unknown[] = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto("/?scene=battle"); await webgl(page);
    await expect(stage(page)).toHaveAttribute("data-population", "21");
    for (const scenario of ["movement", "detail", "replay"]) {
      if (scenario === "movement") { await page.locator("canvas").focus(); await page.keyboard.press("ArrowRight"); }
      if (scenario === "detail") { await page.getByRole("button", { name: "진영·종목 선택 열기" }).click(); await page.locator('.world-camps button[data-side="bearish"]').click(); }
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

test("mode switch moves between 개미인생 (the room) and 웹 (the classic page), keeping the feed scope", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*"); await page.goto("/?channels=toss");
  await page.locator(".world-topbar .mode-switch").getByRole("link", { name: "웹", exact: true }).click();
  // The stored theme (the room shows none) comes back with the classic page.
  await expect(page).toHaveURL(/\/classic\?channels=toss&theme=light$/);
  await expect(page.locator(".world-root")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "최근 글", level: 1 })).toBeVisible();
  await expect(page.locator(".header .mode-switch a[aria-current=page]")).toHaveText("웹");
  // Filters on the classic page stay on the classic page.
  await page.locator(".feed-channel-buttons").getByRole("button", { name: "뽐뿌", exact: true }).click();
  await expect(page).toHaveURL(/\/classic\?channels=toss%2Cppomppu/);
  await page.locator(".header .mode-switch").getByRole("link", { name: "개미인생", exact: true }).click();
  await expect(page).toHaveURL(/:3100\/\?channels=toss%2Cppomppu/);
  await expect(page.locator(".world-root")).toBeVisible();
  await expect(page.locator(".world-topbar .mode-switch a[aria-current=page]")).toHaveText("개미인생");
});

test("own chat line pops over the visitor ant, follows it and fades after a length-based time", async ({ page }) => {
  await prepareWorld(page); await page.goto("/"); await webgl(page);
  const bubble = page.locator(".world-speech-bubble");
  await expect(bubble).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("goksorry:chat-own-message", { detail: "존버 간다" })));
  await expect(bubble).toBeVisible(); await expect(bubble).toHaveText("존버 간다");
  // Pinned to the avatar's head point, like the name tag.
  const at = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => `${el.style.left}|${el.style.top}`);
  expect(await at(".world-speech-bubble")).toBe(await at('[data-testid="world-avatar"]'));
  await expect(bubble.locator("p")).toHaveAttribute("style", /--bubble-ms: 3\d{3}ms/);
  // Short lines live the 3s minimum.
  await expect(bubble).toBeHidden({ timeout: 5_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("goksorry:chat-own-message", { detail: "가".repeat(100) })));
  await expect(bubble.locator("p")).toHaveAttribute("style", /--bubble-ms: 10000ms/);
});
