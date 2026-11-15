// Builds components/world/ant-atlas.json (v2) and, when extra sprite sheets exist, public/world/ant-atlas.png.
//   node scripts/build-ant-atlas.mjs                       base frames + every sheet found in art/world/source
//   node scripts/build-ant-atlas.mjs --check <png> [--cols 4 --rows 5]   segment and validate one sheet, write nothing
//   --source <dir>  look for the manifest sheets (by file name) in another directory; an empty one gives the base-only result
//   --out <dir>     write ant-atlas.json / ant-atlas.png there instead of into the repo (dry run)
// public/world/ants.png is never modified: it is copied verbatim to (0,0) of the composed atlas so legacy `cells` stay valid.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { PNG } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = "components/world/ant-atlas.json", BASE_IMAGE = "public/world/ants.png", ATLAS_IMAGE = "public/world/ant-atlas.png";
const ALPHA = 89, PAD = 2, NOISE = 1, KEY_TOLERANCE = 28, MAX_SIZE = 4096;

// Base sheet layout (ants.png). Rows are [variant, pose, anchor?]; anchor "center" replaces the body anchor with the cell centre.
const BASE = { cols: ["f", "l", "r", "b"], rows: [["neutral", "idle"], ["neutral", "walk-a"], ["neutral", "walk-b"], ["fear", "idle"], ["hope", "idle"]] };
// Extra sheets. A missing file is skipped. A null in cols or rows drops that column or row (the runtime mirrors or falls back).
// norm: k = ref / median cell height of that row, snapped to 1 within 3%. The refs are the heights these sheets came out
// at, because their heads measure the same as the base sheet's: the bowed or mid-step poses are simply shorter.
// tone: [sheet row, base row] showing the same character. The generated sheets came out paler than ants.png, so each is
// multiplied per channel until that row's mean colour equals the base row's; otherwise an ant changes shade between frames.
const SHEETS = [
  { file: "art/world/source/ants-diagonal.png", cols: ["fl", "bl", "br", "fr"],
    rows: [["neutral", "idle"], ["neutral", "walk-a"], ["neutral", "walk-b"], ["fear", "idle"], ["hope", "idle"]], norm: { row: 0, ref: 228 }, tone: [0, 0] },
  { file: "art/world/source/ants-phone.png", cols: ["f", "l", "r", "b"],
    rows: [["neutral", "phone"], ["neutral", "sigh"], ["fear", "phone"], ["hope", "phone"], ["hope", "sigh"]], norm: { row: 0, ref: 234 }, tone: [1, 0] },
  { file: "art/world/source/ants-walk.png", cols: ["f", "l", "r", "b"],
    rows: [null, null, ["hope", "walk-a"], ["hope", "walk-b"], ["neutral", "walk-p"]], norm: { row: 4, ref: 217 }, tone: [4, 0] },
  // Fear walk cycle and sigh. It replaces rows 1-2 of ants-walk.png, whose two strides were nearly identical (the ant slid).
  // Row 5 is a neutral idle ant used only as the tone reference.
  { file: "art/world/source/ants-fear.png", cols: ["f", "l", "r", "b"],
    rows: [["fear", "walk-a"], ["fear", "walk-b"], ["fear", "walk-p"], ["fear", "sigh"], null], norm: { row: 4, ref: 228 }, tone: [4, 0] },
];
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
      const want = meanColour(base, atlas.cells[sheet.tone[1]]), have = meanColour(png, result.cells[sheet.tone[0]]);
      const gain = want.map((value, c) => Math.max(.6, Math.min(1.4, have[c] ? value / have[c] : 1)));
      applyGain(png, gain);
      console.log(`  tone gain ${gain.map((value) => value.toFixed(3)).join(" ")}`);
    }
    sheet.rows.forEach((row, r) => { if (row && row[1] === "phone") result.cells[r].forEach((cell) => softenGlow(png, cell)); });
    const raw = sheet.rows[sheet.norm.row] ? sheet.norm.ref / median(result.cells[sheet.norm.row].map((cell) => cell[3])) : 1;
    const k = raw >= .97 && raw <= 1.03 ? 1 : Math.round(raw * 1000) / 1000;
    let count = 0;
    sheet.rows.forEach((row, r) => row && sheet.cols.forEach((dir, c) => { if (dir) { add(`${row[0]}.${row[1]}.${dir}`, png, result.cells[r][c], k, row[2]); count++; } }));
    extras.push(sheet.file);
    console.log(`  ${count} frames, k ${k}`);
  }
  // 7. Compose: base sheet at (0,0), extra cells shelf-packed below it with PAD px between them.
  let width = base.width, height = base.height, image = `/${BASE_IMAGE.replace(/^public\//, "")}`, out = null;
  const placed = Object.entries(frames).map(([key, frame]) => ({ key, ...frame, at: frame.sheet === base ? [frame.rect[0], frame.rect[1]] : null }));
  if (extras.length) {
    const loose = placed.filter((frame) => !frame.at).sort((a, b) => b.rect[3] - a.rect[3]);
    width = Math.max(width, ...loose.map((frame) => frame.rect[2] + PAD * 2));
    let x = PAD, y = base.height + PAD, shelf = 0;
    for (const frame of loose) {
      if (x + frame.rect[2] + PAD > width) { x = PAD; y += shelf + PAD; shelf = 0; }
      frame.at = [x, y]; x += frame.rect[2] + PAD; shelf = Math.max(shelf, frame.rect[3]);
    }
    height = y + shelf + PAD;
    if (width > MAX_SIZE || height > MAX_SIZE) fail("FAIL compose", [`atlas ${width}x${height} exceeds ${MAX_SIZE}`]);
    out = new PNG({ width, height });
    PNG.bitblt(base, out, 0, 0, base.width, base.height, 0, 0);
    for (const frame of loose) PNG.bitblt(frame.sheet, out, frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3], frame.at[0], frame.at[1]);
    // Shrink the download without changing what the renderer draws: it cuts alpha at .35 (the same ALPHA) and ignores the
    // rest, so alpha becomes 0 or 255 and hidden pixels are cleared. The generated cells also drop to 5 bits per channel
    // (at most 4/255 off); the base sheet's colours stay exact, so the other scenes render as before.
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3] <= ALPHA) { out.data.fill(0, i, i + 4); continue; }
      out.data[i + 3] = 255;
      if (i >= base.height * width * 4) for (let c = 0; c < 3; c++) out.data[i + c] = (out.data[i + c] & 0xF8) | (out.data[i + c] >> 5);
    }
    image = `/${ATLAS_IMAGE.replace(/^public\//, "")}`;
  }
  // Legacy fields keep their exact text; image and frames are appended, one frame per line.
  const legacy = JSON.stringify({ ...atlas, width, height, image: undefined, frames: undefined }, null, 2).replace(/\n}$/, "");
  const lines = placed.map((frame) => `    ${JSON.stringify(frame.key)}: [${[...frame.at, frame.rect[2], frame.rect[3], frame.k, frame.ax].join(", ")}]`);
  const text = `${legacy},\n  "image": ${JSON.stringify(image)},\n  "frames": {\n${lines.join(",\n")}\n  }\n}\n`;
  const jsonOut = outDir ? join(outDir, basename(JSON_PATH)) : join(ROOT, JSON_PATH), imageOut = outDir ? join(outDir, basename(ATLAS_IMAGE)) : join(ROOT, ATLAS_IMAGE);
  if (outDir) mkdirSync(outDir, { recursive: true });
  if (out) writeFileSync(imageOut, PNG.sync.write(out));
  writeFileSync(jsonOut, text);
  console.log(`${jsonOut}: ${placed.length} frames, image ${image} ${width}x${height}${out ? `\n${imageOut}: written` : " (base only, no atlas image written)"}`);
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
