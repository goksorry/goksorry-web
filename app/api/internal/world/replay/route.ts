import { NextResponse } from "next/server";
import { loadWorldReplay } from "@/lib/world-data";
import { buildWorldReplay, worldDayBounds, worldDate } from "@/lib/world";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? worldDate();
  const bounds = worldDayBounds(date);
  if (!bounds) return NextResponse.json({ error: "날짜는 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
  const today = worldDate();
  const earliest = worldDate(new Date(Date.now() - 6 * 24 * 60 * 60_000));
  if (date > today || date < earliest) return NextResponse.json({ error: "최근 7일의 기록만 볼 수 있습니다." }, { status: 400 });
  try {
    return NextResponse.json(await loadWorldReplay(date), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("world replay read failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ...buildWorldReplay(date, []), error: "극장 기록을 불러오지 못했습니다." }, { status: 503 });
  }
}
