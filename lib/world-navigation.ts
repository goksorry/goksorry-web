import type { WorldScene } from "./world";
export type Point = { x: number; z: number };
export type Obstacle = { x: number; z: number; width: number; depth: number };
export const WORLD_BOUNDS = { left: -10, right: 10, back: -3.5, front: 7 };
/** Low doorways cut into the plaza's back wall, one under each panel column: the opening is `half` either side of the door's x
 * and `height` tall, its metal lintel ends under the panel frames (1.58), and a name plate hangs over the lintel and the top `plate`
 * of the opening (a low door has no wall above it for one). An ant
 * stands at `approachZ` to use a door and goes in to `insideZ`, then `hideX` sideways behind a pier (from the camera's height
 * an ant stays visible through the opening, so only the wall beside it hides it). */
export const PLAZA_DOOR = { half: .6, height: 1.42, lintel: .1, plate: .3, approachZ: -2.9, insideZ: -5.85, hideX: 1.2 } as const;
/** Plaza doorways to the other scenes: the floor point in front of each door. The centre pair stays inside the zoomed middle section. */
export const PLAZA_ENTRANCES: { scene: Exclude<WorldScene, "plaza">; name: string; x: number; z: number }[] = [
  { scene: "ecosystem", name: "개미 생태계", x: -6.5, z: PLAZA_DOOR.approachZ }, { scene: "broadcast", name: "재난방송", x: -2.3, z: PLAZA_DOOR.approachZ },
  { scene: "theater", name: "개미극장", x: 2.3, z: PLAZA_DOOR.approachZ }, { scene: "battle", name: "심리 전장", x: 6.5, z: PLAZA_DOOR.approachZ }
];
/** Through a door from the floor in front of it: up to the threshold, inside, then sideways (`side`) behind a pier. Reverse it to come out. */
export const plazaDoorWay = (e: Point, side: -1 | 1 = 1): Point[] =>
  [{ x: e.x, z: -3.2 }, { x: e.x, z: PLAZA_DOOR.insideZ }, { x: e.x + side * PLAZA_DOOR.hideX, z: PLAZA_DOOR.insideZ }];
/** A finished touch gesture as a wall-section step: a quick, mostly horizontal swipe to the left shows the section
 * to the right (+1), to the right the one to the left (-1); anything else (a tap, a slow drag, a vertical swipe) is 0. */
export const swipeStep = (dx: number, dy: number, ms: number): -1 | 0 | 1 =>
  Math.abs(dx) >= 48 && Math.abs(dx) > 1.5 * Math.abs(dy) && ms <= 700 ? (dx < 0 ? 1 : -1) : 0;
/** The plaza door the visitor stands at (in the strip of floor right in front of it), if any. */
export const entranceAt = (scene: WorldScene, at: Point) =>
  scene === "plaza" ? PLAZA_ENTRANCES.find((e) => Math.abs(e.x - at.x) < 1 && at.z < e.z + 1.3) ?? null : null;
/** A door mouth: the floor in front of a door that standing ants keep clear. */
export const inDoorway = (p: Point) => PLAZA_ENTRANCES.some((e) => Math.abs(p.x - e.x) < .9 && p.z < e.z + 1.2);
export function worldObstacles(scene: WorldScene): Obstacle[] {
  const sides = [{ x: -8.7, z: -.6, width: 2.3, depth: 4.5 }, { x: 8.7, z: -.6, width: 2.3, depth: 4.5 }];
  const crates = Array.from({ length: 8 }, (_, i) => ({ x: (i % 2 ? -1 : 1) * (8 + i % 3 * .45), z: 2.6 + i % 3 * .4, width: .7, depth: .5 }));
  const common = [...sides, ...crates];
  if (scene === "ecosystem") return [...common, ...Array.from({ length: 6 }, (_, i) => ({ x: -6.8 + i * 2.7, z: -3.6, width: 2.35, depth: 1.1 }))];
  if (scene === "battle") return [...common, { x: 0, z: .2, width: .9, depth: 3.4 }];
  if (scene === "broadcast") return [...common, { x: 0, z: -1, width: 6.5, depth: 3.5 }];
  if (scene === "theater") return [...common, { x: 0, z: -2, width: 10, depth: 3 }, ...Array.from({ length: 10 }, (_, i) => ({ x: -6 + i % 5 * 3, z: 4.6 + Math.floor(i / 5) * 1.7, width: 1.2, depth: .85 }))];
  return common;
}
export function walkable(point: Point, obstacles: Obstacle[], radius = .3): boolean {
  const b = WORLD_BOUNDS;
  return point.x >= b.left + radius && point.x <= b.right - radius && point.z >= b.back + radius && point.z <= b.front - radius
    && !obstacles.some((o) => Math.abs(point.x - o.x) < o.width / 2 + radius && Math.abs(point.z - o.z) < o.depth / 2 + radius);
}
export function clearSegment(a: Point, b: Point, obstacles: Obstacle[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .12));
  for (let i = 0; i <= steps; i++) if (!walkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, obstacles)) return false;
  return true;
}

// Bounded four-neighbour grid, followed by line-of-sight smoothing. No corner
// cutting and no teleport to a point behind a wall.
export function findWorldPath(start: Point, end: Point, obstacles: Obstacle[]): Point[] {
  if (!walkable(start, obstacles) || !walkable(end, obstacles)) return [];
  if (clearSegment(start, end, obstacles)) return [end];
  const step = .5;
  const nodes: Point[] = [];
  const ids = new Map<string, number>();
  for (let x = -9.5; x <= 9.5; x += step) for (let z = -3; z <= 6.5; z += step) {
    if (walkable({ x, z }, obstacles)) { ids.set(`${x},${z}`, nodes.length); nodes.push({ x, z }); }
  }
  const nearest = (p: Point) => nodes.map((n, i) => ({ i, distance: Math.hypot(p.x - n.x, p.z - n.z) }))
    .filter(({ i }) => clearSegment(p, nodes[i], obstacles)).sort((a, b) => a.distance - b.distance)[0]?.i;
  const first = nearest(start), last = nearest(end);
  if (first === undefined || last === undefined) return [];
  const queue = [first], previous = new Map<number, number>([[first, -1]]);
  for (let cursor = 0; cursor < queue.length && !previous.has(last); cursor++) {
    const i = queue[cursor], p = nodes[i];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = ids.get(`${p.x + dx},${p.z + dz}`);
      if (next !== undefined && !previous.has(next) && clearSegment(p, nodes[next], obstacles)) { previous.set(next, i); queue.push(next); }
    }
  }
  if (!previous.has(last)) return [];
  const path: Point[] = [end];
  for (let i = last; i !== -1; i = previous.get(i)!) path.unshift(nodes[i]);
  const smooth: Point[] = []; let origin = start;
  while (path.length) {
    let i = path.length - 1;
    while (i > 0 && !clearSegment(origin, path[i], obstacles)) i--;
    origin = path[i]; smooth.push(origin); path.splice(0, i + 1);
  }
  return smooth;
}
