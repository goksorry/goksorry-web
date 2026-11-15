import { stockPierrotArt } from "@/lib/stock-pierrot";
import { MOOD_COPY, percent, type WorldFrame } from "@/lib/world";

export async function saveWorldPostcard(frame: WorldFrame, date: string, color: string): Promise<void> {
  await document.fonts.ready;
  const { createWorldRenderer } = await import("./hd2d-renderer");
  const sceneCanvas = document.createElement("canvas"); sceneCanvas.width = 1200; sceneCanvas.height = 620;
  let world: Awaited<ReturnType<typeof createWorldRenderer>> | null = null;
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext("2d"); if (!ctx) { throw new Error("이 브라우저는 PNG 저장을 지원하지 않습니다."); }
  ctx.fillStyle = "#10191e"; ctx.fillRect(0, 0, 1200, 800);
  try {
    world = await createWorldRenderer(sceneCanvas, { frame, scene: "theater", stock: "", mobile: false, paused: true, color });
    world.draw(0);
    ctx.fillStyle = "#10191e"; ctx.fillRect(0, 0, 1200, 800);
    ctx.drawImage(sceneCanvas, 0, 0, 1200, 620);
  } catch {
    // The same static theater used by the accessible WebGL fallback also supports export.
    const sceneImage = new Image(); sceneImage.src = "/world/static-theater.png";
    await sceneImage.decode(); ctx.drawImage(sceneImage, 0, 0, 1200, 620);
  } finally { world?.dispose(); }
  const art = stockPierrotArt(frame.overall, document.documentElement.dataset.themeEffectiveTone === "dark");
  const portrait = new Image();
  portrait.src = art.src;
  await portrait.decode();
  ctx.fillStyle = "#aa9169"; ctx.fillRect(446, 246, 308, 208);
  ctx.drawImage(portrait, 450, 250, 300, 200);
  ctx.fillStyle = "#e8dec9"; ctx.font = "bold 30px sans-serif"; ctx.fillText(`${date} · 오늘의 곡소리 한 컷`, 48, 54);
  ctx.font = "bold 25px sans-serif"; ctx.fillText(`${MOOD_COPY[frame.overall.mood]} · 곡소리 지수 ${frame.overall.total ? frame.overall.index.toFixed(1) : "—"}/10`, 48, 650);
  ctx.font = "22px sans-serif"; ctx.fillText(`분석 표본 ${frame.overall.total}건 · 희망 ${percent(frame.overall.hope_ratio)} · 공포 ${percent(frame.overall.fear_ratio)} · 중립 ${frame.overall.neutral}건`, 48, 690);
  ctx.fillStyle = "#bac6c9"; ctx.font = "16px sans-serif";
  ctx.fillText(`저장 ${new Date(frame.generated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST · 데이터 ${frame.data_at ? new Date(frame.data_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " KST" : "없음"}`, 48, 731);
  ctx.fillText("최근 6시간 분석 표본 · 비율은 중립 제외 · 지수는 기존 보정 산식 · 커뮤니티 심리이며 투자 권유가 아닙니다", 48, 765);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 생성 실패")), "image/png"));
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `goksorry-${date}.png`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
