import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { prepareWorld } from "./world-fixture";

// The full feed (links, filters, paging) lives in the detail dialog; the wall shows the index and latest titles.
const panel = (page: import("@playwright/test").Page) => page.locator('[data-world-panel="detail"]');
const index = (page: import("@playwright/test").Page) => page.locator("#world-index-wall");

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
  // Unified rows show sentiment by left bar, row tint and a labelled chip; hope, fear and neutral differ.
  const look = (tone: string) => detail.locator(`.feed-unified-list .sentiment-card[data-sentiment="${tone}"]`).first().evaluate((card) => {
    const style = getComputedStyle(card), chip = card.querySelector(".feed-sentiment-chip")!;
    return { bar: style.borderLeftColor, barWidth: parseFloat(style.borderLeftWidth), tint: style.backgroundColor, chip: getComputedStyle(chip).color, label: chip.textContent };
  });
  const [fearLook, hopeLook, neutralLook] = [await look("fear"), await look("hope"), await look("neutral")];
  expect([fearLook.label, hopeLook.label, neutralLook.label]).toEqual(["공포", "희망", "중립"]);
  for (const key of ["bar", "tint", "chip"] as const) expect(new Set([fearLook[key], hopeLook[key], neutralLook[key]]).size).toBe(3);
  expect(Math.min(fearLook.barWidth, hopeLook.barWidth, neutralLook.barWidth)).toBeGreaterThanOrEqual(3);
  expect(neutralLook.tint).toBe("rgba(0, 0, 0, 0)");
  expect(await detail.locator(".feed-channel-buttons .filter-chip-active").allTextContents()).toEqual(selected);
  await expect(detail.locator(".sentiment-title").first()).toHaveAttribute("href", /^https:\/\/example.com\//);
  const times = await detail.locator(".feed-unified-list time").evaluateAll(nodes => nodes.map(n => n.getAttribute("datetime")!));
  expect(times).toEqual([...times].sort().reverse());
  await detail.getByRole("button", { name: "좌우 보기", exact: true }).click();
  await expect(detail.locator("#fear-lane")).toBeVisible();
  // Split lanes keep their plain rows: no bar, no chip.
  expect(await detail.locator("#fear-lane .sentiment-card").first().evaluate((card) => [getComputedStyle(card).borderLeftWidth, getComputedStyle(card).backgroundColor])).toEqual(["0px", "rgba(0, 0, 0, 0)"]);
  await expect(detail.locator(".feed-sentiment-chip")).toHaveCount(0);
});

// Every theme, on the world dialog and on /classic: unified rows show a painted left bar, a row tint and a coloured chip, and the title stays readable on the tint.
for (const [place, path] of [["world dialog", "/?feed=1&"], ["classic page", "/classic?"]] as const) test(`unified rows keep bar, tint, chip and a readable title in every theme (${place})`, async ({ page }, info) => {
  test.setTimeout(150_000);
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  const report: Record<string, unknown> = {};
  for (const theme of ["light", "dark", "excel-light", "excel-dark", "docs-light", "docs-dark", "vscode-light", "vscode-dark"]) {
    await page.goto(`${path}theme=${theme}`);
    const scope = place === "world dialog" ? panel(page) : page.locator("main");
    await scope.getByRole("button", { name: "통합 보기", exact: true }).click();
    const list = scope.locator(".feed-unified-list");
    await expect(list.locator(".sentiment-card").first()).toBeVisible(); await page.mouse.move(2, 2);
    // Contrast of the title against the row as painted (the tint composited over whatever lies behind it).
    const rows = await list.evaluate((list) => {
      const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgba = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
      const painted = (node: Element) => {
        const layers: number[][] = [];
        for (let e: Element | null = node; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] > .999) break; } }
        return layers.reverse().reduce((under, c) => under.map((v, i) => v * (1 - c[3]) + c[i] * c[3]), [255, 255, 255]);
      };
      const luminance = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      return ["fear", "hope", "neutral"].map((tone) => {
        const card = list.querySelector(`.sentiment-card[data-sentiment="${tone}"]`)!, row = painted(card), chip = card.querySelector(".feed-sentiment-chip")!;
        const ink = luminance(rgba(getComputedStyle(card.querySelector(".sentiment-title")!).color)), back = luminance(row);
        return { tone, row: row.map(Math.round), chip: getComputedStyle(chip).color, label: chip.textContent, contrast: (Math.max(ink, back) + .05) / (Math.min(ink, back) + .05) };
      });
    });
    // The bar is read from the screenshot, so it counts only when it is really painted (border, inset shadow or pseudo-element alike).
    const bars: { tone: string; color: number[]; width: number }[] = [];
    for (const row of rows) {
      const card = list.locator(`.sentiment-card[data-sentiment="${row.tone}"]`).first();
      await card.scrollIntoViewIfNeeded(); await page.mouse.move(2, 2);
      const box = (await card.boundingBox())!;
      const shot = await page.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y + box.height / 2), width: 8, height: 1 } });
      const pixels = await page.evaluate(async (base64) => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "image/png" }));
        const context = document.createElement("canvas").getContext("2d")!; context.drawImage(bitmap, 0, 0);
        const d = context.getImageData(0, 0, 8, 1).data; return Array.from({ length: 8 }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
      }, shot.toString("base64"));
      const far = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      const solid = pixels.filter((pixel) => far(pixel, row.row) >= 24);
      bars.push({ tone: row.tone, color: solid[Math.min(1, solid.length - 1)] ?? row.row, width: solid.length });
    }
    report[theme] = { rows, bars };
    const far = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    expect.soft(rows.map((row) => row.label), theme).toEqual(["공포", "희망", "중립"]);
    expect.soft(new Set(rows.map((row) => row.row.join())).size, `${theme} tint`).toBe(3);
    expect.soft(new Set(rows.map((row) => row.chip)).size, `${theme} chip`).toBe(3);
    for (const bar of bars) expect.soft(bar.width, `${theme} ${bar.tone} bar width`).toBeGreaterThanOrEqual(3);
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) expect.soft(far(bars[a].color, bars[b].color), `${theme} bar ${bars[a].tone}/${bars[b].tone}`).toBeGreaterThanOrEqual(24);
    for (const row of rows) expect.soft(row.contrast, `${theme} ${row.tone} title on ${row.row}`).toBeGreaterThanOrEqual(4.5);
    await list.locator(".sentiment-card").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`unified-${theme}.png`) });
    // Split lanes stay plain in every theme: no sentiment bar (border or inset shadow), no chip.
    await scope.getByRole("button", { name: "좌우 보기", exact: true }).click();
    const lane = await scope.locator("#fear-lane .sentiment-card").first().evaluate((card) => { const style = getComputedStyle(card); return { shadow: style.boxShadow, border: parseFloat(style.borderLeftWidth) }; });
    expect.soft(lane.shadow, `${theme} split lane`).not.toContain("4px"); expect.soft(lane.border, `${theme} split lane`).toBeLessThan(3);
    await expect.soft(scope.locator(".feed-sentiment-chip"), `${theme} split lane`).toHaveCount(0);
  }
  const file = info.outputPath("unified-themes.json"); await writeFile(file, JSON.stringify(report, null, 1)); await info.attach("unified-themes", { path: file, contentType: "application/json" });
});

for (const width of [320, 360, 390, 430, 768]) test(`metaverse and original Pierrot remain visible at ${width}px`, async ({ page }, info) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: 844 }); await page.goto("/");
  const portrait = page.locator(".world-pierrot img");
  await expect(portrait).toBeVisible();
  expect((await portrait.boundingBox())!.width).toBeGreaterThanOrEqual(116);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "오늘의 개미극장", exact: true }).click();
  await expect(page.getByRole("region", { name: "개미극장 재생 제어" })).toBeVisible();
  await expect(page.getByLabel("기록 날짜")).toBeVisible();
  await expect(portrait).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 360) await page.screenshot({ path: info.outputPath("original-pierrot-theater-mobile.png"), fullPage: true });
});

test("late stock is server scoped before pagination and sentiment never changes summary", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*"); await page.unroute("**/api/internal/world");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/?feed=1");
  await expect(page.getByLabel("피드 종목").locator('option[value="LATE"]')).toHaveCount(1);
  await page.getByLabel("피드 종목").selectOption("LATE");
  await expect(page).toHaveURL(/stock=LATE/);
  await panel(page).getByRole("button", { name: "통합 보기", exact: true }).click();
  await expect(index(page)).toContainText("분석 표본 120건");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(20);
  for (const count of [40, 60, 80, 100, 120]) {
    await panel(page).getByRole("button", { name: "더 보기", exact: true }).click();
    await expect(panel(page).locator(".sentiment-card")).toHaveCount(count);
  }
  const summary = await index(page).locator(".world-numbers").textContent();
  await panel(page).getByRole("group", { name: "글 감성 필터" }).getByRole("button", { name: "공포", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(20);
  await expect(panel(page).locator(".sentiment-card-hope")).toHaveCount(0);
  await expect(index(page).locator(".world-numbers")).toHaveText(summary!);
  await panel(page).getByRole("button", { name: "좌우 보기", exact: true }).click();
  await expect(panel(page).locator("#hope-lane .sentiment-card")).toHaveCount(6);
  await page.getByLabel("피드 종목").selectOption("");
  await expect(index(page)).toContainText("분석 표본 620건");
  await page.goBack(); await expect(page.getByLabel("피드 종목")).toHaveValue("LATE");
  await expect(index(page)).toContainText("분석 표본 120건");
});


test("no page scroll on desktop; 200 percent text and keyboard menu remain usable", async ({ page }) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto("/");
  await expect(page.locator(".world-pierrot img")).toBeVisible();
  // Header fixed, scene fills the rest: nothing to scroll and the scene nav is always on screen.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 500)); expect(await page.evaluate(() => scrollY)).toBe(0);
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
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(20);
  await panel(page).getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(40);
  let reads = 0; page.on("request", req => { if (new URL(req.url()).pathname === "/api/feed") reads++; });
  await page.clock.fastForward(60_001);
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  await expect(panel(page).locator("#feed-top")).toHaveAttribute("aria-busy", "false");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(40);
  const time = await index(page).locator("time").getAttribute("datetime");
  await page.route("**/api/feed?*", route => route.fulfill({ json: { rows: [], errorMessage: "테스트 갱신 오류" } }));
  await page.clock.fastForward(60_001);
  await expect(panel(page).locator(".error")).toContainText("테스트 갱신 오류");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(40);
  await expect(index(page).locator("time")).toHaveAttribute("datetime", time!);
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


test("360 by 640 shows index and original Pierrot without a panel; the arrow reaches the feed section", async ({ page }) => {
  const frame = await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 640 }); await page.goto("/");
  await expect(index(page)).toBeInViewport();
  await expect(page.locator(".world-pierrot img")).toBeInViewport();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('.world-wall-arrow[data-dir="right"]').click();
  await expect(page.locator("#world-feed-wall li p").first()).toBeInViewport();
  await expect(index(page)).toBeHidden();
  await page.locator('.world-wall-arrow[data-dir="left"]').click();
  await page.route("**/api/internal/world", route => route.fulfill({ json: { ...frame, data_at: new Date(Date.now() - 3_600_000).toISOString() } }));
  await page.reload();
  await expect(index(page).locator(".world-screen-status")).toContainText("갱신 지연");
  await expect(index(page)).toBeInViewport();
});

test("multiple sources filter wall summary and list together; empty selection stays empty", async ({ page }) => {
  await prepareWorld(page); await page.unroute("**/api/feed?*");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/?feed=1");
  await panel(page).locator(".feed-source-picker summary").click();
  await panel(page).getByRole("button", { name: "전체해제", exact: true }).click();
  await expect(index(page)).toContainText("분석 표본 0건");
  await expect(index(page).locator(".world-index-number strong")).toHaveText("—");
  await expect(index(page).locator("time")).not.toHaveAttribute("datetime");
  await expect(panel(page).locator(".sentiment-card")).toHaveCount(0);
  await panel(page).getByRole("button", { name: "토스증권", exact: true }).click();
  await panel(page).getByRole("button", { name: "뽐뿌", exact: true }).click();
  await expect(page).toHaveURL(/channels=toss%2Cppomppu/);
  await expect(index(page)).toContainText("분석 표본 620건");
});
