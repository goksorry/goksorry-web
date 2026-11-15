import { test, expect } from "@playwright/test";
import antAtlas from "../components/world/ant-atlas.json";
import { ANT_DIRS, CROWD, LEAN_DEAD, WALK_PHASE, antFrameCandidates, antWalkFrame, createCrowd, walkLift, walkPose, facing4, facing8, inView, leanOf, viewHalf, type AntPose, type AntVariant, type CrowdEnv, type CrowdView } from "../lib/world-crowd";
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

// What the renderer draws for a heading, resolved against the real atlas: the side the sprite ends up turned to.
// The art facts are restated here on purpose: these four "f" frames are drawn turned to the viewer's left, the rest right.
const ATLAS = antAtlas.frames as Record<string, unknown>, hasArt = (key: string) => key in ATLAS;
const DRAWN_LEFT = ["fear.idle.f", "fear.sigh.f", "fear.walk-b.f", "hope.walk-b.f"];
const shown = (variant: AntVariant, pose: AntPose, hx: number, hz: number, lean: number, walking = true) => {
  const dir4 = facing4(hx, hz), step = walking ? antWalkFrame(hasArt, variant, pose, facing8(hx, hz), dir4) : { pose, dir8: facing8(hx, hz) };
  const found = antFrameCandidates(variant, step.pose, step.dir8, dir4, lean).find((c) => hasArt(c.key))!;
  const dir = found.key.split(".")[2], drawn = dir === "f" ? (DRAWN_LEFT.includes(found.key) ? -1 : 1) : dir.endsWith("l") ? -1 : dir.endsWith("r") ? 1 : 0;
  return { ...found, dir, side: found.mirror ? -drawn : drawn };
};
const at = (degree: number) => ({ hx: Math.sin(degree * Math.PI / 180), hz: Math.cos(degree * Math.PI / 180) }); // 0 = straight toward the camera, positive = viewer's right

test("an ant walking toward the camera turns to the side it is heading, in every costume", () => {
  for (const variant of ["neutral", "fear", "hope"] as const) for (const pose of ["walk-a", "walk-b", "walk-p"] as const) {
    for (let degree = -89; degree <= 89; degree++) {
      const { hx, hz } = at(degree);
      if (Math.abs(hx) <= LEAN_DEAD) continue;
      // Whatever side it leaned to before, a heading outside the dead zone decides.
      for (const before of [-1, 1]) {
        const frame = shown(variant, pose, hx, hz, leanOf(hx, before));
        expect(frame.side, `${variant}.${pose} at ${degree} deg -> ${frame.key}${frame.mirror ? " mirrored" : ""}`).toBe(degree < 0 ? -1 : 1);
        expect(frame.key.startsWith(`${variant}.`), `${variant} keeps its costume at ${degree} deg (${frame.key})`).toBe(true);
      }
    }
    // Straight down has no side of its own: it shows the camera-facing frame turned to the ant's remembered side.
    for (const lean of [-1, 1]) { const frame = shown(variant, pose, 0, 1, lean); expect(frame.dir).toBe("f"); expect(frame.side).toBe(lean); }
  }
  // The cases from the report: down-left and down-right, 45 degrees off.
  expect(shown("neutral", "walk-a", -1, 1, -1)).toMatchObject({ key: "neutral.walk-a.fl", mirror: false });
  expect(shown("neutral", "walk-a", 1, 1, 1)).toMatchObject({ key: "neutral.walk-a.fr", mirror: false });
  for (const variant of ["fear", "hope"] as const) {
    expect(shown(variant, "walk-a", -.6, .8, -1)).toMatchObject({ key: `${variant}.walk-a.f`, mirror: true });
    expect(shown(variant, "walk-a", .6, .8, 1)).toMatchObject({ key: `${variant}.walk-a.f`, mirror: false });
    // The second stride is drawn the other way round, so it is the one mirrored when heading right.
    expect(shown(variant, "walk-b", -.6, .8, -1)).toMatchObject({ key: `${variant}.walk-b.f`, mirror: false });
    expect(shown(variant, "walk-b", .6, .8, 1)).toMatchObject({ key: `${variant}.walk-b.f`, mirror: true });
  }
  // Standing poses that face the camera follow the same side; lean 0 leaves every frame as drawn.
  for (const variant of ["neutral", "fear", "hope"] as const) for (const pose of ["idle", "phone", "sigh"] as const) for (const lean of [-1, 1]) {
    expect(shown(variant, pose, 0, 1, lean, false).side, `${variant}.${pose} lean ${lean}`).toBe(lean);
  }
  for (const variant of ["neutral", "fear", "hope"] as const) for (const pose of ["idle", "walk-a", "walk-b", "walk-p", "phone", "sigh"] as const) for (let dir = 0; dir < 8; dir += 2) {
    expect(antFrameCandidates(variant, pose, dir, dir, 0).every((c) => !c.mirror || c.key.endsWith(".l") || c.key.endsWith(".r"))).toBe(true);
    // Sideways and away from the camera the side makes no difference.
    if (dir) expect(antFrameCandidates(variant, pose, dir, dir, -1)).toEqual(antFrameCandidates(variant, pose, dir, dir, 1));
  }
});

test("the side holds inside the dead zone instead of flipping from frame to frame", () => {
  // A heading that wobbles around straight down keeps whichever side it had.
  for (const start of [-1, 1]) {
    let lean = start;
    for (let i = 0; i < 400; i++) {
      lean = leanOf(Math.sin(i * 1.7) * LEAN_DEAD * .99, lean);
      expect(lean).toBe(start);
    }
  }
  // A slow sweep from left to right and back flips once each way, and only past the far edge of the dead zone.
  let lean = -1, flips = 0;
  const sweep = [...Array.from({ length: 201 }, (_, i) => -1 + i / 100), ...Array.from({ length: 201 }, (_, i) => 1 - i / 100)];
  for (const hx of sweep) {
    const next = leanOf(hx, lean);
    if (next !== lean) { flips++; expect(Math.abs(hx)).toBeGreaterThan(LEAN_DEAD); expect(next).toBe(Math.sign(hx)); }
    lean = next;
  }
  expect(flips).toBe(2);
  expect(leanOf(0, 0)).toBe(1); // unset reads as the art's own side

  // In the running crowd: a side only changes on a step that really heads that way, both sides occur among the ants
  // that face the camera, and standing ants never change side.
  const crowd = createCrowd(11), e = env();
  crowd.sync(20, e);
  expect(new Set(crowd.ants.map((a) => a.lean)).size).toBe(2); // not everyone starts on the same side
  let before = crowd.ants.map((a) => ({ lean: a.lean, walking: a.state === "walk" })), changes = 0, standingFlips = 0, wrong = 0;
  const facing = { left: 0, right: 0 }, standing = { left: 0, right: 0 };
  run(crowd, 180, e, () => {
    crowd.ants.forEach((a, i) => {
      if (Math.abs(a.lean) !== 1) wrong++;
      // Only a walking step changes the side (the step that arrives already shows the next standing state).
      if (a.lean !== before[i].lean) { changes++; if (!before[i].walking && a.state !== "walk") standingFlips++; }
      // The side follows the drawn facing (fx), which trails the heading by a few frames through a turn.
      if (a.state === "walk" && a.moved && Math.abs(a.fx) > LEAN_DEAD && a.lean !== Math.sign(a.fx)) wrong++;
      if (facing4(a.hx, a.hz) === 0) { const tally = a.state === "walk" ? facing : standing; if (a.lean < 0) tally.left++; else tally.right++; }
    });
    before = crowd.ants.map((a) => ({ lean: a.lean, walking: a.state === "walk" }));
  });
  expect(standingFlips).toBe(0);
  expect(wrong).toBe(0);
  note(`lean: ${changes} side changes in 180 s for 20 ants; camera-facing walk frames left ${facing.left} / right ${facing.right}, standing left ${standing.left} / right ${standing.right}`);
  expect(changes).toBeGreaterThan(0);
  for (const tally of [facing, standing]) {
    expect(tally.left / (tally.left + tally.right)).toBeGreaterThan(.25);
    expect(tally.left / (tally.left + tally.right)).toBeLessThan(.75);
  }
});

// Regression: "the legs do not move". Seen from the side the two stride frames are the same scissor of legs, so a walk
// that only alternates them (as hope ants, diagonal neutral ants and the visitor did) looks like sliding.
test("every costume and heading walks stride, feet together, other stride, feet together", () => {
  const feet = (key: string) => key.split(".")[1];
  for (const variant of ["neutral", "fear", "hope"] as const) for (let dir8 = 0; dir8 < 8; dir8++) {
    const { hx, hz } = at(dir8 * -45), dir4 = facing4(hx, hz), lean = hx < 0 ? -1 : 1;
    for (const [speed, dt, phase] of [[.85, 1 / 60, WALK_PHASE], [1.35, 1 / 30, WALK_PHASE], [1.35, 1 / 18, WALK_PHASE], [1.1, 1 / 30, WALK_PHASE * .6], [3, 1 / 30, .36]] as const) {
      const keys: string[] = [];
      for (let stride = 0, step = 0; step < Math.round(4 / dt); step++, stride += speed * dt) {
        const walk = antWalkFrame(hasArt, variant, walkPose(stride, phase), dir8, dir4);
        keys.push(antFrameCandidates(variant, walk.pose, walk.dir8, dir4, lean).find((c) => hasArt(c.key))!.key);
      }
      const runs = keys.reduce<{ key: string; n: number }[]>((all, key) => { const last = all[all.length - 1]; if (last?.key === key) last.n++; else all.push({ key, n: 1 }); return all; }, []);
      const label = `${variant} ${ANT_DIRS[dir8]} at ${speed}/s, ${Math.round(1 / dt)} fps`;
      // Its own costume in one direction throughout: three different pictures, never a neutral or turned stand-in.
      expect(new Set(keys).size, label).toBe(3);
      expect(keys.every((key) => key.startsWith(`${variant}.`)), label).toBe(true);
      expect(new Set(keys.map((key) => key.split(".")[2])).size, label).toBe(1);
      // Strides alternate and there is a feet-together frame between every two of them.
      runs.forEach((run, i) => {
        if (i + 2 >= runs.length) return;
        const [now, next, after] = [feet(run.key), feet(runs[i + 1].key), feet(runs[i + 2].key)];
        if (now === "walk-a" || now === "walk-b") { expect(["walk-p", "idle"], `${label}: ${now} then ${next}`).toContain(next); expect(after, label).toBe(now === "walk-a" ? "walk-b" : "walk-a"); }
        else expect(["walk-a", "walk-b"], `${label}: ${now} then ${next}`).toContain(next);
      });
      // No frame is held for longer than a phase (plus one rendered frame), so the legs never freeze.
      expect(Math.max(...runs.map((run) => run.n)) * dt, label).toBeLessThanOrEqual(phase / speed + dt + EPS);
    }
  }
  // The body is lowest in the middle of a stride frame and highest as the feet pass.
  expect(walkLift(WALK_PHASE * .5)).toBeCloseTo(0); expect(walkLift(WALK_PHASE * 1.5)).toBeCloseTo(1); expect(walkLift(WALK_PHASE * 2.5)).toBeCloseTo(0);
});

test("walkers in the simulation keep stepping and do not flicker between directions", () => {
  for (const [seed, count, view, front] of [[5, 20, WIDE, 7], [9, 12, { cx: 0, halfW: 3.25, camZ: 27.115, dist: 32, zoomed: true }, 4.6]] as const) {
    const e = env({ view, front }), crowd = createCrowd(seed);
    crowd.sync(count, e);
    const held = crowd.ants.map(() => 0), last = crowd.ants.map((a) => a.pose), turned = crowd.ants.map(() => [] as { step: number; from: string }[]), dirs = crowd.ants.map((a) => `${a.dir8}/${a.dir4}/${a.lean}`);
    let longest = 0, flicker = 0, walked = 0, astray = 0, rawFlicker = 0;
    const raw = crowd.ants.map((a) => ({ dir: facing8(a.hx, a.hz), step: -99, before: -1 }));
    run(crowd, 240, e, (step) => crowd.ants.forEach((a, i) => {
      const walking = a.state === "walk" && a.moved;
      if (walking) walked++;
      held[i] = walking && a.pose === last[i] ? held[i] + 1 : 0; last[i] = a.pose;
      longest = Math.max(longest, held[i]);
      const dir = `${a.dir8}/${a.dir4}/${a.lean}`;
      if (dir !== dirs[i]) {
        // Going back to a direction it left less than a fifth of a second ago is a flicker; a turn only moves on.
        if (a.state === "walk" && turned[i].some((t) => t.from === dir && step - t.step < 6)) flicker++;
        turned[i].push({ step, from: dirs[i] }); if (turned[i].length > 6) turned[i].shift();
        dirs[i] = dir;
      }
      // For comparison: the same count on the unsteadied heading, which is what used to be drawn.
      const heading = facing8(a.hx, a.hz), r = raw[i];
      if (heading !== r.dir) { if (a.state === "walk" && heading === r.before && step - r.step < 6) rawFlicker++; r.before = r.dir; r.step = step; r.dir = heading; }
      // Standing ants face exactly where they look.
      if (a.state !== "walk" && (a.dir8 !== facing8(a.hx, a.hz) || a.dir4 !== facing4(a.hx, a.hz))) astray++;
    }));
    expect(astray).toBe(0);
    note(`seed ${seed}: walking ant-steps ${walked}, longest held pose ${(longest * DT).toFixed(2)} s, direction flickers ${flicker} (the raw heading would give ${rawFlicker})`);
    expect(walked).toBeGreaterThan(1000);
    expect(longest * DT).toBeLessThanOrEqual(WALK_PHASE / .85 + DT + EPS);
    expect(flicker).toBe(0);
  }
});

// "When resting, ants often look UP at the wall": a wall gazer alternates between a level gaze and looking up.
test("wall gazers look up about half the time, a few seconds at a go, each on its own clock", () => {
  for (const [count, e] of [[20, env()], [12, env({ restless: true })], [20, env({ hopeful: true })]] as const) {
    const crowd = createCrowd(5); crowd.sync(count, e);
    let gazing = 0, up = 0, together = 0, longest = 0, flips = 0, stray = 0;
    const held = crowd.ants.map(() => 0); let before = crowd.ants.map((a) => `${a.state}.${a.pose}`);
    run(crowd, 240, e, () => {
      let moved = 0;
      crowd.ants.forEach((a, i) => {
        // Only a standing wall gazer looks up, and only with its back to the camera, where the art exists.
        if (a.pose === "look") { up++; if (a.state !== "gaze" || a.dir8 < 3 || a.dir8 > 5) stray++; }
        if (a.state === "gaze") gazing++;
        // A head move: the same stand, the other pose.
        if (a.state === "gaze" && before[i].startsWith("gaze.") && before[i] !== `gaze.${a.pose}`) moved++;
        held[i] = a.pose === "look" ? held[i] + DT : 0; longest = Math.max(longest, held[i]);
      });
      if (moved) flips++; if (moved >= Math.max(4, count / 4)) together++;
      before = crowd.ants.map((a) => `${a.state}.${a.pose}`);
    });
    note(`${count} ants${e.restless ? " restless" : e.hopeful ? " hopeful" : ""}: looking up ${(up / gazing * 100).toFixed(1)}% of gaze time, longest ${longest.toFixed(1)} s, ${flips} head moves`);
    expect(stray).toBe(0);
    expect(up / gazing).toBeGreaterThan(.38); expect(up / gazing).toBeLessThan(.62);
    expect(longest).toBeGreaterThan(3); expect(longest).toBeLessThanOrEqual(6 + DT + EPS);
    expect(flips).toBeGreaterThan(count * 5);
    expect(together).toBe(0); // never a wave of heads: four or more (a quarter of the crowd) moving in the same thirtieth of a second
  }
  // Deterministic, and the head timing has its own random stream: where and when ants walk does not depend on it.
  const poses = (seed: number) => { const crowd = createCrowd(seed), log: string[] = []; crowd.sync(20, env()); run(crowd, 60, env(), () => log.push(crowd.ants.map((a) => a.pose[0]).join(""))); return log; };
  expect(poses(3)).toEqual(poses(3)); expect(poses(3)).not.toEqual(poses(4));
});

test("a hopeful index takes fewer phones out and changes nothing else about the walk", () => {
  const busy = (hopeful: boolean) => { const crowd = createCrowd(9), e = env({ hopeful }); crowd.sync(20, e); let n = 0, steps = 0; run(crowd, 600, e, () => { steps++; n += crowd.ants.filter((a) => a.state === "phone" || a.state === "sigh").length; }); return n / steps / 20; };
  const plain = busy(false), light = busy(true);
  note(`share of ants on the phone or sighing: ${(plain * 100).toFixed(1)}% -> hopeful ${(light * 100).toFixed(1)}%`);
  expect(light).toBeLessThan(plain * .75); expect(light).toBeGreaterThan(0);
});

test("looking up and the bright faces resolve to their own art and fall back without changing costume or direction", () => {
  const pick = (variant: AntVariant, pose: AntPose, dir8: number, dir4: number, bright = false, keys?: string[]) => antFrameCandidates(variant, pose, dir8, dir4, 0, bright).find((c) => keys ? keys.includes(c.key) : hasArt(c.key))!;
  for (const variant of ["neutral", "fear", "hope"] as const) for (const dir of [3, 4, 5]) {
    expect(pick(variant, "look", dir, 4)).toEqual({ key: `${variant}.look.${ANT_DIRS[dir]}`, mirror: false, posed: true });
    // Without the art: the same ant's level gaze in the same direction.
    expect(pick(variant, "look", dir, 4, false, Object.keys(ATLAS).filter((key) => !key.includes(".look.")))).toEqual({ key: `${variant}.idle.${ANT_DIRS[dir]}`, mirror: false, posed: false });
    expect(pick(variant, "look", dir, 4, true, BASE)?.key).toBe(`${variant}.idle.b`);
  }
  for (const variant of ["neutral", "hope"] as const) {
    for (const pose of ["idle", "walk-a", "walk-b", "walk-p"] as const) for (const dir of [0, 2, 4, 6]) expect(pick(variant, pose, dir, dir, true).key).toBe(`${variant}-bright.${pose}.${ANT_DIRS[dir]}`);
    for (const dir of [3, 4, 5]) expect(pick(variant, "look", dir, 4, true).key).toBe(`${variant}-bright.look.${ANT_DIRS[dir]}`);
    // No bright art: the plain frame of the same pose and direction, not a bright frame of another one.
    for (const dir of [1, 3, 5, 7]) expect(pick(variant, "idle", dir, dir - 1, true).key).toBe(`${variant}.idle.${ANT_DIRS[dir]}`);
    for (const dir of [0, 2, 4, 6]) expect(pick(variant, "phone", dir, dir, true).key).toBe(`${variant}.phone.${ANT_DIRS[dir]}`);
    // Not bright: never a bright frame.
    for (const pose of ["idle", "walk-a", "walk-b", "walk-p", "phone", "sigh", "look"] as const) for (let dir = 0; dir < 8; dir++) expect(antFrameCandidates(variant, pose, dir, dir % 2 ? dir - 1 : dir).some((c) => c.key.includes("-bright"))).toBe(false);
  }
  // The fear ant has no bright form.
  for (const pose of ["idle", "walk-a", "walk-b", "walk-p", "phone", "sigh", "look"] as const) for (let dir = 0; dir < 8; dir++) expect(antFrameCandidates("fear", pose, dir, dir % 2 ? dir - 1 : dir, 1, true)).toEqual(antFrameCandidates("fear", pose, dir, dir % 2 ? dir - 1 : dir, 1));
});

// The art facts for the bright sheets: both passing steps are drawn turned to the viewer's left, the rest right.
const BRIGHT_LEFT = ["neutral-bright.walk-p.f", "hope-bright.walk-p.f"];
test("a bright ant keeps one face, one costume and one direction through a walk cycle, and turns the way it heads", () => {
  for (const variant of ["neutral", "hope"] as const) for (let dir8 = 0; dir8 < 8; dir8++) {
    const { hx, hz } = at(dir8 * -45), dir4 = facing4(hx, hz), lean = hx < 0 ? -1 : 1, keys: string[] = [];
    for (let stride = 0; stride < 4; stride += WALK_PHASE / 3) {
      const walk = antWalkFrame(hasArt, variant, walkPose(stride), dir8, dir4, true);
      const found = antFrameCandidates(variant, walk.pose, walk.dir8, dir4, lean, walk.bright).find((c) => hasArt(c.key))!;
      keys.push(found.key);
      if (found.key.endsWith(".f")) expect((BRIGHT_LEFT.includes(found.key) ? -1 : 1) * (found.mirror ? -1 : 1), `${found.key} lean ${lean}`).toBe(lean);
    }
    const label = `${variant} ${ANT_DIRS[dir8]}: ${[...new Set(keys)].join(" ")}`;
    expect(new Set(keys).size, label).toBe(3);
    expect(new Set(keys.map((key) => key.split(".")[0])).size, label).toBe(1);
    expect(new Set(keys.map((key) => key.split(".")[2])).size, label).toBe(1);
    // Toward the camera and sideways the bright face shows; a neutral ant heading away on a diagonal keeps its plain diagonal walk.
    expect(keys[0].split(".")[0], label).toBe(variant === "neutral" && (dir8 === 3 || dir8 === 5) ? "neutral" : `${variant}-bright`);
  }
  for (const variant of ["neutral", "hope"] as const) for (const lean of [-1, 1]) expect(antFrameCandidates(variant, "idle", 0, 0, lean, true)[0]).toEqual({ key: `${variant}-bright.idle.f`, mirror: lean < 0, posed: true });
  // Fear walks exactly as before under a hopeful index.
  for (let dir8 = 0; dir8 < 8; dir8++) for (const pose of ["walk-a", "walk-b", "walk-p"] as const) {
    const dir4 = dir8 % 2 ? dir8 - 1 : dir8;
    expect(antWalkFrame(hasArt, "fear", pose, dir8, dir4, true)).toEqual({ ...antWalkFrame(hasArt, "fear", pose, dir8, dir4), bright: false });
  }
});
