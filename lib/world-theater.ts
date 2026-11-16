import { moodOf, type WorldFrame, type WorldReplay, type WorldSide, type WorldSlot, type WorldSummary } from "./world";
import { SOURCE_GROUP_IDS, serializeSourceGroupSelection, type SourceGroupId } from "./feed-source-groups";

/** Length of a full day's replay, in seconds of playback. */
export const THEATER_SECONDS = 30;
/** Seconds the theater's ants take to fade out where no record can be shown, and back in when records resume. */
export const CAST_FADE_SECONDS = .8;

/** A replay slot after gap correction: `corrected` marks a frame interpolated between the records around a gap. */
export type TheaterSlot = WorldSlot & { corrected: boolean };
export type TheaterReplay = Omit<WorldReplay, "slots"> & { slots: TheaterSlot[] };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const time = (a: string, b: string, t: number) => new Date(Math.round(lerp(Date.parse(a), Date.parse(b), t))).toISOString();
const noEvidence = (): WorldSummary["evidence"] => ({ bullish: [], bearish: [], neutral: [] });

/**
 * A sample `t` of the way (0..1) from `a` to `b`: counts and the 곡소리 지수 on the straight line between them (counts
 * whole), each ratio likewise when both ends have one (else from the counts), and the mood read from those values by
 * the live rule. An interpolated sample has no evidence posts.
 */
export function interpolateSummary(a: Omit<WorldSummary, "evidence">, b: Omit<WorldSummary, "evidence">, t: number): WorldSummary {
  const bullish = Math.round(lerp(a.bullish, b.bullish, t)), bearish = Math.round(lerp(a.bearish, b.bearish, t)), neutral = Math.round(lerp(a.neutral, b.neutral, t));
  const total = bullish + bearish + neutral, directional = bullish + bearish;
  const ratio = (x: number | null, y: number | null, count: number) => !directional ? null : x !== null && y !== null ? lerp(x, y, t) : count / directional;
  const hope_ratio = ratio(a.hope_ratio, b.hope_ratio, bullish), fear_ratio = ratio(a.fear_ratio, b.fear_ratio, bearish);
  return {
    total, bullish, bearish, neutral, hope_ratio, fear_ratio, mood: moodOf(total, directional, hope_ratio, fear_ratio),
    index: Math.round(lerp(a.index, b.index, t) * 100) / 100, evidence: noEvidence()
  };
}

/**
 * The frame `t` of the way from record `a` to record `b`. Communities and stocks are kept where both records have them
 * (by id / symbol); their names and collection state are the earlier record's, the time stamps lie between the two.
 */
export function interpolateFrame(a: WorldFrame, b: WorldFrame, t: number): WorldFrame {
  const communities = a.communities.flatMap((c) => {
    const next = b.communities.find((other) => other.id === c.id);
    return next ? [{ ...c, ...interpolateSummary(c, next, t) }] : [];
  });
  const stocks = a.stocks.flatMap((s) => {
    const next = b.stocks.find((other) => other.symbol === s.symbol);
    return next ? [{ ...s, ...interpolateSummary(s, next, t) }] : [];
  }).sort((x, y) => y.total - x.total || x.symbol.localeCompare(y.symbol));
  return {
    ...a, generated_at: time(a.generated_at, b.generated_at, t),
    data_at: a.data_at && b.data_at ? time(a.data_at, b.data_at, t) : a.data_at,
    overall: interpolateSummary(a.overall, b.overall, t), communities, stocks
  };
}

/**
 * Gap correction: every run of missing slots between two records is filled on the straight line between those records,
 * and marked `corrected`. Slots before the first record or after the last one stay empty (nothing to join).
 */
export function correctReplay(replay: WorldReplay): TheaterReplay {
  const slots: TheaterSlot[] = replay.slots.map((slot) => ({ ...slot, corrected: false }));
  let last = -1;
  slots.forEach((slot, i) => {
    if (!slot.frame) return;
    if (last >= 0 && i - last > 1) {
      const a = slots[last].frame!, b = slot.frame;
      for (let k = last + 1; k < i; k++) slots[k] = { bucket_at: slots[k].bucket_at, frame: interpolateFrame(a, b, (k - last) / (i - last)), corrected: true };
    }
    last = i;
  });
  return { ...replay, slots };
}

/** One stroke of the day's trace: x is the slot's place in the day (0..1), index the 곡소리 지수 (0..10). */
export type TracePoint = { x: number; index: number };
/**
 * A run of the trace: recorded (solid) or corrected (drawn lighter and dashed: it spans a gap, from the record before
 * to the record after). A run of one point is a lone record, drawn as a dot.
 */
export type TraceLine = { points: TracePoint[]; corrected: boolean };

/**
 * What the theater shows about its replay, for the wall board and the controls alike: the 곡소리 지수 trace, the
 * playback cursor and the record lines.
 */
export type TheaterTimeline = {
  lines: TraceLine[];
  /** Playback position, 0..1. */
  cursor: number;
  recorded: string; clock: string; state: string;
};

export const theaterSlotIndex = (replay: { slots: unknown[] }, position: number) =>
  Math.max(0, Math.min(replay.slots.length - 1, Math.floor(position / THEATER_SECONDS * replay.slots.length)));

/** The trace of a corrected replay: neighbouring slots with frames are joined; a stroke touching a corrected slot is corrected. */
export function traceLines(slots: TheaterSlot[]): TraceLine[] {
  const last = Math.max(1, slots.length - 1), lines: TraceLine[] = [];
  let line: TraceLine | null = null;
  slots.forEach((slot, i) => {
    if (!slot.frame) { line = null; return; }
    const point = { x: i / last, index: slot.frame.overall.index }, previous = slots[i - 1];
    if (!line || !previous?.frame) { line = { points: [point], corrected: slot.corrected }; lines.push(line); return; }
    const corrected = slot.corrected || previous.corrected;
    if (line.points.length > 1 && line.corrected !== corrected) { line = { points: [line.points[line.points.length - 1]], corrected }; lines.push(line); }
    line.corrected = corrected; line.points.push(point);
  });
  return lines;
}

export function theaterTimeline(replay: TheaterReplay, position: number, loading: boolean): TheaterTimeline {
  const slot = replay.slots[theaterSlotIndex(replay, position)];
  const at = slot ? new Date(slot.bucket_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : "00:00";
  const corrected = replay.slots.filter((s) => s.corrected).length;
  return {
    lines: traceLines(replay.slots), cursor: position / THEATER_SECONDS,
    recorded: `${replay.slots.filter((s) => s.frame && !s.corrected).length}/${replay.slots.length} 구간 기록${corrected ? ` · 보정 ${corrected}` : ""} · KST`,
    clock: `${position.toFixed(1)} / ${THEATER_SECONDS}초 · ${at}`,
    state: loading ? "기록 확인 중…" : slot?.frame ? `${slot.frame.overall.total}건 · ${slot.corrected ? "보정 구간" : "저장된 심리"}` : "기록 없음"
  };
}

/** Opacity of the theater's ants one frame on: toward 0 where no record can be shown, toward 1 otherwise; at once without motion. */
export function castFade(current: number, absent: boolean, dt: number, animate: boolean): number {
  const target = absent ? 0 : 1;
  if (!animate) return target;
  const step = dt / CAST_FADE_SECONDS;
  return target > current ? Math.min(target, current + step) : Math.max(target, current - step);
}

/**
 * Records keep no posts, so the theater's evidence is the feed as of the recorded time: the newest `limit` posts of one
 * side in the 6 hours before it, in the scope of the selection (a stock, a community, or every community, as recorded).
 */
export function theaterEvidenceQuery(selection: { recordedAt: string; symbol?: string; community?: SourceGroupId }, side: WorldSide, limit = 3): string {
  return new URLSearchParams({
    hours: "6", limit: String(limit), offset: "0", asOf: selection.recordedAt, sentiment: side,
    channels: serializeSourceGroupSelection(selection.community ? [selection.community] : [...SOURCE_GROUP_IDS]), symbol: selection.symbol ?? ""
  }).toString();
}
