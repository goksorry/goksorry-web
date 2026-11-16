import { percent } from "@/lib/world";
import { wallPanelLoading, type WallModel, type WallTextPanelId } from "@/lib/world-wall";
import { paintWallSkeleton } from "./wall-skeleton";

export type WallPaintStyle = { family: string; up: string; down: string };
/** Logical (CSS px) size of the panel, device scale of the backing canvas and body text size. */
export type WallPaintBox = { width: number; height: number; scale: number; body: number };

const INK = "#ece6d8", DIM = "#a9b7bd", GOLD = "#dfd2ad", LINE = "#34464d", HOPE = "#c3bf88", FEAR = "#de9d87", BG = "#101c22";
const TITLES: Record<WallTextPanelId, string> = { market: "시장 지수", room: "곡소리방", index: "곡소리 지수", feed: "곡소리 피드" };
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

export function paintWallPanel(id: WallTextPanelId, canvas: HTMLCanvasElement, model: WallModel, box: WallPaintBox, style: WallPaintStyle): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = box;
  // Short panels (phone landscape) shrink their text instead of clipping it.
  const body = id === "index" ? Math.min(box.body, h / 5.6) : box.body;
  ctx.setTransform(box.scale, 0, 0, box.scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";
  const font = (size: number, weight = 400) => { ctx.font = `${weight} ${size}px ${style.family}`; };
  const pad = Math.round(body * .8), small = Math.max(9, Math.round(body * .78)), head = Math.round(body * 1.9);
  const right = (text: string, x: number, y: number) => { ctx.textAlign = "right"; ctx.fillText(text, x, y); ctx.textAlign = "left"; };
  const clip = (text: string, max: number) => wrapLines(ctx, text, max, 1)[0] ?? "";
  // Header strip: panel name and the tap hint.
  font(Math.round(body * 1.05), 700); ctx.fillStyle = GOLD; ctx.fillText(TITLES[id], pad, head * .7);
  const titleWidth = ctx.measureText(TITLES[id]).width;
  font(small); ctx.fillStyle = DIM;
  const loading = wallPanelLoading(model, id);
  const hint = loading ? "불러오는 중…" : id === "index" ? model.index.time ?? "" : id === "feed" && model.feed.scope ? model.feed.scope : "눌러서 열기";
  right(clip(`${hint} ↗`, w - pad * 3 - titleWidth), w - pad, head * .7);
  ctx.fillStyle = LINE; ctx.fillRect(pad, head, w - pad * 2, 1);
  const top = head + Math.round(body * .5), bottom = h - Math.round(body * .5);
  const notice = (text: string) => { font(body); ctx.fillStyle = DIM; ctx.fillText(text, pad, top + body * 1.4); };
  // First payload pending: skeleton rows until real content replaces them (the renderer adds the shimmer).
  if (loading) { paintWallSkeleton(ctx, { x: pad, y: top, width: w - pad * 2, height: bottom - top }, body); return; }

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
