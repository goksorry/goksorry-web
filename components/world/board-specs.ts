import { WALL_PANELS, WALL_PANEL_IDS, wallPanelLoading, type WallModel } from "@/lib/world-wall";
import { SCENE_BOARDS, type SceneBoardModel } from "@/lib/world-scene-boards";
import { paintSceneBoard } from "./scene-board-painter";
import type { BoardSpec } from "./board-layer";
import { paintWallPanel } from "./wall-painter";
import type { BoardPaintStyle } from "./board-canvas";

/**
 * Adapter from the plaza wall model to renderer boards: layout from WALL_PANELS, a paint function and cache key
 * per text panel, the portrait as an image. The portrait stays blank until the index (its mood) is known.
 */
export function plazaBoardSpecs(model: WallModel, style: BoardPaintStyle): BoardSpec[] {
  return WALL_PANEL_IDS.map((id): BoardSpec => {
    const loading = wallPanelLoading(model, id);
    if (id === "pierrot") return { id, rect: WALL_PANELS[id], loading, content: { kind: "image", src: loading ? "" : model.pierrot.src } };
    return {
      id, rect: WALL_PANELS[id], loading,
      content: { kind: "paint", key: JSON.stringify([model[id], style]), paint: (canvas, box) => paintWallPanel(id, canvas, model, box, style) }
    };
  });
}

/** Adapter for the single board of a non-plaza scene. */
export function sceneBoardSpecs(model: SceneBoardModel, style: BoardPaintStyle): BoardSpec[] {
  const rect = (SCENE_BOARDS[model.scene] as Record<string, BoardSpec["rect"]>)[model.id];
  return [{
    id: model.id, rect, loading: model.state === "loading",
    content: { kind: "paint", key: JSON.stringify([model, style]), images: model.portrait.src ? [model.portrait.src] : [], paint: (canvas, box, images) => paintSceneBoard(model, canvas, box, style, images) }
  }];
}

/** What the wall shows in the current scene. */
export type BoardSource = { kind: "plaza"; model: WallModel } | { kind: "scene"; model: SceneBoardModel } | null;

export function boardSpecs(source: BoardSource, style: BoardPaintStyle): BoardSpec[] {
  return !source ? [] : source.kind === "plaza" ? plazaBoardSpecs(source.model, style) : sceneBoardSpecs(source.model, style);
}
