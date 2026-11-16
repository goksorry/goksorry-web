import type { SceneBoardModel } from "@/lib/world-scene-boards";
import type { BoardBox } from "./board-layer";
import { BOARD, openBoard, wrapLines, type BoardPaintStyle, type BoardPen } from "./board-canvas";

const MOOD_MARK = { hope: BOARD.hope, fear: BOARD.fear } as Record<string, string>;
const CAMP_COLOR = { bullish: BOARD.hope, bearish: BOARD.fear, neutral: BOARD.ink } as const;

/** Grid that fits as many cells of at least `minW` × `cellH` as the content area holds, up to `max` columns. */
function grid(pen: BoardPen, minW: number, cellH: number, max: number) {
  const width = pen.w - pen.pad * 2, cols = Math.max(1, Math.min(max, Math.floor(width / minW)));
  const rows = Math.max(1, Math.floor((pen.bottom - pen.top) / cellH));
  return { cols, rows, cellW: (width - (cols - 1) * pen.pad) / cols, cellH, at: (i: number) => ({ x: pen.pad + (i % cols) * ((width - (cols - 1) * pen.pad) / cols + pen.pad), y: pen.top + Math.floor(i / cols) * cellH }) };
}

/** Two-line cell: bold title (with an optional right-aligned value) over a dim meta line; `mark` paints a side bar. */
function cell(pen: BoardPen, x: number, y: number, cellW: number, cellH: number, title: string, meta: string, value = "", mark = "") {
  const { ctx, body, small } = pen, indent = mark ? Math.round(body * .7) : 0;
  if (mark) { ctx.fillStyle = mark; ctx.fillRect(x, y + body * .2, Math.max(2, Math.round(body * .22)), cellH - body * .7); }
  pen.font(body, 700);
  const valueW = value ? ctx.measureText(value).width + body * .5 : 0;
  ctx.fillStyle = BOARD.ink; ctx.fillText(pen.clip(title, cellW - indent - valueW), x + indent, y + body * 1.1);
  if (value) { ctx.fillStyle = BOARD.gold; pen.right(value, x + cellW, y + body * 1.1); }
  pen.font(small); ctx.fillStyle = BOARD.dim; ctx.fillText(pen.clip(meta, cellW - indent), x + indent, y + body * 1.1 + small * 1.35);
  ctx.fillStyle = BOARD.line; ctx.fillRect(x, y + cellH - body * .35, cellW, 1);
}

/** Paints one non-plaza scene board. Layout adapts to the board's pixel size; content past the area is left for the detail dialog. */
export function paintSceneBoard(model: SceneBoardModel, canvas: HTMLCanvasElement, box: BoardBox, style: BoardPaintStyle): void {
  const loading = model.state === "loading";
  const hint = loading ? "불러오는 중…" : model.state === "failed" ? "조회 실패 · 눌러서 열기" : model.scene === "theater" ? model.date : "눌러서 열기";
  const pen = openBoard(canvas, box, style, { title: model.title, hint });
  if (!pen) return;
  if (loading) { pen.skeleton(); return; }
  const { ctx, body, small, pad, top, bottom, w } = pen;
  const rowH = Math.round(body * 1.1 + small * 1.35 + body * .9);

  if (model.scene === "ecosystem") {
    if (!model.items.length) { pen.notice("분석된 종목이 없습니다. 새 표본을 기다리고 있습니다."); return; }
    const g = grid(pen, body * 11, rowH, 4);
    model.items.slice(0, g.cols * g.rows).forEach((item, i) => {
      const { x, y } = g.at(i);
      cell(pen, x, y, g.cellW, g.cellH, `${item.rank} ${item.name}`, `${item.count} · ${item.hope} · ${item.verdict}`, "", item.thin ? BOARD.neutral : MOOD_MARK[item.mood] ?? BOARD.neutral);
    });
    return;
  }

  if (model.scene === "broadcast") {
    if (!model.items.length) { pen.notice("커뮤니티 데이터가 없습니다."); return; }
    const g = grid(pen, body * 15, rowH, 3);
    model.items.slice(0, g.cols * g.rows).forEach((item, i) => {
      const { x, y } = g.at(i);
      cell(pen, x, y, g.cellW, g.cellH, item.name, `${item.ratios} · ${item.status}`, item.index);
    });
    return;
  }

  if (model.scene === "battle") {
    pen.font(small); ctx.fillStyle = BOARD.dim; ctx.fillText(pen.clip(`전장 종목 · ${model.scope}`, w - pad * 2), pad, top + small);
    const lines = [model.note, model.fresh].filter(Boolean);
    const foot = lines.length * small * 1.45;
    const campTop = top + small * 1.6, campH = bottom - foot - campTop, campW = (w - pad * 4) / 3;
    const big = Math.max(body * 1.3, Math.min(body * 2.6, campH * .45));
    model.camps.forEach((camp, i) => {
      const cx = pad + i * (campW + pad) + campW / 2;
      pen.font(small, 700); ctx.fillStyle = CAMP_COLOR[camp.side]; pen.centre(pen.clip(camp.label, campW), cx, campTop + campH * .22);
      pen.font(Math.round(big), 700); ctx.fillStyle = CAMP_COLOR[camp.side]; pen.centre(camp.value, cx, campTop + campH * .22 + big * 1.05);
      pen.font(small); ctx.fillStyle = BOARD.dim; pen.centre(pen.clip(camp.sub, campW), cx, Math.min(campTop + campH, campTop + campH * .22 + big * 1.05 + small * 1.5));
    });
    lines.forEach((line, i) => { pen.font(small, i ? 700 : 400); ctx.fillStyle = i ? BOARD.gold : BOARD.dim; pen.centre(pen.clip(line, w - pad * 2), w / 2, bottom - foot + small * (1.1 + i * 1.45)); });
    return;
  }

  // Theater: the replayed slot's headline and sample.
  const big = Math.round(Math.min(body * 1.8, (bottom - top) / 3.4));
  pen.font(big, 700); ctx.fillStyle = BOARD.ink;
  const headline = wrapLines(ctx, model.headline, w - pad * 2, 2);
  headline.forEach((line, i) => pen.centre(line, w / 2, top + big * (1.15 + i * 1.25)));
  if (model.line) { pen.font(small); ctx.fillStyle = BOARD.dim; pen.centre(pen.clip(`${model.line} · 근거 보기`, w - pad * 2), w / 2, Math.min(bottom, top + big * (1.15 + headline.length * 1.25) + small * .8)); }
}
