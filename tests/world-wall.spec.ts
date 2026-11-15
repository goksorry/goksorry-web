import { expect, test } from "@playwright/test";
import { buildWorldFrame } from "../lib/world";
import { WALL_COS, WALL_PANELS, WALL_PANEL_IDS, buildWallModel, projectPanel, wallBodyPx, wallFit } from "../lib/world-wall";
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
});
