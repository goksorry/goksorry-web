import { expect, test } from "@playwright/test";
import { buildWorldFrame } from "../lib/world";
import { WALL_COS, WALL_PANELS, WALL_PANEL_IDS, buildWallModel, projectPanel, wallBodyPx, wallFit, wallPanelLoading } from "../lib/world-wall";
import { worldRows } from "./world-fixture";

const wide = { plaza: true, layout: "wide", section: 1, overview: false, hudBottom: 60 } as const;
const tall = { ...wide, layout: "sectioned" } as const;
const overlap = (a: ReturnType<typeof projectPanel>, b: ReturnType<typeof projectPanel>) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("wide viewports fit the whole wall with readable text and visible floor", () => {
  for (const [w, h] of [[1440, 844], [1920, 1024], [1920, 900], [1440, 724], [844, 342], [740, 312]]) {
    const fit = wallFit(w, h, wide), rects = WALL_PANEL_IDS.map((id) => projectPanel(id, fit));
    for (const r of rects) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(w); expect(r.y).toBeGreaterThan(0); expect(r.y + r.height).toBeLessThan(h - (h < 380 ? 0 : 60)); }
    rects.forEach((a, i) => rects.forEach((b, j) => { if (i < j) expect(overlap(a, b)).toBe(false); }));
    expect(fit.cx).toBe(0); expect(fit.front).toBeGreaterThanOrEqual(.8);
    expect(wallBodyPx(fit.ppu)).toBeGreaterThanOrEqual(11);
  }
  expect(wallFit(1440, 844, wide).ppu).toBeCloseTo(1440 / 23.2, 3);
  expect(wallBodyPx(wallFit(1440, 844, wide).ppu)).toBeGreaterThanOrEqual(15);
});

test("the portrait projects at exactly 3:2 so the original 300×200 art is never cropped", () => {
  const r = projectPanel("pierrot", wallFit(1440, 844, wide));
  expect(r.width / r.height).toBeCloseTo(1.5, 6);
  expect(WALL_PANELS.pierrot.h * WALL_COS).toBeCloseTo(3.6, 6);
});

test("portrait viewports zoom one section, and overview shows every panel", () => {
  for (const section of [0, 1, 2] as const) {
    const fit = wallFit(390, 796, { ...tall, section });
    for (const id of WALL_PANEL_IDS) {
      const r = projectPanel(id, fit), visible = r.x >= 0 && r.x + r.width <= 390;
      expect(visible).toBe(WALL_PANELS[id].section === section);
      // Arrow buttons sit above the nav in the floor band: panels end well before it.
      if (visible) expect(r.y + r.height).toBeLessThan(796 - 60 - 14 - 64);
    }
    expect(wallBodyPx(fit.ppu)).toBeGreaterThanOrEqual(13);
  }
  const overview = wallFit(390, 796, { ...tall, overview: true });
  for (const id of WALL_PANEL_IDS) { const r = projectPanel(id, overview); expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(390); expect(r.y).toBeGreaterThan(0); }
  expect(overview.ppu).toBeLessThan(wallFit(390, 796, tall).ppu / 2);
});

test("wall model keeps scope fallback, clean filter and row caps", () => {
  const rows = worldRows(), frame = buildWorldFrame(rows);
  const base = { frame, loaded: true, failed: false, status: "관측 중", timezone: "Asia/Seoul", filtered: false, scopeLabel: "", dark: false,
    market: { data: null, failed: false, loaded: false }, room: { data: null, failed: true, loaded: true } };
  const clean = buildWallModel({ ...base, cleanFilterEnabled: true, feed: { data: { rows }, failed: false, loaded: true } });
  // Legacy feed payloads have no summary: the unfiltered world frame stays the source.
  expect(clean.summary.total).toBe(frame.overall.total);
  expect(clean.model.feed.items).toHaveLength(12);
  expect(clean.model.feed.items.every((item) => !item.title.includes("시발"))).toBe(true);
  expect(clean.model.market.state).toBe("loading"); expect(clean.model.room.state).toBe("failed");
  expect(clean.model.pierrot.src).toMatch(/overview-regime-.*-light\.webp$/);
  const raw = buildWallModel({ ...base, cleanFilterEnabled: false, dark: true, feed: { data: { rows }, failed: false, loaded: true } });
  expect(raw.model.feed.items[0].title).toContain("시발");
  expect(raw.model.pierrot.src).toMatch(/-dark\.webp$/);
  // A filtered scope without a summary is empty, never the whole market.
  const filtered = buildWallModel({ ...base, filtered: true, cleanFilterEnabled: true, feed: { data: null, failed: false, loaded: false } });
  expect(filtered.summary.total).toBe(0); expect(filtered.dataAt).toBeNull(); expect(filtered.model.feed.state).toBe("loading");
  // The index panel shows a skeleton until its own source arrives.
  expect(clean.model.index.state).toBe("ready"); expect(filtered.model.index.state).toBe("loading");
  const pending = buildWallModel({ ...base, loaded: false, cleanFilterEnabled: true, feed: { data: null, failed: false, loaded: false } }).model;
  expect(pending.index.state).toBe("loading");
  // Skeletons: waiting panels and the portrait that follows the index; failures and ready panels never.
  expect(WALL_PANEL_IDS.filter((id) => wallPanelLoading(pending, id))).toEqual(["market", "pierrot", "index", "feed", "communities"]);
  expect(WALL_PANEL_IDS.filter((id) => wallPanelLoading(clean.model, id))).toEqual(["market"]);
});

test("the community board (the former 재난방송) lists every community of the live frame with its index, split and state", () => {
  const rows = worldRows(), frame = buildWorldFrame(rows);
  const base = { frame, loaded: true, failed: false, status: "관측 중", timezone: "Asia/Seoul", filtered: true, scopeLabel: "", dark: false, cleanFilterEnabled: true,
    market: { data: null, failed: false, loaded: false }, room: { data: null, failed: false, loaded: false }, feed: { data: null, failed: false, loaded: false } };
  const { communities } = buildWallModel(base).model;
  // Filtered feeds still compare every community: the board shows the frame, not the feed scope.
  expect(communities.state).toBe("ready");
  expect(communities.items.map((c) => c.name)).toEqual(frame.communities.map((c) => c.name));
  const first = communities.items[0], source = frame.communities[0];
  expect(first).toMatchObject({ id: source.id, index: source.index.toFixed(1), total: source.total, fear_ratio: source.fear_ratio, hope_ratio: source.hope_ratio, tone: "ok" });
  expect(first.status).toBe(`관심: ${source.top_stock}`);
  // A collection problem outranks the sample; an empty community has no index.
  const troubled = { ...frame, communities: frame.communities.map((c, i) => i === 0 ? { ...c, collection_problem: true } : i === 1 ? { ...c, total: 0 } : c) };
  const [problem, empty] = buildWallModel({ ...base, frame: troubled }).model.communities.items;
  expect([problem.status, problem.tone]).toEqual(["수집 확인 필요", "problem"]);
  expect([empty.index, empty.status, empty.tone]).toEqual(["—", "소표본 · 관찰 중", "thin"]);
  expect(buildWallModel({ ...base, loaded: false, failed: true }).model.communities.state).toBe("failed");
  // It shares the bottom row with the 곡소리 지수 and sits under the feed in the third section.
  expect([WALL_PANELS.communities.y, WALL_PANELS.communities.h, WALL_PANELS.communities.section]).toEqual([WALL_PANELS.index.y, WALL_PANELS.index.h, 2]);
  expect(WALL_PANELS.feed.y - WALL_PANELS.feed.h / 2).toBeGreaterThan(WALL_PANELS.communities.y + WALL_PANELS.communities.h / 2 + .24);
});
