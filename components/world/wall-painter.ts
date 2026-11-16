import { percent } from "@/lib/world";
import { wallPanelLoading, type WallModel, type WallTextPanelId } from "@/lib/world-wall";
import { BOARD, openBoard, wrapLines, type BoardPaintStyle } from "./board-canvas";
import type { BoardBox } from "./board-layer";

const { ink: INK, dim: DIM, gold: GOLD, line: LINE, hope: HOPE, fear: FEAR } = BOARD;
const TITLES: Record<WallTextPanelId, string> = { market: "시장 지수", room: "곡소리방", index: "곡소리 지수", feed: "곡소리 피드" };

export function paintWallPanel(id: WallTextPanelId, canvas: HTMLCanvasElement, model: WallModel, box: BoardBox, style: BoardPaintStyle): void {
  const loading = wallPanelLoading(model, id);
  const hint = loading ? "불러오는 중…" : id === "index" ? model.index.time ?? "" : id === "feed" && model.feed.scope ? model.feed.scope : "눌러서 열기";
  // Short panels (phone landscape) shrink their text instead of clipping it.
  const pen = openBoard(canvas, box, style, { title: TITLES[id], hint, body: id === "index" ? Math.min(box.body, box.height / 5.6) : box.body });
  if (!pen) return;
  const { ctx, w, h, body, small, pad, top, bottom, font, alignRight: right, clip, notice } = pen;
  // First payload pending: skeleton rows until real content replaces them (the renderer adds the shimmer).
  if (loading) { pen.skeleton(); return; }

  if (id === "market") {
    const { state, items } = model.market;
    if (!items.length) { notice(state === "failed" ? "시장 지수 조회 실패" : "시장 지수 없음"); return; }
    const cellW = (w - pad * 3) / 2, cellH = (bottom - top) / 2;
    items.forEach((item, i) => {
      const x = pad + (i % 2) * (cellW + pad), y = top + Math.floor(i / 2) * cellH;
      const color = item.tone === "up" || item.tone === "greed" ? style.up : item.tone === "down" || item.tone === "fear" ? style.down : DIM;
      if (cellH < small * 1.2 + body * 1.35) {
        // No room for two rows: name and value share one line, coloured by direction.
        const baseline = y + Math.min(cellH - 2, (cellH + body) / 2);
        font(body, 700);
        if (ctx.measureText(item.value).width > cellW * .7) font(small, 700); // Keep the whole number before the name.
        ctx.fillStyle = color === DIM ? INK : color;
        const value = clip(item.value, cellW * .8), valueWidth = ctx.measureText(value).width;
        right(value, x + cellW, baseline);
        font(small); ctx.fillStyle = DIM; ctx.fillText(clip(item.label, cellW - valueWidth - small * .5), x, baseline);
        return;
      }
      // One line for name + change, one for the value: two rows fit the short panel.
      font(small); ctx.fillStyle = color;
      const delta = clip(item.delta, cellW * .62), deltaWidth = ctx.measureText(delta).width;
      right(delta, x + cellW, y + small * 1.2);
      ctx.fillStyle = DIM; ctx.fillText(clip(item.label, cellW - deltaWidth - small * .6), x, y + small * 1.2);
      font(Math.round(Math.min(body * 1.3, (cellH - small * 1.5) * .8)), 700); ctx.fillStyle = INK; ctx.fillText(clip(item.value, cellW), x, y + small * 1.2 + Math.min(body * 1.5, cellH - small * 1.5));
    });
    return;
  }

  if (id === "index") {
    const s = model.index.summary;
    const big = Math.max(body * 2, Math.min(body * 3, (bottom - top) * .62));
    const base = top + big * .92;
    font(Math.round(big), 700); ctx.fillStyle = INK;
    const value = s.total ? s.index.toFixed(1) : "—";
    ctx.fillText(value, pad, base);
    const valueWidth = ctx.measureText(value).width;
    font(body); ctx.fillStyle = DIM; ctx.fillText("/ 10", pad + valueWidth + body * .4, base);
    font(small, 700); ctx.fillStyle = GOLD; ctx.fillText(clip(model.index.label, w * .42), pad, Math.min(bottom, base + small * 1.5));
    // Right block: hope/fear ratio, bar and sample counts.
    const x = Math.round(w * .46), blockW = w - pad - x;
    const hope = `희망 ${percent(s.hope_ratio)}`, fear = `공포 ${percent(s.fear_ratio)}`;
    font(body, 700);
    if (ctx.measureText(hope).width + ctx.measureText(fear).width + body * .6 > blockW) font(small, 700);
    ctx.fillStyle = HOPE; ctx.fillText(hope, x, top + body * 1.2);
    ctx.fillStyle = FEAR; right(fear, w - pad, top + body * 1.2);
    const barY = top + body * 1.75, barH = Math.max(4, Math.round(body * .35));
    ctx.fillStyle = "#52616b"; ctx.fillRect(x, barY, blockW, barH);
    ctx.fillStyle = "#b4aa73"; ctx.fillRect(x, barY, blockW * (s.hope_ratio ?? 0), barH);
    ctx.fillStyle = "#bd7864"; ctx.fillRect(x + blockW * (1 - (s.fear_ratio ?? 0)), barY, blockW * (s.fear_ratio ?? 0), barH);
    font(small);
    const problem = model.index.status && model.index.status !== "관측 중";
    const sampleY = barY + barH + small * 1.5, statusY = barY + barH + small * 2.9;
    // One spare line: a problem status outranks the sample count.
    if (problem && statusY > h - 2) { ctx.fillStyle = FEAR; if (sampleY <= h - 2) ctx.fillText(clip(model.index.status, blockW), x, sampleY); return; }
    ctx.fillStyle = DIM;
    if (sampleY <= h - 2) ctx.fillText(clip(`표본 ${s.total.toLocaleString()}건 · 중립 ${s.neutral.toLocaleString()}건`, blockW), x, sampleY);
    if (problem) { ctx.fillStyle = FEAR; ctx.fillText(clip(model.index.status, blockW), x, statusY); }
    return;
  }

  const rows = id === "feed" ? model.feed.items.map((item) => ({
    text: item.title, meta: [item.source, item.symbol, item.time].filter(Boolean).join(" · "),
    mark: item.label === "bullish" ? HOPE : item.label === "bearish" ? FEAR : "#6f8188"
  })) : model.room.items.map((item) => ({
    text: item.text, meta: [`${item.author}${item.guest ? "*" : ""}`, item.time, item.replies ? `덧글 ${item.replies}` : ""].filter(Boolean).join(" · "), mark: ""
  }));
  const state = id === "feed" ? model.feed.state : model.room.state;
  if (!rows.length) { notice(state === "failed" ? "조회 실패 · 눌러서 다시 열기" : id === "feed" ? "최근 6시간 글 없음" : "아직 글이 없습니다"); return; }
  const indent = id === "feed" ? Math.round(body * .7) : 0, lineH = Math.round(body * 1.42), gap = Math.round(body * .62);
  let y = top;
  for (const row of rows) {
    font(body);
    const lines = wrapLines(ctx, row.text, w - pad * 2 - indent, 2);
    const rowH = lines.length * lineH + small * 1.45;
    if (y + rowH > bottom) break;
    if (row.mark) { ctx.fillStyle = row.mark; ctx.fillRect(pad, y + body * .25, Math.max(2, Math.round(body * .22)), rowH - body * .45); }
    ctx.fillStyle = INK;
    lines.forEach((line, i) => ctx.fillText(line, pad + indent, y + lineH * (i + 1) - body * .32));
    font(small); ctx.fillStyle = DIM; ctx.fillText(clip(row.meta, w - pad * 2 - indent), pad + indent, y + lines.length * lineH + small * 1.05);
    y += rowH + gap;
    ctx.fillStyle = LINE; ctx.fillRect(pad, y - gap / 2, w - pad * 2, 1);
  }
}
