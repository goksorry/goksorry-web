import { clearSegment, findWorldPath, walkable, type Obstacle, type Point } from "./world-navigation";

// Plaza crowd: a pure, seeded simulation stepped by the renderer. No three.js and
// no Math.random, so captures and tests are deterministic.
export const ANT_DIRS = ["f", "fl", "l", "bl", "b", "br", "r", "fr"] as const; // 0 = toward camera (+z), 4 = toward wall
// "look" is standing with the head thrown back, looking up at the wall. It only exists seen from behind (b, bl, br).
// "tilt" is the in-between of idle and look (straight back view only), shown for a moment while the head moves.
// Under a bright variant the "sigh" frames are the relieved pose: head up, smiling, phone lowered.
export type AntPose = "idle" | "walk-a" | "walk-b" | "walk-p" | "phone" | "sigh" | "look" | "tilt";
export type AntVariant = "neutral" | "fear" | "hope";
// While the index is in the hope state, neutral and hope ants wear a brighter face: the same poses under these atlas
// variants, wherever that art exists. The fear ant has no bright form.
export const ANT_BRIGHT: Partial<Record<AntVariant, string>> = { neutral: "neutral-bright", hope: "hope-bright" };
export type CrowdState = "walk" | "gaze" | "phone" | "sigh";
export type CrowdAnt = { x: number; z: number; hx: number; hz: number; state: CrowdState; pose: AntPose;
  t: number; span: number; path: Point[]; goal: Point; speed: number; stride: number; wait: number; moved: boolean; rng: number;
  lean: number; // side a camera-facing sprite turns to: -1 the viewer's left, 1 the right (see leanOf)
  fx: number; fz: number; dir8: number; dir4: number; fresh: boolean; // the facing that is drawn: the heading, steadied (see `face`)
  eye: number; eyeRng: number; // seconds until a gazer next raises or lowers its head, and the private stream that times it
  nod: number }; // seconds left of the head movement that just started (see antGazePose)
export type CrowdView = { cx: number; halfW: number; camZ: number; dist: number; zoomed: boolean };
// `restless` (mixed index) shortens the stands; `hopeful` (index in the hope state) takes fewer phones out.
export type CrowdEnv = { obstacles: Obstacle[]; front: number; visitor: Point; view: CrowdView; restless?: boolean; hopeful?: boolean };
// gap is the least distance between standing spots; `wide` and `deep` stretch it to the sprite's footprint on screen (a
// sprite is about .85 wide, and one standing close in front of another hides it). `busy` caps the share on the phone at once.
export const CROWD = { back: -2.9, side: 9.4, radius: .35, gap: .7, wide: 1.1, deep: 1.3, pass: .45, visitorGap: 1.2, edge: .6, busy: .15, panels: [-7, 0, 7] };

export const facing8 = (dx: number, dz: number): number => ((Math.round(Math.atan2(-dx, dz) / (Math.PI / 4)) % 8) + 8) % 8;
// Same 4-way split as the visitor rule in hd2d-renderer, expressed as ANT_DIRS indices.
export const facing4 = (dx: number, dz: number): number => Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 2 : 6) : (dz < 0 ? 4 : 0);
// The camera-facing ("f") art is a three-quarter view, so it always turns to one side. `lean` says which: -1 the viewer's
// left, 1 the right. It follows the sideways part of the heading and holds its last value inside the dead zone (about 11
// degrees either side of straight toward the camera), so a walker heading almost straight down never flips back and forth.
export const LEAN_DEAD = .2;
export const leanOf = (hx: number, previous: number): number => Math.abs(hx) > LEAN_DEAD ? (hx < 0 ? -1 : 1) : previous < 0 ? -1 : 1;
// The visible floor is a trapezoid: half-width at depth z, minus a margin for the sprite.
export const viewHalf = (view: CrowdView, z: number): number => view.halfW * (view.camZ - z) / view.dist - CROWD.edge;
export const inView = (p: Point, view: CrowdView): boolean => Math.abs(p.x - view.cx) <= viewHalf(view, p.z);

const WALL_Z = -4.885, GAZE_ARC = 40 * Math.PI / 180, TOP_SPEED = 1.35, HARD = .36, SQUEEZE = .33, VISITOR_PASS = .6, EPS = 1e-9;
const SIDESTEPS = [50, -50, 90, -90, 130, -130].map((degree) => degree * Math.PI / 180);
// One walk cycle is two steps: stride, feet passing, the other stride, feet passing. In a side view the two strides
// look alike (both are the same scissor of dark legs), so the legs only read as moving through the passing frame
// between them. Each of the four frames lasts WALK_PHASE of floor, which makes a step .4: about the distance between
// the feet of a stride frame at the plaza sprite size, so the planted foot does not skate.
const WALK_CYCLE: AntPose[] = ["walk-a", "walk-p", "walk-b", "walk-p"];
export const WALK_PHASE = .2;
export const walkPose = (stride: number, phase = WALK_PHASE): AntPose => WALK_CYCLE[Math.floor(Math.max(0, stride) / phase) % 4];
// Height of the body through the cycle, 0..1: lowest in the middle of a stride frame, highest as the feet pass.
export const walkLift = (stride: number, phase = WALK_PHASE): number => .5 - .5 * Math.cos(Math.PI * (stride / phase - .5));
// The drawn facing follows the heading through a short low-pass and only leaves its current direction once the heading is
// clearly inside another one. A sidestep that alternates with the route, or a heading on the border between two
// directions, would otherwise swap the sprite's direction every frame.
const FACE_TAU = .18, FACE_KEEP8 = Math.PI / 8 + .16, FACE_KEEP4 = Math.PI / 4 + .2;
const DIR_ANGLE = (dir: number) => dir * Math.PI / 4; // angle of an ANT_DIRS index, as atan2(-x, z)
const off = (angle: number, dir: number) => Math.abs(Math.atan2(Math.sin(angle - DIR_ANGLE(dir)), Math.cos(angle - DIR_ANGLE(dir))));
export function face(a: CrowdAnt, dt: number, snap = false): void {
  const k = snap ? 1 : 1 - Math.exp(-dt / FACE_TAU);
  let fx = a.fx + (a.hx - a.fx) * k, fz = a.fz + (a.hz - a.fz) * k;
  const length = Math.hypot(fx, fz);
  if (length < .2) { fx = a.hx; fz = a.hz; } else { fx /= length; fz /= length; } // an about-turn passes through zero
  a.fx = fx; a.fz = fz;
  const angle = Math.atan2(-fx, fz);
  if (snap || off(angle, a.dir8) > FACE_KEEP8) a.dir8 = facing8(fx, fz);
  if (snap || off(angle, a.dir4) > FACE_KEEP4) a.dir4 = facing4(fx, fz);
  a.lean = leanOf(fx, a.lean);
}
// A wall gazer alternates between a level gaze and looking up, a few seconds each, so about half of the standing time
// is spent looking up. The timing has its own random stream: the walk and phone decisions are the same with or without it.
export const NOD = .15;
const EYE_MIN = 2.5, EYE_RANGE = 3.5, PHONE_CHANCE = .35, PHONE_CHANCE_HOPEFUL = .15;
const PHONE_FACING = [[.4, 0, 1], [.65, -1, 0], [.9, 1, 0], [2, 0, -1]];
const hash = (seed: number, index: number) => {
  let h = (seed ^ Math.imul(index + 1, 0x9E3779B1)) | 0;
  h = Math.imul(h ^ h >>> 16, 0x85EBCA6B); h = Math.imul(h ^ h >>> 13, 0xC2B2AE35);
  return (h ^ h >>> 16) | 0;
};
const roll = (a: CrowdAnt, stream: "rng" | "eyeRng") => { // mulberry32 on the ant's own state
  const state = a[stream] = (a[stream] + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const rand = (a: CrowdAnt) => roll(a, "rng");
const eyeSpan = (a: CrowdAnt) => EYE_MIN + roll(a, "eyeRng") * EYE_RANGE;
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// Standing room: `gap` scaled so that two spots need `wide` between them side by side and `deep` front to back.
const room = (a: Point, b: Point) => Math.hypot((a.x - b.x) / CROWD.wide, (a.z - b.z) / CROWD.deep) * CROWD.gap;
// A spot right in front of the visitor would hide it behind the standing ant.
const hides = (p: Point, visitor: Point) => Math.abs(p.x - visitor.x) < .9 && p.z > visitor.z && p.z - visitor.z < 2.6;
// Distance from p to the first `reach` units of segment a-b.
const segmentGap = (p: Point, a: Point, b: Point, reach = Infinity) => {
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
  if (!length) return gap(p, a);
  const along = Math.max(0, Math.min(length, reach, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length));
  return Math.hypot(p.x - a.x - dx / length * along, p.z - a.z - dz / length * along);
};

export function createCrowd(seed = 1): { ants: CrowdAnt[]; sync(count: number, env: CrowdEnv): void; step(dt: number, env: CrowdEnv): void } {
  const ants: CrowdAnt[] = [];
  let lastCx: number | null = null;
  const limit = (env: CrowdEnv) => env.front - .35;
  const onFloor = (p: Point, env: CrowdEnv) => p.z >= CROWD.back && p.z <= limit(env) && Math.abs(p.x) <= CROWD.side && walkable(p, env.obstacles, CROWD.radius);
  const mustSee = (a: CrowdAnt, env: CrowdEnv) => rand(a) < (env.view.zoomed ? .75 : .9);
  const sample = (a: CrowdAnt, env: CrowdEnv, must: boolean, local: boolean): Point => {
    if (local) { const angle = rand(a) * Math.PI * 2, reach = 1.5 + rand(a) * 2.5; return { x: a.x + Math.cos(angle) * reach, z: a.z + Math.sin(angle) * reach }; }
    const z = CROWD.back + rand(a) * (limit(env) - CROWD.back), half = viewHalf(env.view, z);
    const low = must ? Math.max(-CROWD.side, env.view.cx - half) : -CROWD.side, high = must ? Math.min(CROWD.side, env.view.cx + half) : CROWD.side;
    return { x: low + rand(a) * (high - low), z };
  };
  // Goals keep a body's distance from the visitor, every other goal and every standing ant.
  const spaced = (p: Point, self: CrowdAnt, env: CrowdEnv, bodies = false) => gap(p, env.visitor) >= CROWD.visitorGap && !hides(p, env.visitor)
    && ants.every((o) => o === self || (room(p, o.goal) >= CROWD.gap && ((!bodies && o.state === "walk") || room(p, o) >= CROWD.gap)));
  // Phones come out a few at a time, never as a wave.
  const phoneFree = () => ants.filter((o) => o.state === "phone" || o.state === "sigh").length < Math.max(1, Math.round(ants.length * CROWD.busy));
  // A route is clear when it does not lead closer than `pass` to a standing ant, nor to any ant in its first 1.5 units.
  const pathClear = (a: CrowdAnt, p: Point) => ants.every((o) => {
    if (o === a) return true;
    const near = segmentGap(o, a, p, o.state === "walk" ? 1.5 : Infinity);
    return near >= CROWD.pass || near >= gap(o, a) - 1e-6;
  });
  const pickSpot = (a: CrowdAnt, env: CrowdEnv, search = true): Point[] | null => {
    // Decided once per pick: per-try rolls would favour the roomier floor outside a narrow view.
    const must = mustSee(a, env);
    let last: Point | null = null;
    for (let i = 0; i < 12; i++) {
      const p = sample(a, env, must, rand(a) < .6);
      if (!onFloor(p, env) || (must && !inView(p, env.view)) || !spaced(p, a, env)) continue;
      last = p;
      if (clearSegment(a, p, env.obstacles) && pathClear(a, p)) return [p];
    }
    if (!search || !last) return null;
    const path = findWorldPath(a, last, env.obstacles); // rare last resort, never per frame
    return path.length && path.every((p) => p.z >= CROWD.back && p.z <= limit(env) && Math.abs(p.x) <= CROWD.side) ? path : null;
  };
  const stand = (a: CrowdAnt, state: CrowdState, pose: AntPose, span: number) => {
    a.state = state; a.pose = pose; a.span = a.t = span; a.path = []; a.goal = { x: a.x, z: a.z }; a.wait = 0; a.moved = false; a.nod = 0;
  };
  // Standing ants turn at once; their lean is left alone (it only follows a walk).
  const turn = (a: CrowdAnt, hx: number, hz: number) => { const lean = a.lean; a.hx = hx; a.hz = hz; face(a, 0, true); a.lean = lean; };
  const gaze = (a: CrowdAnt, span: number) => {
    const was = a.state === "gaze" ? a.pose : null; // a gazer that could not set off stands on: its head may move
    stand(a, "gaze", roll(a, "eyeRng") < .5 ? "look" : "idle", span);
    if (was && was !== a.pose) a.nod = NOD;
    a.eye = eyeSpan(a) * roll(a, "eyeRng"); // already part-way through, so heads do not move together
    const nearest = CROWD.panels.reduce((best, x) => Math.abs(x - a.x) < Math.abs(best - a.x) ? x : best);
    const panel = rand(a) < .7 ? nearest : CROWD.panels[Math.floor(rand(a) * CROWD.panels.length)];
    const angle = Math.max(-GAZE_ARC, Math.min(GAZE_ARC, Math.atan2(panel - a.x, a.z - WALL_Z)));
    turn(a, Math.sin(angle), -Math.cos(angle));
  };
  const gazeSpan = (a: CrowdAnt, env: CrowdEnv) => (8 + rand(a) * 12) * (env.restless ? .75 : 1);
  const phone = (a: CrowdAnt) => {
    stand(a, "phone", "phone", 3 + rand(a) * 3);
    const roll = rand(a), facing = PHONE_FACING.find((f) => roll < f[0])!;
    turn(a, facing[1], facing[2]);
  };
  const go = (a: CrowdAnt, path: Point[], speed: number) => {
    a.fresh = a.state !== "walk"; // setting off from a stand turns at once; a new route mid-walk turns through `face`
    a.state = "walk"; a.path = path; a.goal = path[path.length - 1]; a.speed = speed; a.wait = 0; a.t = a.span = 0; a.nod = 0;
    a.pose = "walk-a"; // never carry a phone or sigh pose into the walk, even for the one frame before the first stride
  };
  const roam = (a: CrowdAnt, env: CrowdEnv) => {
    const path = pickSpot(a, env);
    if (path) go(a, path, .85 + rand(a) * .5); else gaze(a, 2);
  };
  const spawn = (index: number, env: CrowdEnv) => {
    const a: CrowdAnt = { x: 0, z: (CROWD.back + limit(env)) / 2, hx: 0, hz: -1, state: "gaze", pose: "idle", t: 0, span: 0,
      path: [], goal: { x: 0, z: 0 }, speed: 1, stride: 0, wait: 0, moved: false, rng: hash(seed, index),
      lean: hash(seed ^ 0x5EED, index) & 1 ? 1 : -1, // a stable side of its own until its first sideways walk
      fx: 0, fz: -1, dir8: 4, dir4: 4, fresh: true, eye: 0, eyeRng: hash(seed ^ 0x100C, index), nod: 0 };
    let spot: Point | null = null;
    for (let i = 0; i < 80; i++) {
      const must = mustSee(a, env), p = sample(a, env, must, false);
      if (!onFloor(p, env) || (must && !inView(p, env.view))) continue;
      spot = p;
      if (spaced(p, a, env, true)) break;
    }
    if (spot) { a.x = spot.x; a.z = spot.z; }
    ants.push(a);
    const roll = rand(a);
    // First timers are spread over the whole range, whatever the mood, or the crowd would turn away in one wave.
    if (roll < .72 || (roll < .84 && !phoneFree())) { gaze(a, 8 + rand(a) * 12); a.t = a.span * rand(a); }
    else if (roll < .84) { phone(a); a.t = a.span * (.25 + .75 * rand(a)); }
    else { a.goal = { x: a.x, z: a.z }; roam(a, env); }
  };
  const blocked = (a: CrowdAnt, index: number, next: Point, env: CrowdEnv) => {
    const visitor = gap(next, env.visitor);
    if (visitor < VISITOR_PASS && visitor < gap(a, env.visitor)) return true;
    return ants.some((o, j) => {
      if (j === index) return false;
      const near = gap(next, o);
      if (near >= CROWD.pass || near >= gap(a, o)) return false;
      // Standing ants are spaced `gap` apart, so a walker may squeeze between two of them.
      if (o.state !== "walk") return near < SQUEEZE;
      // Head-on with a higher index that is still moving: it yields, unless we are already body to body.
      return near < HARD || !(j > index && o.moved && o.hx * (a.x - o.x) + o.hz * (a.z - o.z) > 0);
    });
  };
  const stride = (a: CrowdAnt, index: number, dt: number, env: CrowdEnv) => {
    const target = a.path[0];
    if (!target) { gaze(a, gazeSpan(a, env)); return; }
    const dx = target.x - a.x, dz = target.z - a.z, distance = Math.hypot(dx, dz), reach = a.speed * dt, arrive = distance <= reach;
    if (distance > EPS) { a.hx = dx / distance; a.hz = dz / distance; }
    let next = arrive ? target : { x: a.x + a.hx * reach, z: a.z + a.hz * reach }, slid = false;
    if (blocked(a, index, next, env)) {
      // Sidestep around whoever is in the way; the detour counts toward `wait` so it cannot circle for long.
      const side = index % 2 ? 1 : -1, floor = Math.max(a.z, limit(env));
      for (const turn of SIDESTEPS) {
        const cos = Math.cos(turn * side), sin = Math.sin(turn * side), hx = a.hx * cos - a.hz * sin, hz = a.hx * sin + a.hz * cos;
        const p = { x: a.x + hx * reach, z: a.z + hz * reach };
        if (p.z < CROWD.back || p.z > floor || Math.abs(p.x) > CROWD.side || !walkable(p, env.obstacles) || blocked(a, index, p, env)) continue;
        next = p; a.hx = hx; a.hz = hz; slid = true; break;
      }
      if (!slid) a.moved = false, a.pose = "idle";
      a.wait += slid ? dt * .25 : dt;
      if (a.wait > .5) { roam(a, env); return; }
      if (!slid) return;
    } else a.wait = 0;
    face(a, dt, a.fresh); a.fresh = false;
    a.x = next.x; a.z = next.z; a.moved = true; a.stride += slid ? reach : Math.min(distance, reach);
    a.pose = walkPose(a.stride);
    if (arrive && !slid) { a.path.shift(); if (!a.path.length) gaze(a, gazeSpan(a, env)); }
  };
  return {
    ants,
    sync(count, env) {
      const size = Math.max(0, Math.floor(count));
      if (ants.length > size) ants.length = size;
      while (ants.length < size) spawn(ants.length, env);
    },
    step(dt, env) {
      const delta = Math.max(0, Math.min(dt, .1)), edge = limit(env) + EPS;
      // Section change: gazers left outside the new view drift in over a few seconds.
      if (lastCx !== null && lastCx !== env.view.cx) for (const a of ants) if (a.state === "gaze" && !inView(a, env.view)) a.t = Math.min(a.t, rand(a) * 4);
      lastCx = env.view.cx;
      for (let i = 0; i < ants.length; i++) {
        const a = ants[i];
        if (a.z > edge) {
          // The visible floor shrank: walk out, never clamp or teleport.
          if (a.state !== "walk" || a.goal.z > edge) {
            const path = pickSpot(a, env, false);
            if (path) go(a, path, TOP_SPEED); else if (a.state === "walk") gaze(a, .5);
          }
        } else if (a.state === "walk" && a.goal.z > edge) roam(a, env);
        if (a.state === "walk") { stride(a, i, delta, env); continue; }
        a.moved = false; a.t -= delta;
        const crowded = gap(a, env.visitor) < VISITOR_PASS;
        if (a.state === "gaze") {
          if (crowded) a.t = Math.min(a.t, .25); // step aside for the visitor
          a.eye -= delta; a.nod = Math.max(0, a.nod - delta);
          if (a.eye <= 0) { a.pose = a.pose === "look" ? "idle" : "look"; a.eye = eyeSpan(a); a.nod = NOD; }
          // The phone is for an audience: next to the visitor or off the zoomed view the ant just walks on.
          if (a.t <= 0) { if (rand(a) < (env.hopeful ? PHONE_CHANCE_HOPEFUL : PHONE_CHANCE) && phoneFree() && gap(a, env.visitor) >= .9 && !(env.view.zoomed && !inView(a, env.view))) phone(a); else roam(a, env); }
        } else if (a.state === "phone") {
          if (a.t <= 0) { a.state = "sigh"; a.pose = "sigh"; a.span = a.t = 1.8; }
        } else if (a.t <= 0) {
          if (rand(a) < .7) gaze(a, 4 + rand(a) * 5); else roam(a, env);
        }
      }
    }
  };
}

// "f" frames drawn turned to the viewer's left; every other one turns right. Within the fear and hope walks the second
// stride came out the other way round from the first (the briefcase and the scarf tail swap sides), so tracking this per
// frame also keeps the costume on one side through the whole cycle. Both bright passing steps were drawn turned left too.
// The scarf ant's passing step has its scarf tail on the other side from its first stride, like its second stride.
const FRONT_LEFT = new Set(["fear.idle.f", "fear.sigh.f", "fear.walk-b.f", "hope.walk-b.f", "hope.walk-p.f", "neutral-bright.walk-p.f", "hope-bright.walk-p.f"]);

// Frame lookup order for a pose: exact art first, then the nearest pose and direction that
// exists. With only the 20 base frames the chain always ends on one of them.
// `lean` (-1 left, 1 right) mirrors a camera-facing frame that is drawn turned the other way; 0 leaves the art as drawn.
// `bright` puts the variant's bright frame in front of each of its own frames (same pose, same direction), so a bright
// ant shows the plain face only where no bright art exists, and never changes pose or direction to find one.
export function antFrameCandidates(variant: AntVariant, pose: AntPose, dir8: number, dir4: number, lean = 0, bright = false): { key: string; mirror: boolean; posed: boolean }[] {
  const poses: AntPose[] = pose === "idle" ? ["idle"] : pose === "walk-a" || pose === "walk-b" ? [pose] : pose === "sigh" ? ["sigh", "phone", "idle"] : [pose, "idle"];
  const variants: AntVariant[] = variant === "neutral" ? ["neutral"] : [variant, "neutral"];
  // sigh interleaves: own sigh, own phone, neutral sigh, neutral phone, then idle.
  // look keeps the costume first: own look, own idle (the level gaze it alternates with), then the neutral ant.
  const pairs: [AntVariant, AntPose][] = pose === "sigh"
    ? [...variants.flatMap((v) => [[v, "sigh"], [v, "phone"]] as [AntVariant, AntPose][]), ...variants.map((v) => [v, "idle"] as [AntVariant, AntPose])]
    : pose === "look" || pose === "tilt" ? variants.flatMap((v) => [[v, pose], [v, "idle"]] as [AntVariant, AntPose][])
    : poses.flatMap((p) => variants.map((v) => [v, p] as [AntVariant, AntPose]));
  const dirs: [number, boolean][] = dir8 % 2 ? [[dir8, false], [8 - dir8, true]] : [];
  dirs.push([dir4, false]);
  if (dir4 === 2 || dir4 === 6) dirs.push([8 - dir4, true]);
  const skin = bright ? ANT_BRIGHT[variant] : undefined;
  return pairs.flatMap(([v, p]) => dirs.flatMap(([d, mirror]) => (skin && v === variant ? [skin, v] : [v]).map((name) => {
    const key = `${name}.${p}.${ANT_DIRS[d]}`;
    return { key, mirror: d === 0 && lean ? (FRONT_LEFT.has(key) ? -1 : 1) !== (lean < 0 ? -1 : 1) : mirror, posed: p === pose };
  })));
}

// The pose a wall gazer is drawn in. For NOD seconds after its head starts to move it shows the in-between frame, but
// only where that exact art exists (same face, same direction): a gazer turned bl or br goes straight to the new pose.
export function antGazePose(has: (key: string) => boolean, variant: AntVariant, a: Pick<CrowdAnt, "state" | "pose" | "nod" | "dir8">, bright = false): AntPose {
  if (a.state !== "gaze" || a.nod <= 0) return a.pose;
  const skin = bright ? ANT_BRIGHT[variant] : undefined, dir = ANT_DIRS[a.dir8];
  return (skin && has(`${skin}.tilt.${dir}`)) || has(`${variant}.tilt.${dir}`) ? "tilt" : a.pose;
}

// A walk must not change costume, face or facing between steps: where this variant has no diagonal walk art it walks
// 4-way (toward the camera that is the "f" frame, turned by `lean`). Every walk in the atlas has its passing frame (feet
// together between the two strides); only if one is missing (a build from the base sheet alone) does the ant's own
// standing frame in that direction stand in for it. Alternating only the two stride frames does not work, because seen
// from the side they are the same silhouette and the legs look frozen. The standing frame is a poor stand-in for the
// scarf ant, whose raised fist then pumps up and down on every step.
// A bright ant has no diagonal art. Heading toward the camera it walks 4-way so the bright face shows; heading away on a
// diagonal its face is hidden, so it keeps the plain diagonal cycle. The returned `bright` says which set the whole
// cycle uses in that direction, so the face cannot change between two steps.
export function antWalkFrame(has: (key: string) => boolean, variant: AntVariant, pose: AntPose, dir8: number, dir4: number, bright = false): { pose: AntPose; dir8: number; bright: boolean } {
  const skin = bright ? ANT_BRIGHT[variant] : undefined, stride = (name: string, dir: number) => has(`${name}.walk-a.${ANT_DIRS[dir]}`);
  if (dir8 % 2 && !(skin && stride(skin, dir8)) && ((skin && (dir8 === 1 || dir8 === 7)) || !stride(variant, dir8))) dir8 = dir4;
  const name = skin && stride(skin, dir8) ? skin : variant;
  if (pose === "walk-p" && !has(`${name}.walk-p.${ANT_DIRS[dir8]}`)) pose = "idle";
  return { pose, dir8, bright: name === skin };
}
