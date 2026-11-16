/** Skeleton colour shared by the WebGL wall texture and the DOM fallback (`.world-skeleton`). */
export const WALL_SKELETON_COLOR = "#22343b";
/** Relative widths of successive skeleton rows, so the block reads as ragged text. */
export const WALL_SKELETON_WIDTHS = [.92, .7, .82] as const;

export type SkeletonArea = { x: number; y: number; width: number; height: number };

/**
 * Paints placeholder text rows into `area` of a 2D context. Rows are `unit` px tall-ish and fill the area
 * top-down; only the shape lives here. Motion is the renderer's job (see wall-shimmer.ts).
 */
export function paintWallSkeleton(ctx: CanvasRenderingContext2D, area: SkeletonArea, unit: number): void {
  const rowH = unit * .8, step = unit * 1.8;
  ctx.fillStyle = WALL_SKELETON_COLOR;
  for (let y = area.y + unit * .3, i = 0; y + rowH <= area.y + area.height; y += step, i++) {
    ctx.fillRect(area.x, y, area.width * WALL_SKELETON_WIDTHS[i % WALL_SKELETON_WIDTHS.length], rowH);
  }
}
