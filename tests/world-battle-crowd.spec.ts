import { test, expect } from "@playwright/test";
import antAtlas from "../components/world/ant-atlas.json";
import { BATTLE_CROWD, EMOTES, SIDE_VARIANT, battleFrontSignal, battleLayoutKey, battlePose, campSpots, createBattleCrowd, emoteFrame, emoteFrames, emoteSpan, planCamps, type BattleAnt, type BattleCounts } from "../lib/world-battle-crowd";
import { antFrameCandidates, inView, type CrowdView, type EmoteLoop } from "../lib/world-crowd";
import { CAMP_X, SIDE_ORDER, crowdCapacity, crowdDistribution } from "../lib/world-presentation";
import { WORLD_BOUNDS, walkable, worldObstacles } from "../lib/world-navigation";
import { worldSummary } from "../lib/world";

const DT = 1 / 30, obstacles = worldObstacles("battle");
const has = (key: string) => key in antAtlas.frames;
const FRAMES = emoteFrames(has);
const counts = (bearish: number, neutral: number, bullish: number): BattleCounts => ({ bearish, neutral, bullish });
const tally = (ants: BattleAnt[]) => SIDE_ORDER.map((side) => ants.filter((a) => !a.leaving && a.side === side).length);
const run = (crowd: ReturnType<typeof createBattleCrowd>, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) { crowd.step(DT); each?.(); }
};
const at = (a: BattleAnt) => ({ x: a.x, z: a.z });
const spotOf = (a: BattleAnt, view: CrowdView | null = null) => campSpots(a.side, view)[a.spot];
// Frames of the battle at rest (camera 32 from the wall): a desktop shows the whole field, a portrait phone about |x| 4.9 mid-floor.
const DESKTOP: CrowdView = { cx: 0, halfW: 13.3, camZ: 27.115, dist: 32, zoomed: false };
const PHONE: CrowdView = { cx: 0, halfW: 6, camZ: 27.115, dist: 32, zoomed: false };

test("each camp has room for the whole crowd on its own side of the field, nearest to its rally point first", () => {
  for (const side of SIDE_ORDER) {
    const spots = campSpots(side), camp = CAMP_X[side];
    expect(spots.length).toBeGreaterThanOrEqual(BATTLE_CROWD.max);
    for (const p of spots) {
      expect(walkable(p, obstacles, .35)).toBe(true);
      // Fear left, hope right (as the gauge reads), neutral in between, with a clear gap between camps.
      // Within |x| 5.8, so a portrait phone still frames both camps.
      if (camp) { expect(p.x * camp).toBeGreaterThanOrEqual(2.6); expect(p.x * camp).toBeLessThanOrEqual(5.8); } else expect(Math.abs(p.x)).toBeLessThanOrEqual(1.6);
      // On the floor every screen shows (the shallowest frame shows z up to 4), never on the visitor's way in.
      expect(p.z).toBeLessThanOrEqual(BATTLE_CROWD.front); expect(p.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.back);
      expect(Math.hypot(p.x - BATTLE_CROWD.start.x, p.z - BATTLE_CROWD.start.z)).toBeGreaterThanOrEqual(BATTLE_CROWD.startGap);
    }
    expect(new Set(spots.map((p) => `${p.x},${p.z}`)).size).toBe(spots.length);
  }
  // The two camps mirror each other, rank for rank.
  expect(campSpots("bullish").map((p) => ({ x: Math.abs(p.x), z: p.z }))).toEqual(campSpots("bearish").map((p) => ({ x: Math.abs(p.x), z: p.z })));
});

test("on a narrow frame each camp fills the spots in sight first; frames that show the same spots keep the same order", () => {
  for (const side of SIDE_ORDER) {
    const spots = campSpots(side, PHONE), shown = spots.filter((p) => inView(p, PHONE)).length;
    // Most of a camp fits a phone's frame; the spots past its edge come last.
    expect(shown).toBeGreaterThanOrEqual(side === "neutral" ? BATTLE_CROWD.max : 12);
    expect(spots.slice(0, shown).every((p) => inView(p, PHONE))).toBe(true);
    expect(new Set(spots.map((p) => `${p.x},${p.z}`))).toEqual(new Set(campSpots(side).map((p) => `${p.x},${p.z}`)));
  }
  expect(battleLayoutKey(DESKTOP)).toBe(battleLayoutKey(null));
  expect(battleLayoutKey({ ...DESKTOP, halfW: 15 })).toBe(battleLayoutKey(DESKTOP));
  expect(battleLayoutKey(PHONE)).not.toBe(battleLayoutKey(DESKTOP));
  // The first frame re-forms the camps at once; a later change of frame (a phone turned) walks them into sight.
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(8, 4, 8)); crowd.frame(PHONE);
  for (const a of crowd.ants) { expect(at(a)).toEqual(spotOf(a, PHONE)); expect(inView(a, PHONE)).toBe(true); }
  run(crowd, 1); crowd.frame(DESKTOP); crowd.frame(DESKTOP);
  const walking = crowd.ants.filter((a) => a.path.length).length;
  expect(walking).toBeGreaterThan(0); expect(walking).toBeLessThan(crowd.ants.length);
  run(crowd, 20); for (const a of crowd.ants) expect(at(a)).toEqual(spotOf(a, DESKTOP));
  // A desktop resize that shows the same spots moves nobody.
  crowd.frame({ ...DESKTOP, halfW: 12 }); expect(crowd.ants.every((a) => !a.path.length)).toBe(true);
});

test("the plan keeps each camp's nearest ants, walks the rest of a shrinking camp to a growing one, adds or drops the difference", () => {
  const place = (side: BattleAnt["side"], spot: number, id: string) => ({ id, side, spot, ...campSpots(side)[spot] });
  const ants = [place("bearish", 0, "a"), place("bearish", 1, "b"), place("bearish", 2, "c"), place("bullish", 0, "d")];
  // Fear 3 → 1, hope 1 → 3: the two outermost fear ants change camp, the nearest one stays; nothing is added or dropped.
  const swap = planCamps(ants, counts(1, 0, 3));
  expect(swap.moves.map((m) => m.id).sort()).toEqual(["b", "c"]);
  expect(swap.moves.every((m) => m.side === "bullish" && m.spot >= 1 && m.spot <= 2)).toBe(true);
  expect([swap.adds, swap.drops]).toEqual([[], []]);
  // Fewer in all: the outermost go, the rest stay put.
  expect(planCamps(ants, counts(1, 0, 1))).toEqual({ moves: [], adds: [], drops: ["b", "c"] });
  // More in all: the free spots nearest the rally point fill first.
  expect(planCamps(ants, counts(3, 2, 1))).toEqual({ moves: [], adds: [{ side: "neutral", spot: 0 }, { side: "neutral", spot: 1 }], drops: [] });
  // Same counts: nothing at all.
  expect(planCamps(ants, counts(3, 0, 1))).toEqual({ moves: [], adds: [], drops: [] });
});

test("the first counts are placed at once; the crowd never holds more than 20 and follows the counts by camp", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(0, 0, 0)); expect(crowd.ants).toHaveLength(0);
  // An empty frame (no data yet) does not use up the placement.
  crowd.sync(counts(9, 4, 7));
  expect(tally(crowd.ants)).toEqual([9, 4, 7]);
  for (const a of crowd.ants) { expect(at(a)).toEqual(spotOf(a)); expect(a.path).toEqual([]); expect(a.fade).toBe(1); }
  crowd.sync(counts(30, 30, 30)); run(crowd, 30);
  expect(crowd.ants.filter((a) => !a.leaving).length).toBeLessThanOrEqual(BATTLE_CROWD.max);
  // The renderer's counts: largest remainder over all classified posts, 20 places on any screen.
  const summary = { ...worldSummary([]), total: 100, bullish: 22, bearish: 61, neutral: 17 };
  expect(crowdDistribution(summary, crowdCapacity("battle", true))).toEqual({ bullish: 5, bearish: 12, neutral: 3 });
});

test("a change of counts walks only the ants that change camp; everyone else stands where they are", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(12, 4, 4));
  const before = new Map(crowd.ants.map((a) => [a.id, { side: a.side, ...at(a) }]));
  crowd.sync(counts(6, 4, 10));
  const movers = crowd.ants.filter((a) => a.path.length), stayers = crowd.ants.filter((a) => !a.path.length);
  expect(movers).toHaveLength(6);
  for (const a of movers) { expect(before.get(a.id)!.side).toBe("bearish"); expect(a.side).toBe("bullish"); }
  // No teleport: every step moves an ant at most its walking speed; stayers never move; the walk keeps to the floor and
  // goes round the barricade in the middle.
  let worst = 0, last = new Map(crowd.ants.map((a) => [a.id, at(a)]));
  run(crowd, 20, () => {
    for (const a of crowd.ants) {
      const p = last.get(a.id)!; worst = Math.max(worst, Math.hypot(a.x - p.x, a.z - p.z));
      expect(walkable(a, obstacles, .25)).toBe(true);
    }
    for (const a of stayers) expect(at(a)).toEqual({ x: before.get(a.id)!.x, z: before.get(a.id)!.z });
    last = new Map(crowd.ants.map((a) => [a.id, at(a)]));
  });
  expect(worst).toBeLessThanOrEqual(BATTLE_CROWD.speed * DT + 1e-9);
  expect(tally(crowd.ants)).toEqual([6, 4, 10]);
  for (const a of crowd.ants) { expect(a.path).toEqual([]); expect(at(a)).toEqual(spotOf(a)); }
  // Hope stands turned toward the fear camp and fear toward hope.
  for (const a of crowd.ants) if (a.side !== "neutral") expect(a.lean).toBe(-CAMP_X[a.side]);
});

test("newcomers walk in from the front edge and the ants no longer needed walk off it", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(3, 2, 3));
  crowd.sync(counts(3, 2, 8));
  const fresh = crowd.ants.filter((a) => a.path.length);
  expect(fresh).toHaveLength(5);
  for (const a of fresh) { expect(a.z).toBe(BATTLE_CROWD.enterZ); expect(a.fade).toBe(0); }
  run(crowd, 1); expect(fresh.every((a) => a.fade > 0 && a.z < BATTLE_CROWD.enterZ)).toBe(true);
  run(crowd, 20); expect(fresh.every((a) => !a.path.length && a.fade === 1)).toBe(true);
  crowd.sync(counts(1, 2, 3));
  const leaving = crowd.ants.filter((a) => a.leaving);
  expect(leaving).toHaveLength(7);
  expect(crowd.ants).toHaveLength(13);
  run(crowd, 20);
  expect(crowd.ants).toHaveLength(6); expect(tally(crowd.ants)).toEqual([1, 2, 3]);
});

test("the front ranks trade ground and regroup without changing camps", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.frame(PHONE);
  crowd.sync(counts(4, 3, 13), { front: { scope: "overall", bias: .7 } });
  const start = crowd.ants.map((a) => ({ side: a.side, ...at(a) }));
  const phases = new Set<string>();
  let feint = 0, press = 0;
  run(crowd, 8, () => {
    const line = crowd.front()!;
    phases.add(line.phase);
    if (line.phase === "feint") feint = Math.max(feint, line.x);
    if (line.phase === "press") press = Math.min(press, line.x);
    crowd.ants.forEach((a, i) => {
      expect(a.side).toBe(start[i].side);
      expect(walkable(a, obstacles, .3)).toBe(true);
      if (a.side === "neutral") expect(at(a)).toEqual({ x: start[i].x, z: start[i].z });
    });
  });
  expect([...phases]).toEqual(["rest", "advance", "feint", "press", "regroup"]);
  expect(feint).toBeGreaterThan(.8);
  expect(press).toBeLessThan(-.9);
  expect(crowd.ants.map((a) => ({ side: a.side, ...at(a) }))).toEqual(start);
});

test("changing scope or reducing motion settles the front ranks in the current camps", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(6, 3, 11), { front: { scope: "overall", bias: .3 } });
  run(crowd, 3);
  expect(crowd.ants.some((a) => a.x !== spotOf(a).x)).toBe(true);
  const places = crowd.ants.map(at);
  crowd.sync(counts(11, 3, 6), { front: { scope: "stock", bias: -.3 } });
  expect(crowd.ants.map(at)).toEqual(places);
  run(crowd, 1);
  crowd.step(DT, { still: true });
  expect(crowd.front()).toEqual({ x: expect.closeTo(.45), phase: "rest" });
  for (const a of crowd.ants) expect(at(a)).toEqual(spotOf(a));
  const empty = worldSummary([]);
  expect(battleFrontSignal({ ...empty, total: 2, bullish: 2 }, "stock")).toBeNull();
  expect(battleFrontSignal({ ...empty, total: 20, neutral: 20 }, "stock")).toBeNull();
  expect(battleFrontSignal({ ...empty, total: 20, bullish: 8, bearish: 2, neutral: 10 }, "stock")).toEqual({ scope: "stock", bias: .6 });
});

test("reduced motion places a change at once and plays no loops", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(10, 0, 10));
  crowd.sync(counts(2, 4, 14), { instant: true });
  expect(tally(crowd.ants)).toEqual([2, 4, 14]);
  for (const a of crowd.ants) { expect(a.path).toEqual([]); expect(at(a)).toEqual(spotOf(a)); }
  for (let i = 0; i < 1800; i++) { crowd.step(DT, { still: true }); expect(crowd.ants.every((a) => !a.emote)).toBe(true); }
  // A walk under way when motion is reduced ends at once.
  crowd.sync(counts(10, 0, 10)); expect(crowd.ants.some((a) => a.path.length)).toBe(true);
  crowd.step(DT, { still: true }); expect(crowd.ants.every((a) => !a.path.length)).toBe(true);
});

test("fear ants howl or kneel and hope ants dance or laugh, a few at a time and staggered; neutral ants just stand", () => {
  const crowd = createBattleCrowd({ frames: FRAMES });
  crowd.sync(counts(8, 4, 8));
  const played = new Map<string, Set<EmoteLoop>>(), starts: number[] = [];
  let worstShare = 0, t = 0;
  run(crowd, 90, () => {
    t += DT;
    for (const side of SIDE_ORDER) {
      const camp = crowd.ants.filter((a) => a.side === side), busy = camp.filter((a) => a.emote).length;
      if (camp.length) worstShare = Math.max(worstShare, busy / Math.max(1, Math.round(camp.length * BATTLE_CROWD.emoteShare)));
    }
    for (const a of crowd.ants) if (a.emote) {
      if (a.emote.t === DT || Math.abs(a.emote.t - DT) < 1e-9) starts.push(t);
      played.set(a.side, (played.get(a.side) ?? new Set()).add(a.emote.loop));
    }
  });
  expect([...played.get("bearish")!].sort()).toEqual(["howl", "kneel"]);
  expect([...played.get("bullish")!].sort()).toEqual(["dance", "smug"]);
  expect(played.has("neutral")).toBe(false);
  expect(worstShare).toBeLessThanOrEqual(1);
  // Staggered: loops start throughout the run, not in one wave.
  expect(new Set(starts.map((s) => Math.floor(s / 10))).size).toBeGreaterThanOrEqual(8);
  // Same seed, same show.
  const replay = (seed: number) => { const c = createBattleCrowd({ seed, frames: FRAMES }); c.sync(counts(8, 4, 8)); run(c, 30); return c.ants.map((a) => [a.emote?.loop ?? null, a.rest]); };
  expect(replay(3)).toEqual(replay(3)); expect(replay(3)).not.toEqual(replay(4));
  // A loop the atlas does not have never plays.
  const plain = createBattleCrowd({ frames: { howl: FRAMES.howl } }); plain.sync(counts(8, 0, 8)); let other = false;
  run(plain, 60, () => { if (plain.ants.some((a) => a.emote && a.emote.loop !== "howl")) other = true; });
  expect(other).toBe(false);
});

test("poses resolve to the atlas's loop frames, hope smiling and each camp turned toward the other", () => {
  for (const loop of Object.keys(EMOTES) as EmoteLoop[]) {
    const n = FRAMES[loop]!; expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(6);
    // Frames step 1 → n and back to 1 over each cycle, the last one held a little longer for the kneel.
    const shown = Array.from({ length: Math.round(emoteSpan(loop, n) / .01) }, (_, i) => emoteFrame(loop, i * .01, n));
    expect(new Set(shown)).toEqual(new Set(Array.from({ length: n }, (_, i) => i + 1)));
    expect(shown[0]).toBe(1); expect(shown.filter((f, i) => i && f === 1 && shown[i - 1] === n).length).toBe(EMOTES[loop].cycles - 1);
    const pose = battlePose({ path: [], stride: 0, side: "neutral", emote: { loop, t: EMOTES[loop].frame * 1.5, span: 9 } }, FRAMES);
    expect(pose).toBe(`${loop}-2`);
    const variant = EMOTES[loop].variant, side = variant === "fear" ? "bearish" : "bullish";
    expect(SIDE_VARIANT[side]).toBe(variant);
    const found = antFrameCandidates(variant, pose, 0, 0, -CAMP_X[side], side === "bullish").find((c) => has(c.key))!;
    expect(found.key).toBe(`${variant}.${loop}-2.f`); expect(found.posed).toBe(true);
  }
  // Standing hope ants wear the bright (smiling) face; walking ants walk; without a loop's frames an ant stands.
  expect(antFrameCandidates("hope", "idle", 0, 0, -1, true).find((c) => has(c.key))!.key).toBe("hope-bright.idle.f");
  expect(battlePose({ path: [{ x: 0, z: 0 }], stride: .45, side: "bullish", emote: null }, FRAMES, .2)).toBe("walk-b");
  expect(battlePose({ path: [], stride: 0, side: "bearish", emote: { loop: "howl", t: 0, span: 1 } }, {})).toBe("idle");
  // Standing between loops (or without motion), hope ants keep the grin that opens the smug loop; the others stand idle.
  expect(battlePose({ path: [], stride: 0, side: "bullish", emote: null }, FRAMES)).toBe("smug-1");
  expect(antFrameCandidates("hope", "smug-1", 0, 0, -1, true).find((c) => has(c.key))!.key).toBe("hope.smug-1.f");
  expect(battlePose({ path: [], stride: 0, side: "bearish", emote: null }, FRAMES)).toBe("idle");
  expect(battlePose({ path: [], stride: 0, side: "neutral", emote: null }, FRAMES)).toBe("idle");
  expect(battlePose({ path: [], stride: 0, side: "bullish", emote: null }, {})).toBe("idle");
  // The kneel is drawn facing left and the others right: turned toward the other camp, fear's kneel and hope's loops are mirrored.
  const mirror = (variant: "fear" | "hope", pose: `${EmoteLoop}-1`, lean: number) => antFrameCandidates(variant, pose, 0, 0, lean).find((c) => has(c.key))!.mirror;
  expect([mirror("fear", "howl-1", 1), mirror("fear", "kneel-1", 1), mirror("hope", "dance-1", -1), mirror("hope", "smug-1", -1)]).toEqual([false, true, true, true]);
});
