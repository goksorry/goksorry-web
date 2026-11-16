import type { FeedRow } from "./feed-data";
import type { WorldCommunity, WorldFrame, WorldScene, WorldSide, WorldSummary } from "./world";

export const WORLD_COLORS = ["#d9bc79", "#91b4ae", "#efa5ac", "#aaa0c4"];
// NPC places per scene (the visitor is one more). The plaza is a sparse wall-gazing crowd; the battle's camps hold at most
// 20 ants on any screen (lib/world-battle-crowd.ts), so a change of mood reads as a few ants walking over.
export const crowdCapacity = (scene: WorldScene, mobile: boolean): number =>
  scene === "plaza" ? (mobile ? 12 : 20) : scene === "battle" ? 20 : (mobile ? 23 : 47);
export const SIDE_LABEL: Record<WorldSide, string> = { bullish: "희망", bearish: "공포", neutral: "중립" };

/**
 * Left-to-right reading of every hope/fear split (gauges, battle camps, camp buttons). The 곡소리 지수 rises with
 * fear and a gauge fills from the left, so fear is the left side and hope the right; neutral stands between.
 */
export const SIDE_ORDER = ["bearish", "neutral", "bullish"] as const satisfies readonly WorldSide[];
/** The half of the battle field each camp holds: −1 left, 0 the centre front row, 1 right (follows SIDE_ORDER). */
export const CAMP_X: Record<WorldSide, -1 | 0 | 1> = { bearish: -1, neutral: 0, bullish: 1 };

/** Ratio gauge of a summary as 0..1 widths: fear fills from the left edge, hope from the right; neutral is excluded. */
export function ratioGauge(summary: Pick<WorldSummary, "hope_ratio" | "fear_ratio">): { fear: number; hope: number } {
  const clamp = (v: number | null) => Math.max(0, Math.min(1, v ?? 0));
  return { fear: clamp(summary.fear_ratio), hope: clamp(summary.hope_ratio) };
}

// Largest remainder allocation: representation comes from ALL classified counts,
// never the capped evidence lists. One place is reserved for the visitor.
export function crowdDistribution(summary: WorldSummary, capacity: number): Record<WorldSide, number> {
  const keys: WorldSide[] = ["bullish", "bearish", "neutral"];
  const total = keys.reduce((sum, side) => sum + Math.max(0, summary[side]), 0);
  const count = total ? Math.min(Math.max(0, capacity), total) : 0;
  const raw = keys.map((side) => count * Math.max(0, summary[side]) / (total || 1));
  const counts = raw.map(Math.floor);
  const order = keys.map((_, i) => i).sort((a, b) => (raw[b] - counts[b]) - (raw[a] - counts[a]) || a - b);
  const remaining = count - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) counts[order[i]]++;
  return { bullish: counts[0], bearish: counts[1], neutral: counts[2] };
}

export function recentEvidence(summary: WorldSummary, limit = 3): FeedRow[] {
  return [...new Map(Object.values(summary.evidence).flat().map((row) => [row.post_key, row])).values()]
    .sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at) || a.post_key.localeCompare(b.post_key)).slice(0, limit);
}

export function worldHeadline(summary: WorldSummary): string {
  if (!summary.total) return "분석 표본 없음";
  if (summary.total < 3) return "표본 부족";
  if (!summary.bullish && !summary.bearish) return "중립만 집계됨";
  return `공포 ${Math.round((summary.fear_ratio ?? 0) * 100)}% · 희망 ${Math.round((summary.hope_ratio ?? 0) * 100)}%`;
}

export const timelineY = (index: number) => 60 - Math.max(0, Math.min(10, index)) / 10 * 52;

/**
 * A community's collection and sample state as one line (the plaza's community board and the index tab's list): a collection
 * problem outranks a thin sample, which outranks the stock it talks about most.
 */
export function communityStatus(c: Pick<WorldCommunity, "total" | "collection_disabled" | "collection_problem" | "top_stock">): { text: string; tone: "problem" | "thin" | "ok" } {
  if (c.collection_disabled) return { text: "수집 보류", tone: "problem" };
  if (c.collection_problem) return { text: "수집 확인 필요", tone: "problem" };
  if (c.total < 3) return { text: "소표본 · 관찰 중", tone: "thin" };
  return { text: `관심: ${c.top_stock ?? "종목 미지정"}`, tone: "ok" };
}

export function frameStatus(frame: WorldFrame, loaded: boolean, error: string, now: number): string {
  if (error) return loaded ? "조회 실패 · 마지막 정상 데이터" : "조회 실패";
  if (!loaded) return "최초 분석 조회 중";
  if (!frame.overall.total) return "최근 6시간 분석 표본 없음";
  if (frame.data_at && now - Date.parse(frame.data_at) >= 30 * 60_000) return "갱신 지연 · 마지막 정상 데이터";
  return frame.overall.total < 3 ? "소표본 · 해석 대기" : "관측 중";
}
