import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import antAtlas from "../components/world/ant-atlas.json";

const frames = antAtlas.frames as Record<string, number[] | undefined>;
const DIRS = ["f", "l", "r", "b"], ROWS = ["neutral.idle", "neutral.walk-a", "neutral.walk-b", "fear.idle", "hope.idle"];

test("ant atlas keeps the 20 legacy cells as base frames", () => {
  expect(antAtlas.directions).toEqual(["front", "left", "right", "back"]);
  expect(antAtlas.poses).toEqual(["idle", "walk-a", "walk-b", "fear", "hope"]);
  expect(antAtlas.cells).toHaveLength(5);
  ROWS.forEach((row, r) => {
    expect(antAtlas.cells[r]).toHaveLength(4);
    DIRS.forEach((dir, c) => {
      const frame = frames[`${row}.${dir}`];
      expect(frame, `${row}.${dir}`).toBeDefined();
      expect(frame!.slice(0, 4), `${row}.${dir}`).toEqual(antAtlas.cells[r][c]);
      expect(frame![4], `${row}.${dir} k`).toBe(1);
    });
  });
});
test("every ant atlas rect lies inside the image and carries a usable scale and body anchor", () => {
  expect(antAtlas.width).toBeGreaterThanOrEqual(1254);
  expect(antAtlas.height).toBeGreaterThanOrEqual(1254);
  expect(Math.max(antAtlas.width, antAtlas.height)).toBeLessThanOrEqual(4096);
  for (const rect of antAtlas.cells.flat()) {
    expect(rect).toHaveLength(4);
    expect(rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0 && rect[0] + rect[2] <= 1254 && rect[1] + rect[3] <= 1254, `cell ${rect}`).toBe(true);
  }
  const entries = Object.entries(frames);
  expect(entries.length).toBeGreaterThanOrEqual(20);
  for (const [key, frame] of entries) {
    expect(key).toMatch(/^(neutral|fear|hope)\.(idle|walk-a|walk-b|walk-p|phone|sigh)\.(f|fl|l|bl|b|br|r|fr)$/);
    expect(frame, key).toHaveLength(6);
    const [x, y, w, h, k, ax] = frame!;
    expect([x, y, w, h, ax].every(Number.isInteger), `${key} integers`).toBe(true);
    expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= antAtlas.width && y + h <= antAtlas.height, `${key} inside ${antAtlas.width}x${antAtlas.height}`).toBe(true);
    expect(k > .5 && k < 2, `${key} k ${k}`).toBe(true);
    expect(ax >= 0 && ax <= w, `${key} ax ${ax}`).toBe(true);
  }
});
test("ant atlas image matches the frame set and exists on disk", () => {
  const extra = Object.keys(frames).length > 20;
  expect(antAtlas.image).toBe(extra ? "/world/ant-atlas.png" : "/world/ants.png");
  if (!extra) expect([antAtlas.width, antAtlas.height]).toEqual([1254, 1254]);
  expect(existsSync(join(process.cwd(), "public", antAtlas.image))).toBe(true);
});
