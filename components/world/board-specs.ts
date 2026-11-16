import { WALL_PANELS, WALL_PANEL_IDS, wallPanelLoading, type WallModel } from "@/lib/world-wall";
import type { BoardSpec } from "./board-layer";
import { paintWallPanel, type WallPaintStyle } from "./wall-painter";

/**
 * Adapter from the plaza wall model to renderer boards: layout from WALL_PANELS, a paint function and cache key
 * per text panel, the portrait as an image. The portrait stays blank until the index (its mood) is known.
 */
export function plazaBoardSpecs(model: WallModel, style: WallPaintStyle): BoardSpec[] {
  return WALL_PANEL_IDS.map((id): BoardSpec => {
    const loading = wallPanelLoading(model, id);
    if (id === "pierrot") return { id, rect: WALL_PANELS[id], loading, content: { kind: "image", src: loading ? "" : model.pierrot.src } };
    return {
      id, rect: WALL_PANELS[id], loading,
      content: { kind: "paint", key: JSON.stringify([model[id], style]), paint: (canvas, box) => paintWallPanel(id, canvas, model, box, style) }
    };
  });
}
