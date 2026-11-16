import { test, expect } from "@playwright/test";
import { crowdCapacity, crowdDistribution, timelineY, timelineSegments, recentEvidence, worldHeadline, frameStatus } from "../lib/world-presentation";
import { buildWorldFrame, buildWorldReplay, worldSummary, type WorldSide } from "../lib/world";
import { findWorldPath, clearSegment, worldObstacles, walkable, entranceAt, plazaDoorWay, PLAZA_DOOR, PLAZA_ENTRANCES } from "../lib/world-navigation";
import { WALL_PANELS } from "../lib/world-wall";
import { worldRows } from "./world-fixture";

test("population follows full counts, including neutral, independent of representative lists", () => {
  const summary = { ...worldSummary([]), total: 100, bullish: 10, bearish: 65, neutral: 25 };
  expect(crowdDistribution(summary, 47)).toEqual({ bullish: 5, bearish: 30, neutral: 12 });
  expect(crowdDistribution(summary, 23)).toEqual({ bullish: 2, bearish: 15, neutral: 6 });
  expect(crowdDistribution({ ...summary, total: 3, bullish: 0, bearish: 0, neutral: 3 }, 47)).toEqual({ bullish: 0, bearish: 0, neutral: 3 });
  expect(crowdDistribution(worldSummary([]), 47)).toEqual({ bullish: 0, bearish: 0, neutral: 0 });
  const sparse = { ...summary, total: 1, bullish: 0, bearish: 1, neutral: 0 };
  expect(crowdDistribution(sparse, 47).bearish).toBe(1);
});
test("the plaza is a sparse crowd; other scenes keep the full population", () => {
  expect([crowdCapacity("plaza", false), crowdCapacity("plaza", true)]).toEqual([20, 12]);
  for (const scene of ["battle", "ecosystem", "broadcast", "theater"] as const) expect([crowdCapacity(scene, false), crowdCapacity(scene, true)]).toEqual([47, 23]);
});
test("latest evidence sorted across all three sides; no repeated or fabricated entries", () => {
  const frame = buildWorldFrame(worldRows());
  const recent = recentEvidence(frame.overall);
  expect(recent).toHaveLength(3);
  expect(new Set(recent.map((r) => r.post_key)).size).toBe(3);
  expect(recent.every((row, i) => i === 0 || recent[i - 1].analyzed_at >= row.analyzed_at)).toBeTruthy();
});
test("index 0, 5, 10 spans full graph and missing slots split segments", () => {
  expect([0, 5, 10].map(timelineY)).toEqual([60, 34, 8]);
  const frame = buildWorldFrame(worldRows());
  const replay = buildWorldReplay("2026-11-15", []);
  [0, 1, 3].forEach((slot, i) => { replay.slots[slot].frame = { ...frame, overall: { ...frame.overall, index: i * 5 } }; });
  const lines = timelineSegments(replay.slots);
  expect(lines).toHaveLength(2); expect(lines[0]).toContain(",60 "); expect(lines[0]).toContain(",34"); expect(lines[1]).toContain(",8");
});
test("headlines distinguish empty, neutral-only and sparse data from calm", () => {
  const rows = worldRows().slice(0, 4);
  expect(worldHeadline(worldSummary([]))).toBe("분석 표본 없음");
  expect(worldHeadline(worldSummary(rows.slice(0, 1)))).toBe("표본 부족");
  expect(worldHeadline(worldSummary(rows.map((r) => ({ ...r, label: "neutral" as WorldSide }))))).toContain("중립");
  const frame = buildWorldFrame(rows);
  expect(frameStatus(frame, false, "", Date.now())).toContain("최초");
  expect(frameStatus(frame, true, "503", Date.now())).toContain("마지막 정상");
  expect(frameStatus(frame, true, "", Date.now() + 1_800_000)).toContain("갱신 지연");
});
test("click paths go around barricades and never cut obstacle corners", () => {
  const obstacles = worldObstacles("battle"), start = { x: -2, z: 0 }, end = { x: 2, z: 0 };
  const path = findWorldPath(start, end, obstacles);
  expect(path.length).toBeGreaterThan(1); expect(path.at(-1)).toEqual(end);
  let from = start;
  for (const to of path) { expect(clearSegment(from, to, obstacles)).toBe(true); expect(walkable(to, obstacles)).toBe(true); from = to; }
  expect(findWorldPath(start, { x: 0, z: 0 }, obstacles)).toEqual([]);
  expect(findWorldPath(start, { x: 99, z: 99 }, obstacles)).toEqual([]);
  expect(walkable({ x: 3, z: 0 }, worldObstacles("broadcast"))).toBe(false);
  expect(walkable({ x: 0, z: 4.5 }, worldObstacles("theater"))).toBe(false);
  expect(walkable({ x: 8, z: 2.6 }, worldObstacles("plaza"))).toBe(false);
  for (const scene of ["plaza", "ecosystem", "battle", "broadcast", "theater"] as const) expect(walkable({ x: 0, z: 3.2 }, worldObstacles(scene))).toBe(true);
});

test("plaza doors stand under the panels, inside their zoomed sections, with a walkable floor in front", () => {
  const obstacles = worldObstacles("plaza"), frame = PLAZA_DOOR.half + .22; // opening plus the jambs
  const frames = [[-10.35, -3.65], [-3.35, 3.35], [3.65, 10.35]];
  for (const e of PLAZA_ENTRANCES) {
    expect(walkable(e, obstacles), e.scene).toBe(true);
    expect(entranceAt("plaza", { x: e.x, z: -3 })?.scene).toBe(e.scene);
    expect(entranceAt("plaza", { x: e.x, z: .4 })).toBeNull();
    for (const side of [-1, 1]) expect(entranceAt("plaza", { x: e.x + side * 1.2, z: e.z })).toBeNull();
    expect(entranceAt("ecosystem", e)).toBeNull();
    // The framed door fits one zoomed phone section and keeps clear of the side buildings.
    expect(frames.some(([a, b]) => e.x - frame >= a && e.x + frame <= b), e.scene).toBe(true);
    for (const o of obstacles.filter((o) => o.z - o.depth / 2 < e.z + 1.3)) expect(Math.abs(e.x - o.x)).toBeGreaterThanOrEqual(o.width / 2 + frame);
    // A low door: the lintel ends under the frame of the panel above it (frames reach .12 below a panel).
    const above = Object.values(WALL_PANELS).filter((p) => Math.abs(e.x - p.x) <= p.w / 2 && p.y - p.h / 2 < 3);
    expect(above, e.scene).toHaveLength(1);
    for (const p of above) { expect(e.x - frame).toBeGreaterThanOrEqual(p.x - p.w / 2 - .12); expect(e.x + frame).toBeLessThanOrEqual(p.x + p.w / 2 + .12); expect(PLAZA_DOOR.height + PLAZA_DOOR.lintel).toBeLessThan(p.y - p.h / 2 - .12); }
    // The way in ends sideways behind a pier: a sprite about .43 wide either side of its foot is out of the opening.
    const way = plazaDoorWay(e, 1), end = way[way.length - 1];
    expect(Math.abs(end.x - e.x) - .43).toBeGreaterThan(PLAZA_DOOR.half);
    expect(end.z).toBe(PLAZA_DOOR.insideZ); expect(walkable(way[0], obstacles)).toBe(true);
  }
  const sorted = PLAZA_ENTRANCES.map((e) => e.x).sort((a, b) => a - b);
  sorted.slice(1).forEach((x, i) => expect(x - sorted[i]).toBeGreaterThan(2 * frame + 2));
});
