import type { WorldSide } from "./world";
import { CAMP_X, SIDE_ORDER } from "./world-presentation";
import { findWorldPath, walkable, worldObstacles, type Point } from "./world-navigation";
import { facing4, facing8, inView, leanOf, walkPose, type AntPose, type AntVariant, type CrowdView, type EmoteLoop } from "./world-crowd";
import { advance, hash, unit } from "./world-random";

// 심리 전장 crowd: a pure, seeded model stepped by the renderer (no three.js, no Math.random). Up to BATTLE_CROWD.max ants
// stand for the shown scope's hope / neutral / fear counts, each at a fixed spot of its camp. When the counts change only the
// ants that must change camp walk over (newcomers walk in from the front edge, the ones no longer needed walk off it), and
// everyone else keeps standing where they are. Standing fear ants now and then howl at the sky or kneel in despair, hope
// ants (who smile) dance or laugh smugly.

export const BATTLE_CROWD = {
  max: 20,
  speed: 1.25,
  /** Spot grid: rows of the floor from `back` to `front`, `row` apart; the camps lie on the CAMP_X sides. */
  back: -2.8, front: 3.2, row: 1,
  /** The front edge of the floor: newcomers come in from `enterZ` (below the frame) and walk through `edgeZ`; leavers go the other way. */
  edgeZ: 6.4, enterZ: 7.8,
  /** The visitor's default standing point in the room: no spot is closer than `startGap` to it. */
  start: { x: 0, z: 3.2 } as Point, startGap: 1.1,
  /** At most this share of a camp (at least one ant) plays an emotion loop at a time. */
  emoteShare: .34,
  /** Seconds between two loops of one ant, and before the first one. */
  rest: [3, 9] as const, firstRest: [.8, 7] as const
} as const;

// Each camp's half of the field: |x| from `inner` to `outer`, `step` apart, odd rows offset by half a step. The side camps
// keep a clear metre from the neutral ants, who stand along the barricade in the middle; their flags fly over them.
const ZONES: Record<-1 | 0 | 1, { inner: number; outer: number; step: number; z: number }> = {
  [-1]: { inner: 2.6, outer: 5.8, step: 1, z: 1 },
  [0]: { inner: 0, outer: 1.6, step: .8, z: .7 },
  [1]: { inner: 2.6, outer: 5.8, step: 1, z: 1 }
};
// The camp flag poles (see the renderer's buildRoom) stand in the camps: nobody stands on them.
const POLES: Point[] = [{ x: -5.5, z: -.5 }, { x: 5.5, z: -.5 }];

const gridMemo = new Map<WorldSide, Point[]>(), rankMemo = new Map<string, Point[]>();
/** Every standing spot of a camp's half of the field, in grid order. */
function campGrid(side: WorldSide): Point[] {
  const memo = gridMemo.get(side); if (memo) return memo;
  const camp = CAMP_X[side], zone = ZONES[camp], obstacles = worldObstacles("battle"), spots: Point[] = [];
  const round = (v: number) => Math.round(v * 100) / 100;
  for (let r = 0, z = BATTLE_CROWD.back; z <= BATTLE_CROWD.front + 1e-6; r++, z += BATTLE_CROWD.row) {
    const shift = r % 2 ? zone.step / 2 : 0;
    // The centre camp is laid out around x 0; a side camp from its inner edge outward.
    const xs: number[] = [];
    if (camp === 0) for (let x = shift; x <= zone.outer + 1e-6; x += zone.step) { xs.push(x); if (x > 1e-6) xs.push(-x); }
    else for (let x = zone.inner + shift; x <= zone.outer + 1e-6; x += zone.step) xs.push(camp * x);
    for (const x of xs) {
      const p = { x: round(x), z: round(z) };
      if (!walkable(p, obstacles, .35) || POLES.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < .45)) continue;
      if (Math.hypot(p.x - BATTLE_CROWD.start.x, p.z - BATTLE_CROWD.start.z) < BATTLE_CROWD.startGap) continue;
      spots.push(p);
    }
  }
  gridMemo.set(side, spots);
  return spots;
}
/** Which of a camp's spots the framed floor shows (all of them without a view): one character per spot. */
const shownMask = (side: WorldSide, view: CrowdView | null) => campGrid(side).map((p) => !view || inView(p, view) ? "1" : "0").join("");
/** A key that changes exactly when the camps' spot order would: a new frame that shows the same spots keeps every ant in place. */
export const battleLayoutKey = (view: CrowdView | null): string => SIDE_ORDER.map((side) => shownMask(side, view)).join("|");

/**
 * Standing spots of a camp, best first: the spots the frame shows (`view`; a portrait phone shows only the middle of the
 * field), each nearest to the camp's rally point, then the rest. A small camp is a tight group in sight; only a camp of
 * nearly the whole crowd spreads past the frame's edge. The rally point is the middle of the camp's shown width.
 */
export function campSpots(side: WorldSide, view: CrowdView | null = null): Point[] {
  const mask = shownMask(side, view), key = `${side}|${mask}`, memo = rankMemo.get(key); if (memo) return memo;
  const camp = CAMP_X[side], zone = ZONES[camp], grid = campGrid(side);
  const shown = grid.filter((_, i) => mask[i] === "1"), reach = shown.length ? Math.max(...shown.map((p) => Math.abs(p.x))) : zone.outer;
  const anchor = { x: camp * (zone.inner + Math.min(zone.outer, reach)) / 2, z: zone.z };
  const gap = (p: Point) => Math.hypot(p.x - anchor.x, p.z - anchor.z);
  const order = (list: Point[]) => [...list].sort((a, b) => gap(a) - gap(b) || Math.abs(a.x) - Math.abs(b.x) || a.x - b.x || a.z - b.z);
  const spots = [...order(shown), ...order(grid.filter((_, i) => mask[i] !== "1"))];
  rankMemo.set(key, spots);
  return spots;
}

export type BattleCounts = Record<WorldSide, number>;
type Placed = { id: string; side: WorldSide; spot: number; x: number; z: number };
export type CampPlan = { moves: { id: string; side: WorldSide; spot: number }[]; adds: { side: WorldSide; spot: number }[]; drops: string[] };

/**
 * Who goes where for new counts. Each camp keeps its ants nearest to its rally point (as many as it still needs); the rest of
 * a shrinking camp fill the free spots of growing camps (each spot takes the nearest such ant), and are dropped when no camp
 * grows. Spots still free after that are new ants. Counts are capped by the spots a camp has.
 */
export function planCamps(ants: readonly Placed[], counts: BattleCounts, view: CrowdView | null = null): CampPlan {
  const surplus: Placed[] = [], targets: { side: WorldSide; spot: number }[] = [];
  for (const side of SIDE_ORDER) {
    const spots = campSpots(side, view), want = Math.max(0, Math.min(spots.length, Math.floor(counts[side] ?? 0)));
    const members = ants.filter((a) => a.side === side).sort((a, b) => a.spot - b.spot || a.id.localeCompare(b.id));
    surplus.push(...members.slice(want));
    const used = new Set(members.slice(0, want).map((a) => a.spot));
    for (let spot = 0, need = want - Math.min(want, members.length); need > 0 && spot < spots.length; spot++) if (!used.has(spot)) { targets.push({ side, spot }); need--; }
  }
  const moves: CampPlan["moves"] = [], adds: CampPlan["adds"] = [];
  for (const target of targets) {
    const p = campSpots(target.side, view)[target.spot];
    let best = -1;
    surplus.forEach((a, i) => {
      if (best < 0) { best = i; return; }
      const b = surplus[best], d = Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z);
      if (d < -1e-9 || (Math.abs(d) <= 1e-9 && a.id.localeCompare(b.id) < 0)) best = i;
    });
    if (best < 0) { adds.push(target); continue; }
    moves.push({ id: surplus[best].id, ...target }); surplus.splice(best, 1);
  }
  return { moves, adds, drops: surplus.map((a) => a.id) };
}

/** An emotion loop: the costume that has it, seconds per frame (the last one held `last`), and how many times it plays through. */
export const EMOTES: Record<EmoteLoop, { variant: AntVariant; frame: number; last: number; cycles: number }> = {
  howl: { variant: "fear", frame: .2, last: .2, cycles: 2 },
  kneel: { variant: "fear", frame: .25, last: .45, cycles: 2 },
  dance: { variant: "hope", frame: .155, last: .155, cycles: 4 },
  smug: { variant: "hope", frame: .18, last: .18, cycles: 3 }
};
/** Frames a loop has in the atlas: `${variant}.${loop}-1.f`, `-2`, ... while they exist (0 when the atlas has none). */
export function emoteFrames(has: (key: string) => boolean): Partial<Record<EmoteLoop, number>> {
  const out: Partial<Record<EmoteLoop, number>> = {};
  for (const loop of Object.keys(EMOTES) as EmoteLoop[]) {
    let n = 0; while (has(`${EMOTES[loop].variant}.${loop}-${n + 1}.f`)) n++;
    if (n) out[loop] = n;
  }
  return out;
}
const cycleOf = (loop: EmoteLoop, frames: number) => EMOTES[loop].frame * (frames - 1) + EMOTES[loop].last;
/** Seconds one play of a loop lasts. */
export const emoteSpan = (loop: EmoteLoop, frames: number): number => cycleOf(loop, frames) * EMOTES[loop].cycles;
/** The frame number (1-based) a loop shows `t` seconds in. */
export function emoteFrame(loop: EmoteLoop, t: number, frames: number): number {
  const { frame } = EMOTES[loop], at = Math.max(0, t) % cycleOf(loop, frames);
  return Math.min(frames, Math.floor(at / frame) + 1);
}
/** Variant an ant of each side wears. Hope ants always smile (the bright face) in the battle. */
export const SIDE_VARIANT: Record<WorldSide, AntVariant> = { bullish: "hope", bearish: "fear", neutral: "neutral" };
const LOOPS: Record<WorldSide, EmoteLoop[]> = { bearish: ["howl", "kneel"], bullish: ["dance", "smug"], neutral: [] };

export type BattleAnt = {
  id: string; side: WorldSide; spot: number; x: number; z: number;
  /** Points still to walk (empty: standing at its spot, or about to be removed when `leaving`). */
  path: Point[]; stride: number; moved: boolean;
  /** Drawn facing: 8-way and 4-way ANT_DIRS indices and the side a camera-facing sprite turns to (see leanOf). */
  dir8: number; dir4: number; lean: number;
  /** Walking off the front edge, removed once there. */
  leaving: boolean;
  /** 1 drawn, fading to 0 past the front edge of the floor. */
  fade: number;
  emote: { loop: EmoteLoop; t: number; span: number } | null;
  /** Seconds until it may start its next loop. */
  rest: number;
  /** Sprite size factor of its own (.9 to 1.02), so a crowd is not one size. */
  build: number;
  rng: number };
export type BattleCrowd = {
  ants: BattleAnt[];
  /** Holds these counts (capped at BATTLE_CROWD.max in all). The first counts with any ant, and every sync with `instant`
   * (reduced motion), place the ants on their spots at once; later ones walk them. */
  sync(counts: BattleCounts, options?: { instant?: boolean }): void;
  /** The floor the frame shows (see campSpots). When that changes which spots are in sight, every camp re-forms in its new
   * order: at once with `instant` or before the crowd has taken a step, else by walking. */
  frame(view: CrowdView, options?: { instant?: boolean }): void;
  /** `still` (reduced motion): walks finish at once and no loop plays. */
  step(dt: number, options?: { still?: boolean }): void;
  /** A new room: no ants, and the next counts are placed again. */
  reset(): void;
};

/** The pose an ant is drawn in: its walk cycle (`phase` is floor per walk frame), its loop's frame, or standing. */
export function battlePose(a: Pick<BattleAnt, "path" | "stride" | "emote">, frames: Partial<Record<EmoteLoop, number>>, phase?: number): AntPose {
  if (a.path.length) return walkPose(a.stride, phase);
  const e = a.emote, n = e ? frames[e.loop] ?? 0 : 0;
  return e && n ? `${e.loop}-${emoteFrame(e.loop, e.t, n)}` : "idle";
}

export function createBattleCrowd(options: { seed?: number; frames?: Partial<Record<EmoteLoop, number>> } = {}): BattleCrowd {
  const seed = options.seed ?? 1, frames = options.frames ?? {}, obstacles = worldObstacles("battle");
  const ants: BattleAnt[] = [];
  // `fresh`: no step taken since the last placement, so a re-forming is still a placement.
  let made = 0, placed = false, fresh = true, view: CrowdView | null = null, layout = battleLayoutKey(null);
  const rand = (a: BattleAnt) => unit(a.rng = advance(a.rng));
  const within = (a: BattleAnt, [low, high]: readonly [number, number]) => low + rand(a) * (high - low);
  const spotOf = (a: Pick<BattleAnt, "side" | "spot">) => campSpots(a.side, view)[a.spot];
  // Standing, an ant faces the camera turned toward the other camp (fear right, hope left); a neutral one toward the camp on its side.
  const stand = (a: BattleAnt) => {
    a.path = []; a.moved = false; a.dir8 = a.dir4 = 0; a.stride = 0;
    a.lean = CAMP_X[a.side] ? -CAMP_X[a.side] : a.x < 0 ? -1 : 1;
  };
  // Around the barricade on the floor's walking grid. An ant still below the front edge (walking in or off) first steps up
  // onto the floor, straight ahead.
  const route = (from: Point, to: Point): Point[] => {
    if (from.z > BATTLE_CROWD.edgeZ) { const edge = { x: from.x, z: BATTLE_CROWD.edgeZ }; return [edge, ...route(edge, to)]; }
    const path = findWorldPath(from, to, obstacles);
    return path.length ? path : [to];
  };
  // In from the front edge, below the frame, up onto the floor and on to the spot; off the same way back.
  const entry = (p: Point): Point[] => route({ x: p.x, z: BATTLE_CROWD.enterZ }, p);
  const exit = (a: BattleAnt): Point[] => [...route(a, { x: a.x, z: BATTLE_CROWD.edgeZ }), { x: a.x, z: BATTLE_CROWD.enterZ }];
  const fadeAt = (z: number) => Math.max(0, Math.min(1, (BATTLE_CROWD.enterZ - z) / (BATTLE_CROWD.enterZ - BATTLE_CROWD.edgeZ)));
  const spawn = (side: WorldSide, spot: number, at: boolean) => {
    const index = made++, p = campSpots(side, view)[spot];
    const a: BattleAnt = { id: `battle:${index}`, side, spot, x: p.x, z: p.z, path: [], stride: 0, moved: false, dir8: 0, dir4: 0, lean: 1,
      leaving: false, fade: 1, emote: null, rest: 0, build: .9 + index % 3 * .06, rng: hash(seed ^ 0xBA77, index) };
    a.rest = within(a, BATTLE_CROWD.firstRest);
    if (at) stand(a);
    else { a.z = BATTLE_CROWD.enterZ; a.fade = 0; a.path = entry(p); }
    ants.push(a);
  };
  const walkTo = (a: BattleAnt, path: Point[]) => { a.emote = null; a.path = path; a.moved = false; };
  const place = (a: BattleAnt, p: Point) => { a.x = p.x; a.z = p.z; a.fade = 1; a.emote = null; stand(a); };
  return {
    ants,
    sync(counts, { instant = false } = {}) {
      // crowdDistribution already sums to the capacity; this only guards a caller that asks for more than `max` in all.
      const max = BATTLE_CROWD.max, capped = { ...counts };
      let over = SIDE_ORDER.reduce((sum, side) => sum + Math.max(0, capped[side]), 0) - max;
      for (const side of SIDE_ORDER) { const cut = Math.min(Math.max(0, over), Math.max(0, capped[side])); capped[side] -= cut; over -= cut; }
      const live = ants.filter((a) => !a.leaving), plan = planCamps(live, capped, view);
      const now = instant || (!placed && live.length + plan.adds.length > 0);
      if (live.length + plan.adds.length > 0) { if (!placed) fresh = true; placed = true; }
      for (const m of plan.moves) {
        const a = live.find((o) => o.id === m.id)!;
        a.side = m.side; a.spot = m.spot;
        const p = spotOf(a);
        if (now) place(a, p); else walkTo(a, route(a, p));
      }
      for (const id of plan.drops) {
        const i = ants.findIndex((o) => o.id === id), a = ants[i];
        if (now) ants.splice(i, 1); else { a.leaving = true; walkTo(a, exit(a)); }
      }
      for (const t of plan.adds) spawn(t.side, t.spot, now);
      // A quick run of changes can leave many walking off: past `max` of them, the ones furthest out go at once.
      const leaving = ants.filter((a) => a.leaving).sort((a, b) => b.z - a.z);
      for (const a of leaving.slice(0, Math.max(0, leaving.length - max))) ants.splice(ants.indexOf(a), 1);
    },
    frame(next, { instant = false } = {}) {
      const key = battleLayoutKey(next); view = next;
      if (key === layout) return;
      layout = key;
      // Each camp keeps its order: its n ants take the new first n spots.
      for (const side of SIDE_ORDER) ants.filter((a) => !a.leaving && a.side === side).sort((a, b) => a.spot - b.spot).forEach((a, spot) => {
        a.spot = spot;
        const p = spotOf(a);
        if (Math.hypot(a.x - p.x, a.z - p.z) < 1e-6 && !a.path.length) return;
        if (instant || fresh) place(a, p); else walkTo(a, route(a, p));
      });
    },
    step(dt, { still = false } = {}) {
      const delta = Math.max(0, Math.min(dt, .1));
      if (delta > 0 && ants.length) fresh = false;
      for (let i = 0; i < ants.length; i++) {
        const a = ants[i];
        if (a.path.length) {
          if (still) { const end = a.path[a.path.length - 1]; a.x = end.x; a.z = end.z; a.path = []; }
          let reach = BATTLE_CROWD.speed * delta;
          while (a.path.length && reach > 0) {
            const target = a.path[0], dx = target.x - a.x, dz = target.z - a.z, distance = Math.hypot(dx, dz);
            if (distance > 1e-9) { a.dir8 = facing8(dx, dz); a.dir4 = facing4(dx, dz); a.lean = leanOf(dx / distance, a.lean); }
            const go = Math.min(distance, reach);
            a.x += distance > 1e-9 ? dx / distance * go : 0; a.z += distance > 1e-9 ? dz / distance * go : 0;
            a.stride += go; reach -= go; a.moved = true;
            if (go >= distance) { a.x = target.x; a.z = target.z; a.path.shift(); }
          }
          a.fade = fadeAt(a.z);
          if (!a.path.length) {
            if (a.leaving) { ants.splice(i--, 1); continue; }
            stand(a); a.rest = within(a, BATTLE_CROWD.firstRest);
          }
          continue;
        }
        a.fade = fadeAt(a.z);
        if (still) { a.emote = null; continue; }
        if (a.emote) {
          if ((a.emote.t += delta) >= a.emote.span) { a.emote = null; a.rest = within(a, BATTLE_CROWD.rest); }
          continue;
        }
        if ((a.rest -= delta) > 0) continue;
        const loops = LOOPS[a.side].filter((loop) => frames[loop]);
        const camp = ants.filter((o) => !o.leaving && o.side === a.side), busy = camp.filter((o) => o.emote).length;
        if (!loops.length) { a.rest = within(a, BATTLE_CROWD.rest); continue; }
        // A camp never emotes as one wave: past its share the ant waits a little and tries again.
        if (busy >= Math.max(1, Math.round(camp.length * BATTLE_CROWD.emoteShare))) { a.rest = within(a, [.6, 1.6]); continue; }
        const loop = loops[Math.floor(rand(a) * loops.length)];
        a.emote = { loop, t: 0, span: emoteSpan(loop, frames[loop]!) };
      }
    },
    reset() { ants.length = 0; placed = false; fresh = true; }
  };
}
