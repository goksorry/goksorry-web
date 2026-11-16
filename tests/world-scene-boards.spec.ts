import { expect, test } from "@playwright/test";
import { worldRows } from "./world-fixture";
import { buildWorldFrame } from "../lib/world";
import { SCENE_BOARDS, buildSceneBoard, type BoardScene } from "../lib/world-scene-boards";

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
  const eco = board("ecosystem");
  expect(eco.scene === "ecosystem" && eco.items.length).toBe(frame.stocks.length);
  expect(eco.status).toBe("관측 중 · 13:09 KST"); expect(eco.portrait.caption).toBe("현재 분위기 · 중립");
  const battle = board("battle", { fresh: 3 });
  expect(battle.scene === "battle" && battle.camps.map((c) => c.label)).toEqual(["희망군", "절망군", "중립 관찰석"]);
  expect(battle.scene === "battle" && battle.fresh).toContain("3건");
  expect(board("broadcast").scene).toBe("broadcast");
  // Theater never waits on the live frame; without a record it says so.
  const theater = board("theater", { loaded: false });
  expect(theater.state).toBe("ready"); expect(theater.portrait.caption).toContain("기록 시점");
  expect(theater.scene === "theater" && theater.headline).toBe("이 구간은 기록이 없습니다");
  expect(board("ecosystem", { loaded: false }).state).toBe("loading");
  expect(board("ecosystem", { loaded: false, failed: true }).state).toBe("failed");
});
