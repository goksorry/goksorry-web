import type { BoardBox } from "./board-layer";
import { paintWallSkeleton } from "./wall-skeleton";

/** Fonts and direction colours taken from the page theme. */
export type BoardPaintStyle = { family: string; up: string; down: string };

/** Board palette (dark board face, whatever the page theme). */
export const BOARD = { ink: "#ece6d8", dim: "#a9b7bd", gold: "#dfd2ad", line: "#34464d", hope: "#c3bf88", fear: "#de9d87", bg: "#101c22", neutral: "#6f8188" } as const;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
const graphemes = (text: string): string[] => segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);

/** Greedy grapheme wrap with a soft break at the last space; the final line ends with an ellipsis. */
export function wrapLines(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, maxWidth: number, maxLines: number): string[] {
  const parts = graphemes(text.replace(/\s+/g, " ").trim());
  const lines: string[] = [];
  let start = 0;
  while (start < parts.length && lines.length < maxLines) {
    let end = start, line = "";
    while (end < parts.length && ctx.measureText(line + parts[end]).width <= maxWidth) line += parts[end++];
    if (end === start) line = parts[end++]; // A single glyph wider than the column still advances.
    const last = lines.length === maxLines - 1;
    if (end < parts.length && !last) {
      const space = line.lastIndexOf(" ");
      if (space > 0 && line.length - space <= 7) { end = start + graphemes(line.slice(0, space + 1)).length; line = line.slice(0, space); }
    }
    if (end < parts.length && last) {
      const fitted = graphemes(line.trimEnd());
      while (fitted.length && ctx.measureText(`${fitted.join("")}…`).width > maxWidth) fitted.pop();
      line = `${fitted.join("").trimEnd()}…`;
    }
    lines.push(line.trim());
    start = end;
  }
  return lines;
}

/** Drawing kit for one board, in CSS px: metrics derived from the body size and the content area below the header. */
export type BoardPen = {
  ctx: CanvasRenderingContext2D;
  w: number; h: number; body: number; small: number; pad: number; head: number;
  /** Content area below the header strip. */
  top: number; bottom: number;
  font(size: number, weight?: number): void;
  right(text: string, x: number, y: number): void;
  centre(text: string, x: number, y: number): void;
  /** One line, ellipsised to `max` px. */
  clip(text: string, max: number): string;
  /** A dim one-line message at the top of the content area. */
  notice(text: string): void;
  /** Skeleton rows over the content area. */
  skeleton(): void;
};

/**
 * Clears the canvas to the board face, draws the header strip (title left, hint right, rule) and returns the pen.
 * `body` overrides the box's body size (short boards shrink their text instead of clipping it).
 */
export function openBoard(canvas: HTMLCanvasElement, box: BoardBox, style: BoardPaintStyle, header: { title: string; hint: string; body?: number }): BoardPen | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width: w, height: h } = box, body = header.body ?? box.body;
  ctx.setTransform(box.scale, 0, 0, box.scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BOARD.bg; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const pad = Math.round(body * .8), small = Math.max(9, Math.round(body * .78)), head = Math.round(body * 1.9);
  const font = (size: number, weight = 400) => { ctx.font = `${weight} ${size}px ${style.family}`; };
  const aligned = (align: CanvasTextAlign) => (text: string, x: number, y: number) => { ctx.textAlign = align; ctx.fillText(text, x, y); ctx.textAlign = "left"; };
  const clip = (text: string, max: number) => wrapLines(ctx, text, max, 1)[0] ?? "";
  font(Math.round(body * 1.05), 700); ctx.fillStyle = BOARD.gold; ctx.fillText(header.title, pad, head * .7);
  const titleWidth = ctx.measureText(header.title).width;
  font(small); ctx.fillStyle = BOARD.dim;
  aligned("right")(clip(`${header.hint} ↗`, w - pad * 3 - titleWidth), w - pad, head * .7);
  ctx.fillStyle = BOARD.line; ctx.fillRect(pad, head, w - pad * 2, 1);
  const top = head + Math.round(body * .5), bottom = h - Math.round(body * .5);
  return {
    ctx, w, h, body, small, pad, head, top, bottom, font, clip,
    right: aligned("right"), centre: aligned("center"),
    notice(text) { font(body); ctx.fillStyle = BOARD.dim; ctx.fillText(text, pad, top + body * 1.4); },
    skeleton() { paintWallSkeleton(ctx, { x: pad, y: top, width: w - pad * 2, height: bottom - top }, body); }
  };
}
