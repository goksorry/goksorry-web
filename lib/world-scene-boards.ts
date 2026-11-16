import { percent, type WorldFrame, type WorldScene, type WorldStock, type WorldSummary } from "./world";
import { SIDE_ORDER, worldHeadline } from "./world-presentation";
import type { BoardRect, Loadable } from "./world-wall";
import type { TheaterTimeline } from "./world-theater";

/**
 * Back-wall boards of the non-plaza scenes: one board each, between the centre sign (top 4.7) and the lamp brackets
 * (from 8.6), and within ±5.8 so a portrait phone (12 units of wall) shows all of it.
 */
export const SCENE_BOARDS = {
  battle: { camps: { x: 0, y: 6.6, w: 11.4, h: 3.5 } },
  theater: { replay: { x: 0, y: 6.6, w: 11.4, h: 3.5 } }
} satisfies Record<Exclude<WorldScene, "plaza">, Record<string, BoardRect>>;
export type BoardScene = keyof typeof SCENE_BOARDS;
export type SceneBoardId = { [S in BoardScene]: keyof (typeof SCENE_BOARDS)[S] }[BoardScene];

/** How a sample reads, shared by the board, its DOM twin and the detail lists. */
export const sampleVerdict = (s: WorldSummary): string =>
  s.total < 3 ? "소표본 · 관찰 중" : s.mood === "fear" ? "공포 우세" : s.mood === "hope" ? "희망 우세" : "혼조";

/** One row of the battle's stock picker: the recent mention ranking that 개미 생태계 used to show. */
export type StockRank = { symbol: string; rank: string; name: string; count: string; hope: string; verdict: string; mood: WorldSummary["mood"]; thin: boolean; selected: boolean };
/** The frame's stocks by mention count (as the frame orders them), `selected` marking the battle's stock. */
export const stockRanking = (stocks: WorldStock[], selected: string): StockRank[] => stocks.map((s, i) => ({
  symbol: s.symbol, rank: String(i + 1).padStart(2, "0"), name: s.name, count: `${s.total}건`, hope: `희망 ${percent(s.hope_ratio)}`,
  verdict: sampleVerdict(s), mood: s.mood, thin: s.total < 3, selected: s.symbol === selected
}));

/**
 * Shared by every scene board: header status line and the mood portrait (original Pierrot art). `missing` replaces the
 * picture with that text (the theater where no record can be shown: no mood to picture); `src` is then empty.
 */
type BoardCommon = { title: string; state: Loadable; status: string; portrait: { src: string; caption: string; missing?: string } };
export type SceneBoardModel = BoardCommon & (
  | { scene: "battle"; id: "camps"; scope: string; camps: { side: "bullish" | "bearish" | "neutral"; label: string; value: string; sub: string }[]; note: string; fresh: string; ranking: StockRank[] }
  | { scene: "theater"; id: "replay"; date: string; headline: string; line: string; timeline: TheaterTimeline | null });

export const CAMP_LABEL = { bullish: "희망군", bearish: "절망군", neutral: "중립 관찰석" } as const;

/** Builds the board model of a non-plaza scene from the frame it shows. */
export function buildSceneBoard(input: {
  scene: BoardScene; frame: WorldFrame; loaded: boolean; failed: boolean;
  /** Battle: the selected stock, if any, and its summary (or the overall one). */
  stock?: WorldStock; summary: WorldSummary; fresh: number;
  /** Theater: the replayed date and frame (null = no record can be shown in this slot), and whether that frame is a gap correction. */
  date: string; replay: WorldFrame | null; corrected?: boolean; timeline?: TheaterTimeline | null;
  /** Theater: the day's records are still loading, so a null `replay` is not yet "no record" (the board shows its skeleton). */
  pending?: boolean;
  /** Live status line (e.g. "관측 중 · 13:09 KST") and the portrait art for the summary the scene shows. */
  status: string; art: { src: string; label: string };
}): SceneBoardModel {
  const { frame, art } = input, theater = input.scene === "theater";
  const common = {
    state: (theater ? (input.pending && !input.replay ? "loading" : "ready") : input.loaded ? "ready" : input.failed ? "failed" : "loading") as Loadable, status: input.status,
    portrait: theater && !input.replay ? { src: "", caption: "기록 시점", missing: "기록 없음" }
      : { src: art.src, caption: `${theater ? "기록 시점" : "현재 분위기"}${theater && input.corrected ? " (보정)" : ""} · ${art.label}` }
  };
  if (input.scene === "battle") {
    const s = input.summary;
    return {
      ...common, scene: "battle", id: "camps", title: "희망·공포 비교", scope: input.stock?.name ?? "전체 커뮤니티",
      camps: SIDE_ORDER.map((side) => ({
        side, label: CAMP_LABEL[side],
        value: side === "neutral" ? `${s.neutral}건` : percent(side === "bullish" ? s.hope_ratio : s.fear_ratio),
        sub: side === "neutral" ? "비율에서 별도" : `${s[side]}건`
      })),
      note: s.total < 3 ? "표본 부족 · 진영 우세 판단 보류" : "희망·공포 비율은 중립 제외. 가격·수익률 예측이 아닙니다.",
      fresh: input.fresh > 0 ? `새로운 근거 글 ${input.fresh}건이 도착했습니다.` : "",
      ranking: stockRanking(frame.stocks, input.stock?.symbol ?? "")
    };
  }
  const r = input.replay;
  return {
    ...common, scene: "theater", id: "replay", title: "오늘의 개미극장", date: `기록 · ${input.date}`,
    headline: r ? worldHeadline(r.overall) : "이 구간은 기록이 없습니다",
    timeline: input.timeline ?? null,
    line: r ? `${input.corrected ? "보정 구간 · " : ""}분석 표본 ${r.overall.total}건 · 공포 ${percent(r.overall.fear_ratio)} / 희망 ${percent(r.overall.hope_ratio)}` : ""
  };
}
