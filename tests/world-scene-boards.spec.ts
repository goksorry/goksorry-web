import { expect, test } from "@playwright/test";
import { worldRows } from "./world-fixture";
import { buildWorldFrame, type WorldFrame } from "../lib/world";
import { SCENE_BOARDS, buildSceneBoard, stockRanking, type BoardScene } from "../lib/world-scene-boards";
import { CAST_FADE_SECONDS, castFade, correctReplay, interpolateFrame, theaterEvidenceQuery, theaterTimeline, traceLines } from "../lib/world-theater";

const art = { src: "/images/overview-regimes/overview-regime-neutral-light.webp", label: "중립" };

test("scene boards fit a portrait phone's wall and stay clear of the sign and lamps", () => {
  for (const boards of Object.values(SCENE_BOARDS)) for (const r of Object.values(boards)) {
    expect(Math.abs(r.x) + r.w / 2).toBeLessThanOrEqual(5.8);
    expect(r.y - r.h / 2).toBeGreaterThanOrEqual(4.7);
    expect(r.y + r.h / 2).toBeLessThanOrEqual(8.6);
  }
});

test("scene board models carry status, portrait and each scene's content", () => {
  const frame = buildWorldFrame(worldRows());
  const base = { frame, loaded: true, failed: false, summary: frame.overall, fresh: 0, date: "2026-11-16", replay: null, status: "관측 중 · 13:09 KST", art };
  const board = (scene: BoardScene, extra = {}) => buildSceneBoard({ ...base, scene, ...extra });
  const battle = board("battle", { fresh: 3 });
  expect(battle.status).toBe("관측 중 · 13:09 KST"); expect(battle.portrait.caption).toBe("현재 분위기 · 중립");
  expect(battle.scene === "battle" && battle.camps.map((c) => c.label)).toEqual(["절망군", "중립 관찰석", "희망군"]);
  expect(battle.scene === "battle" && battle.fresh).toContain("3건");
  // The mention ranking of the former 개미 생태계 is the battle's stock picker: every stock, in the frame's order.
  expect(battle.scene === "battle" && battle.ranking.map((r) => r.symbol)).toEqual(frame.stocks.map((s) => s.symbol));
  expect(battle.scene === "battle" && battle.ranking.every((r) => !r.selected)).toBe(true);
  const stock = frame.stocks[2], picked = board("battle", { stock, summary: stock });
  expect(picked.scene === "battle" && [picked.scope, picked.ranking.filter((r) => r.selected).map((r) => r.symbol)]).toEqual([stock.name, [stock.symbol]]);
  // Theater never waits on the live frame; without a record it says so, with text in place of the mood portrait.
  const theater = board("theater", { loaded: false });
  expect(theater.state).toBe("ready"); expect(theater.portrait).toEqual({ src: "", caption: "기록 시점", missing: "기록 없음" });
  expect(theater.scene === "theater" && theater.headline).toBe("이 구간은 기록이 없습니다");
  // While the day's records are still loading a null replay is not "no record" yet: the board waits (skeleton).
  expect(board("theater", { pending: true }).state).toBe("loading");
  expect(board("theater", { pending: true, replay: frame }).state).toBe("ready");
  const recorded = board("theater", { replay: frame }), corrected = board("theater", { replay: frame, corrected: true });
  expect([recorded.portrait.src, recorded.portrait.caption, recorded.portrait.missing]).toEqual([art.src, "기록 시점 · 중립", undefined]);
  expect(corrected.portrait.caption).toBe("기록 시점 (보정) · 중립");
  expect(recorded.scene === "theater" && recorded.line).toMatch(/^분석 표본/); expect(corrected.scene === "theater" && corrected.line).toMatch(/^보정 구간 · 분석 표본/);
  expect(board("battle", { loaded: false }).state).toBe("loading");
  expect(board("battle", { loaded: false, failed: true }).state).toBe("failed");
});

test("stock ranking numbers the stocks by mentions and reads each sample", () => {
  const frame = buildWorldFrame(worldRows());
  const ranking = stockRanking(frame.stocks, frame.stocks[0].symbol);
  expect(ranking.map((r) => r.rank).slice(0, 3)).toEqual(["01", "02", "03"]);
  expect(ranking[0]).toMatchObject({ name: frame.stocks[0].name, count: `${frame.stocks[0].total}건`, selected: true });
  expect(stockRanking([{ ...frame.stocks[0], total: 2 }], "")[0]).toMatchObject({ thin: true, verdict: "소표본 · 관찰 중" });
});

const day = (frames: (WorldFrame | null)[]) => ({ date: "2026-11-16", timezone: "Asia/Seoul" as const,
  slots: frames.map((frame, i) => ({ bucket_at: new Date(Date.UTC(2026, 10, 15, 15, i * 10)).toISOString(), frame })) });
const at = (frame: WorldFrame, index: number, generated: string): WorldFrame => ({ ...frame, generated_at: generated, overall: { ...frame.overall, index } });

test("theater timeline joins gaps between records as corrected strokes and reports the slot under the cursor", () => {
  const frame = buildWorldFrame(worldRows());
  // Records at 0-39, 50 and 100-143; 40-49 and 51-99 are gaps between records.
  const replay = correctReplay(day(Array.from({ length: 144 }, (_, i) => i < 40 || i === 50 || i >= 100 ? frame : null)));
  const t = theaterTimeline(replay, 15, false);
  // The lone record at 50 sits inside one corrected stroke from 39 to 100.
  expect(t.lines.map((line) => [line.points.length, line.corrected])).toEqual([[40, false], [62, true], [44, false]]);
  expect(t.lines[0].points[0]).toEqual({ x: 0, index: frame.overall.index }); expect(t.lines[2].points.at(-1)!.x).toBe(1);
  // A corrected stroke runs from the record before the gap to the record after it.
  expect(t.lines[1].points[0].x).toBe(39 / 143); expect(t.lines[1].points.at(-1)!.x).toBe(100 / 143);
  expect(t.cursor).toBe(.5); expect(t.recorded).toBe("85/144 구간 기록 · 보정 59 · KST");
  // 15 s of 30 is slot 72, filled between the records at 50 and 100.
  expect(t.state).toBe(`${frame.overall.total}건 · 보정 구간`); expect(t.clock).toBe("15.0 / 30초 · 12:00");
  expect(theaterTimeline(replay, 0, false).state).toBe(`${frame.overall.total}건 · 저장된 심리`);
  expect(theaterTimeline(replay, 0, true).state).toBe("기록 확인 중…");
});

test("gap correction fills only between records, on the straight line between them", () => {
  const frame = buildWorldFrame(worldRows());
  const a = at(frame, 2, "2026-11-15T15:10:30.000Z"), b = at(frame, 8, "2026-11-15T15:40:30.000Z");
  const replay = correctReplay(day([null, a, null, null, b, null, ...Array.from({ length: 138 }, () => null)]));
  expect(replay.slots.map((s) => [!!s.frame, s.corrected]).slice(0, 6)).toEqual([[false, false], [true, false], [true, true], [true, true], [true, false], [false, false]]);
  // Nothing to join before the first record or after the last one: those stay "기록 없음".
  expect(theaterTimeline(replay, 0, false).state).toBe("기록 없음");
  expect(replay.slots[2].frame!.overall.index).toBe(4); expect(replay.slots[3].frame!.overall.index).toBe(6);
  expect(replay.slots[2].frame!.generated_at).toBe("2026-11-15T15:20:30.000Z");
  expect(replay.slots[1].frame).toBe(a);
  expect(traceLines(replay.slots).map((l) => [l.points.length, l.corrected])).toEqual([[4, true]]);
  // Without a gap nothing is corrected; with one record there is a dot.
  expect(correctReplay(day([a, b])).slots.every((s) => !s.corrected)).toBe(true);
  expect(traceLines(correctReplay(day([null, a, null])).slots)).toEqual([{ points: [{ x: .5, index: 2 }], corrected: false }]);
  expect(correctReplay(day(Array.from({ length: 144 }, () => null))).slots.every((s) => !s.frame)).toBe(true);
});

test("interpolated frames carry counts, ratios and mood between the records, no evidence, and shared scopes only", () => {
  const base = buildWorldFrame(worldRows());
  const summary = (bullish: number, bearish: number, neutral: number, index: number) => ({
    ...base.overall, bullish, bearish, neutral, total: bullish + bearish + neutral, index,
    hope_ratio: bullish + bearish ? bullish / (bullish + bearish) : null, fear_ratio: bullish + bearish ? bearish / (bullish + bearish) : null
  });
  const [c0, c1] = base.communities, [s0, s1, s2] = base.stocks;
  const a: WorldFrame = { ...base, generated_at: "2026-11-15T15:00:00.000Z", data_at: "2026-11-15T14:59:00.000Z", overall: summary(9, 1, 2, 2),
    communities: [{ ...c0, ...summary(9, 1, 0, 2) }, { ...c1, ...summary(1, 1, 1, 5) }], stocks: [{ ...s0, ...summary(4, 0, 0, 1) }, { ...s1, ...summary(1, 0, 0, 3) }] };
  const b: WorldFrame = { ...base, generated_at: "2026-11-15T15:30:00.000Z", data_at: "2026-11-15T15:29:00.000Z", overall: summary(1, 9, 2, 8),
    communities: [{ ...c0, ...summary(1, 9, 0, 8) }], stocks: [{ ...s1, ...summary(1, 9, 0, 9) }, { ...s2, ...summary(5, 0, 0, 1) }] };
  const mid = interpolateFrame(a, b, .5);
  expect(mid.overall).toMatchObject({ bullish: 5, bearish: 5, neutral: 2, total: 12, hope_ratio: .5, fear_ratio: .5, mood: "mixed", index: 5 });
  expect(mid.overall.evidence).toEqual({ bullish: [], bearish: [], neutral: [] });
  expect(interpolateFrame(a, b, 1 / 6).overall.mood).toBe("hope"); expect(interpolateFrame(a, b, 5 / 6).overall.mood).toBe("fear");
  expect([mid.generated_at, mid.data_at]).toEqual(["2026-11-15T15:15:00.000Z", "2026-11-15T15:14:00.000Z"]);
  // Communities and stocks present in both records only, matched by id / symbol; names and collection state of the earlier one.
  expect(mid.communities.map((c) => [c.id, c.name, c.collection_problem, c.index])).toEqual([[c0.id, c0.name, c0.collection_problem, 5]]);
  expect(mid.stocks.map((s) => [s.symbol, s.total])).toEqual([[s1.symbol, 6]]);
  // A ratio missing on one side comes from the interpolated counts; no directional posts leaves none.
  const neutralOnly = { ...a, overall: { ...summary(0, 0, 4, 5) } };
  expect(interpolateFrame(neutralOnly, b, .5).overall).toMatchObject({ bullish: 1, bearish: 5, hope_ratio: 1 / 6, fear_ratio: 5 / 6 });
  expect(interpolateFrame(neutralOnly, { ...b, overall: summary(0, 0, 2, 5) }, .5).overall).toMatchObject({ hope_ratio: null, mood: "neutral" });
  expect(interpolateFrame(a, { ...b, overall: summary(0, 0, 0, 5) }, .9).overall.mood).toBe("watching");
});

test("the theater's ants fade out where no record can be shown and back in, at once without motion", () => {
  const steps = (absent: boolean, from: number) => { let v = from, n = 0; while (v !== (absent ? 0 : 1) && n < 1000) { v = castFade(v, absent, 1 / 60, true); n++; } return n / 60; };
  expect(steps(true, 1)).toBeCloseTo(CAST_FADE_SECONDS, 1); expect(steps(false, 0)).toBeCloseTo(CAST_FADE_SECONDS, 1);
  expect(castFade(1, true, 1 / 60, true)).toBeGreaterThan(.9);
  expect(castFade(.5, false, 10, true)).toBe(1);
  expect(castFade(1, true, 1 / 60, false)).toBe(0); expect(castFade(0, false, 1 / 60, false)).toBe(1);
});

test("theater evidence asks the feed for one side as of the recorded time, in the recorded scope", () => {
  const all = new URLSearchParams(theaterEvidenceQuery({ recordedAt: "2026-11-15T15:20:30.000Z" }, "bearish"));
  expect(Object.fromEntries(all)).toEqual({ hours: "6", limit: "3", offset: "0", asOf: "2026-11-15T15:20:30.000Z", sentiment: "bearish", channels: "", symbol: "" });
  const scoped = new URLSearchParams(theaterEvidenceQuery({ recordedAt: "2026-11-15T15:20:30.000Z", community: "dc", symbol: "AAPL" }, "neutral", 5));
  expect([scoped.get("channels"), scoped.get("symbol"), scoped.get("limit"), scoped.get("sentiment")]).toEqual(["dc", "AAPL", "5", "neutral"]);
});
