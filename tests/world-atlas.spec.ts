import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import antAtlas from "../components/world/ant-atlas.json";
import { ANT_DIRS, antFrameCandidates } from "../lib/world-crowd";

// The atlas is checked by its sprite names (what the renderer asks for) and a light look at its layout, not pixel by pixel:
// the art is reviewed by eye when it is redrawn.
const frames = antAtlas.frames as Record<string, number[] | undefined>;
const keys = Object.keys(frames);
const composed = keys.length > 20;
const DIRS = ["f", "l", "r", "b"], ROWS = ["neutral.idle", "neutral.walk-a", "neutral.walk-b", "fear.idle", "hope.idle"];
const missing = (names: string[]) => names.filter((name) => !frames[name]);
const each = <T,>(a: readonly T[], f: (item: T) => string[]) => a.flatMap(f);

test("ant atlas keeps the 20 legacy cells as base frames", () => {
  expect(antAtlas.directions).toEqual(["front", "left", "right", "back"]);
  expect(antAtlas.poses).toEqual(["idle", "walk-a", "walk-b", "fear", "hope"]);
  expect(antAtlas.cells).toHaveLength(5);
  for (const row of antAtlas.cells) expect(row).toHaveLength(4);
  expect(missing(each(ROWS, (row) => DIRS.map((dir) => `${row}.${dir}`)))).toEqual([]);
});

test("every sprite has a known name and a rect inside the image", () => {
  expect(Math.max(antAtlas.width, antAtlas.height)).toBeLessThanOrEqual(4096);
  for (const [key, frame] of Object.entries(frames)) {
    expect(key).toMatch(/^(neutral|fear|hope|neutral-bright|hope-bright)\.(idle|walk-a|walk-b|walk-p|phone|sigh|look|tilt|(howl|kneel|dance|smug)-[1-6])\.(f|fl|l|bl|b|br|r|fr)$/);
    const [x, y, w, h, k, ax] = frame!;
    expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= antAtlas.width && y + h <= antAtlas.height, `${key} inside`).toBe(true);
    expect(k > .5 && k < 2 && ax >= 0 && ax <= w, `${key} k ${k} ax ${ax}`).toBe(true);
  }
});

test("atlas images exist: a palette PNG and a two-thirds copy for small screens", () => {
  expect(antAtlas.image).toBe(composed ? "/world/ant-atlas.png" : "/world/ants.png");
  expect(existsSync(join(process.cwd(), "public", antAtlas.image))).toBe(true);
  if (!composed) return;
  const small = (antAtlas as { small?: { image: string; width: number; height: number } }).small!;
  expect(small.image).toBe("/world/ant-atlas-small.png");
  expect([small.width, small.height]).toEqual([antAtlas.width * 2 / 3, antAtlas.height * 2 / 3]);
  // Only a guard against an accidental full-colour export: the budget leaves room for more frames.
  for (const [path, width, height, budget] of [[antAtlas.image, antAtlas.width, antAtlas.height, 6e6], [small.image, small.width, small.height, 3e6]] as const) {
    const file = join(process.cwd(), "public", path), head = readFileSync(file).subarray(0, 26);
    expect([head.readUInt32BE(16), head.readUInt32BE(20)], path).toEqual([width, height]);
    expect(head[25], `${path} colour type`).toBe(3); // palette
    expect(statSync(file).size, `${path} bytes`).toBeLessThan(budget);
  }
});

test("every pose the crowd draws has its sprites", () => {
  if (!composed) return;
  // Walking and standing in all eight directions for the neutral and hope ants, four for the fear ant.
  expect(missing(each(["neutral", "hope"], (v) => each(ANT_DIRS, (d) => ["idle", "walk-a", "walk-b", "walk-p"].map((p) => `${v}.${p}.${d}`))))).toEqual([]);
  expect(missing(each(DIRS, (d) => ["walk-a", "walk-b", "walk-p", "phone", "sigh"].map((p) => `fear.${p}.${d}`)))).toEqual([]);
  // Phone and sigh, also with the bright (hopeful) face.
  expect(missing(each(["neutral", "hope", "neutral-bright", "hope-bright"], (v) => each(DIRS, (d) => [`${v}.phone.${d}`, `${v}.sigh.${d}`])))).toEqual([]);
  // A bright walk is a whole cycle in every direction.
  expect(missing(each(["neutral-bright", "hope-bright"], (v) => each(DIRS, (d) => ["idle", "walk-a", "walk-b", "walk-p"].map((p) => `${v}.${p}.${d}`))))).toEqual([]);
  expect(keys.some((key) => key.startsWith("fear-bright"))).toBe(false);
});

test("looking up is drawn from behind only, for every ant", () => {
  if (!composed) return;
  expect(missing(each(["neutral", "fear", "hope", "neutral-bright", "hope-bright"], (v) => [`${v}.look.b`, `${v}.look.br`, `${v}.tilt.b`]))).toEqual([]);
  expect(keys.filter((key) => key.includes(".look.") && !/\.(bl|b|br)$/.test(key))).toEqual([]);
  expect(keys.filter((key) => key.includes(".tilt.") && !key.endsWith(".b"))).toEqual([]);
  // Back-left is drawn, or is the mirrored back-right.
  for (const variant of ["neutral", "fear", "hope"] as const) for (const bright of [false, true]) {
    const found = antFrameCandidates(variant, "look", 3, 4, 0, bright).find((candidate) => frames[candidate.key]);
    expect(found?.key, `${variant} bl`).toMatch(/\.look\.(bl|br)$/);
  }
});

test("emotion loops: fear howls and kneels, hope dances and gloats, 3 to 6 numbered frames each", () => {
  if (!composed) return;
  for (const [pose, variant] of Object.entries({ howl: "fear", kneel: "fear", dance: "hope", smug: "hope" })) {
    const loop = keys.filter((key) => key.split(".")[1].replace(/-\d+$/, "") === pose);
    expect(loop.length, pose).toBeGreaterThanOrEqual(3); expect(loop.length, pose).toBeLessThanOrEqual(6);
    expect(loop.sort()).toEqual(Array.from({ length: loop.length }, (_, i) => `${variant}.${pose}-${i + 1}.f`).sort());
  }
});
