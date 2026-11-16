import type { WorldReplay } from "./world";

/** Length of a full day's replay, in seconds of playback. */
export const THEATER_SECONDS = 30;

/**
 * What the theater shows about its replay, for the wall board and the controls alike: the 곡소리 지수 trace (runs of
 * recorded slots; gaps stay gaps), the playback cursor and the record lines.
 */
export type TheaterTimeline = {
  /** Unbroken runs of recorded slots: x is the slot's place in the day (0..1), index the recorded 곡소리 지수 (0..10). */
  runs: { x: number; index: number }[][];
  /** Playback position, 0..1. */
  cursor: number;
  recorded: string; clock: string; state: string;
};

export const theaterSlotIndex = (replay: WorldReplay, position: number) =>
  Math.min(replay.slots.length - 1, Math.floor(position / THEATER_SECONDS * replay.slots.length));

export function theaterTimeline(replay: WorldReplay, position: number, loading: boolean): TheaterTimeline {
  const last = Math.max(1, replay.slots.length - 1), runs: TheaterTimeline["runs"] = [];
  let run: TheaterTimeline["runs"][number] = [];
  replay.slots.forEach((slot, i) => {
    if (slot.frame) run.push({ x: i / last, index: slot.frame.overall.index });
    else if (run.length) { runs.push(run); run = []; }
  });
  if (run.length) runs.push(run);
  const slot = replay.slots[theaterSlotIndex(replay, position)];
  const time = slot ? new Date(slot.bucket_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : "00:00";
  return {
    runs, cursor: position / THEATER_SECONDS,
    recorded: `${replay.slots.filter((s) => s.frame).length}/${replay.slots.length} 구간 기록 · KST`,
    clock: `${position.toFixed(1)} / ${THEATER_SECONDS}초 · ${time}`,
    state: loading ? "기록 확인 중…" : slot?.frame ? `${slot.frame.overall.total}건 · 저장된 심리` : "기록 없음"
  };
}
