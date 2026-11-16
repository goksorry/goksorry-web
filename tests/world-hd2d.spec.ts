import { test, expect } from "@playwright/test";
import { prepareWorld, requireWebGL2 } from "./world-fixture";
import { writeFile, mkdir } from "node:fs/promises";
import { buildWorldFrame } from "../lib/world";
import type { RenderMetrics } from "../components/world/hd2d-renderer";
import antAtlas from "../components/world/ant-atlas.json";

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
    for (const scene of ["plaza", "battle", "theater"]) {
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
  await expect.poll(async () => Object.keys((await wallMetrics(page)).drawn).length).toBe(6);
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
  // The community board: each painted quarter opens that community's evidence.
  const communities = (await wallMetrics(page)).rects.communities, names = ["토스증권", "뽐뿌", "블라인드", "디시 4종"];
  for (const [i, name] of names.entries()) {
    await page.mouse.click(box.x + communities.x + communities.width * (i + .5) / names.length, box.y + communities.y + communities.height * .6);
    await expect(page.locator('[data-world-panel="detail"]')).toHaveAccessibleName(`${name} · 분위기와 근거`);
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("portrait zooms one wall section; arrows pan the camera and overview shows the whole wall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  const inside = async (id: "market" | "feed" | "pierrot" | "communities") => { const r = (await wallMetrics(page)).rects[id]; return r.x >= 0 && r.x + r.width <= 390; };
  // The middle section, where a phone opens, frames both doors whole.
  const door = async (scene: string) => { const r = (await wallMetrics(page)).doors[scene]; return r.x >= 0 && r.x + r.width <= 390; };
  await expect.poll(() => inside("pierrot")).toBe(true); expect(await inside("feed")).toBe(false);
  await expect.poll(async () => (await wallMetrics(page)).settled && await door("battle") && await door("theater")).toBe(true);
  const zoomed = (await wallMetrics(page)).ppu;
  await page.locator('.world-wall-arrow[data-dir="right"]').click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("feed")).toBe(true); expect(await inside("pierrot")).toBe(false);
  expect(await inside("communities")).toBe(true);
  // Arrows live in the floor band, never over panel text.
  const arrow = (await page.locator('.world-wall-arrow[data-dir="left"]').boundingBox())!, canvas = (await page.locator("canvas").boundingBox())!;
  const board = (await wallMetrics(page)).rects.communities; expect(arrow.y).toBeGreaterThan(canvas.y + board.y + board.height);
  await page.getByRole("button", { name: "전체보기", exact: true }).click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("market") && await inside("feed")).toBe(true);
  expect((await wallMetrics(page)).ppu).toBeLessThan(zoomed / 2);
  await page.getByRole("button", { name: "확대", exact: true }).click();
  await expect.poll(async () => (await wallMetrics(page)).settled && await inside("market")).toBe(false);
});

test("perspective camera turns toward the visitor and brings it nearer the middle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await expect.poll(async () => (await wallMetrics(page)).yaw).toBe(0); // Visitor starts in the middle: frontal view.
  const rest = await wallMetrics(page), box = (await page.locator("canvas").boundingBox())!;
  // Walk to the left side of the floor with the keyboard.
  const visitorX = () => page.locator("canvas").evaluate((node) => (node as WallCanvas).worldMetrics.visitor().x);
  await page.locator("canvas").focus();
  await expect.poll(async () => { await page.keyboard.press("ArrowLeft"); return visitorX(); }, { timeout: 20_000 }).toBeLessThanOrEqual(-6);
  await expect.poll(async () => (await wallMetrics(page)).yaw, { timeout: 15_000 }).toBeGreaterThan(.05);
  // Let the turn settle: two equal reads in a row.
  let last = NaN;
  await expect.poll(async () => { const yaw = (await wallMetrics(page)).yaw, same = yaw === last; last = yaw; return same; }, { timeout: 15_000 }).toBe(true);
  const turned = await wallMetrics(page);
  // The camera pans left toward the ant: the wall slides right, so the ant sits nearer the middle.
  expect(turned.rects.market.x).toBeGreaterThan(rest.rects.market.x + 100);
  expect(turned.rects.pierrot.x).toBeGreaterThan(rest.rects.pierrot.x + 100);
  // The side the ant stands on stays fully on screen; the far end may leave the frame.
  for (const id of ["market", "room", "pierrot", "index"] as const) { const r = turned.rects[id]; expect(r.x).toBeGreaterThan(0); expect(r.x + r.width).toBeLessThan(box.width); expect(r.y).toBeGreaterThan(0); }
  // Panel buttons follow the turned wall.
  const r = turned.rects.room; await page.mouse.click(box.x + r.x + r.width / 2, box.y + r.y + r.height / 2);
  await expect(page.getByRole("tab", { name: "곡소리방", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("the visitor's walk alternates both strides through a feet-together frame, in the plaza and elsewhere", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await prepareWorld(page);
  for (const url of ["/", "/?scene=battle"]) {
    await page.goto(url); await requireWebGL2(page);
    await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
    await page.locator("canvas").focus();
    // Sample the drawn frame on every animation frame while the visitor walks right for four key presses.
    const sampling = page.locator("canvas").evaluate((node) => new Promise<string[]>((resolve) => {
      const metrics = (node as WallCanvas).worldMetrics, seen: string[] = [], start = performance.now();
      const tick = (now: number) => { const frame = metrics.visitor().frame; if (seen[seen.length - 1] !== frame) seen.push(frame); if (now - start < 1500) requestAnimationFrame(tick); else resolve(seen); };
      requestAnimationFrame(tick);
    }));
    for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(300); }
    const seen = await sampling;
    expect(seen, url).toEqual(expect.arrayContaining(["neutral.walk-a.r", "neutral.walk-p.r", "neutral.walk-b.r"]));
    // Side-view strides look alike, so they must never follow each other directly.
    seen.forEach((frame, i) => { if (i && /walk-[ab]/.test(frame)) expect(seen[i - 1], `${url}: ${seen.join(" ")}`).not.toMatch(/walk-[ab]/); });
  }
});

// Distance on the floor per step against the feet as they are drawn. The spread is measured here from the atlas image (the
// centres of the two ground contacts of each side-view stride frame the walk showed) and scaled by the size the renderer
// drew the sprite at, so it does not depend on the renderer's own step constant.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) test(`the visitor's step covers the drawn foot spread and each pose lasts long enough to be seen (${viewport.width}x${viewport.height})`, async ({ page }) => {
  await page.setViewportSize(viewport); await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  await expect.poll(async () => (await wallMetrics(page)).settled).toBe(true);
  await page.locator("canvas").focus();
  const WALK = 5000;
  const sampling = page.locator("canvas").evaluate((node, span) => new Promise<{ t: number; x: number; frame: string; unit: number }[]>((resolve) => {
    const metrics = (node as WallCanvas).worldMetrics, seen: { t: number; x: number; frame: string; unit: number }[] = [], start = performance.now();
    const tick = (now: number) => { const v = metrics.visitor(); seen.push({ t: now - start, x: v.x, frame: v.frame, unit: v.unit }); if (now - start < span) requestAnimationFrame(tick); else resolve(seen); };
    requestAnimationFrame(tick);
  }), WALK);
  // Each press walks one unit further, so pressing faster than a unit takes keeps the visitor walking without a stop.
  for (const end = Date.now() + WALK; Date.now() < end;) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(120); }
  const seen = await sampling, size = await page.locator("canvas").evaluate((node) => (node as WallCanvas).worldMetrics.antSize);
  expect(size).toBeCloseTo(viewport.width > 1000 ? 1 : .6, 1);
  // Whole cycles: from one start of the first stride frame to a later one.
  const starts = seen.filter((s, i) => i > 0 && /walk-a/.test(s.frame) && !/walk-a/.test(seen[i - 1].frame));
  expect(starts.length).toBeGreaterThanOrEqual(4);
  const first = starts[1], last = starts[starts.length - 1], cycles = starts.length - 2;
  const step = (last.x - first.x) / cycles / 2, pose = (last.t - first.t) / cycles / 4, speed = (last.x - first.x) / (last.t - first.t) * 1000;
  const strides = [...new Set(seen.map((s) => s.frame.replace("~", "")).filter((frame) => /walk-[ab]\.[lr]$/.test(frame)))];
  expect(strides.length).toBe(2);
  const spreadPx = await page.evaluate(async ({ src, rects }) => {
    const image = new Image(); image.src = src; await image.decode();
    const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
    const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
    return rects.map(([x, y, w, h]) => {
      // Columns that touch the ground (the lowest 5% of the frame, above its 2px margin), grouped into the two feet.
      const band = Math.floor(h * .05) + 1, data = ctx.getImageData(x, y + h - 2 - band, w, band).data, feet: number[][] = [];
      for (let col = 0; col < w; col++) {
        let solid = false; for (let row = 0; row < band && !solid; row++) solid = data[(row * w + col) * 4 + 3] > 89;
        if (!solid) continue;
        const foot = feet[feet.length - 1]; if (foot && col - foot[1] <= 3) foot[1] = col; else feet.push([col, col]);
      }
      return feet.length < 2 ? 0 : (feet[feet.length - 1][0] + feet[feet.length - 1][1]) / 2 - (feet[0][0] + feet[0][1]) / 2;
    });
  }, { src: antAtlas.image, rects: strides.map((key) => (antAtlas.frames as Record<string, number[]>)[key]) });
  for (const px of spreadPx) expect(px).toBeGreaterThan(40);
  const unit = last.unit, spread = spreadPx.reduce((sum, px) => sum + px, 0) / spreadPx.length * unit;
  expect(unit).toBeGreaterThan(0);
  const note = `step ${step.toFixed(3)}, drawn spread ${spread.toFixed(3)} (${spreadPx.map((px) => px.toFixed(1)).join(" / ")} px), pose ${pose.toFixed(0)} ms, speed ${speed.toFixed(2)}, antSize ${size.toFixed(3)}`;
  // A step is as long as the feet are apart: neither sliding forward (the old run was 1.4x to 2.3x) nor treading on the spot.
  expect(step / spread, note).toBeGreaterThan(.88); expect(step / spread, note).toBeLessThan(1.12);
  // Every pose stays up for two rendered frames even at 19 fps (105 ms), and the ant still crosses the floor at a brisk pace.
  expect(pose, note).toBeGreaterThanOrEqual(100);
  expect(speed / size, note).toBeGreaterThan(2.2);
});

test("the zoomed phone view follows the visitor across wall sections and never loses it", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareWorld(page); await page.goto("/"); await requireWebGL2(page);
  await expect(page.locator(".hd2d-stage")).toHaveAttribute("data-renderer", "webgl", { timeout: 45_000 });
  const root = page.locator(".world-root"), canvas = page.locator("canvas");
  await expect(root).toHaveAttribute("data-wall-section", "1");
  await expect.poll(async () => (await wallMetrics(page)).settled).toBe(true);
  expect((await wallMetrics(page)).pan).toBe(0); // the visitor starts in the middle section, framed as it always was
  const visitor = () => canvas.evaluate((node) => (node as WallCanvas).worldMetrics.visitor());
  // Records, on every animation frame until stopped: the visitor's screen x and half sprite width, the largest pan, and
  // each change of the section indicator with the floor x the visitor had reached.
  type Watch = { min: number; max: number; half: number; pan: number; changes: { section: string; x: number }[]; on: boolean };
  const watch = () => canvas.evaluate((node) => {
    const metrics = (node as WallCanvas).worldMetrics, rootNode = document.querySelector<HTMLElement>(".world-root")!;
    const log: Watch = { min: Infinity, max: -Infinity, half: 0, pan: 0, changes: [], on: true };
    (window as unknown as { visitorWatch: Watch }).visitorWatch = log;
    const tick = () => {
      const v = metrics.visitor(), section = rootNode.dataset.wallSection ?? "";
      log.min = Math.min(log.min, v.sx); log.max = Math.max(log.max, v.sx); log.half = Math.max(log.half, v.sh * .35); log.pan = Math.max(log.pan, Math.abs(metrics.wall!.pan));
      if (log.changes[log.changes.length - 1]?.section !== section) log.changes.push({ section, x: v.x });
      if (log.on) requestAnimationFrame(tick);
    };
    tick();
  });
  const stop = () => page.evaluate(() => { const log = (window as unknown as { visitorWatch: Watch }).visitorWatch; log.on = false; return log; });
  const hold = async (key: string, until: (x: number) => boolean) => {
    await canvas.focus();
    await expect.poll(async () => { await page.keyboard.press(key); return until((await visitor()).x); }, { intervals: [120], timeout: 30_000 }).toBe(true);
  };
  // Right across the border at x = 3.5 into the feed section, left across both borders to the far section, and back to the middle.
  await watch();
  await hold("ArrowRight", (x) => x >= 6.5);
  await expect(root).toHaveAttribute("data-wall-section", "2");
  await hold("ArrowLeft", (x) => x <= -6.5);
  await expect(root).toHaveAttribute("data-wall-section", "0");
  await expect(page.locator('.world-wall-arrow[data-dir="left"]')).toHaveAttribute("aria-disabled", "true");
  await hold("ArrowRight", (x) => x >= 0);
  await expect(root).toHaveAttribute("data-wall-section", "1");
  const walked = await stop(), note = JSON.stringify(walked);
  // The whole sprite (about .35 of its height to either side of its middle) stayed on the 390px canvas the whole way,
  // which took framing some of the floor off the section's centre.
  expect(walked.min - walked.half, note).toBeGreaterThanOrEqual(0); expect(walked.max + walked.half, note).toBeLessThanOrEqual(390);
  expect(walked.pan, note).toBeGreaterThan(1);
  // One change per border crossing, never flapping back, and each only once the visitor is .4 past the border (x = ±3.5):
  // walking right the border trips later than walking left, so an ant standing on a border keeps its section.
  expect(walked.changes.map((change) => change.section), note).toEqual(["1", "2", "1", "0", "1"]);
  const [, toFeed, back, toMarket, home] = walked.changes.map((change) => change.x);
  expect(toFeed, note).toBeGreaterThanOrEqual(3.9); expect(back, note).toBeLessThanOrEqual(3.1);
  expect(toMarket, note).toBeLessThanOrEqual(-3.9); expect(home, note).toBeGreaterThanOrEqual(-3.1);
  for (const x of [toFeed, back, toMarket, home]) expect(Math.abs(Math.abs(x) - 3.5), note).toBeLessThan(.9); // and not much later than that
  await expect.poll(async () => (await visitor()).state).toBe("idle");
  // A section button moves the frame at once and sends the visitor to that section's centre, framed in the middle.
  await page.locator('.world-wall-arrow[data-dir="right"]').click();
  await expect(root).toHaveAttribute("data-wall-section", "2");
  await expect.poll(async () => { const wall = await wallMetrics(page); return !wall.follow && wall.pan === 0 && wall.rects.feed.x >= 0 && wall.rects.feed.x + wall.rects.feed.width <= 390; }).toBe(true);
  await expect.poll(async () => { const me = await visitor(), wall = await wallMetrics(page); return me.state === "idle" && Math.abs(me.x - 7) < .05 && wall.follow && wall.settled && Math.abs(me.sx - 195) < 60; }, { timeout: 20_000 }).toBe(true);
  await expect(page.locator(".world-nearby")).toHaveCount(0); // it stops clear of the entrance next to the section centre
  // A left swipe on a touch screen does the same as the right arrow; its click neither opens a panel nor walks the floor.
  await page.locator('.world-wall-arrow[data-dir="left"]').click();
  await expect.poll(async () => { const me = await visitor(); return me.state === "idle" && Math.abs(me.x) < .05; }, { timeout: 20_000 }).toBe(true);
  await page.locator(".hd2d-stage").evaluate((stage) => {
    const at = (type: string, x: number) => new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: 600, isPrimary: true });
    const canvasNode = stage.querySelector("canvas")!;
    canvasNode.dispatchEvent(at("pointerdown", 300)); canvasNode.dispatchEvent(at("pointerup", 120));
    canvasNode.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 120, clientY: 600 }));
  });
  await expect(root).toHaveAttribute("data-wall-section", "2");
  await expect.poll(async () => { const me = await visitor(); return me.state === "idle" && Math.abs(me.x - 7) < .05; }, { timeout: 20_000 }).toBe(true);
  await expect(page.locator('[data-world-panel="detail"]')).toHaveCount(0);
});
