"use client";
import { useEffect, useMemo, useState } from "react";
import { buildWorldReplay, MOOD_COPY, percent, worldDate, type WorldFrame, type WorldReplay } from "@/lib/world";
import { Ant, INK, moodColor } from "./diorama";
import type { SceneProps } from "./scene-types";
import { saveWorldPostcard } from "./world-postcard";

export default function Theater({ frame, mobile, onEvidence }: SceneProps) {
  return <g>
    <path d="M310 291L600 155l290 136v225L600 655 310 516Z" fill="#ac7d88" stroke={INK} strokeWidth="3" />
    <rect x="363" y="238" width="474" height="256" rx="8" fill="#fff3d9" stroke={INK} strokeWidth="5" />
    <path d="M362 239h70l-14 255h-56Zm406 0h70v255h-56Z" fill="#c18d99" stroke={INK} strokeWidth="2" />
    <path d="M369 240q25 80 0 155m37-155q25 80 0 155m387-155q-25 80 0 155m37-155q-25 80 0 155" fill="none" stroke="#a5717f" strokeWidth="5" />
    <text x="600" y="279" textAnchor="middle" fill={INK} fontSize="19" fontWeight="800">今日 · 오늘의 개미극장</text>
    <text x="600" y="307" textAnchor="middle" fill="#8c6b72" fontSize="12">저장된 커뮤니티 심리 · 하루를 30초로</text>
    <text x="600" y="354" textAnchor="middle" fill={INK} fontSize="18">{frame.overall.total ? MOOD_COPY[frame.overall.mood] : "이 구간은 기록이 없습니다"}</text>
    <text x="600" y="381" textAnchor="middle" fill={INK} fontSize="13">희망 {percent(frame.overall.hope_ratio)} · 공포 {percent(frame.overall.fear_ratio)} · 중립 {frame.overall.neutral}건</text>
    {Array.from({ length: frame.overall.total ? mobile ? 8 : 16 : 0 }, (_, i) => <Ant key={i} x={450 + i * 53 % 300} y={428 + i * 7 % 28} scale={.65} mood={frame.overall.mood} color={moodColor(frame.overall.mood)} delay={-i * .3}
      label={`극장 개미 ${i + 1} 근거 글`} onClick={() => onEvidence({ title: "극장 기록", summary: frame.overall })} />)}
    <g fill="#674e5b" stroke={INK} strokeWidth="2">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${380 + i * 48} 525v-25q18-20 36 0v25l-18 10Z`} />)}</g>
  </g>;
}

export function TheaterControls({ date, onDate, onFrame, paused, reduced, color }: {
  date: string; onDate: (date: string) => void; onFrame: (frame: WorldFrame | null) => void; paused: boolean; reduced: boolean; color: string;
}) {
  const [replay, setReplay] = useState<WorldReplay>(() => buildWorldReplay(date, []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [retry, setRetry] = useState(0);
  const today = worldDate();
  const earliest = worldDate(new Date(Date.now() - 6 * 24 * 60 * 60_000));
  useEffect(() => {
    setReplay(buildWorldReplay(date, [])); setLoading(true); setError(""); setPosition(0); setPlaying(false); setMessage(""); setShareLink("");
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
  useEffect(() => {
    if (!playing || paused || reduced) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), elapsed = (now - last) / 1000; last = now;
      setPosition((value) => Math.min(30, value + elapsed));
    }, 100);
    return () => clearInterval(timer);
  }, [playing, paused, reduced]);
  useEffect(() => { if (position >= 30) setPlaying(false); }, [position]);
  const slot = replay.slots[Math.min(143, Math.floor(position / 30 * 144))];
  useEffect(() => { onFrame(slot?.frame ?? null); }, [slot, onFrame]);
  const recorded = replay.slots.filter((item) => item.frame);
  const lastFrame = recorded[recorded.length - 1]?.frame;
  const segments = useMemo(() => {
    const lines: string[] = []; let current: string[] = [];
    replay.slots.forEach((item, i) => {
      if (item.frame) current.push(`${i / 143 * 600},${60 - item.frame.overall.index / 100 * 52}`);
      else if (current.length) { lines.push(current.join(" ")); current = []; }
    });
    if (current.length) lines.push(current.join(" "));
    return lines;
  }, [replay]);
  const share = async () => {
    const url = new URL(window.location.href); url.searchParams.set("scene", "theater"); url.searchParams.set("date", date);
    url.searchParams.delete("panels");
    setShareLink(url.toString());
    try {
      if (navigator.share) await navigator.share({ title: `${date} 오늘의 곡소리 한 컷`, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setMessage("극장 링크를 복사했습니다. 최근 7일간 열 수 있습니다."); }
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setMessage("아래 링크를 복사해 공유하세요."); }
  };
  return <section className="world-theater-controls" aria-label="개미극장 재생 제어">
    <div className="world-theater-top"><label>기록 날짜 <input type="date" min={earliest} max={today} value={date} onChange={(e) => { if (e.target.value >= earliest && e.target.value <= today) onDate(e.target.value); }} /></label><span>{recorded.length}/144 구간 기록 · KST</span></div>
    <svg viewBox="0 0 600 66" className="world-timeline" role="img" aria-label="커뮤니티 심리 추이. 빈 구간은 기록 누락. 높을수록 공포.">
      <path d="M0 8H600M0 60H600" stroke="currentColor" opacity=".16" />
      {segments.map((line, i) => <polyline key={i} points={line} fill="none" stroke="#ae747f" strokeWidth="3" strokeLinecap="round" />)}
      <path d={`M${position / 30 * 600} 0v66`} stroke="currentColor" strokeWidth="2" />
    </svg>
    <label className="world-sr-only" htmlFor="world-seek">극장 시간 탐색</label><input id="world-seek" type="range" min="0" max="30" step="0.1" value={position} onChange={(e) => { setPosition(Number(e.target.value)); setPlaying(false); }} aria-valuetext={`${position.toFixed(1)}초 / 30초`} />
    <div className="world-theater-actions"><button disabled={loading || !recorded.length || reduced} onClick={() => { if (position >= 30) setPosition(0); setPlaying((v) => !v); }}>{playing ? "일시정지" : "재생"}</button>
      <span>{position.toFixed(1)} / 30초 · {slot ? new Date(slot.bucket_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : "00:00"}</span>
      <span className="world-record-state">{loading ? "기록 확인 중…" : slot?.frame ? `${slot.frame.overall.total}건 · 저장된 심리` : "기록 없음"}</span></div>
    <p className="world-note">{reduced ? "동작 줄이기: 시간 막대로 정적 장면을 탐색하세요. " : ""}심리 추이입니다. 기록은 기능 도입 시점부터, 10분마다 수집 완료 후 저장. 빈 구간은 보간하지 않습니다.</p>
    {error && <p role="alert">{error} <button onClick={() => setRetry((v) => v + 1)}>다시 시도</button></p>}
    {position >= 30 && lastFrame && <div className="world-postcard-actions"><strong>오늘의 곡소리 한 컷 · 마지막 기록 기준</strong><button onClick={() => void saveWorldPostcard(lastFrame, date, color).then(() => setMessage("PNG 저장 완료")).catch((e) => setMessage(String(e.message)))}>PNG 저장</button><button onClick={() => void share()}>링크 공유</button></div>}
    {shareLink && <input aria-label="극장 공유 링크" readOnly value={shareLink} onFocus={(e) => e.target.select()} />}
    <span role="status">{message}</span>
  </section>;
}
