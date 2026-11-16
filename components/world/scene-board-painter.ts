import type { SceneBoardModel } from "@/lib/world-scene-boards";
import type { BoardBox, BoardImages } from "./board-layer";
import { BOARD, openBoard, type BoardPaintStyle, type BoardPen } from "./board-canvas";

const MOOD_MARK = { hope: BOARD.hope, fear: BOARD.fear } as Record<string, string>;
/** Trace colour of the theater timeline (as the HTML chart). */
const TRACE = "#ae747f";
const CAMP_COLOR = { bullish: BOARD.hope, bearish: BOARD.fear, neutral: BOARD.ink } as const;

/**
 * Paints one non-plaza scene board: header (title, live status), the mood portrait in a left column, then the scene's
 * content. Layout adapts to the board's pixel size; whatever does not fit is left to the detail dialog.
 */
export function paintSceneBoard(model: SceneBoardModel, canvas: HTMLCanvasElement, box: BoardBox, style: BoardPaintStyle, images: BoardImages): void {
  const loading = model.state === "loading";
  const hint = loading ? "불러오는 중…" : model.state === "failed" ? "조회 실패 · 눌러서 열기" : model.scene === "theater" ? model.date : model.status;
  const pen = openBoard(canvas, box, style, { title: model.title, hint });
  if (!pen) return;
  pen.portrait(loading ? undefined : images.get(model.portrait.src), loading ? "" : model.portrait.caption, loading ? undefined : model.portrait.missing);
  if (loading) { pen.skeleton(); return; }
  const { ctx, body, small, top, bottom, left, right } = pen, width = right - left, mid = left + width / 2;

  if (model.scene === "battle") {
    // A wide board also lists the mention ranking the battle's stock is picked from, in a right column. Narrow boards
    // (portrait phones, which drop the portrait too) leave the whole width to the camps; the popup has the ranking.
    const rankW = pen.wide && width >= body * 26 && model.ranking.length ? Math.round(body * 10.5) : 0;
    if (rankW) { ranking(pen, model.ranking, right - rankW, rankW); pen.right = right - rankW - pen.pad; }
    const campsW = pen.right - left, campsMid = left + campsW / 2;
    pen.font(small); ctx.fillStyle = BOARD.dim; ctx.fillText(pen.clip(`전장 종목 · ${model.scope}`, campsW), left, top + small);
    // Footnote lines under the camps. A board too short for both keeps the passing arrival notice over the standing note
    // (the popup's footnote repeats it), so the camps never run into them.
    const lines = [model.note, model.fresh].filter(Boolean);
    const campsNeed = small * 1.6 + body + small * 2.45 + small * .8;
    if (lines.length > 1 && top + campsNeed + lines.length * small * 1.45 > bottom) lines.shift();
    const foot = lines.length * small * 1.45;
    // Most of a line between the camps' sub-lines and the footnote, so they never touch.
    const campTop = top + small * 1.6, campH = bottom - foot - small * .8 - campTop, campW = (campsW - pen.pad * 2) / 3;
    // Each camp is a stacked label / value / sub-line block (about big + 2.45 small tall) at the top of the camp area, any
    // spare height going to the gap above the footnote; the value shrinks before the lines can overlap on a short board.
    const big = Math.max(body, Math.min(body * 2.6, campW / 3.2, campH - small * 2.6));
    const labelY = campTop + small, valueY = labelY + small * .3 + big * .85, subY = valueY + big * .15 + small * 1.15;
    model.camps.forEach((camp, i) => {
      const cx = left + i * (campW + pen.pad) + campW / 2;
      pen.font(small, 700); ctx.fillStyle = CAMP_COLOR[camp.side]; pen.centre(pen.clip(camp.label, campW), cx, labelY);
      pen.font(Math.round(big), 700); ctx.fillStyle = CAMP_COLOR[camp.side]; pen.centre(camp.value, cx, valueY);
      pen.font(small); ctx.fillStyle = BOARD.dim; pen.centre(pen.clip(camp.sub, campW), cx, subY);
    });
    lines.forEach((line, i) => { const fresh = line === model.fresh; pen.font(small, fresh ? 700 : 400); ctx.fillStyle = fresh ? BOARD.gold : BOARD.dim; pen.centre(pen.clip(line, campsW), campsMid, bottom - foot + small * (1.1 + i * 1.45)); });
    return;
  }

  // Theater: the replayed slot's headline and sample, the day's trace with the playback cursor, and the record line.
  const big = Math.round(Math.min(body * 1.5, (bottom - top) / 5));
  pen.font(big, 700); ctx.fillStyle = BOARD.ink; pen.centre(pen.clip(model.headline, width), mid, top + big);
  let y = top + big * 1.3;
  if (model.line) { pen.font(small); ctx.fillStyle = BOARD.dim; pen.centre(pen.clip(`${model.line} · 근거 보기`, width), mid, y + small); y += small * 1.5; }
  const t = model.timeline;
  if (!t) return;
  const foot = small * 1.6;
  trace(pen, t, { x: left, y: y + small * .4, w: width, h: bottom - foot - y - small * .4 });
  pen.font(small); ctx.fillStyle = BOARD.dim; pen.centre(pen.clip(`${t.recorded} · ${t.clock} · ${t.state}`, width), mid, bottom - small * .3);
}

/** The battle board's mention ranking: as many rows as fit, each marked by its mood, the battle's stock in gold (always listed). */
function ranking(pen: BoardPen, items: Extract<SceneBoardModel, { scene: "battle" }>["ranking"], x: number, w: number) {
  const { ctx, small, top, bottom } = pen, rowH = Math.round(small * 1.55);
  ctx.fillStyle = BOARD.line; ctx.fillRect(x - pen.pad / 2, top, 1, bottom - top);
  pen.font(small, 700); ctx.fillStyle = BOARD.dim; ctx.fillText(pen.clip("언급 순위 · 눌러서 고르기", w), x, top + small);
  const rows = Math.max(0, Math.floor((bottom - top - small * 1.5) / rowH));
  // The battle's own stock stays listed (in the last row) when it ranks below what fits.
  const shown = items.slice(0, rows), picked = items.find((item) => item.selected);
  if (picked && rows && !shown.includes(picked)) shown[rows - 1] = picked;
  shown.forEach((item, i) => {
    const y = top + small * 1.5 + rowH * (i + 1) - small * .35, indent = Math.round(small * .6);
    ctx.fillStyle = item.thin ? BOARD.neutral : MOOD_MARK[item.mood] ?? BOARD.neutral; ctx.fillRect(x, y - small * .85, 2, small);
    pen.font(small, item.selected ? 700 : 400); ctx.fillStyle = item.selected ? BOARD.gold : BOARD.ink;
    const countW = ctx.measureText(item.count).width;
    ctx.fillText(pen.clip(`${item.rank} ${item.name}`, w - indent - countW - small * .5), x + indent, y);
    ctx.fillStyle = item.selected ? BOARD.gold : BOARD.dim; pen.alignRight(item.count, x + w, y);
  });
}

/**
 * The day's 곡소리 지수 trace (0..10) with grid lines and the playback cursor: recorded runs solid, gap corrections thinner,
 * dashed and lighter, slots with nothing to show left open.
 */
function trace(pen: BoardPen, t: NonNullable<Extract<SceneBoardModel, { scene: "theater" }>["timeline"]>, area: { x: number; y: number; w: number; h: number }) {
  const { ctx, small } = pen;
  if (area.h < small * 2) return;
  const label = small * 1.6, x0 = area.x + label, w = area.w - label;
  const at = (x: number, index: number) => [x0 + x * w, area.y + (1 - Math.max(0, Math.min(10, index)) / 10) * area.h] as const;
  pen.font(Math.max(9, Math.round(small * .85)));
  for (const v of [10, 5, 0]) {
    const [, gy] = at(0, v);
    ctx.fillStyle = BOARD.line; ctx.fillRect(x0, Math.round(gy), w, 1);
    ctx.fillStyle = BOARD.dim; ctx.fillText(String(v), area.x, gy + small * .35);
  }
  const width = Math.max(2, pen.body * .18);
  ctx.strokeStyle = ctx.fillStyle = TRACE; ctx.lineCap = ctx.lineJoin = "round";
  for (const line of t.lines) {
    const run = line.points;
    if (run.length === 1) { const [px, py] = at(run[0].x, run[0].index); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, width, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.globalAlpha = line.corrected ? .6 : 1; ctx.lineWidth = line.corrected ? Math.max(1.5, width * .7) : width;
    ctx.setLineDash(line.corrected ? [width * 2, width * 2] : []);
    ctx.beginPath(); run.forEach((p, i) => { const [px, py] = at(p.x, p.index); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  const [cx] = at(Math.max(0, Math.min(1, t.cursor)), 0);
  ctx.fillStyle = BOARD.ink; ctx.fillRect(Math.round(cx) - 1, area.y, 2, area.h);
}
