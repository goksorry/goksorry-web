"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildWorldReplay, worldDate, type WorldFrame, type WorldReplay } from "@/lib/world";
import { timelineY } from "@/lib/world-presentation";
import { correctReplay, theaterSlotIndex, theaterTimeline, type TheaterTimeline, type TracePoint } from "@/lib/world-theater";
import { saveWorldPostcard } from "./world-postcard";
import { useWorldSnack } from "./world-snackbar";

/**
 * Replay controls of the theater. Owns loading, gap correction and playback; reports the shown frame (`onFrame`: null
 * where no record can be shown, `corrected` for a slot filled between two records, `pending` while the day's records are
 * still being fetched, so a null frame then means "not known yet" rather than "no record") and what the wall board paints about
 * the replay (`onTimeline`). The chart and record lines here are the HTML copy of that board.
 */
const svgPoint = (p: TracePoint) => `${p.x * 600},${timelineY(p.index)}`;

export function TheaterControls({ date, onDate, onFrame, onTimeline, onPlaying, onHudHeight, paused, reduced, color }: {
  date: string; onDate: (date: string) => void; onFrame: (frame: WorldFrame | null, corrected: boolean, pending: boolean) => void; onTimeline: (timeline: TheaterTimeline | null) => void;
  onPlaying: (playing: boolean) => void; onHudHeight: (height: number) => void;
  paused: boolean; reduced: boolean; color: string;
}) {
  const [replay, setReplay] = useState<WorldReplay>(() => buildWorldReplay(date, []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [retry, setRetry] = useState(0);
  const controls = useRef<HTMLElement>(null);
  const today = worldDate();
  const earliest = worldDate(new Date(Date.now() - 6 * 24 * 60 * 60_000));
  useEffect(() => {
    setLoading(true); setError(""); setPlaying(false);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/internal/world/replay?date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "극장 기록 불러오기 실패");
        if (!Array.isArray(result.slots) || result.slots.length !== 144) throw new Error("극장 기록 형식 오류");
        setReplay(result); setError("");
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "기록을 불러오지 못했습니다."); }
      finally { if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(() => void load(), 60_000); } }
    };
    void load();
    const visibility = () => { clearTimeout(timer); if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [date, retry]);
  const animating = playing && !paused && !reduced && position < 30;
  useEffect(() => { onPlaying(animating); }, [onPlaying, animating]);
  useEffect(() => () => onPlaying(false), [onPlaying]);
  useEffect(() => {
    const panel = controls.current!;
    const stage = panel.parentElement!;
    const measure = () => onHudHeight(Math.ceil(stage.getBoundingClientRect().bottom - panel.getBoundingClientRect().top));
    const observer = new ResizeObserver(measure);
    observer.observe(panel); observer.observe(stage); measure();
    return () => observer.disconnect();
  }, [onHudHeight]);
  useEffect(() => {
    if (!animating) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), elapsed = (now - last) / 1000; last = now;
      setPosition((value) => Math.min(30, value + elapsed));
    }, 100);
    return () => clearInterval(timer);
  }, [animating]);
  useEffect(() => { if (position >= 30) setPlaying(false); }, [position]);
  const corrected = useMemo(() => correctReplay(replay), [replay]);
  const slot = corrected.slots[theaterSlotIndex(corrected, position)];
  useEffect(() => { onFrame(slot?.frame ?? null, !!slot?.corrected, loading && !slot?.frame); }, [slot, loading, onFrame]);
  // Unmounted (scene left, date changed): nothing is known about the next replay until it loads.
  useEffect(() => () => onFrame(null, false, true), [onFrame]);
  const timeline = useMemo(() => theaterTimeline(corrected, position, loading), [corrected, position, loading]);
  useEffect(() => { onTimeline(timeline); }, [timeline, onTimeline]);
  useEffect(() => () => onTimeline(null), [onTimeline]);
  const recorded = replay.slots.filter((item) => item.frame);
  const lastFrame = recorded[recorded.length - 1]?.frame;
  useWorldSnack("theater-replay", error ? { text: error, tone: "error", action: { label: "다시 시도", run: () => setRetry((v) => v + 1) } } : null);
  const share = async () => {
    const url = new URL(window.location.href); url.searchParams.set("scene", "theater"); url.searchParams.set("date", date);
    for (const key of ["panels", "feed", "channels", "channel"]) url.searchParams.delete(key);
    setShareLink(url.toString());
    try {
      if (navigator.share) await navigator.share({ title: `${date} 오늘의 곡소리 한 컷`, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setMessage("극장 링크를 복사했습니다. 최근 7일간 열 수 있습니다."); }
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setMessage("아래 링크를 복사해 공유하세요."); }
  };
  return <section ref={controls} className="world-theater-controls" aria-label="개미극장 재생 제어">
    <div className="world-theater-top"><label>기록 날짜 <input type="date" min={earliest} max={today} value={date} onChange={(e) => { if (e.target.value >= earliest && e.target.value <= today) onDate(e.target.value); }} /></label><span className="world-theater-info">{timeline.recorded}</span></div>
    <svg viewBox="0 0 600 66" className="world-timeline world-theater-info" role="img" aria-label="커뮤니티 심리 추이. 점선은 앞뒤 기록을 이은 보정 구간, 빈 곳은 기록 없음. 높을수록 공포.">
      <path d="M0 8H600M0 34H600M0 60H600" stroke="currentColor" opacity=".16" /><text x="1" y="9">10</text><text x="1" y="35">5</text><text x="1" y="61">0</text>
      {timeline.lines.map((line, i) => line.points.length > 1
        ? <polyline key={i} points={line.points.map(svgPoint).join(" ")} fill="none" stroke="#ae747f" strokeWidth={line.corrected ? 2 : 3} strokeLinecap="round" strokeDasharray={line.corrected ? "5 5" : undefined} opacity={line.corrected ? .6 : 1} data-corrected={line.corrected || undefined} />
        : <circle key={i} cx={line.points[0].x * 600} cy={timelineY(line.points[0].index)} r="2.5" fill="#ae747f" />)}
      <path d={`M${position / 30 * 600} 0v66`} stroke="currentColor" strokeWidth="2" />
    </svg>
    <label className="world-sr-only" htmlFor="world-seek">극장 시간 탐색</label><input id="world-seek" type="range" min="0" max="30" step="0.1" value={position} onChange={(e) => { setPosition(Number(e.target.value)); setPlaying(false); }} aria-valuetext={`${position.toFixed(1)}초 / 30초`} />
    <div className="world-theater-actions"><button disabled={loading || !recorded.length || reduced} onClick={() => { if (position >= 30) setPosition(0); setPlaying((v) => !v); }}>{playing ? "일시정지" : "재생"}</button>
      <span className="world-theater-info">{timeline.clock}</span>
      <span className="world-record-state world-theater-info">{timeline.state}</span></div>
    <p className="world-note world-theater-info">{reduced ? "동작 줄이기: 시간 막대로 정적 장면을 탐색하세요. " : ""}심리 추이입니다. 정상 수집 뒤 10분마다 지수만 기록합니다(글은 저장하지 않음). 기록 사이 빈 구간은 앞뒤 기록을 직선으로 이어 보정하고 점선으로 표시합니다. 첫 기록 전·마지막 기록 뒤는 기록 없음입니다.</p>
    {position >= 30 && lastFrame && <div className="world-postcard-actions"><strong>오늘의 곡소리 한 컷 · 마지막 기록 기준</strong><button onClick={() => void saveWorldPostcard(lastFrame, date, color).then(() => setMessage("PNG 저장 완료")).catch((e) => setMessage(String(e.message)))}>PNG 저장</button><button onClick={() => void share()}>링크 공유</button></div>}
    {shareLink && <input aria-label="극장 공유 링크" readOnly value={shareLink} onFocus={(e) => e.target.select()} />}
    <span role="status">{message}</span>
  </section>;
}
