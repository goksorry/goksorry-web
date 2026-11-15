import type { WorldScene } from "./world";
export type Point = { x: number; z: number };
export type Obstacle = { x: number; z: number; width: number; depth: number };
export const WORLD_BOUNDS = { left: -10, right: 10, back: -3.5, front: 7 };
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
