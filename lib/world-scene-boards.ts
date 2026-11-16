import { percent, type WorldFrame, type WorldScene, type WorldStock, type WorldSummary } from "./world";
import { worldHeadline } from "./world-presentation";
import type { BoardRect, Loadable } from "./world-wall";

/**
 * Back-wall boards of the non-plaza scenes: one board each, between the centre sign (top 4.7) and the lamp brackets
 * (from 8.6), and within ±5.8 so a portrait phone (12 units of wall) shows all of it.
 */
export const SCENE_BOARDS = {
  ecosystem: { stocks: { x: 0, y: 6.6, w: 11.4, h: 3.5 } },
  battle: { camps: { x: 0, y: 6.6, w: 11.4, h: 3.5 } },
  broadcast: { communities: { x: 0, y: 6.6, w: 11.4, h: 3.5 } },
  theater: { replay: { x: 0, y: 6.85, w: 9, h: 3 } }
} satisfies Record<Exclude<WorldScene, "plaza">, Record<string, BoardRect>>;
export type BoardScene = keyof typeof SCENE_BOARDS;
export type SceneBoardId = { [S in BoardScene]: keyof (typeof SCENE_BOARDS)[S] }[BoardScene];

/** How a sample reads, shared by the board, its DOM twin and the detail lists. */
export const sampleVerdict = (s: WorldSummary): string =>
  s.total < 3 ? "소표본 · 관찰 중" : s.mood === "fear" ? "공포 우세" : s.mood === "hope" ? "희망 우세" : "혼조";

export type SceneBoardModel =
  | { scene: "ecosystem"; id: "stocks"; title: string; state: Loadable; items: { symbol: string; rank: string; name: string; count: string; hope: string; verdict: string; mood: WorldSummary["mood"]; thin: boolean }[] }
  | { scene: "battle"; id: "camps"; title: string; state: Loadable; scope: string; camps: { side: "bullish" | "bearish" | "neutral"; label: string; value: string; sub: string }[]; note: string; fresh: string }
  | { scene: "broadcast"; id: "communities"; title: string; state: Loadable; items: { id: string; name: string; index: string; ratios: string; status: string }[] }
  | { scene: "theater"; id: "replay"; title: string; state: Loadable; date: string; headline: string; line: string };

export const CAMP_LABEL = { bullish: "희망군", bearish: "절망군", neutral: "중립 관찰석" } as const;

/** Builds the board model of a non-plaza scene from the frame it shows. */
export function buildSceneBoard(input: {
  scene: BoardScene; frame: WorldFrame; loaded: boolean; failed: boolean;
  /** Battle: the selected stock, if any, and its summary (or the overall one). */
  stock?: WorldStock; summary: WorldSummary; fresh: number;
  /** Theater: the replayed date and frame (null = no record in this slot). */
  date: string; replay: WorldFrame | null;
}): SceneBoardModel {
  const state: Loadable = input.loaded ? "ready" : input.failed ? "failed" : "loading";
  const { frame } = input;
  if (input.scene === "ecosystem") return {
    scene: "ecosystem", id: "stocks", title: "최근 6시간 종목별 언급", state,
    items: frame.stocks.map((s, i) => ({
      symbol: s.symbol, rank: String(i + 1).padStart(2, "0"), name: s.name, count: `${s.total}건`, hope: `희망 ${percent(s.hope_ratio)}`,
      verdict: sampleVerdict(s), mood: s.mood, thin: s.total < 3
    }))
  };
  if (input.scene === "battle") {
    const s = input.summary;
    return {
      scene: "battle", id: "camps", title: "희망·공포 비교", state, scope: input.stock?.name ?? "전체 커뮤니티",
      camps: (["bullish", "bearish", "neutral"] as const).map((side) => ({
        side, label: CAMP_LABEL[side],
        value: side === "neutral" ? `${s.neutral}건` : percent(side === "bullish" ? s.hope_ratio : s.fear_ratio),
        sub: side === "neutral" ? "비율에서 별도" : `${s[side]}건`
      })),
      note: s.total < 3 ? "표본 부족 · 진영 우세 판단 보류" : "희망·공포 비율은 중립 제외. 가격·수익률 예측이 아닙니다.",
      fresh: input.fresh > 0 ? `새로운 근거 글 ${input.fresh}건이 도착했습니다.` : ""
    };
  }
  if (input.scene === "broadcast") return {
    scene: "broadcast", id: "communities", title: "커뮤니티별 현황", state,
    items: frame.communities.map((c) => ({
      id: c.id, name: c.name, index: c.total ? `${c.index.toFixed(1)} / 10` : "— / 10",
      ratios: `표본 ${c.total}건 · 희망 ${percent(c.hope_ratio)} · 공포 ${percent(c.fear_ratio)}`,
      status: c.collection_disabled ? "수집 보류" : c.collection_problem ? "수집 확인 필요" : c.total < 3 ? "소표본 · 관찰 중" : `관심: ${c.top_stock ?? "종목 미지정"}`
    }))
  };
  const r = input.replay;
  return {
    scene: "theater", id: "replay", title: "오늘의 개미극장", state: "ready", date: `기록 · ${input.date}`,
    headline: r ? worldHeadline(r.overall) : "이 구간은 기록이 없습니다",
    line: r ? `분석 표본 ${r.overall.total}건 · 희망 ${percent(r.overall.hope_ratio)} / 공포 ${percent(r.overall.fear_ratio)}` : ""
  };
}
