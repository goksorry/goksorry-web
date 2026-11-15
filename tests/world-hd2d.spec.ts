import { test, expect } from "@playwright/test";
import { prepareWorld, requireWebGL2 } from "./world-fixture";
import { writeFile, mkdir } from "node:fs/promises";
import { buildWorldFrame } from "../lib/world";

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
      const png = await page.locator("canvas").evaluate((node) => (node as HTMLCanvasElement & { worldCapture: () => string }).worldCapture());
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
