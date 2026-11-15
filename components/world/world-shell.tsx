"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { useMediaQuery } from "@/components/use-media-query";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { FirstVisitHeaderHint } from "@/components/first-visit-header-hint";
import { useCookieConsent } from "@/components/cookie-consent-provider";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS as STORAGE } from "@/lib/persistence-registry";
import type { ScopeSummary } from "@/lib/feed-scope";
import type { SourceGroupId } from "@/lib/feed-source-groups";
import { buildWorldFrame, percent, WORLD_SCENES, worldDate, worldDayBounds, type WorldFrame, type WorldScene } from "@/lib/world";
import { frameStatus, worldHeadline, WORLD_COLORS } from "@/lib/world-presentation";
import { WorldPanel } from "./world-panel";
import { WorldEvidence } from "./world-evidence";
import { WorldScreens, SummaryNumbers } from "./world-screens";
import { useWorldSound } from "./world-sound";
import type { EvidenceSelection } from "./scene-types";
import "./world.css";

const HD2DWorld = dynamic(() => import("./hd2d-world"), { ssr: false, loading: () => <div className="world-loading">화면 불러오는 중…</div> });
const TheaterControls = dynamic(() => import("./theater").then((module) => module.TheaterControls));
const WorldIndex = dynamic(() => import("./world-index"), { loading: () => <p>지수 여는 중…</p> });
const EMPTY = buildWorldFrame([], { now: new Date(0) });
const SCENES: { id: WorldScene; name: string; short: string; title: string }[] = [
  { id: "plaza", name: "광장", short: "광장", title: "곡소리 지수와 피드" },
  { id: "ecosystem", name: "개미 생태계", short: "생태계", title: "종목별 언급" },
  { id: "battle", name: "심리 전장", short: "전장", title: "희망·공포 비교" },
  { id: "broadcast", name: "곡소리 재난방송", short: "방송", title: "커뮤니티별 현황" },
  { id: "theater", name: "오늘의 개미극장", short: "극장", title: "개미극장" }
];
type DetailTab = "index" | "feed";

export function WorldShell({ timezone, selectedGroupIds, menu }: { timezone: string; selectedGroupIds: SourceGroupId[]; menu: ReactNode }) {
  const params = useSearchParams();
  const rawScene = params.get("scene") ?? "plaza";
  const scene: WorldScene = WORLD_SCENES.includes(rawScene as WorldScene) ? rawScene as WorldScene : "plaza";
  const stock = (params.get("stock") ?? "").toUpperCase();
  const today = worldDate(), firstDate = worldDate(new Date(Date.now() - 6 * 86_400_000));
  const rawDate = params.get("date") ?? today;
  const date = worldDayBounds(rawDate) && rawDate <= today && rawDate >= firstDate ? rawDate : today;
  const mobile = useMediaQuery("(max-width: 959px)") === true;
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)") !== false;
  const { bannerVisible } = useCookieConsent();
  const [frame, setFrame] = useState<WorldFrame>(EMPTY), [replayFrame, setReplayFrame] = useState<WorldFrame | null>(null);
  const [wallSummary, setWallSummary] = useState<ScopeSummary>();
  const [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [visible, setVisible] = useState(true), [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<DetailTab | null>(null);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [color, setColor] = useState(WORLD_COLORS[0]), [muted, setMuted] = useState(true), [emote, setEmote] = useState("");
  const [reinforcement, setReinforcement] = useState(0), [clock, setClock] = useState(Date.now()), [retry, setRetry] = useState(0);
  const emoteTimer = useRef<ReturnType<typeof setTimeout>>();
  const previousKeys = useRef<{ stock: string; keys: Set<string> } | null>(null);
  const playSound = useWorldSound(muted, !visible, reduced);
  const onStep = useCallback(() => playSound("step"), [playSound]);
  const setUrl = useCallback((key: string, value: string) => {
    const next = new URL(window.location.href); value ? next.searchParams.set(key, value) : next.searchParams.delete(key);
    window.history.pushState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }, []);
  const onScene = useCallback((next: WorldScene) => { setUrl("scene", next === "plaza" ? "" : next); setTab(null); setSelection(null); playSound(next === "broadcast" ? "signal" : "step"); }, [setUrl, playSound]);
  const onDate = useCallback((value: string) => { setReplayFrame(null); setUrl("date", value); }, [setUrl]);
  const onFrame = useCallback((value: WorldFrame | null) => setReplayFrame(value), []);
  const open = (next: DetailTab) => { setSelection(null); setTab(next); setMenuOpen(false); };
  const evidence = (value: EvidenceSelection) => { setSelection(scene === "theater" ? { ...value, recordedAt: view.generated_at } : value); setTab("feed"); setMenuOpen(false); };
  const close = () => { setTab(null); if (params.get("feed") === "1") setUrl("feed", ""); };
  useEffect(() => {
    if (!tab) return;
    const panel = document.querySelector('[data-world-panel="detail"]');
    const active = document.activeElement;
    // Scope selection can hide or remove the initiating control inside a tab.
    if (active === document.body || (active && panel?.contains(active) && active.closest("[hidden]"))) {
      document.getElementById(`world-tab-${tab}`)?.focus();
    }
  }, [tab, selection]);
  useEffect(() => {
    const stored = readClientLocalStorageValue(STORAGE.worldAvatarColor); if (stored && WORLD_COLORS.includes(stored)) setColor(stored);
    setMuted(readClientLocalStorageValue(STORAGE.worldMuted) !== "off");
    const change = () => setVisible(!document.hidden); change(); document.addEventListener("visibilitychange", change);
    return () => { document.removeEventListener("visibilitychange", change); clearTimeout(emoteTimer.current); };
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/internal/world", { signal: controller.signal, cache: "no-store" }); const payload = await response.json();
        if (!response.ok || payload.version !== 1) throw new Error(payload.error ?? "월드 데이터를 불러오지 못했습니다.");
        if (!controller.signal.aborted) { setFrame(payload); setLoaded(true); setClock(Date.now()); setError(""); }
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "조회 실패"); setClock(Date.now()); } }
      finally { if (!controller.signal.aborted && !document.hidden) timer = setTimeout(() => void load(), 60_000); }
    };
    void load(); const clockTimer = setInterval(() => setClock(Date.now()), 30_000);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(clockTimer); };
  }, [visible, retry]);
  useEffect(() => {
    const item = frame.stocks.find((s) => s.symbol === stock), selected = item?.symbol ?? "overall";
    const keys = new Set(Object.values((item ?? frame.overall).evidence).flat().map((r) => r.post_key));
    if (previousKeys.current?.stock === selected) {
      const fresh = [...keys].filter((key) => !previousKeys.current!.keys.has(key)).length; setReinforcement(fresh);
      if (fresh && scene === "battle") playSound("signal");
    }
    previousKeys.current = { stock: selected, keys }; const timer = setTimeout(() => setReinforcement(0), 5000); return () => clearTimeout(timer);
  }, [frame, stock, scene, playSound]);
  const liveFrame = scene === "plaza" && wallSummary ? { ...frame, data_at: wallSummary.data_at, overall: { ...frame.overall, ...wallSummary } } : frame;
  const view = scene === "theater" ? replayFrame ?? EMPTY : liveFrame;
  const item = view.stocks.find((s) => s.symbol === stock);
  const activeSummary = (scene === "battle" || scene === "ecosystem") && item ? item : view.overall;
  const status = frameStatus(liveFrame, loaded, error, clock);
  const info = SCENES.find((s) => s.id === scene)!;
  const currentSelection = selection ? { ...selection, summary: selection.symbol ? view.stocks.find((s) => s.symbol === selection.symbol) ?? EMPTY.overall : selection.community ? view.communities.find((c) => c.id === selection.community) ?? EMPTY.overall : selection.summary } : null;
  const selectStock = (symbol: string, show = true) => {
    setUrl("stock", symbol); const found = view.stocks.find((s) => s.symbol === symbol);
    if (found && show) evidence({ title: found.name, summary: found, symbol });
  };
  const wallParams = new URLSearchParams(params.toString());
  for (const key of ["scene", "date", "feed"]) wallParams.delete(key);
  const wallHref = scene === "plaza" ? "" : `/${wallParams.size ? `?${wallParams}` : ""}`;
  return <div className="world-root" data-paused={!visible || reduced} data-scene={scene} data-cookie-banner={bannerVisible}>
    <div className="world-content" aria-hidden={!!tab || menuOpen ? true : undefined} ref={node => { if (node) node.inert = !!tab || menuOpen; }}>
    <header className="world-topbar"><a href="/" className="world-brand" aria-label="곡소리 개미 월드 홈"><span className="world-brand-mark" aria-hidden="true" /><span>곡소리</span></a>
      <div className="world-hud-actions"><a className="world-index-toggle" href={`${wallHref}#world-index-wall`}>지수</a><a href={`${wallHref}#world-feed-wall`}>피드</a><button className="world-menu-button" aria-expanded={menuOpen} onClick={() => { setTab(null); setMenuOpen(true); }}>메뉴 <span aria-hidden="true">☰</span></button></div>
    </header>
    <div className="world-scene-heading"><h1 className={scene === "plaza" ? "sr-only" : undefined}>{info.title}</h1>
      <div className="world-live-badge" data-state={error ? "error" : status.startsWith("갱신") ? "delayed" : "ready"}><i /><span>{status}</span><time dateTime={liveFrame.data_at ?? undefined}>{liveFrame.data_at ? `${new Date(liveFrame.data_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false })} KST` : ""}</time></div>
    </div>
    {(error || frame.collection.errors > 0 || frame.collection.degraded || frame.collection.unavailable) && <p className="world-data-notice" role="status">{error || "일부 수집·분석 상태 확인 필요"}{error && <button onClick={() => setRetry((n) => n + 1)}>다시 시도</button>}</p>}
    <div className="world-scene-stage" aria-busy={!loaded && !error}>
      <HD2DWorld frame={view} scene={scene} stock={stock} mobile={mobile} reduced={reduced} paused={!visible} color={color} emote={emote} onStep={onStep} onScene={onScene} onEvidence={(side) => evidence({ title: scene === "theater" ? "극장 기록" : item?.name ?? "전체 커뮤니티", summary: activeSummary, symbol: scene === "theater" ? undefined : item?.symbol, recordedAt: scene === "theater" ? view.generated_at : undefined, side })}>
        {scene === "plaza" && <WorldScreens frame={frame} loaded={loaded} failed={!!error} status={status} timezone={timezone} selectedGroupIds={selectedGroupIds} stock={stock} onSummary={setWallSummary} onStock={(symbol) => selectStock(symbol, false)} onOpen={open} />}
        {scene === "plaza" && <div className="world-area-links"><button onClick={() => onScene("ecosystem")}>개미 생태계 <span>종목별 언급 ↗</span></button><button onClick={() => onScene("battle")}>심리 전장 <span>희망·공포 비교 ↗</span></button><button onClick={() => onScene("broadcast")}>재난방송 <span>커뮤니티별 현황 ↗</span></button><button onClick={() => onScene("theater")}>개미극장 <span>기록 재생 ↗</span></button></div>}
        {scene === "ecosystem" && <div className="world-region-overlay"><h2>최근 6시간 종목별 언급량</h2><div className="world-stock-list">{view.stocks.map((s, i) => <button key={s.symbol} onClick={() => selectStock(s.symbol)} aria-label={`${s.name} 개미굴 · ${s.total}건`} aria-pressed={stock === s.symbol}><span className="world-rank">{String(i + 1).padStart(2, "0")}</span><strong>{s.name}</strong><span>{s.total}건 · 희망 {percent(s.hope_ratio)}</span><small>{s.total < 3 ? "소표본 · 관찰 중" : s.mood === "fear" ? "공포 우세" : s.mood === "hope" ? "희망 우세" : "혼조"}</small></button>)}</div>{!view.stocks.length && <p>분석된 종목이 없습니다. 새 표본을 기다리고 있습니다.</p>}</div>}
        {scene === "battle" && <div className="world-battle-overlay"><label>전장 종목 <select aria-label="전장 종목" value={item?.symbol ?? ""} onChange={(e) => selectStock(e.target.value, false)}><option value="">전체 커뮤니티</option>{view.stocks.map((s) => <option key={s.symbol} value={s.symbol}>{s.name} · {s.total}건</option>)}</select></label><div className="world-camps">{(["bullish", "bearish", "neutral"] as const).map((side) => <button key={side} data-side={side} onClick={() => evidence({ title: `${item?.name ?? "전체"} ${side === "bullish" ? "희망군" : side === "bearish" ? "절망군" : "중립 관찰석"}`, summary: activeSummary, symbol: item?.symbol, side })}><span>{side === "bullish" ? "희망군" : side === "bearish" ? "절망군" : "중립 관찰석"}</span><strong>{side === "neutral" ? `${activeSummary.neutral}건` : percent(side === "bullish" ? activeSummary.hope_ratio : activeSummary.fear_ratio)}</strong><span>{side === "neutral" ? "비율에서 별도" : `${activeSummary[side]}건`} · 근거 보기 ↗</span></button>)}</div><p>{activeSummary.total < 3 ? "표본 부족 · 진영 우세 판단 보류" : "희망·공포 비율은 중립 제외. 가격·수익률 예측이 아닙니다."}</p>{reinforcement > 0 && <p role="status">새로운 근거 글 {reinforcement}건이 도착했습니다.</p>}</div>}
        {scene === "broadcast" && <div className="world-broadcast-overlay"><h2>커뮤니티별 현황</h2><div className="world-community-list">{view.communities.map((c) => <button key={c.id} onClick={() => evidence({ title: `${c.name} 현장`, summary: c, community: c.id })}><strong>{c.name}</strong><span>{c.total ? `${c.index.toFixed(1)} / 10` : "— / 10"} · 표본 {c.total}건</span><span>희망 {percent(c.hope_ratio)} · 공포 {percent(c.fear_ratio)}</span><span>{c.collection_disabled ? "수집 보류" : c.collection_problem ? "수집 확인 필요" : c.total < 3 ? "소표본 · 관찰 중" : `관심: ${c.top_stock ?? "종목 미지정"}`}</span></button>)}</div></div>}
        {scene === "theater" && <div className="world-replay-screen"><span>기록 · {date}</span><h2>{replayFrame ? worldHeadline(replayFrame.overall) : "이 구간은 기록이 없습니다"}</h2>{replayFrame && <button onClick={() => evidence({ title: "극장 기록", summary: replayFrame.overall, recordedAt: replayFrame.generated_at })}>분석 표본 {replayFrame.overall.total}건 · 희망 {percent(replayFrame.overall.hope_ratio)} / 공포 {percent(replayFrame.overall.fear_ratio)} · 근거 보기 ↗</button>}</div>}
      </HD2DWorld>
    </div>
    {scene === "theater" && <TheaterControls key={date} date={date} onDate={onDate} onFrame={onFrame} paused={!visible || !!tab || menuOpen} reduced={reduced} color={color} />}
    <footer className="world-bottom"><nav aria-label="월드 장면 선택">{SCENES.map((s, i) => <button key={s.id} aria-label={s.name} aria-current={scene === s.id ? "page" : undefined} onClick={() => onScene(s.id)}><span>0{i + 1}</span><b>{mobile ? s.short : s.name}</b></button>)}</nav><p>개미는 분석 표본의 분위기입니다. 커뮤니티 심리이며 투자 권유가 아닙니다.</p></footer>
    </div>
    {tab && <WorldPanel title={currentSelection ? `${currentSelection.title} · 분위기와 근거` : "전체 커뮤니티 · 지수와 피드"} name="detail" modal onClose={close}>
      <div className="world-detail-tabs" role="tablist" aria-label="정보 전환">{(["index", "feed"] as const).map((value) => <button key={value} id={`world-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`world-tabpanel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "index" : e.key === "End" ? "feed" : value === "index" ? "feed" : "index"; setTab(next); document.getElementById(`world-tab-${next}`)?.focus(); } }}>{value === "index" ? "지수" : "피드"}</button>)}{currentSelection && <button className="world-reset-selection" onClick={() => setSelection(null)}>전체 보기</button>}</div>
      {currentSelection && <div className="world-selected-summary"><SummaryNumbers summary={currentSelection.summary} /><p className="world-note">선택 범위: {currentSelection.title} · 최근 6시간 분석 표본</p></div>}
      <div id="world-tabpanel-index" role="tabpanel" aria-labelledby="world-tab-index" hidden={tab !== "index"}>
        <p className="world-note">희망·공포 비율은 중립을 제외한 글 건수 비율입니다. 곡소리 지수는 기존 감성 점수·커뮤니티 보정 산식으로 계산하며 비율과 다릅니다. 표본 부족·빈 결과는 안정이나 시장 전체를 뜻하지 않습니다.</p>
        {!currentSelection && <WorldIndex selectedGroupIds={selectedGroupIds} />}
        <div className="world-detail-selection"><h3>종목·커뮤니티 선택</h3>{view.stocks.map((s) => <button key={s.symbol} onClick={() => selectStock(s.symbol)}>{s.name} · {s.total}건 ↗</button>)}{view.communities.map((c) => <button key={c.id} onClick={() => evidence({ title: c.name, summary: c, community: c.id })}>{c.name} · {c.total}건 ↗</button>)}</div>
      </div>
      <div id="world-tabpanel-feed" role="tabpanel" aria-labelledby="world-tab-feed" hidden={tab !== "feed"}>
        {currentSelection ? <WorldEvidence key={`${currentSelection.title}-${currentSelection.side ?? "all"}`} selection={currentSelection} selectedGroupIds={selectedGroupIds} /> : <><CleanFilterToggle /><HomeFeedShell timezone={timezone} selectedGroupIds={selectedGroupIds} windowHours={6} initialLimit={80} /></>}
      </div>
    </WorldPanel>}
    {menuOpen && <WorldPanel title="사이트 메뉴·출처·정책" name="menu" modal onClose={() => setMenuOpen(false)}><FirstVisitHeaderHint inWorldMenu />
      <section className="world-settings"><h3>내 개미와 소리</h3><p>먼저 두 스크린에서 지수와 실제 글을 확인하세요. 이동과 감정 표현은 선택 사항입니다.</p><fieldset><legend>내 개미 색상</legend>{WORLD_COLORS.map((value, i) => <button key={value} aria-label={`내 개미 색상 ${i + 1}`} aria-pressed={color === value} style={{ background: value }} onClick={() => { setColor(value); writeClientLocalStorageValue(STORAGE.worldAvatarColor, value); }} />)}</fieldset><div className="world-emotes">{["♡", "ㅠㅠ", "존버"].map((value) => <button key={value} aria-label={`${value} 감정 표현`} onClick={() => { setEmote(value); clearTimeout(emoteTimer.current); emoteTimer.current = setTimeout(() => setEmote(""), 2400); }}>{value}</button>)}</div><button aria-label={muted ? "효과음 켜기" : "효과음 끄기"} aria-pressed={!muted} onClick={() => { const next = !muted; setMuted(next); writeClientLocalStorageValue(STORAGE.worldMuted, next ? "on" : "off"); }}>{muted ? "효과음 켜기" : "효과음 끄기"}</button><p className="world-note">내 반응은 분석 수치에 영향을 주지 않습니다. 기본 무음.</p><CleanFilterToggle /></section>{menu}
    </WorldPanel>}
  </div>;
}
