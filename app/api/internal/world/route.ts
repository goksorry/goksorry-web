import { NextResponse } from "next/server";
import { getWorldFrame } from "@/lib/world-data";
import { buildWorldFrame } from "@/lib/world";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getWorldFrame(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("world read failed", { message: error instanceof Error ? error.message : "unknown" });
    const frame = buildWorldFrame([], { collection: { last_run_at: null, errors: 0, degraded: false, unavailable: true } });
    return NextResponse.json({ ...frame, error: "월드 데이터를 불러오지 못했습니다. 잠시 후 다시 확인합니다." }, { status: 503 });
  }
}
