import { test, expect } from "@playwright/test";
import { ANT_DIRS, CROWD, antFrameCandidates, createCrowd, facing4, facing8, inView, viewHalf, type AntPose, type AntVariant, type CrowdEnv, type CrowdView } from "../lib/world-crowd";
import { walkable, worldObstacles } from "../lib/world-navigation";

const DT = 1 / 30, EPS = 1e-6, obstacles = worldObstacles("plaza");
const WIDE: CrowdView = { cx: 0, halfW: 11.6, camZ: 27.115, dist: 32, zoomed: false };
const env = (over: Partial<CrowdEnv> = {}): CrowdEnv => ({ obstacles, front: 7, visitor: { x: 0, z: .4 }, view: WIDE, ...over });
const spots = (crowd: ReturnType<typeof createCrowd>) => crowd.ants.map((a) => ({ x: a.x, z: a.z }));
const run = (crowd: ReturnType<typeof createCrowd>, seconds: number, e: CrowdEnv, each?: (step: number) => void) => {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) { crowd.step(DT, e); each?.(i); }
};
// Largest per-step displacement of any ant, for the no-teleport checks.
const tracker = (crowd: ReturnType<typeof createCrowd>) => {
  let before = spots(crowd), worst = 0;
  return { each: () => { const now = spots(crowd); now.forEach((p, i) => { if (before[i]) worst = Math.max(worst, Math.hypot(p.x - before[i].x, p.z - before[i].z)); }); before = now; }, worst: () => worst };
};
const BASE = ANT_DIRS.filter((_, i) => i % 2 === 0).flatMap((d) => [`neutral.idle.${d}`, `neutral.walk-a.${d}`, `neutral.walk-b.${d}`, `fear.idle.${d}`, `hope.idle.${d}`]);
// Measured values go into the report as annotations, not onto the console.
const note = (description: string) => test.info().annotations.push({ type: "crowd", description });
const resolve = (keys: string[], variant: AntVariant, pose: AntPose, dir8: number, dir4: number) => antFrameCandidates(variant, pose, dir8, dir4).find((c) => keys.includes(c.key));

test("crowd is deterministic for a seed and differs between seeds", () => {
  const make = (seed: number) => { const crowd = createCrowd(seed); crowd.sync(20, env()); run(crowd, 600 * DT, env()); return crowd.ants; };
  expect(make(7)).toEqual(make(7));
  expect(make(7)).not.toEqual(make(8));
  expect(make(7)).toHaveLength(20);
});

test("ants stay on the walkable floor at the full and the shortest front", () => {
  for (const front of [7, .8]) {
    const e = env({ front }), crowd = createCrowd(3);
    crowd.sync(20, e);
    let bad = 0;
    const check = () => { for (const a of crowd.ants) if (!walkable(a, obstacles, .3) || Math.abs(a.x) > CROWD.side + EPS || a.z < CROWD.back - EPS || a.z > front - .35 + EPS) bad++; };
    check(); run(crowd, 120, e, check);
    expect(bad, `front ${front}`).toBe(0);
  }
});

test("ants cover the visible floor instead of the old strip under the wall", () => {
  const e = env(), crowd = createCrowd(11);
  crowd.sync(20, e);
  const zBins = new Set<number>(), xBins = new Set<number>();
  let seen = 0, total = 0, strip = -1;
  run(crowd, 180, e, (step) => {
    for (const a of crowd.ants) {
      total++; if (inView(a, WIDE)) seen++;
      zBins.add(Math.min(5, Math.floor((a.z - CROWD.back) / (6.65 - CROWD.back) * 6)));
      const nx = (a.x - WIDE.cx) / viewHalf(WIDE, a.z);
      if (Math.abs(nx) <= 1) xBins.add(Math.min(5, Math.floor((nx + 1) / 2 * 6)));
    }
    if (step === Math.round(60 / DT) - 1) strip = crowd.ants.filter((a) => a.z >= -1.7 && a.z <= .5).length / crowd.ants.length;
  });
  note(`in-view share ${(seen / total).toFixed(3)}, old-strip share at 60 s ${strip.toFixed(3)}, z bins ${zBins.size}, x bins ${xBins.size}`);
  expect([...zBins].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  expect([...xBins].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  expect(seen / total).toBeGreaterThanOrEqual(.85);
  expect(strip).toBeGreaterThanOrEqual(0);
  expect(strip).toBeLessThan(.4);
});

for (const restless of [false, true]) test(`most ants gaze at the wall; a few at a time check the phone and then sigh (${restless ? "mixed" : "calm"} mood)`, () => {
  const e = env({ restless }), crowd = createCrowd(5);
  crowd.sync(20, e);
  let gazing = 0, phoning = 0, total = 0, phones = 0, sighs = 0, orphanSighs = 0, strayGaze = 0, busiest = 0, stalePose = 0;
  let before = crowd.ants.map((a) => a.state);
  const busy = () => { busiest = Math.max(busiest, crowd.ants.filter((a) => a.state === "phone" || a.state === "sigh").length); };
  busy();
  run(crowd, 240, e, () => {
    busy();
    crowd.ants.forEach((a, i) => {
      if (a.state === "walk" && (a.pose === "phone" || a.pose === "sigh")) stalePose++;
      total++;
      const dir = facing8(a.hx, a.hz);
      if (a.state === "gaze") { if (dir >= 3 && dir <= 5) gazing++; else strayGaze++; if (facing4(a.hx, a.hz) !== 4) strayGaze++; }
      if (a.state === "phone" || a.state === "sigh") phoning++;
      if (a.state === "phone" && before[i] !== "phone") phones++;
      if (a.state === "sigh" && before[i] !== "sigh") { sighs++; if (before[i] !== "phone") orphanSighs++; }
      if (a.state === "sigh") expect(a.pose).toBe("sigh");
      before[i] = a.state;
    });
  });
  note(`wall-gaze share ${(gazing / total).toFixed(3)}, phone+sigh share ${(phoning / total).toFixed(3)}, phone entries ${phones}, sigh entries ${sighs}, most at once ${busiest}`);
  expect(gazing / total).toBeGreaterThanOrEqual(.65);
  expect(busiest).toBeLessThanOrEqual(Math.round(20 * CROWD.busy));
  expect(stalePose).toBe(0);
  expect(phoning / total).toBeGreaterThanOrEqual(.03);
  expect(phoning / total).toBeLessThanOrEqual(.25);
  expect(phones).toBeGreaterThan(0); expect(sighs).toBeGreaterThan(0);
  expect(orphanSighs).toBe(0); expect(strayGaze).toBe(0);
});

test("a shrinking front makes ants walk out without teleporting", () => {
  const crowd = createCrowd(9);
  crowd.sync(20, env());
  run(crowd, 30, env());
  const stranded = crowd.ants.filter((a) => a.z > 1.65), standing = stranded.filter((a) => a.state !== "walk").length;
  expect(stranded.length).toBeGreaterThan(3); expect(standing).toBeGreaterThan(0);
  const e = env({ front: 2 }), moves = tracker(crowd);
  let cleared = -1;
  run(crowd, 20, e, (step) => { moves.each(); if (cleared < 0 && crowd.ants.every((a) => a.z <= 1.65 + EPS)) cleared = (step + 1) * DT; });
  note(`front 7 -> 2: ${stranded.length} ants outside (${standing} standing), all inside after ${cleared.toFixed(2)} s, max step ${moves.worst().toFixed(5)} (limit ${(1.35 * DT).toFixed(5)})`);
  expect(moves.worst()).toBeLessThanOrEqual(1.35 * DT + EPS);
  expect(Math.max(...crowd.ants.map((a) => a.z))).toBeLessThanOrEqual(1.65 + EPS);
});

test("population sync keeps the retained ants and spawns valid new ones", () => {
  const e = env(), crowd = createCrowd(2);
  crowd.sync(20, e); run(crowd, 10, e);
  const first = spots(crowd).slice(0, 12);
  crowd.sync(12, e);
  expect(spots(crowd)).toEqual(first);
  crowd.sync(20, e);
  expect(crowd.ants).toHaveLength(20);
  expect(spots(crowd).slice(0, 12)).toEqual(first);
  for (const a of crowd.ants.slice(12)) {
    expect(walkable(a, obstacles, CROWD.radius)).toBe(true);
    expect(a.z).toBeGreaterThanOrEqual(CROWD.back); expect(a.z).toBeLessThanOrEqual(6.65); expect(Math.abs(a.x)).toBeLessThanOrEqual(CROWD.side);
    expect(Math.min(...crowd.ants.filter((o) => o !== a).map((o) => Math.hypot(o.x - a.x, o.z - a.z)))).toBeGreaterThanOrEqual(CROWD.gap);
  }
  const moves = tracker(crowd);
  run(crowd, 5, e, moves.each);
  expect(moves.worst()).toBeLessThanOrEqual(1.35 * DT + EPS);
  crowd.sync(0, e); expect(crowd.ants).toHaveLength(0);
});

test("the zoomed phone view keeps most ants in the watched section and follows a swipe", () => {
  const side: CrowdView = { ...WIDE, cx: 7, halfW: 3.35, zoomed: true }, middle = { ...side, cx: 0 };
  const e = env({ view: side }), crowd = createCrowd(4);
  crowd.sync(12, e);
  let seen = 0, steps = 0;
  run(crowd, 120, e, (step) => { if (step >= Math.round(60 / DT)) { steps++; seen += crowd.ants.filter((a) => inView(a, side)).length; } });
  const moves = tracker(crowd), next = env({ view: middle });
  let reached = -1, count = 0;
  run(crowd, 30, next, (step) => { moves.each(); count = crowd.ants.filter((a) => inView(a, middle)).length; if (reached < 0 && count >= 7) reached = (step + 1) * DT; });
  note(`zoomed: ${(seen / steps).toFixed(2)} of 12 in view (60-120 s); after swipe 7 in view at ${reached.toFixed(2)} s, ${count} at 30 s`);
  expect(seen / steps).toBeGreaterThanOrEqual(7);
  expect(12 - seen / steps).toBeGreaterThanOrEqual(1);
  expect(moves.worst()).toBeLessThanOrEqual(1.35 * DT + EPS);
  expect(reached).toBeGreaterThan(0);
});

test("ants keep a body's distance from each other and from a standing visitor", () => {
  const e = env(), crowd = createCrowd(6);
  crowd.sync(20, e);
  let pair = Infinity, visitor = Infinity, piled = 0, hiding = 0, steps = 0;
  const check = () => {
    steps++;
    crowd.ants.forEach((a, i) => {
      visitor = Math.min(visitor, Math.hypot(a.x - e.visitor.x, a.z - e.visitor.z));
      for (let j = i + 1; j < crowd.ants.length; j++) {
        const b = crowd.ants[j];
        pair = Math.min(pair, Math.hypot(a.x - b.x, a.z - b.z));
        // Two standing sprites on top of each other: less than a sprite's width apart and close in depth.
        if (a.state !== "walk" && b.state !== "walk" && Math.abs(a.x - b.x) < .8 && Math.abs(a.z - b.z) < 1) piled++;
      }
      // A standing ant right in front of the visitor hides it.
      if (a.state !== "walk" && Math.abs(a.x - e.visitor.x) < .7 && a.z > e.visitor.z && a.z - e.visitor.z < 2.5) hiding++;
    });
  };
  check(); run(crowd, 120, e, check);
  note(`min pairwise distance ${pair.toFixed(3)}, min visitor distance ${visitor.toFixed(3)}, piled standing pairs per step ${(piled / steps).toFixed(3)}, ants hiding the visitor per step ${(hiding / steps).toFixed(3)}`);
  expect(pair).toBeGreaterThanOrEqual(.3);
  expect(visitor).toBeGreaterThanOrEqual(.3);
  expect(piled / steps).toBeLessThan(.25);
  expect(hiding / steps).toBeLessThan(.1);
});

test("frame lookup falls back to the base frames and prefers exact art", () => {
  for (const variant of ["neutral", "fear", "hope"] as const) for (const pose of ["idle", "walk-a", "walk-b", "walk-p", "phone", "sigh"] as const) for (let dir = 0; dir < 8; dir++) {
    for (const dir4 of dir % 2 ? [(dir + 1) % 8, dir - 1] : [dir]) expect(resolve(BASE, variant, pose, dir, dir4), `${variant}.${pose}.${dir}/${dir4}`).toBeTruthy();
  }
  expect(resolve(BASE, "fear", "idle", 3, 4)).toEqual({ key: "fear.idle.b", mirror: false, posed: true });
  // Regression for the visitor rule: without diagonal art the 4-way direction decides.
  expect(resolve(BASE, "neutral", "walk-a", 3, 4)?.key).toBe("neutral.walk-a.b");
  expect(resolve(BASE, "neutral", "walk-a", 3, 2)?.key).toBe("neutral.walk-a.l");
  expect(resolve(BASE, "fear", "walk-b", 6, 6)).toEqual({ key: "neutral.walk-b.r", mirror: false, posed: true });
  expect(resolve(BASE, "neutral", "phone", 0, 0)).toEqual({ key: "neutral.idle.f", mirror: false, posed: false });
  expect(resolve(BASE, "neutral", "walk-p", 2, 2)).toEqual({ key: "neutral.idle.l", mirror: false, posed: false });
  expect(resolve(BASE, "fear", "sigh", 0, 0)).toEqual({ key: "fear.idle.f", mirror: false, posed: false });
  expect(resolve([...BASE, "fear.phone.f", "neutral.sigh.f"], "fear", "sigh", 0, 0)?.key).toBe("fear.phone.f");
  expect(resolve(["neutral.idle.l"], "neutral", "idle", 6, 6)).toEqual({ key: "neutral.idle.l", mirror: true, posed: true });
  expect(resolve(["neutral.idle.r"], "hope", "idle", 2, 2)).toEqual({ key: "neutral.idle.r", mirror: true, posed: true });
  expect(resolve([...BASE, "neutral.idle.br"], "neutral", "idle", 3, 4)).toEqual({ key: "neutral.idle.br", mirror: true, posed: true });
  const full = (["neutral", "fear", "hope"] as const).flatMap((v) => (["idle", "walk-a", "walk-b", "walk-p", "phone", "sigh"] as const).flatMap((p) => ANT_DIRS.map((d) => `${v}.${p}.${d}`)));
  for (const key of full) {
    const [variant, pose, dir] = key.split(".") as [AntVariant, AntPose, (typeof ANT_DIRS)[number]], dir8 = ANT_DIRS.indexOf(dir);
    expect(antFrameCandidates(variant, pose, dir8, dir8 % 2 ? dir8 - 1 : dir8)[0]).toEqual({ key, mirror: false, posed: true });
  }
});

test("facing4 matches the renderer's visitor rule and facing8 the eight sprite directions", () => {
  for (let degree = 0; degree < 360; degree++) {
    const dx = Math.cos((degree + .5) * Math.PI / 180), dz = Math.sin((degree + .5) * Math.PI / 180);
    const direction = Math.abs(dx) > Math.abs(dz) ? dx < 0 ? 1 : 2 : dz < 0 ? 3 : 0; // hd2d-renderer visitor rule
    expect(facing4(dx, dz)).toBe([0, 2, 6, 4][direction]);
  }
  expect([[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]].map(([dx, dz]) => facing8(dx, dz))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});
