import type { FeedRow } from "./feed-data";
import { getSourceGroupShortLabel } from "./feed-source-groups";
import type { ScopeSummary } from "./feed-scope";
import type { GoksorryRoomEntryPayload } from "./goksorry-room-types";
import type { MarketIndicator } from "./overview-data";
import { pickDisplayTitle } from "./clean-filter";
import { stockPierrotArt } from "./stock-pierrot";
import { worldSummary, type WorldFrame, type WorldSummary } from "./world";

// Rest pose of the wall frame. It was designed for a frontal orthographic camera at 22° elevation:
// wall x maps 1:1 to screen x and wall y is scaled by cos, so wall panels are rectangles. The renderer
// now uses a perspective camera whose shifted frustum reproduces exactly this mapping on the wall
// plane (and turns toward the visitor), so these functions describe the un-turned view; the visible
// floor depth (`front`) is recomputed by the renderer for perspective.
export const WALL_SIN = Math.sin(22 * Math.PI / 180);
export const WALL_COS = Math.cos(22 * Math.PI / 180);
export const WALL_CAMERA_DISTANCE = 28;
export const WALL_HEIGHT = 9;
export const WALL_FACE_Z = -4.975;
export const WALL_PANEL_Z = -4.885;
/** Camera-space vertical coordinate of a world point. */
export const wallScreenY = (y: number, z: number): number => y * WALL_COS - z * WALL_SIN;
const TOP = wallScreenY(WALL_HEIGHT, WALL_FACE_Z) + .5;

export const WALL_PANEL_IDS = ["market", "room", "pierrot", "index", "feed"] as const;
export type WallPanelId = (typeof WALL_PANEL_IDS)[number];
export type WallTextPanelId = Exclude<WallPanelId, "pierrot">;
export type WallSection = 0 | 1 | 2;
export type WallLayout = "wide" | "sectioned";
export const WALL_SECTION_X = [-7, 0, 7] as const;
// The portrait is 3.6 / cos tall so the original 300×200 art projects at exactly 3:2.
export const WALL_PANELS: Record<WallPanelId, { x: number; y: number; w: number; h: number; section: WallSection }> = {
  market: { x: -7, y: 7.2, w: 6.4, h: 2.6, section: 0 },
  room: { x: -7, y: 3.65, w: 6.4, h: 3.9, section: 0 },
  pierrot: { x: 0, y: 6.31, w: 5.4, h: 3.6 / WALL_COS, section: 1 },
  index: { x: 0, y: 2.8, w: 6.4, h: 2.2, section: 1 },
  feed: { x: 7, y: 5.1, w: 6.4, h: 6.8, section: 2 }
};

export type WallView = { layout: WallLayout; section: WallSection; overview: boolean; hudBottom: number };
export type WallFit = { ppu: number; cx: number; top: number; bottom: number; halfW: number; front: number };
export type WallRect = { x: number; y: number; width: number; height: number };

/** Stage heights below this (phone landscape) drop the bottom HUD and frame the wall first. */
export const WALL_SHORT_STAGE = 380;

export function wallFit(w: number, h: number, options: { plaza: boolean } & WallView): WallFit {
  const short = h < WALL_SHORT_STAGE;
  const hud = short ? 0 : Math.max(0, options.hudBottom);
  const sectioned = options.layout === "sectioned";
  const zoomed = options.plaza && sectioned && !options.overview;
  const viewW = zoomed ? 6.7 : !options.plaza && sectioned ? 12 : 23.2;
  // Depth of floor that must stay visible above the bottom HUD.
  const floorZ = !options.plaza ? 8.5 : sectioned ? 7 : short ? .5 : 2;
  const viewV = TOP + floorZ * WALL_SIN;
  const availH = Math.max(1, h - hud);
  const ppu = Math.min(w / viewW, availH / viewV);
  // Width-limited fits give the spare height to the floor; the overview centres instead.
  const slack = availH / ppu - viewV;
  const top = TOP + (options.plaza && sectioned && options.overview ? slack / 2 : 0);
  const bottom = top - h / ppu;
  const visibleFloor = -(bottom + hud / ppu) / WALL_SIN;
  return {
    ppu, top, bottom, halfW: w / (2 * ppu),
    cx: zoomed ? WALL_SECTION_X[options.section] : 0,
    front: Math.max(.8, Math.min(7, visibleFloor))
  };
}

export function projectPanel(id: WallPanelId, fit: WallFit): WallRect {
  const p = WALL_PANELS[id];
  return {
    x: (p.x - p.w / 2 - fit.cx + fit.halfW) * fit.ppu,
    y: (fit.top - wallScreenY(p.y + p.h / 2, WALL_PANEL_Z)) * fit.ppu,
    width: p.w * fit.ppu,
    height: p.h * WALL_COS * fit.ppu
  };
}

/** Body text size in CSS px for wall textures painted at `ppu` px per world unit. */
export const wallBodyPx = (ppu: number): number => Math.max(11, Math.min(20, Math.round(ppu * .26)));

export type Loadable = "loading" | "ready" | "failed";
export type WallModel = {
  index: { state: Loadable; summary: Omit<WorldSummary, "evidence">; dataAt: string | null; time: string | null; status: string; label: string };
  pierrot: { src: string; band: string; label: string };
  market: { state: Loadable; items: { id: string; label: string; value: string; delta: string; tone: string }[] };
  room: { state: Loadable; items: { id: string; text: string; author: string; guest: boolean; time: string; replies: number }[] };
  feed: { state: Loadable; scope: string; items: { key: string; title: string; label: FeedRow["label"]; source: string; symbol: string; time: string }[] };
};

export type WallSource<T> = { data: T | null; failed: boolean; loaded: boolean };
const loadable = (source: WallSource<unknown>): Loadable => source.data ? "ready" : source.failed ? "failed" : "loading";

/**
 * Whether a wall panel still waits for its first payload and should show a loading skeleton.
 * The portrait follows the index: its art is chosen from the index summary.
 */
export function wallPanelLoading(model: WallModel, id: WallPanelId): boolean {
  if (id === "index" || id === "pierrot") return model.index.state === "loading";
  return model[id].state === "loading" && !model[id].items.length;
}

export function buildWallModel(input: {
  frame: WorldFrame; loaded: boolean; failed: boolean; status: string; scopeStatus?: string;
  timezone: string; filtered: boolean; scopeLabel: string; cleanFilterEnabled: boolean; dark: boolean;
  feed: WallSource<{ rows: FeedRow[]; summary?: ScopeSummary }>;
  market: WallSource<{ market_indicators: MarketIndicator[] }>;
  room: WallSource<{ entries: GoksorryRoomEntryPayload[] }>;
}): { model: WallModel; summary: Omit<WorldSummary, "evidence">; dataAt: string | null } {
  const clock = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleTimeString("ko-KR", { timeZone: input.timezone, hour: "2-digit", minute: "2-digit", hour12: false }) : null;
  const scope = input.feed.data?.summary;
  // Legacy feed payloads carry no summary: fall back to the unfiltered world frame.
  const summary = scope ?? (input.filtered ? worldSummary([]) : input.frame.overall);
  const dataAt = scope ? scope.data_at : input.filtered ? null : input.frame.data_at;
  const time = clock(dataAt);
  const art = stockPierrotArt(summary, input.dark);
  return {
    summary, dataAt,
    model: {
      index: {
        // A scoped selection waits for its own summary; the unscoped wall waits for the world frame.
        state: scope ? "ready" : input.filtered ? loadable(input.feed) : input.loaded ? "ready" : input.failed ? "failed" : "loading",
        summary: { total: summary.total, bullish: summary.bullish, bearish: summary.bearish, neutral: summary.neutral, hope_ratio: summary.hope_ratio, fear_ratio: summary.fear_ratio, mood: summary.mood, index: summary.index },
        time: time ? `${time} 기준` : input.failed ? "데이터 조회 실패" : input.loaded ? "기준 시각 없음" : "데이터 조회 중",
        dataAt, status: input.scopeStatus ?? input.status, label: art.label
      },
      pierrot: art,
      market: {
        state: loadable(input.market),
        items: (input.market.data?.market_indicators ?? []).slice(0, 4).map((item) => ({ id: item.id, label: item.label, value: item.value_text, delta: item.delta_text, tone: item.tone }))
      },
      room: {
        state: loadable(input.room),
        items: (input.room.data?.entries ?? []).slice(0, 6).map((entry) => ({
          id: entry.id, text: entry.content.replace(/\s+/g, " ").trim(), author: entry.author_label, guest: entry.author_kind === "guest",
          time: clock(entry.created_at) ?? "", replies: entry.reply_count
        }))
      },
      feed: {
        state: loadable(input.feed), scope: input.scopeLabel,
        items: (input.feed.data?.rows ?? []).slice(0, 12).map((row) => ({
          key: row.post_key, label: row.label, source: getSourceGroupShortLabel(row.source), symbol: row.symbol_name || row.symbol || "",
          title: pickDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled: input.cleanFilterEnabled }).replace(/\s+/g, " ").trim(),
          time: clock(row.analyzed_at) ?? ""
        }))
      }
    }
  };
}
