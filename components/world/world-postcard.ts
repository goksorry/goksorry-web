import { MOOD_COPY, percent, type WorldFrame } from "@/lib/world";

// Canvas uses local text and vector primitives only, so no cross-origin image can
// taint export. Long labels are clipped to keep the shared image readable.
export async function saveWorldPostcard(frame: WorldFrame, date: string, color: string): Promise<void> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저는 PNG 저장을 지원하지 않습니다.");
  ctx.fillStyle = "#f4efde"; ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = "#35433d"; ctx.font = "bold 23px sans-serif"; ctx.fillText("곡소리 개미 월드  /  DAILY POSTCARD", 70, 76);
  ctx.font = "bold 54px sans-serif"; ctx.fillText("오늘의 곡소리 한 컷", 70, 158);
  ctx.font = "24px sans-serif"; ctx.fillText(`${date} · ${MOOD_COPY[frame.overall.mood]}`, 73, 204);
  ctx.fillStyle = "#dce2be";
  ctx.beginPath(); ctx.moveTo(120, 470); ctx.lineTo(600, 250); ctx.lineTo(1080, 470); ctx.lineTo(600, 690); ctx.closePath(); ctx.fill();
  const ants = frame.stocks.slice(0, 8);
  ants.forEach((stock, i) => {
    const x = 310 + i % 4 * 190, y = 385 + Math.floor(i / 4) * 160;
    ctx.fillStyle = stock.mood === "hope" ? "#8fba9f" : stock.mood === "fear" ? "#c88e90" : "#c3b08a";
    ctx.beginPath(); ctx.ellipse(x, y, 40, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#343b3b"; ctx.beginPath(); ctx.ellipse(x, y + 7, 19, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center"; ctx.fillText(stock.name.slice(0, 12), x, y + 52);
    ctx.font = "15px sans-serif"; ctx.fillText(`${stock.total}건 · 희망 ${percent(stock.hope_ratio)}`, x, y + 77);
  });
  ctx.textAlign = "left"; ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(580, 600, 20, 14, 0, 0, Math.PI * 2); ctx.ellipse(605, 605, 13, 10, 0, 0, Math.PI * 2); ctx.ellipse(630, 607, 22, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#343b3b"; ctx.font = "22px sans-serif";
  ctx.fillText(`희망 ${percent(frame.overall.hope_ratio)}  ·  공포 ${percent(frame.overall.fear_ratio)}  ·  중립 ${frame.overall.neutral}건`, 72, 718);
  ctx.font = "15px sans-serif";
  ctx.fillText(`기록 기준 ${new Date(frame.generated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST · 커뮤니티 심리 · 투자 권유 아님`, 72, 758);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 생성 실패")), "image/png"));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `goksorry-${date}.png`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
