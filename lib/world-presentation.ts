import type { FeedRow } from "./feed-data";
import type { WorldFrame, WorldSide, WorldSlot, WorldSummary } from "./world";

export const WORLD_COLORS = ["#d9bc79", "#91b4ae", "#efa5ac", "#aaa0c4"];
export const SIDE_LABEL: Record<WorldSide, string> = { bullish: "희망", bearish: "공포", neutral: "중립" };

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
  if (!summary.total) return "아직, 들려온 목소리가 없습니다.";
  if (summary.total < 3) return "몇 개의 목소리. 조금 더 지켜봅니다.";
  if (!summary.bullish && !summary.bearish) return "중립의 목소리만 모인 새벽.";
  if (summary.mood === "fear") return "오늘은, 짐을 든 개미가 많습니다.";
  if (summary.mood === "hope") return "어두운 골목에도, 작은 희망은 있습니다.";
  return "같은 골목, 엇갈리는 마음.";
}

export const timelineY = (index: number) => 60 - Math.max(0, Math.min(10, index)) / 10 * 52;
export function timelineSegments(slots: WorldSlot[]): string[] {
  const segments: string[] = [];
  let points: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].frame) points.push(`${i / Math.max(1, slots.length - 1) * 600},${timelineY(slots[i].frame!.overall.index)}`);
    else if (points.length) { segments.push(points.join(" ")); points = []; }
  }
  if (points.length) segments.push(points.join(" "));
  return segments;
}

export function frameStatus(frame: WorldFrame, loaded: boolean, error: string, now: number): string {
  if (error) return loaded ? "조회 실패 · 마지막 정상 데이터" : "조회 실패";
  if (!loaded) return "최초 분석 조회 중";
  if (!frame.overall.total) return "최근 6시간 분석 표본 없음";
  if (frame.data_at && now - Date.parse(frame.data_at) >= 30 * 60_000) return "갱신 지연 · 마지막 정상 데이터";
  return frame.overall.total < 3 ? "소표본 · 해석 대기" : "관측 중";
}
