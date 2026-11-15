import { test, expect } from "@playwright/test";
import { prepareWorld, requireWebGL2 } from "./world-fixture";
import { writeFile, mkdir } from "node:fs/promises";
import { buildWorldFrame } from "../lib/world";
import type { RenderMetrics } from "../components/world/hd2d-renderer";

test("HD2D art capture", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().includes("404")) errors.push(msg.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepareWorld(page);
  await page.goto("/");
  await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await page.screenshot({ path: testInfo.outputPath("plaza-desktop.png"), fullPage: true });
  await testInfo.attach("plaza-desktop", { path: testInfo.outputPath("plaza-desktop.png"), contentType: "image/png" });
  if (process.env.WORLD_CAPTURE_ART === "1" && testInfo.project.name === "chromium") {
    await mkdir("public/world", { recursive: true });
    await page.route("**/api/internal/world", (route) => route.fulfill({ json: buildWorldFrame([]) }));
    await page.route("**/api/internal/world/replay?*", (route) => route.fulfill({ json: { slots: Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date(Date.now() + i * 600_000).toISOString(), frame: null })) } }));
    for (const scene of ["plaza", "ecosystem", "battle", "broadcast", "theater"]) {
      await page.goto(`/?scene=${scene}`);
      await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
      const png = await page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldCapture: (bare?: boolean) => string }).worldCapture(true));
      await writeFile(`public/world/static-${scene}.png`, Buffer.from(png.split(",")[1], "base64"));
    }
  }
  await page.unroute("**/api/internal/world");
  await prepareWorld(page);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await page.screenshot({ path: testInfo.outputPath("plaza-mobile.png"), fullPage: true });
  await testInfo.attach("plaza-mobile", { path: testInfo.outputPath("plaza-mobile.png"), contentType: "image/png" });
  expect(errors).toEqual([]);
});

type WallCanvas = HTMLCanvasElement & { worldMetrics: RenderMetrics; worldWallTexture: (id: string) => string };
const wallMetrics = (page: import("@playwright/test").Page) => page.locator("canvas").evaluate((node) => (node as WallCanvas).worldMetrics.wall!);

test("wall panels are drawn inside the WebGL scene and each one opens its detail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await expect.poll(async () => Object.keys((await wallMetrics(page)).drawn).length).toBe(5);
  const wall = await wallMetrics(page), box = (await page.locator("canvas").boundingBox())!;
  // The canvas is the whole viewport under the fixed header.
  expect(box.width).toBe(1440); expect(Math.round(box.y + box.height)).toBe(900);
  // Every panel sits on the wall inside the stage, above the bottom HUD, without overlapping another.
  const rects = Object.values(wall.rects);
  for (const r of rects) { expect(r.x).toBeGreaterThan(0); expect(r.x + r.width).toBeLessThan(box.width); expect(r.y).toBeGreaterThan(0); expect(r.y + r.height).toBeLessThan(box.height - 60); }
  for (const a of rects) for (const b of rects) if (a !== b) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  expect(wall.rects.pierrot.width / wall.rects.pierrot.height).toBeCloseTo(1.5, 2); // original 300×200, no crop
  expect(wall.body).toBeGreaterThanOrEqual(14);
  // The text is in the texture, not in a floating DOM layer: the DOM copy is visually clipped away.
  expect((await page.locator("#world-feed-wall .world-wall-copy").boundingBox())!.width).toBeLessThanOrEqual(1);
  const painted = await page.locator("canvas").evaluate(async (node) => {
    const image = new Image(); image.src = (node as WallCanvas).worldWallTexture("feed"); await image.decode();
    const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
    const ctx = c.getContext("2d")!; ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data; const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) colors.add(data[i] << 16 | data[i + 1] << 8 | data[i + 2]);
    return { width: image.width, colors: colors.size };
  });
  expect(painted.width).toBeGreaterThan(300); expect(painted.colors).toBeGreaterThan(8);
  // New feed data repaints the texture.
  const before = wall.drawn.feed;
  await page.route("**/api/feed?*", (route) => route.fulfill({ json: { rows: [], nextOffset: null, hasMore: false, errorMessage: "" } }));
  await page.goto("/?stock=S3"); await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await expect.poll(async () => (await wallMetrics(page)).drawn.feed).not.toBe(before);
  // Clicking the panel's place in the scene opens the matching detail.
  for (const [id, tab] of [["market", "지수"], ["pierrot", "지수"], ["index", "지수"], ["feed", "피드"], ["room", "곡소리방"]] as const) {
    const r = (await wallMetrics(page)).rects[id];
    await page.mouse.click(box.x + r.x + r.width / 2, box.y + r.y + r.height / 2);
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("portrait zooms one wall section; arrows pan the camera and overview shows the whole wall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  const inside = async (id: "market" | "feed" | "pierrot") => { const r = (await wallMetrics(page)).rects[id]; return r.x >= 0 && r.x + r.width <= 390; };
  await expect.poll(() => inside("pierrot")).toBe(true); expect(await inside("feed")).toBe(false);
  const zoomed = (await wallMetrics(page)).ppu;
  await page.locator('.world-wall-arrow[data-dir="right"]').click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("feed")).toBe(true); expect(await inside("pierrot")).toBe(false);
  // Arrows live in the floor band, never over panel text.
  const arrow = (await page.locator('.world-wall-arrow[data-dir="left"]').boundingBox())!, canvas = (await page.locator("canvas").boundingBox())!;
  const feed = (await wallMetrics(page)).rects.feed; expect(arrow.y).toBeGreaterThan(canvas.y + feed.y + feed.height);
  await page.getByRole("button", { name: "전체보기", exact: true }).click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("market") && await inside("feed")).toBe(true);
  expect((await wallMetrics(page)).ppu).toBeLessThan(zoomed / 2);
  await page.getByRole("button", { name: "확대", exact: true }).click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("market")).toBe(false);
});

test("perspective camera turns toward the visitor and keeps every panel on screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await expect.poll(async () => (await wallMetrics(page)).yaw).toBe(0); // Visitor starts in the middle: frontal view.
  const rest = await wallMetrics(page), box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + 150, box.y + box.height - 150); // Walk to the left side of the floor.
  await expect.poll(async () => (await wallMetrics(page)).yaw, { timeout: 15_000 }).toBeGreaterThan(.05);
  const turned = await wallMetrics(page);
  // The camera swings right to look left: the right panel comes closer, the left one recedes.
  expect(turned.rects.feed.height).toBeGreaterThan(rest.rects.feed.height);
  expect(turned.rects.market.height).toBeLessThan(rest.rects.market.height);
  for (const r of Object.values(turned.rects)) { expect(r.x).toBeGreaterThan(0); expect(r.x + r.width).toBeLessThan(box.width); expect(r.y).toBeGreaterThan(0); }
  // Panel buttons follow the turned wall.
  const r = turned.rects.feed; await page.mouse.click(box.x + r.x + r.width / 2, box.y + r.y + r.height / 2);
  await expect(page.getByRole("tab", { name: "피드", exact: true })).toHaveAttribute("aria-selected", "true");
});
