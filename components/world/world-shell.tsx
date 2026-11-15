"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { useMediaQuery } from "@/components/use-media-query";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS as STORAGE } from "@/lib/persistence-registry";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import { buildWorldFrame, MOOD_COPY, percent, WORLD_SCENES, worldDate, worldDayBounds, worldHealth, type WorldFrame, type WorldScene } from "@/lib/world";
import { COLORS, Diorama } from "./diorama";
import Plaza from "./plaza";
import { WorldPanel } from "./world-panel";
import { WorldEvidence } from "./world-evidence";
import { useWorldSound } from "./world-sound";
import type { EvidenceSelection, SceneProps } from "./scene-types";
import "./world.css";

const Ecosystem = dynamic(() => import("./ecosystem"));
const Battle = dynamic(() => import("./battle"));
const Broadcast = dynamic(() => import("./broadcast"));
const Theater = dynamic(() => import("./theater"));
const TheaterControls = dynamic(() => import("./theater").then((module) => module.TheaterControls));
const WorldIndex = dynamic(() => import("./world-index"), { loading: () => <p>지수 여는 중…</p> });
const EMPTY = buildWorldFrame([], { now: new Date(0) });
const SCENES: { id: WorldScene; icon: string; name: string; description: string }[] = [
  { id: "plaza", icon: "⌂", name: "광장", description: "작은 개미들의 아주 큰 마음" },
  { id: "ecosystem", icon: "♧", name: "개미 생태계", description: "요즘 시끄러운 종목, 저마다 사연 있는 개미굴" },
  { id: "battle", icon: "⚑", name: "심리 전장", description: "희망군 vs 절망군. 오늘의 마음은 어느 쪽?" },
  { id: "broadcast", icon: "◉", name: "재난방송", description: "삐에로는 오늘도 웃으며 속보를 전합니다" },
  { id: "theater", icon: "▶", name: "개미극장", description: "웃다 울다, 하루를 30초로" }
];

export function WorldShell({ timezone, selectedGroupIds, menu }: { timezone: string; selectedGroupIds: SourceGroupId[]; menu: ReactNode }) {
  const params = useSearchParams();
  const rawScene = params.get("scene") ?? "plaza";
  const scene: WorldScene = WORLD_SCENES.includes(rawScene as WorldScene) ? rawScene as WorldScene : "plaza";
  const stock = (params.get("stock") ?? "").toUpperCase();
  const today = worldDate();
  const firstDate = worldDate(new Date(Date.now() - 6 * 24 * 60 * 60_000));
  const rawDate = params.get("date") ?? today;
  const date = worldDayBounds(rawDate) && rawDate <= today && rawDate >= firstDate ? rawDate : today;
  const mobile = useMediaQuery("(max-width: 760px)") === true;
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)") !== false;
  const [frame, setFrame] = useState<WorldFrame>(EMPTY);
  const [replayFrame, setReplayFrame] = useState<WorldFrame | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(() => params.has("channels") || params.has("channel") || params.get("feed") === "1");
  const [mobilePanel, setMobilePanel] = useState<"index" | "feed">("feed");
  const [evidence, setEvidence] = useState<EvidenceSelection | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [muted, setMuted] = useState(true);
  const [emote, setEmote] = useState("");
  const [reinforcement, setReinforcement] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const emoteTimer = useRef<ReturnType<typeof setTimeout>>();
  const previousKeys = useRef<{ stock: string; keys: Set<string> } | null>(null);
  const playSound = useWorldSound(muted, !visible, reduced);
  const onStep = useCallback(() => playSound("step"), [playSound]);
  const setUrl = useCallback((key: string, value: string) => {
    const next = new URL(window.location.href);
    value ? next.searchParams.set(key, value) : next.searchParams.delete(key);
    window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }, []);
  const onScene = useCallback((next: WorldScene) => { setUrl("scene", next === "plaza" ? "" : next); setEvidence(null); playSound(next === "broadcast" ? "signal" : "step"); }, [setUrl, playSound]);
  const onStock = useCallback((symbol: string) => setUrl("stock", symbol), [setUrl]);
  const onDate = useCallback((value: string) => setUrl("date", value), [setUrl]);
  const onFrame = useCallback((value: WorldFrame | null) => setReplayFrame(value), []);

  useEffect(() => {
    const storedColor = readClientLocalStorageValue(STORAGE.worldAvatarColor);
    if (storedColor && COLORS.includes(storedColor)) setColor(storedColor);
    setMuted(readClientLocalStorageValue(STORAGE.worldMuted) !== "off");
    const change = () => setVisible(!document.hidden);
    change(); document.addEventListener("visibilitychange", change);
    return () => { document.removeEventListener("visibilitychange", change); clearTimeout(emoteTimer.current); };
  }, []);
  const channelKey = params.get("channels") ?? params.get("channel");
  const requestedFeed = params.get("feed") === "1";
  useEffect(() => { if (channelKey !== null || requestedFeed) { setFeedOpen(true); setMobilePanel("feed"); if (requestedFeed) setMenuOpen(false); } }, [channelKey, requestedFeed]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/internal/world", { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || payload.version !== 1) throw new Error(payload.error ?? "월드 데이터를 불러오지 못했습니다.");
        if (controller.signal.aborted) return;
        setFrame(payload); setClock(Date.now()); setError("");
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "연결 대기 중"); setClock(Date.now()); } }
      finally { if (!controller.signal.aborted && !document.hidden) timer = setTimeout(() => void load(), 60_000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [visible]);
  useEffect(() => {
    if (!frame.data_at) return;
    const item = frame.stocks.find((s) => s.symbol === stock) ?? frame.stocks[0];
    const selected = item?.symbol ?? "overall";
    const keys = new Set(Object.values((item ?? frame.overall).evidence).flat().map((r) => r.post_key));
    if (previousKeys.current?.stock === selected) {
      const fresh = [...keys].filter((key) => !previousKeys.current!.keys.has(key)).length;
      setReinforcement(fresh);
      if (fresh && scene === "battle") playSound("signal");
    }
    previousKeys.current = { stock: selected, keys };
    const timer = setTimeout(() => setReinforcement(0), 5000);
    return () => clearTimeout(timer);
  }, [frame, stock, scene, playSound]);
  const health = worldHealth(frame, clock);
  useEffect(() => { if (health === "delayed") playSound("alarm"); }, [health, playSound]);
  const showIndex = indexOpen && (!mobile || mobilePanel === "index");
  const showFeed = feedOpen && (!mobile || mobilePanel === "feed");
  const view = scene === "theater" ? replayFrame ?? EMPTY : frame;
  const props: SceneProps = { frame: view, mobile, stock, onStock, onEvidence: setEvidence, onScene, reinforcements: reinforcement };
  const sceneInfo = SCENES.find((s) => s.id === scene)!;
  const statusText = error ? "연결 대기" : health === "delayed" ? "갱신 지연" : health === "waiting" ? "데이터 대기" : health === "watching" ? "관찰 중" : "관측 중";
  const togglePanel = (name: "index" | "feed") => {
    if (name === "index") setIndexOpen((value) => mobile && mobilePanel !== "index" ? true : !value);
    else setFeedOpen((value) => mobile && mobilePanel !== "feed" ? true : !value);
    setMobilePanel(name);
  };
  return <div className="world-root" data-paused={!visible || reduced} data-scene={scene}>
    <header className="world-topbar">
      <a href="/" className="world-brand" aria-label="곡소리 개미 월드 홈"><span className="world-brand-ant" aria-hidden="true">♣</span><span>곡소리 <b>개미 월드</b><small>작은 몸. 아주 큰 희로애락.</small></span></a>
      <div className="world-hud-actions"><button className="world-index-toggle" aria-pressed={indexOpen} onClick={() => togglePanel("index")}>◷ <span>지수</span></button><button aria-pressed={feedOpen} onClick={() => togglePanel("feed")}>▤ <span>피드</span></button>
        <button aria-label={muted ? "효과음 켜기" : "효과음 끄기"} aria-pressed={!muted} onClick={() => { const next = !muted; setMuted(next); writeClientLocalStorageValue(STORAGE.worldMuted, next ? "on" : "off"); }}>{muted ? "♪̸" : "♪"}<span className="world-desktop-label"> {muted ? "무음" : "효과음"}</span></button>
        <button className="world-menu-button" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>☰ <span>메뉴</span></button></div>
    </header>
    <div className="world-scene-heading"><span className="world-eyebrow">COMMUNITY SENTIMENT DIORAMA</span><h1>{scene === "plaza" ? "오늘도, 개미는 출근 중." : sceneInfo.name}</h1><p>{sceneInfo.description}</p>
      <div className="world-live-badge" data-health={health}><i />{statusText}<span>·</span><time dateTime={frame.data_at ?? undefined}>{frame.data_at ? `${new Date(frame.data_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false })} KST 기준` : "분석 데이터 기다리는 중"}</time></div>
    </div>
    <div className="world-scene-stage" aria-busy={false}><Diorama color={color} emote={emote} reduced={reduced} paused={!visible} onStep={onStep}>
      {scene === "plaza" ? <Plaza {...props} /> : scene === "ecosystem" ? <Ecosystem {...props} /> : scene === "battle" ? <Battle {...props} /> : scene === "broadcast" ? <Broadcast {...props} /> : <Theater {...props} />}
    </Diorama></div>
    {scene === "battle" && <div className="world-stock-picker"><label>전장 종목 <select aria-label="전장 종목" value={frame.stocks.find((s) => s.symbol === stock)?.symbol ?? frame.stocks[0]?.symbol ?? ""} onChange={(e) => onStock(e.target.value)}>{!frame.stocks.length && <option value="">종목 대기</option>}{frame.stocks.map((s) => <option key={s.symbol} value={s.symbol}>{s.name} · {s.total}건</option>)}</select></label>{reinforcement > 0 && <span className="world-reinforcement" role="status">지원군 도착! 새로운 근거 글 {reinforcement}건</span>}</div>}
    {scene === "theater" && <TheaterControls date={date} onDate={onDate} onFrame={onFrame} paused={!visible} reduced={reduced} color={color} />}
    {scene !== "theater" && <aside className="world-summary"><span>최근 6시간 · {frame.overall.total.toLocaleString()}건</span><b>{MOOD_COPY[frame.overall.mood].split(" · ")[0]}</b><span>희망 {percent(frame.overall.hope_ratio)} / 공포 {percent(frame.overall.fear_ratio)}<small>중립 {frame.overall.neutral}건 별도</small></span></aside>}
    <div className="world-avatar-controls"><fieldset><legend>내 개미 색상</legend>{COLORS.map((value, i) => <button key={value} aria-label={`내 개미 색상 ${i + 1}`} aria-pressed={color === value} style={{ background: value }} onClick={() => { setColor(value); writeClientLocalStorageValue(STORAGE.worldAvatarColor, value); }} />)}</fieldset>
      <div className="world-emotes" aria-label="내 감정 표현">{["♡", "ㅠㅠ", "존버"].map((value) => <button key={value} aria-label={`${value} 감정 표현`} onClick={() => { setEmote(value); clearTimeout(emoteTimer.current); emoteTimer.current = setTimeout(() => setEmote(""), 2400); }}>{value}</button>)}</div><small>내 반응은 분석 수치에 영향 없음</small></div>
    {(error || frame.collection.errors > 0 || frame.collection.degraded || frame.collection.unavailable) && <p className="world-data-notice" role="status">{error || "일부 수집·분석 상태 확인 필요"} · 월드 탐색과 지수·피드는 계속 이용 가능</p>}
    <footer className="world-bottom"><p>바닥 클릭·탭 / 방향키로 이동 <span>· 개미 선택하면 실제 글</span></p><nav aria-label="월드 장면 선택">{SCENES.map((s, i) => <button key={s.id} aria-current={scene === s.id ? "page" : undefined} onClick={() => onScene(s.id)}><span aria-hidden="true">{s.icon}</span><b>{s.name}</b><small>0{i + 1}</small></button>)}</nav><p className="world-disclaimer">개미 = 게시글 분위기 캐릭터 · 커뮤니티 심리이며 투자 권유가 아닙니다</p></footer>
    {mobile && (indexOpen || feedOpen) && <div className="world-sheet-tabs" aria-label="정보 시트 전환"><button aria-pressed={mobilePanel === "index"} onClick={() => { setIndexOpen(true); setMobilePanel("index"); }}>지수</button><button aria-pressed={mobilePanel === "feed"} onClick={() => { setFeedOpen(true); setMobilePanel("feed"); }}>피드</button></div>}
    {showIndex && <WorldPanel title="지수·시장 개요" name="index" onClose={() => { setIndexOpen(false); if (feedOpen) setMobilePanel("feed"); }}><WorldIndex selectedGroupIds={selectedGroupIds} /></WorldPanel>}
    {showFeed && <WorldPanel title="외부 감성 피드" name="feed" onClose={() => { setFeedOpen(false); if (indexOpen) setMobilePanel("index"); }}><HomeFeedShell timezone={timezone} selectedGroupIds={selectedGroupIds} windowHours={6} initialLimit={80} /></WorldPanel>}
    {evidence && <WorldEvidence key={`${evidence.title}-${evidence.side ?? "all"}`} selection={evidence} onClose={() => setEvidence(null)} />}
    {menuOpen && <WorldPanel title="사이트 메뉴·출처·정책" name="menu" modal onClose={() => setMenuOpen(false)}>{menu}</WorldPanel>}
  </div>;
}
