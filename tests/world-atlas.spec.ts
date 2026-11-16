import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import antAtlas from "../components/world/ant-atlas.json";
import { ANT_DIRS, antFrameCandidates, type AntVariant } from "../lib/world-crowd";

// The same PNG decoder the build script uses (it reads palette PNGs too).
type Image = { width: number; height: number; data: Uint8Array };
const { PNG } = createRequire(join(process.cwd(), "package.json"))("playwright-core/lib/utilsBundle") as { PNG: { sync: { read(file: Buffer): Image } } };
const read = (path: string): Image => PNG.sync.read(readFileSync(join(process.cwd(), "public", path)));
const composed = Object.keys(antAtlas.frames).length > 20;
let cached: Image | undefined;
const atlasImage = () => cached ??= read(antAtlas.image);
// Opaque pixels of a rect: how many, and where the ant stands (middle of the span of its lowest 5%, from the rect's left edge).
const body = (image: Image, [x, y, w, h]: number[]) => {
  let area = 0, low = w, high = -1;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (image.data[((y + py) * image.width + x + px) * 4 + 3] > 89) {
    area++;
    if (py >= h - 2 - Math.round(h * .05)) { low = Math.min(low, px); high = Math.max(high, px + 1); }
  }
  return { area, stance: (low + high) / 2 };
};

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
      // `cells` are coordinates in ants.png. In the composed atlas the same crop is packed elsewhere, at the same size.
      expect(composed ? frame!.slice(2, 4) : frame!.slice(0, 4), `${row}.${dir}`).toEqual(composed ? antAtlas.cells[r][c].slice(2) : antAtlas.cells[r][c]);
      expect(frame![4], `${row}.${dir} k`).toBe(1);
    });
  });
});
test("the base cells in the composed atlas are the ants.png cells: same outline, colours within the palette's error", () => {
  if (!composed) return;
  const base = read("/world/ants.png"), atlas = atlasImage();
  ROWS.forEach((row, r) => DIRS.forEach((dir, c) => {
    const [bx, by, w, h] = antAtlas.cells[r][c], [ax, ay] = frames[`${row}.${dir}`]!;
    let outline = 0, off = 0, count = 0;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = ((by + py) * base.width + bx + px) * 4, j = ((ay + py) * atlas.width + ax + px) * 4, solid = base.data[i + 3] > 89;
      if (solid !== atlas.data[j + 3] > 0) outline++;
      else if (solid) for (let k = 0; k < 3; k++) { off += Math.abs(base.data[i + k] - atlas.data[j + k]); count++; }
    }
    expect(outline, `${row}.${dir} outline`).toBe(0);
    expect(off / count, `${row}.${dir} mean colour error`).toBeLessThan(4);
  }));
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
    expect(key).toMatch(/^(neutral|fear|hope|neutral-bright|hope-bright)\.(idle|walk-a|walk-b|walk-p|phone|sigh|look|tilt|(howl|kneel|dance|smug)-[1-6])\.(f|fl|l|bl|b|br|r|fr)$/);
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
test("the atlas download stays small: a palette PNG, and a two-thirds copy with the same layout for small screens", () => {
  if (!composed) return;
  const small = (antAtlas as { small?: { image: string; width: number; height: number } }).small!;
  expect(small.image).toBe("/world/ant-atlas-small.png");
  expect([small.width, small.height]).toEqual([antAtlas.width * 2 / 3, antAtlas.height * 2 / 3]);
  for (const [path, width, height, budget] of [[antAtlas.image, antAtlas.width, antAtlas.height, 2.3e6], [small.image, small.width, small.height, 1.1e6]] as const) {
    const file = join(process.cwd(), "public", path), head = readFileSync(file).subarray(0, 26);
    expect([head.readUInt32BE(16), head.readUInt32BE(20)], path).toEqual([width, height]);
    expect(head[25], `${path} colour type`).toBe(3); // palette
    expect(statSync(file).size, `${path} bytes`).toBeLessThan(budget);
  }
  // Nothing is wasted on empty space: the frames fill at least nine tenths of the image.
  expect(Object.values(frames).reduce((sum, frame) => sum + frame![2] * frame![3], 0) / (antAtlas.width * antAtlas.height)).toBeGreaterThan(.9);
  // The copy shows the same ant in the same place: every frame's opaque area scales by (2/3) squared.
  const full = atlasImage(), copy = read(small.image), scale = 2 / 3, entries = Object.entries(frames) as [string, number[]][];
  const wrong = entries.filter(([, [x, y, w, h]]) => {
    const x0 = Math.ceil(x * scale), y0 = Math.ceil(y * scale), x1 = Math.floor((x + w) * scale), y1 = Math.floor((y + h) * scale);
    return Math.abs(body(copy, [x0, y0, x1 - x0, y1 - y0]).area / body(full, [x, y, w, h]).area / (scale * scale) - 1) > .03;
  }).map(([key]) => key);
  expect(wrong).toEqual([]);
  // A sprite's border samples the reduced pixel that straddles its rect: up to 1.5 atlas px outside it. Rects keep 2 px
  // between them (and off the image edge), so that pixel never holds a neighbour.
  const close = entries.filter(([key, a]) => a[0] < 2 || a[1] < 2 || a[0] + a[2] > antAtlas.width - 2 || a[1] + a[3] > antAtlas.height - 2
    || entries.some(([other, b]) => other !== key && a[0] < b[0] + b[2] + 2 && b[0] < a[0] + a[2] + 2 && a[1] < b[1] + b[3] + 2 && b[1] < a[1] + a[3] + 2)).map(([key]) => key);
  expect(close).toEqual([]);
});
test("looking up exists from behind for every ant, and each bright set is a whole walk cycle", () => {
  if (!composed) return; // base-only build
  const VARIANTS = ["neutral", "fear", "hope", "neutral-bright", "hope-bright"];
  // Straight behind and back-right are drawn for everyone; back-left is drawn, or is the mirrored back-right (scarf ant).
  for (const variant of VARIANTS) {
    for (const dir of ["b", "br"]) expect(frames[`${variant}.look.${dir}`], `${variant}.look.${dir}`).toBeDefined();
    // The in-between of a head move exists from straight behind.
    expect(frames[`${variant}.tilt.b`], `${variant}.tilt.b`).toBeDefined();
  }
  for (const variant of ["neutral", "fear", "hope"] as const) for (const bright of [false, true]) {
    const found = antFrameCandidates(variant, "look", 3, 4, 0, bright).find((candidate) => frames[candidate.key])!;
    expect(found.key, `${variant} bl`).toMatch(/\.look\.(bl|br)$/); expect(found.mirror).toBe(found.key.endsWith(".br"));
  }
  // The look-up art has no front or side view: it is only ever drawn for ants facing the wall.
  expect(Object.keys(frames).filter((key) => key.includes(".look.") && !/\.(bl|b|br)$/.test(key))).toEqual([]);
  expect(Object.keys(frames).filter((key) => key.includes(".tilt.") && !key.endsWith(".b"))).toEqual([]);
  // A bright face must not come and go between the steps of a walk: wherever a bright stride exists, so does the rest.
  const bright = Object.keys(frames).filter((key) => key.includes("-bright."));
  expect(bright.some((key) => key.startsWith("fear"))).toBe(false);
  for (const key of bright.filter((key) => key.includes(".walk-a."))) {
    const [variant, , dir] = key.split(".");
    for (const pose of ["walk-b", "walk-p", "idle"]) expect(frames[`${variant}.${pose}.${dir}`], `${variant}.${pose}.${dir}`).toBeDefined();
  }
  for (const variant of ["neutral-bright", "hope-bright"]) for (const dir of DIRS) expect(frames[`${variant}.walk-a.${dir}`], `${variant}.walk-a.${dir}`).toBeDefined();
  // Same apparent size as the plain art: standing heights within a few percent of the base sheet's.
  const tall = (key: string) => frames[key]![3] * frames[key]![4];
  for (const [key, base] of [["neutral-bright.idle.f", "neutral.idle.f"], ["neutral-bright.idle.b", "neutral.idle.b"], ["hope-bright.idle.f", "hope.idle.f"]]) {
    expect(Math.abs(tall(key) / tall(base) - 1), `${key} ${tall(key)} vs ${base} ${tall(base)}`).toBeLessThan(.08);
  }
  // A head thrown back lowers the antennae, so height says nothing about the look-up frames. Their size is compared by
  // the body itself: the square root of the opaque area, as drawn (times k), against the standing back view.
  const size = (key: string) => Math.sqrt(body(atlasImage(), frames[key]!).area) * frames[key]![4];
  for (const [key, base] of [["neutral.look.b", "neutral.idle.b"], ["neutral.tilt.b", "neutral.idle.b"], ["neutral-bright.look.b", "neutral.idle.b"], ["hope.look.b", "hope.idle.b"], ["hope.tilt.b", "hope.idle.b"], ["hope-bright.look.b", "hope-bright.idle.b"]]) {
    expect(Math.abs(size(key) / size(base) - 1), `${key} ${size(key).toFixed(1)} vs ${base} ${size(base).toFixed(1)}`).toBeLessThan(.08);
  }
});
test("raising or lowering the head does not move the ant sideways: the boots stay where the standing frame has them", () => {
  if (!composed) return;
  // Where the boots are drawn relative to the ant's floor point, in sprite pixels (mirrored frames count from the other edge).
  const boots = (key: string, mirror: boolean) => { const frame = frames[key]!, off = (body(atlasImage(), frame).stance - frame[5]) * frame[4]; return mirror ? -off : off; };
  for (const variant of ["neutral", "fear", "hope"] as const) for (const bright of [false, true]) for (const dir of [3, 4, 5]) {
    const pick = (pose: "idle" | "look" | "tilt") => antFrameCandidates(variant, pose, dir, 4, 0, bright).find((candidate) => frames[candidate.key])!;
    const still = pick("idle"), poses = dir === 4 ? ["look", "tilt"] as const : ["look"] as const;
    for (const pose of poses) {
      const moved = pick(pose);
      expect(moved.posed, `${variant} ${pose} ${ANT_DIRS[dir]}`).toBe(true);
      // 3 atlas px is 1.4 px on a 1440 px wide screen.
      expect(Math.abs(boots(moved.key, moved.mirror) - boots(still.key, still.mirror)), `${moved.key}${moved.mirror ? "~" : ""} vs ${still.key}`).toBeLessThanOrEqual(3);
    }
  }
});
test("passing steps and bright phone frames exist wherever the crowd draws them", () => {
  if (!composed) return;
  for (const dir of ANT_DIRS) for (const pose of ["idle", "walk-a", "walk-b", "walk-p"]) for (const variant of ["neutral", "hope"]) expect(frames[`${variant}.${pose}.${dir}`], `${variant}.${pose}.${dir}`).toBeDefined();
  for (const dir of DIRS) for (const pose of ["walk-a", "walk-b", "walk-p", "phone", "sigh"]) expect(frames[`fear.${pose}.${dir}`], `fear.${pose}.${dir}`).toBeDefined();
  for (const variant of ["neutral", "hope"] as AntVariant[]) for (const dir of DIRS) for (const pose of ["phone", "sigh"]) {
    expect(frames[`${variant}.${pose}.${dir}`], `${variant}.${pose}.${dir}`).toBeDefined();
    expect(frames[`${variant}-bright.${pose}.${dir}`], `${variant}-bright.${pose}.${dir}`).toBeDefined();
    // About the size of the dull phone frame it replaces.
    const tall = (key: string) => frames[key]![3] * frames[key]![4];
    expect(Math.abs(tall(`${variant}-bright.phone.${dir}`) / tall(`${variant}.phone.${dir}`) - 1), `${variant}-bright.phone.${dir}`).toBeLessThan(.08);
    expect(Math.abs(tall(`${variant}-bright.sigh.${dir}`) / tall(`${variant}-bright.phone.${dir}`) - 1), `${variant}-bright.sigh.${dir}`).toBeLessThan(.05);
  }
});
test("emotion loops: fear howls and kneels, hope dances and gloats, 3 to 6 numbered frames each, played on the spot", () => {
  if (!composed) return;
  const LOOPS = { howl: "fear", kneel: "fear", dance: "hope", smug: "hope" } as const;
  for (const [pose, variant] of Object.entries(LOOPS)) {
    // Numbered from 1 without gaps, camera side only, and only for the ant whose mood the loop shows.
    const keys = Object.keys(frames).filter((key) => key.split(".")[1].replace(/-\d+$/, "") === pose);
    const count = keys.length;
    expect(count, pose).toBeGreaterThanOrEqual(3); expect(count, pose).toBeLessThanOrEqual(6);
    expect(keys.sort()).toEqual(Array.from({ length: count }, (_, i) => `${variant}.${pose}-${i + 1}.f`).sort());
    // The same ant as the standing frame: body size (square root of the opaque area, as drawn) within a fifth of it.
    const size = (key: string) => Math.sqrt(body(atlasImage(), frames[key]!).area) * frames[key]![4];
    for (const key of keys) expect(Math.abs(size(key) / size(`${variant}.idle.f`) - 1), `${key} ${size(key).toFixed(1)}`).toBeLessThan(.2);
    // One scale for the whole loop, so the ant does not grow or shrink while it plays.
    expect(new Set(keys.map((key) => frames[key]![4])).size, `${pose} k`).toBe(1);
  }
});
