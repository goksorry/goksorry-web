// Builds components/world/ant-atlas.json (v2) and, when extra sprite sheets exist, public/world/ant-atlas.png and ant-atlas-small.png.
//   node scripts/build-ant-atlas.mjs                       base frames + every sheet found in art/world/source
//   node scripts/build-ant-atlas.mjs --check <png> [--cols 4 --rows 5]   segment and validate one sheet, write nothing
//   --source <dir>  look for the manifest sheets (by file name) in another directory; an empty one gives the base-only result
//   --out <dir>     write ant-atlas.json / ant-atlas.png there instead of into the repo (dry run)
// public/world/ants.png is never modified. Its 20 cells are packed into the composed atlas like every other frame;
// the legacy `cells` field keeps their coordinates in ants.png itself.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const { PNG } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = "components/world/ant-atlas.json", BASE_IMAGE = "public/world/ants.png", ATLAS_IMAGE = "public/world/ant-atlas.png";
const ALPHA = 89, PAD = 2, NOISE = 1, KEY_TOLERANCE = 28, MAX_SIZE = 4096;
// The reduced atlas (ant-atlas-small.png) is this fraction of the full one. Small screens draw an ant at no more than
// about .65 screen pixels per atlas pixel (see hd2d-renderer), so two thirds loses nothing there; a half-size copy had
// to be enlarged up to 1.3x for the visitor on a phone and looked blockier in a side-by-side.
const SMALL = { num: 2, den: 3 };

// Base sheet layout (ants.png). Rows are [variant, pose, anchor?]; anchor "center" replaces the body anchor with the cell centre.
const BASE = { cols: ["f", "l", "r", "b"], rows: [["neutral", "idle"], ["neutral", "walk-a"], ["neutral", "walk-b"], ["fear", "idle"], ["hope", "idle"]] };
// Extra sheets. A missing file is skipped. A null in cols or rows drops that column or row (the runtime mirrors or falls back).
// norm: k = ref / median cell height of that row, snapped to 1 within 3%. The refs are the heights these sheets came out
// at, because their heads measure the same as the base sheet's: the bowed or mid-step poses are simply shorter.
// Frame keys are "variant.pose.dir". Variants: neutral | fear | hope, plus neutral-bright | hope-bright: the same two ants
// with the open-eyed face they wear while the index is in the hope state (fear has no bright form). Poses: idle | walk-a |
// walk-b | walk-p | phone | sigh | look (standing, head tipped back to look up at the wall; drawn from behind only) |
// tilt (the in-between of idle and look, straight back view only).
// A column may be "pose@dir" to file that column under another pose; rowCols replaces the columns for single rows;
// skip lists frame keys that are segmented but left out of the atlas; rowScale multiplies k for rows drawn smaller than the rest.
// tone: [sheet row, base row, sheet col?, base col?] showing the same character (the whole rows, or one cell of each). The generated sheets came out paler than ants.png, so each is
// multiplied per channel until that row's mean colour equals the base row's; otherwise an ant changes shade between frames.
const SHEETS = [
  // The fear ant only walks 4-way and only stands facing the wall or a cardinal direction, so nothing draws its two
  // camera-side diagonal standing cells.
  { file: "art/world/source/ants-diagonal.png", cols: ["fl", "bl", "br", "fr"],
    rows: [["neutral", "idle"], ["neutral", "walk-a"], ["neutral", "walk-b"], ["fear", "idle"], ["hope", "idle"]], norm: { row: 0, ref: 228 }, tone: [0, 0],
    skip: ["fear.idle.fl", "fear.idle.fr"] },
  { file: "art/world/source/ants-phone.png", cols: ["f", "l", "r", "b"],
    rows: [["neutral", "phone"], ["neutral", "sigh"], ["fear", "phone"], ["hope", "phone"], ["hope", "sigh"]], norm: { row: 0, ref: 234 }, tone: [1, 0] },
  { file: "art/world/source/ants-walk.png", cols: ["f", "l", "r", "b"],
    rows: [null, null, ["hope", "walk-a"], ["hope", "walk-b"], ["neutral", "walk-p"]], norm: { row: 4, ref: 217 }, tone: [4, 0] },
  // Fear walk cycle and sigh. It replaces rows 1-2 of ants-walk.png, whose two strides were nearly identical (the ant slid).
  // Row 5 is a neutral idle ant used only as the tone reference.
  { file: "art/world/source/ants-fear.png", cols: ["f", "l", "r", "b"],
    rows: [["fear", "walk-a"], ["fear", "walk-b"], ["fear", "walk-p"], ["fear", "sigh"], null], norm: { row: 4, ref: 228 }, tone: [4, 0] },
  // Looking up at the wall, from behind: head thrown back, eyes showing over the crown, antennae hanging down the back.
  // Column 1 is the in-between (pose "tilt": antennae folding back, eyes not yet showing), drawn for a moment as the head
  // goes up or comes down. Columns 3 and 4 came out as back-right, back-left. The scarf ant's back-left cells are skipped:
  // their fist and scarf tail sit on the other side from its standing back-left view, so the runtime mirrors back-right.
  // There is no comparison row, so the tone comes from the neutral in-between cell against the base sheet's back view.
  { file: "art/world/source/ants-lookup-back.png", cols: ["tilt@b", "b", "br", "bl"],
    rows: [["neutral", "look"], ["fear", "look"], ["hope", "look"], ["neutral-bright", "look"], ["hope-bright", "look"]], norm: { row: 0, ref: 203 }, tone: [0, 0, 0, 3],
    skip: ["hope.look.bl", "hope-bright.look.bl"] },
  // Bright faces for the hope state. Row 5 of each is the unchanged dull ant, used only as the tone reference.
  { file: "art/world/source/ants-bright.png", cols: ["f", "l", "r", "b"],
    rows: [["neutral-bright", "idle"], ["neutral-bright", "walk-a"], ["neutral-bright", "walk-b"], ["neutral-bright", "walk-p"], null], norm: { row: 0, ref: 232 }, tone: [4, 0] },
  { file: "art/world/source/ants-bright-hope.png", cols: ["f", "l", "r", "b"],
    rows: [["hope-bright", "idle"], ["hope-bright", "walk-a"], ["hope-bright", "walk-b"], ["hope-bright", "walk-p"], null], norm: { row: 0, ref: 236 }, tone: [4, 4] },
  // Passing steps (feet together between two strides) the first sheets lacked, and the scarf ant's diagonal walk.
  // Row 1 is laid out f/l/r/b, the rest diagonally. No row repeats the base art, so the tone compares the scarf ant's
  // passing step with its standing row.
  { file: "art/world/source/ants-pass.png", cols: ["fl", "bl", "br", "fr"], rowCols: { 0: ["f", "l", "r", "b"] },
    rows: [["hope", "walk-p"], ["neutral", "walk-p"], ["hope", "walk-a"], ["hope", "walk-b"], ["hope", "walk-p"]], norm: { row: 0, ref: 231 }, tone: [0, 4] },
  // Bright faces on the phone. Under a bright variant "sigh" is the relieved pose that replaces the sigh: head up, smiling,
  // phone lowered. Row 5 is the unchanged dull ant on the phone, used only as the tone reference. These cells have no
  // light cone, and softenGlow would grey the open eyes, so it is off. Row 4 was drawn about 5% smaller than row 3.
  { file: "art/world/source/ants-phone-bright.png", cols: ["f", "l", "r", "b"], glow: false, rowScale: { 3: 1.05 },
    rows: [["neutral-bright", "phone"], ["neutral-bright", "sigh"], ["hope-bright", "phone"], ["hope-bright", "sigh"], null], norm: { row: 0, ref: 237 }, tone: [4, 0] },
];
// Cells mirrored left-right while composing (the source sheet is untouched): the scarf tail was drawn on the other side
// from the ant's standing back view, so it would jump across its back when the pose changes.
const FLIP = new Set(["hope-bright.phone.b"]);
export function flipCell(png, [x, y, w, h]) {
  for (let py = y; py < y + h; py++) for (let a = x, b = x + w - 1; a < b; a++, b--) for (let c = 0; c < 4; c++) {
    const i = (py * png.width + a) * 4 + c, j = (py * png.width + b) * 4 + c, value = png.data[i];
    png.data[i] = png.data[j]; png.data[j] = value;
  }
}
// Hand-fixed anchors by frame key (px from the cell's left edge), e.g. { "fear.phone.l": 84 }.
const AX = {};

export const readPng = (file) => PNG.sync.read(readFileSync(file));

// A sheet without transparency gets its flat background keyed out: flood-fill from the borders with the corner colour.
export function keyBackground(png) {
  const { width: W, height: H, data } = png, total = W * H;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 90) clear++;
  if (clear >= total * .05) return { keyed: false, pockets: 0 };
  const corners = [0, W - 1, (H - 1) * W, total - 1].map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  const key = [0, 1, 2].map((c) => corners.map((v) => v[c]).sort((a, b) => a - b)[1]);
  const match = (p) => Math.max(Math.abs(data[p * 4] - key[0]), Math.abs(data[p * 4 + 1] - key[1]), Math.abs(data[p * 4 + 2] - key[2])) <= KEY_TOLERANCE;
  const seen = new Uint8Array(total), stack = new Int32Array(total);
  let top = 0;
  const push = (p) => { if (!seen[p] && match(p)) { seen[p] = 1; stack[top++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (top) {
    const p = stack[--top], x = p % W;
    data[p * 4 + 3] = 0;
    if (x > 0) push(p - 1);
    if (x < W - 1) push(p + 1);
    if (p >= W) push(p - W);
    if (p < total - W) push(p + W);
  }
  let pockets = 0;
  for (let p = 0; p < total; p++) if (!seen[p] && match(p)) pockets++;
  return { keyed: true, key, pockets };
}

// Occupied runs of a projection, grouped into n bands by cutting at the n-1 widest empty gaps.
function bands(counts, from, to, n) {
  const runs = [];
  for (let i = from, start = -1; i <= to; i++) {
    const on = i < to && counts[i] > NOISE;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { runs.push([start, i]); start = -1; }
  }
  if (runs.length < n) return { found: runs.length, list: [] };
  const gaps = runs.slice(1).map((run, i) => ({ after: i, size: run[0] - runs[i][1] })).sort((a, b) => b.size - a.size || a.after - b.after);
  const cuts = new Set(gaps.slice(0, n - 1).map((gap) => gap.after)), list = [];
  for (let i = 0, start = runs[0][0]; i < runs.length; i++) if (cuts.has(i) || i === runs.length - 1) { list.push([start, runs[i][1]]); start = runs[i + 1]?.[0] ?? 0; }
  return { found: runs.length, list, cut: n > 1 ? gaps[n - 2].size : 0, spare: gaps[n - 1]?.size ?? 0 };
}

const median = (values) => { const s = [...values].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// Splits a sheet into rows x cols cells. Returns { cells: [row][col] = [x, y, w, h], errors, notes }.
export function segment(png, cols, rows) {
  const { width: W, height: H, data } = png, errors = [], notes = [], cells = [];
  const background = keyBackground(png);
  if (background.keyed) notes.push(`opaque sheet: keyed background rgb(${background.key.join(",")})${background.pockets ? `, ${background.pockets} px of that colour remain in enclosed pockets` : ""}`);
  const solid = (x, y) => data[(y * W + x) * 4 + 3] > ALPHA;
  const project = (x0, x1, y0, y1, alongY) => {
    const counts = new Int32Array(alongY ? H : W);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (solid(x, y)) counts[alongY ? y : x]++;
    return counts;
  };
  const ambiguous = (split, label) => { if (split.spare && split.spare >= split.cut * .5) errors.push(`${label}: a leftover ${split.spare} px gap is close to the ${split.cut} px split gap (more ${label.startsWith("rows") ? "rows" : "columns"} than expected, or a detached part)`); };
  const rowSplit = bands(project(0, W, 0, H, true), 0, H, rows);
  if (!rowSplit.list.length) return { cells, errors: [`rows: found ${rowSplit.found} separate band(s), expected ${rows}`], notes };
  ambiguous(rowSplit, "rows");
  rowSplit.list.forEach(([y0, y1], r) => {
    const colSplit = bands(project(0, W, y0, y1, false), 0, W, cols);
    if (!colSplit.list.length) { errors.push(`row ${r + 1}: found ${colSplit.found} separate column(s), expected ${cols} (merged or missing cells)`); cells.push([]); return; }
    ambiguous(colSplit, `row ${r + 1} columns`);
    cells.push(colSplit.list.map(([x0, x1], c) => {
      const ys = project(x0, x1, y0, y1, true);
      let top = y0, bottom = y1;
      while (top < bottom && ys[top] <= NOISE) top++;
      while (bottom > top && ys[bottom - 1] <= NOISE) bottom--;
      if (x0 <= 0 || top <= 0 || x1 >= W || bottom >= H) errors.push(`r${r + 1}c${c + 1}: touches the sheet edge`);
      const x = Math.max(0, x0 - PAD), y = Math.max(0, top - PAD);
      return [x, y, Math.min(W, x1 + PAD) - x, Math.min(H, bottom + PAD) - y];
    }));
  });
  const all = cells.flat(), midW = median(all.map((cell) => cell[2])), midH = median(all.map((cell) => cell[3]));
  cells.forEach((row, r) => {
    const mid = median(row.map((cell) => cell[3]));
    row.forEach((cell, c) => {
      if (Math.abs(cell[3] - mid) > mid * .15) errors.push(`r${r + 1}c${c + 1}: height ${cell[3]} is more than 15% off the row median ${mid}`);
      if (cell[2] > midW * 1.7 || cell[3] > midH * 1.7) errors.push(`r${r + 1}c${c + 1}: ${cell[2]}x${cell[3]} is far larger than the sheet median ${midW}x${midH} (merged cells)`);
      if (cell[2] < midW * .4 || cell[3] < midH * .4) errors.push(`r${r + 1}c${c + 1}: ${cell[2]}x${cell[3]} is far smaller than the sheet median ${midW}x${midH} (fragment)`);
    });
  });
  if (!errors.length && all.length !== cols * rows) errors.push(`found ${all.length} cells, expected ${cols * rows}`);
  return { cells, errors, notes };
}

// Anchor: the x that stands on the ant's floor position, in px from the cell's left edge. It is the centre of mass of
// the opaque pixels. The feet themselves are no use: in a walk frame the lowest rows hold whichever foot is down (and
// sometimes a suitcase), so a feet median swings 35..114 px between frames and the sprite would shake sideways.
export function bodyAnchor(png, [x, y, w, h]) {
  let sum = 0, count = 0;
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) if (png.data[(py * png.width + px) * 4 + 3] > ALPHA) { sum += px - x + .5; count++; }
  return count ? Math.round(sum / count) : Math.round(w / 2);
}

// Where the ant stands: the middle of the opaque span of the lowest 5% of the cell (both boots), in px from its left edge.
export function stance(png, [x, y, w, h]) {
  let low = w, high = -1;
  for (let py = y + h - PAD - Math.round(h * .05); py < y + h; py++) for (let px = x; px < x + w; px++) if (png.data[(py * png.width + px) * 4 + 3] > ALPHA) { low = Math.min(low, px - x); high = Math.max(high, px - x + 1); }
  return high < 0 ? w / 2 : (low + high) / 2;
}

// Mean colour of the opaque pixels of some cells, and a per-channel gain applied to a whole sheet (in memory only).
export function meanColour(png, cells) {
  const sum = [0, 0, 0];
  let count = 0;
  for (const [x, y, w, h] of cells) for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    const i = (py * png.width + px) * 4;
    if (png.data[i + 3] > ALPHA) { sum[0] += png.data[i]; sum[1] += png.data[i + 1]; sum[2] += png.data[i + 2]; count++; }
  }
  return sum.map((value) => count ? value / count : 0);
}
export function applyGain(png, gain) {
  for (let i = 0; i < png.data.length; i += 4) for (let c = 0; c < 3; c++) png.data[i + c] = Math.min(255, Math.round(png.data[i + c] * gain[c]));
}
// Phone frames were painted with a near-white light cone between the screen and the face. At in-game size that reads as
// a face mask, so the pale, non-warm pixels of those cells are pulled down to a dim teal screen glow.
const GLOW = { from: 95, range: 50, tint: [50, 94, 96] };
export function softenGlow(png, [x, y, w, h]) {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    const i = (py * png.width + px) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], light = .3 * r + .6 * g + .1 * b;
    if (png.data[i + 3] <= ALPHA || b < r - 4 || light <= GLOW.from) continue;
    const t = Math.min(1, (light - GLOW.from) / GLOW.range);
    for (let c = 0; c < 3; c++) png.data[i + c] = Math.max(0, Math.min(255, Math.round(png.data[i + c] * (1 - t) + (GLOW.tint[c] + (png.data[i + c] - 200) * .25) * t)));
  }
}

// A copy reduced to num/den of the size (box filter over the opaque pixels; a pixel stays where at least half of it was
// covered). Frame rects are not rewritten: the renderer addresses the atlas in fractions of its size, and every cell
// keeps a transparent margin wider than one reduced pixel, so neighbours cannot bleed in.
export function shrink(png, num, den) {
  const W = png.width * num / den, H = png.height * num / den, out = new PNG({ width: W, height: H }), step = den / num;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = x * step, x1 = x0 + step, y0 = y * step, y1 = y0 + step, sum = [0, 0, 0];
    let cover = 0;
    for (let sy = Math.floor(y0); sy < y1; sy++) for (let sx = Math.floor(x0); sx < x1; sx++) {
      const i = (sy * png.width + sx) * 4, weight = (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0));
      if (png.data[i + 3] > ALPHA) { cover += weight; for (let c = 0; c < 3; c++) sum[c] += png.data[i + c] * weight; }
    }
    if (cover < step * step / 2) continue;
    const o = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(sum[c] / cover);
    out.data[o + 3] = 255;
  }
  return out;
}

// One shared palette for the whole atlas: 255 colours plus transparent, so the PNG stores one byte per pixel instead of
// four. Median cut over the colours in use, then a few rounds of k-means; no dithering (it would add noise to flat
// areas and compress worse). The ants are a handful of browns, a blue-grey and an amber, which is why 255 is enough.
export function quantize(png, colours = 255) {
  const data = png.data, bins = new Map();
  for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { const key = (data[i] >> 3) << 10 | (data[i + 1] >> 3) << 5 | data[i + 2] >> 3; bins.set(key, (bins.get(key) ?? 0) + 1); }
  const points = [...bins].map(([key, count]) => [(key >> 10) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4, count]);
  const weight = (box) => box.reduce((sum, point) => sum + point[3], 0);
  const boxes = [points];
  while (boxes.length < colours) {
    let pick = -1, score = 0, axis = 0;
    boxes.forEach((box, b) => {
      if (box.length < 2) return;
      const mass = Math.sqrt(weight(box));
      for (let c = 0; c < 3; c++) { let low = 255, high = 0; for (const point of box) { low = Math.min(low, point[c]); high = Math.max(high, point[c]); } const value = (high - low) * mass * [1, 1.4, .8][c]; if (value > score) { score = value; pick = b; axis = c; } }
    });
    if (pick < 0) break;
    const box = boxes[pick].sort((a, b) => a[axis] - b[axis]), half = weight(box) / 2;
    let cut = 1;
    for (let i = 0, seen = 0; i < box.length - 1; i++) { seen += box[i][3]; if (seen >= half) { cut = i + 1; break; } }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }
  let palette = boxes.map((box) => [0, 1, 2].map((c) => box.reduce((sum, point) => sum + point[c] * point[3], 0) / weight(box)));
  const nearest = (r, g, b) => { let pick = 0, least = Infinity; for (let p = 0; p < palette.length; p++) { const d = (palette[p][0] - r) ** 2 + (palette[p][1] - g) ** 2 + (palette[p][2] - b) ** 2; if (d < least) { least = d; pick = p; } } return pick; };
  for (let round = 0; round < 4; round++) {
    const sums = palette.map(() => [0, 0, 0, 0]);
    for (const [r, g, b, count] of points) { const sum = sums[nearest(r, g, b)]; sum[0] += r * count; sum[1] += g * count; sum[2] += b * count; sum[3] += count; }
    palette = palette.map((colour, p) => sums[p][3] ? sums[p].slice(0, 3).map((value) => value / sums[p][3]) : colour);
  }
  palette = palette.map((colour) => colour.map(Math.round));
  const index = new Uint8Array(png.width * png.height), known = new Map();
  let error = 0, max = 0, count = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (!data[i + 3]) continue; // index 0 is transparent
    const key = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
    let pick = known.get(key);
    if (pick === undefined) known.set(key, pick = nearest(data[i], data[i + 1], data[i + 2]));
    index[p] = pick + 1;
    for (let c = 0; c < 3; c++) { const off = Math.abs(palette[pick][c] - data[i + c]); error += off; max = Math.max(max, off); count++; }
  }
  return { palette, index, mean: count ? error / count : 0, max };
}
// Palette PNG (colour type 3, 8 bit, entry 0 transparent). pngjs cannot write one, so the few chunks are built here.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
export function encodeIndexed(width, height, palette, index) {
  const chunk = (type, body) => {
    const data = Buffer.alloc(12 + body.length);
    data.writeUInt32BE(body.length); data.write(type, 4, "latin1"); body.copy(data, 8);
    let crc = -1;
    for (const byte of data.subarray(4, 8 + body.length)) crc = CRC[(crc ^ byte) & 255] ^ (crc >>> 8);
    data.writeUInt32BE((crc ^ -1) >>> 0, 8 + body.length);
    return data;
  };
  const head = Buffer.alloc(13), rows = Buffer.alloc((width + 1) * height); // each row starts with filter type 0
  head.writeUInt32BE(width); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 3;
  for (let y = 0; y < height; y++) rows.set(index.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("PLTE", Buffer.from([0, 0, 0, ...palette.flat()])),
    chunk("tRNS", Buffer.from([0])), chunk("IDAT", deflateSync(rows, { level: 9, memLevel: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const report = (cells) => cells.map((row, r) => `  row ${r + 1} (median h ${median(row.map((cell) => cell[3]))}): ${row.map((cell) => `[${cell.join(",")}]`).join(" ")}`).join("\n");
const fail = (title, errors) => { console.error(`${title}\n${errors.map((error) => `  - ${error}`).join("\n")}`); process.exit(1); };

function check(file, cols, rows) {
  const png = readPng(file), result = segment(png, cols, rows);
  console.log(`${file}: ${png.width}x${png.height}, expecting ${cols}x${rows}`);
  result.notes.forEach((note) => console.log(`  note: ${note}`));
  if (result.cells.length) console.log(report(result.cells));
  if (result.errors.length) fail(`FAIL ${basename(file)}`, result.errors);
  console.log(`OK ${result.cells.flat().length} cells`);
}

function build(sourceDir, outDir) {
  const atlas = JSON.parse(readFileSync(join(ROOT, JSON_PATH), "utf8")), base = readPng(join(ROOT, BASE_IMAGE));
  const frames = {}, extras = [];
  const add = (key, sheet, rect, k, anchor) => {
    if (frames[key]) fail("FAIL manifest", [`duplicate frame ${key}`]);
    frames[key] = { sheet, rect, k, ax: AX[key] ?? (anchor === "center" ? Math.round(rect[2] / 2) : bodyAnchor(sheet, rect)) };
  };
  // 1. Base frames straight from the existing cells: ants.png is not re-segmented.
  BASE.rows.forEach(([variant, pose, anchor], r) => BASE.cols.forEach((dir, c) => add(`${variant}.${pose}.${dir}`, base, atlas.cells[r][c], 1, anchor)));
  // 2-6. Extra sheets: decode, key, segment, validate, normalise, anchor.
  for (const sheet of SHEETS) {
    const file = sourceDir ? join(sourceDir, basename(sheet.file)) : join(ROOT, sheet.file);
    if (!existsSync(file)) { console.log(`skip ${sheet.file} (not found)`); continue; }
    const png = readPng(file), result = segment(png, sheet.cols.length, sheet.rows.length);
    console.log(`${file}: ${png.width}x${png.height}`);
    result.notes.forEach((note) => console.log(`  note: ${note}`));
    if (result.errors.length) fail(`FAIL ${sheet.file}\n${report(result.cells)}`, result.errors);
    if (sheet.tone) {
      const [row, baseRow, col, baseCol] = sheet.tone, pick = (cells, c) => c === undefined ? cells : [cells[c]];
      const want = meanColour(base, pick(atlas.cells[baseRow], baseCol)), have = meanColour(png, pick(result.cells[row], col));
      const gain = want.map((value, c) => Math.max(.6, Math.min(1.4, have[c] ? value / have[c] : 1)));
      applyGain(png, gain);
      console.log(`  tone gain ${gain.map((value) => value.toFixed(3)).join(" ")}`);
    }
    if (sheet.glow !== false) sheet.rows.forEach((row, r) => { if (row && row[1] === "phone") result.cells[r].forEach((cell) => softenGlow(png, cell)); });
    const raw = sheet.rows[sheet.norm.row] ? sheet.norm.ref / median(result.cells[sheet.norm.row].map((cell) => cell[3])) : 1;
    const k = raw >= .97 && raw <= 1.03 ? 1 : Math.round(raw * 1000) / 1000;
    let count = 0;
    sheet.rows.forEach((row, r) => row && (sheet.rowCols?.[r] ?? sheet.cols).forEach((col, c) => {
      if (!col) return;
      const [dir, pose = row[1]] = col.split("@").reverse(), key = `${row[0]}.${pose}.${dir}`;
      if (sheet.skip?.includes(key)) return;
      if (FLIP.has(key)) flipCell(png, result.cells[r][c]);
      add(key, png, result.cells[r][c], Math.round(k * (sheet.rowScale?.[r] ?? 1) * 1000) / 1000, row[2]); count++;
    }));
    extras.push(sheet.file);
    console.log(`  ${count} frames, k ${k}`);
  }
  // A look-up (or its in-between) alternates with the standing frame of the same direction while the ant stays put, so its
  // anchor is set to keep the boots where the standing frame has them. The centre of mass alone moves when the head tips
  // back or an arm comes up, and the ant would step sideways each time it raised its head. The fear ant's suitcase hangs
  // at boot height, so its cells are in AX by hand.
  for (const [key, frame] of Object.entries(frames)) {
    const [variant, pose, dir] = key.split(".");
    if ((pose !== "look" && pose !== "tilt") || AX[key] !== undefined) continue;
    const still = frames[`${variant}.idle.${dir}`] ?? frames[`${variant.replace("-bright", "")}.idle.${dir}`];
    if (still) frame.ax = Math.round(stance(frame.sheet, frame.rect) - (stance(still.sheet, still.rect) - still.ax));
  }
  // 7. Compose. With extra sheets every frame, the 20 base cells included, is shelf-packed with PAD px between cells;
  // `cells` keeps describing ants.png itself, which the CSS scenes use. Copying ants.png whole to a corner of the atlas,
  // as before, left 0.9 megapixels of it empty. The width is the one that gives the smallest area (a multiple of
  // SMALL.den, so the reduced copy below lands on whole pixels).
  let width = base.width, height = base.height, image = `/${BASE_IMAGE.replace(/^public\//, "")}`, out = null, small = null;
  const placed = Object.entries(frames).map(([key, frame]) => ({ key, ...frame, at: [frame.rect[0], frame.rect[1]] }));
  if (extras.length) {
    const loose = [...placed].sort((a, b) => b.rect[3] - a.rect[3] || b.rect[2] - a.rect[2]);
    const pack = (wide, commit) => {
      let x = PAD, y = PAD, shelf = 0;
      for (const frame of loose) {
        if (x + frame.rect[2] + PAD > wide) { y += shelf + PAD; x = PAD; shelf = 0; }
        if (commit) frame.at = [x, y];
        x += frame.rect[2] + PAD; shelf = Math.max(shelf, frame.rect[3]);
      }
      return Math.ceil((y + shelf + PAD) / SMALL.den) * SMALL.den;
    };
    let best = Infinity;
    for (let wide = 1500; wide <= MAX_SIZE; wide += SMALL.den) { const tall = pack(wide, false); if (tall <= MAX_SIZE && wide * tall < best) { best = wide * tall; width = wide; height = tall; } }
    if (!Number.isFinite(best)) fail("FAIL compose", [`the frames do not fit in ${MAX_SIZE}x${MAX_SIZE}`]);
    pack(width, true);
    out = new PNG({ width, height });
    for (const frame of loose) PNG.bitblt(frame.sheet, out, frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3], frame.at[0], frame.at[1]);
    // The renderer cuts alpha at .35 (the same ALPHA) and ignores the rest, so alpha becomes 0 or 255 and hidden pixels are cleared.
    for (let i = 0; i < out.data.length; i += 4) { if (out.data[i + 3] <= ALPHA) out.data.fill(0, i, i + 4); else out.data[i + 3] = 255; }
    image = `/${ATLAS_IMAGE.replace(/^public\//, "")}`;
    small = shrink(out, SMALL.num, SMALL.den);
  }
  // Legacy fields keep their exact text; image and frames are appended, one frame per line.
  const legacy = JSON.stringify({ ...atlas, width, height, image: undefined, small: undefined, frames: undefined }, null, 2).replace(/\n}$/, "");
  const lines = placed.map((frame) => `    ${JSON.stringify(frame.key)}: [${[...frame.at, frame.rect[2], frame.rect[3], frame.k, frame.ax].join(", ")}]`);
  const smallImage = image.replace(/\.png$/, "-small.png");
  const text = `${legacy},\n  "image": ${JSON.stringify(image)},${small ? `\n  "small": ${JSON.stringify({ image: smallImage, width: small.width, height: small.height })},` : ""}\n  "frames": {\n${lines.join(",\n")}\n  }\n}\n`;
  const jsonOut = outDir ? join(outDir, basename(JSON_PATH)) : join(ROOT, JSON_PATH), imageOut = outDir ? join(outDir, basename(ATLAS_IMAGE)) : join(ROOT, ATLAS_IMAGE);
  if (outDir) mkdirSync(outDir, { recursive: true });
  for (const [file, png] of out ? [[imageOut, out], [imageOut.replace(/\.png$/, "-small.png"), small]] : []) {
    const indexed = quantize(png), bytes = encodeIndexed(png.width, png.height, indexed.palette, indexed.index);
    writeFileSync(file, bytes);
    console.log(`${file}: ${png.width}x${png.height}, ${bytes.length} bytes, ${indexed.palette.length} colours, mean error ${indexed.mean.toFixed(2)}/255 per channel (max ${indexed.max})`);
  }
  writeFileSync(jsonOut, text);
  console.log(`${jsonOut}: ${placed.length} frames, image ${image} ${width}x${height}${out ? "" : " (base only, no atlas image written)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const size = (name, fallback) => { const value = Number(option(name) ?? fallback); if (!Number.isInteger(value) || value < 1) fail("FAIL arguments", [`${name} must be a positive integer`]); return value; };
  if (args.includes("--check")) {
    const file = option("--check");
    if (!file || !existsSync(file)) fail("FAIL arguments", [`--check needs an existing PNG path, got ${file}`]);
    check(file, size("--cols", 4), size("--rows", 5));
  } else build(option("--source") && resolve(option("--source")), option("--out") && resolve(option("--out")));
}
